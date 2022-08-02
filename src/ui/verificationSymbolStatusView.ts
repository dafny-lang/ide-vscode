/* eslint-disable max-depth */
import { commands, ExtensionContext, workspace, tests, Range, Position, Uri, TestRunRequest, TestController, TestRun, DocumentSymbol, TestItem, TestItemCollection, TextDocument, TestRunProfileKind, window } from 'vscode';
import { Range as lspRange, Position as lspPosition } from 'vscode-languageclient';
import { IVerificationSymbolStatusParams, PublishedVerificationStatus } from '../language/api/verificationSymbolStatusParams';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import CompilationStatusView from './compilationStatusView';
import { Messages } from './messages';

interface ResolveablePromise<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

interface ItemRunState {
  run: TestRun;
  startedRunningTime?: number;
}

export function createAndRegister(
  context: ExtensionContext,
  languageClient: DafnyLanguageClient,
  compilationStatusView: CompilationStatusView): VerificationSymbolStatusView {
  const instance = new VerificationSymbolStatusView(context, languageClient, compilationStatusView);
  return instance;
}

/**
 * This class shows verification tasks through the VSCode testing UI.
 */
export default class VerificationSymbolStatusView {

  public getFirstStatusForCurrentVersion(uriString: string): Promise<TestItem[]> {
    return this.getItemsFilePromise(uriString).promise;
  }

  public static createAndRegister(
    context: ExtensionContext,
    languageClient: DafnyLanguageClient,
    compilationStatusView: CompilationStatusView): VerificationSymbolStatusView {
    const instance = new VerificationSymbolStatusView(context, languageClient, compilationStatusView);
    window.onDidChangeActiveTextEditor(e => {
      if(e !== undefined) {
        const lastUpdate = instance.updatesPerFile.get(e.document.uri.toString());
        if(lastUpdate !== undefined) {
          instance.update(lastUpdate);
        }
      }
    });
    workspace.onDidChangeTextDocument(e => {
      const uriString = e.document.uri.toString();
      instance.updatesPerFile.delete(uriString);
      instance.updateListenersPerFile.delete(uriString);
    });
    context.subscriptions.push(
      languageClient.onVerificationSymbolStatus(params => instance.update(params)),
      languageClient.onCompilationStatus(params => compilationStatusView.compilationStatusChangedForBefore38(params))
    );
    return instance;
  }

  private getItemsFilePromise(uriString: string): ResolveablePromise<TestItem[]> {
    let listener = this.updateListenersPerFile.get(uriString);
    if(listener === undefined) {
      let storedResolve: (value: TestItem[]) => void;
      const promise = new Promise<TestItem[]>((resolve) => {
        storedResolve = resolve;
      });
      listener = { resolve: storedResolve!, promise };
      this.updateListenersPerFile.set(uriString, listener);
    }
    return listener;
  }

  public constructor(
    private readonly context: ExtensionContext,
    private readonly languageClient: DafnyLanguageClient,
    private readonly compilationStatusView: CompilationStatusView) {
    this.controller = this.createController();
    context.subscriptions.push(this.controller);

    workspace.onDidChangeTextDocument(e => {
      const uriString = e.document.uri.toString();
      this.updateListenersPerFile.delete(uriString);
    });
    workspace.onDidCloseTextDocument(e => {
      const uriString = e.uri.toString();
      this.updatesPerFile.delete(uriString);
    });
    context.subscriptions.push(
      languageClient.onVerificationSymbolStatus(params => this.update(params))
    );

    window.onDidChangeActiveTextEditor(e => {
      if(e !== undefined) {
        const lastUpdate = this.updatesPerFile.get(e.document.uri.toString());
        if(lastUpdate !== undefined) {
          this.update(lastUpdate);
        }
      }
    });
  }

  private itemStates: Map<string, PublishedVerificationStatus> = new Map();
  private itemRuns: Map<string, ItemRunState> = new Map();
  private readonly runItemsLeft: Map<TestRun, number> = new Map();
  private readonly updateListenersPerFile: Map<string, ResolveablePromise<TestItem[]>> = new Map();
  private readonly updatesPerFile: Map<string, IVerificationSymbolStatusParams> = new Map();
  private readonly controller: TestController;
  private automaticRunEnd: boolean = false;
  private processUpdateLock: Promise<void> = Promise.resolve();

  private createController(): TestController {
    const controller = tests.createTestController('verificationStatus', 'Verification Status');
    controller.createRunProfile('Verify', TestRunProfileKind.Run, async (request) => {
      const items: TestItem[] = this.getItemsInRun(request, controller);
      const runningItems: TestItem[] = [];
      let outerResolve: () => void;
      await this.processUpdateLock;
      this.processUpdateLock = new Promise((resolve) => {
        outerResolve = resolve;
      });

      const runs = items.map(item => this.languageClient.runVerification({ position: item.range!.start, textDocument: { uri: item.uri!.toString() } }));
      for(const index in runs) {
        const success = await runs[index];
        if(success) {
          runningItems.push(items[index]);
        }
      }

      if(runningItems.length > 0) {
        this.createRun(runningItems);
      }
      outerResolve!();
    }, true);
    return controller;
  }

  private getItemsInRun(run: TestRunRequest, controller: TestController): TestItem[] {
    const allItems: TestItem[] = [];
    controller.items.forEach(item => allItems.push(item));
    const result: TestItem[] = [];
    const todo = run.include ? [ ...run.include ] : allItems;
    const excludes = run.exclude ? new Set(run.exclude) : new Set<TestItem>();
    while(todo.length > 0) {
      const current = todo.pop()!;
      if(excludes.has(current)) {
        continue;
      }

      current.children.forEach(child => {
        todo.push(child);
      });
      if(current.children.size === 0) {
        result.push(current);
      }
    }
    return result;
  }

  private createRun(items: TestItem[]): TestRun {
    const run = this.controller.createTestRun(new TestRunRequest(items));
    for(const item of items) {
      this.itemRuns.set(item.id, { run });
    }
    run.token.onCancellationRequested(() => {
      if(!this.automaticRunEnd) {
        for(const item of items) {
          this.languageClient.cancelVerification({ position: item.range!.start, textDocument: { uri: item.uri!.toString() } });
        }
      }
    });
    this.runItemsLeft.set(run, items.length);
    return run;
  }

  private async update(params: IVerificationSymbolStatusParams): Promise<void> {
    await this.processUpdateLock;

    this.updateStatusBar(params);
    this.updatesPerFile.set(params.uri, params);
    const uri = Uri.parse(params.uri);
    const controller = this.controller;
    const rootSymbols: DocumentSymbol[] = await commands.executeCommand('vscode.executeDocumentSymbolProvider', uri) as DocumentSymbol[];
    let items: TestItem[];
    const document = await workspace.openTextDocument(uri);
    if(rootSymbols !== undefined) {
      items = this.updateUsingSymbols(params, document, controller, rootSymbols);
    } else {
      items = params.namedVerifiables.map(f => this.getItem(document,
        VerificationSymbolStatusView.convertRange(f.nameRange), controller, uri));
      controller.items.replace(items);
      this.getItemsFilePromise(params.uri).resolve(items);
    }

    const runningItemsWithoutRun = params.namedVerifiables.
      map((element, index) => {
        return { verifiable: element, testItem: items[index] };
      }).
      filter(({ verifiable, testItem }) => {
        return this.itemStates.get(testItem.id) !== verifiable.status && this.itemRuns.get(testItem.id) === undefined;
      }).map(r => r.testItem);
    if(runningItemsWithoutRun.length > 0) {
      this.createRun(runningItemsWithoutRun);
    }

    const newItemRuns = new Map();
    params.namedVerifiables.forEach((element, index) => {
      const testItem = items[index];
      const itemRunState = this.itemRuns.get(testItem.id)!;
      if(this.itemStates.get(testItem.id) === element.status) {
        const isRunning = itemRunState !== undefined;
        if(isRunning) {
          newItemRuns.set(testItem.id, itemRunState);
        }
        return;
      }
      const { run, startedRunningTime } = itemRunState;

      const endRun = () => {
        const remaining = this.runItemsLeft.get(run)! - 1;
        this.itemRuns.delete(testItem.id);
        if(remaining === 0) {
          this.runItemsLeft.delete(run);
          this.automaticRunEnd = true;
          run.end();
          this.automaticRunEnd = false;
        } else {
          this.runItemsLeft.set(run, remaining);
        }
      };
      const getDuration = () => startedRunningTime === undefined ? undefined : Date.now() - startedRunningTime;
      switch(element.status) {
      case PublishedVerificationStatus.Stale: {
        run.skipped(testItem);
        endRun();
        break;
      }
      case PublishedVerificationStatus.Error:
        run.failed(testItem, [], getDuration());
        endRun();
        break;
      case PublishedVerificationStatus.Correct:
        run.passed(testItem, getDuration());
        endRun();
        break;
      case PublishedVerificationStatus.Running:
        run.started(testItem);
        newItemRuns.set(testItem.id, { run, startedRunningTime: Date.now() });
        break;
      case PublishedVerificationStatus.Queued:
        run.enqueued(testItem);
        newItemRuns.set(testItem.id, itemRunState);
        break;
      }
    });
    this.itemStates = new Map(params.namedVerifiables.map((v, index) => [ items[index].id, v.status ]));
    for(const [ id, oldItem ] of this.itemRuns.entries()) {
      if(!newItemRuns.has(id)) {
        oldItem.run.end();
      }
    }
    this.itemRuns = newItemRuns;
  }

  private async updateStatusBar(params: IVerificationSymbolStatusParams) {
    const completed = params.namedVerifiables.filter(v => v.status >= PublishedVerificationStatus.Error).length;
    const running = params.namedVerifiables.filter(v => v.status === PublishedVerificationStatus.Running);
    const total = params.namedVerifiables.length;
    let message: string;
    if(running.length > 0) {
      const document = await workspace.openTextDocument(Uri.parse(params.uri));
      const verifying = running.map(item => document.getText(VerificationSymbolStatusView.convertRange(item.nameRange))).join(', ');
      message = `$(sync~spin) Verified ${completed}/${total}, verifying ${verifying}`;
    } else {
      const skipped = params.namedVerifiables.filter(v => v.status === PublishedVerificationStatus.Stale).length;
      const errors = params.namedVerifiables.filter(v => v.status === PublishedVerificationStatus.Error).length;
      const succeeded = completed - errors;

      if(errors === 0) {
        if(skipped === 0) {
          message = Messages.CompilationStatus.VerificationSucceeded;
        } else {
          message = `Verified ${succeeded} declarations, skipped ${skipped}`;
        }
      } else {
        message = `${Messages.CompilationStatus.VerificationFailed} ${errors} declarations`;
      }
    }
    this.compilationStatusView.setDocumentStatusMessage(params.uri.toString(), message, params.version);
  }

  private updateUsingSymbols(params: IVerificationSymbolStatusParams, document: TextDocument,
    controller: TestController, rootSymbols: DocumentSymbol[]): TestItem[] {

    const itemMapping: Map<DocumentSymbol, TestItem> = new Map();
    const uri = Uri.parse(params.uri);

    const updateMapping = (symbols: DocumentSymbol[], leafRange: Range): TestItem | undefined => {
      for(const symbol of symbols) {
        if(symbol.range.contains(leafRange)) {
          let item = itemMapping.get(symbol);
          if(!item) {
            const itemRange = symbol.selectionRange;
            item = this.getItem(document, itemRange, controller, uri);
            itemMapping.set(symbol, item);
          }
          return updateMapping(symbol.children, leafRange) ?? item;
        }
      }
      return undefined;
    };

    const items = params.namedVerifiables.map(element => {
      const vscodeRange = VerificationSymbolStatusView.convertRange(element.nameRange);
      return updateMapping(rootSymbols, vscodeRange)!;
    });

    replaceChildren(rootSymbols, controller.items);
    for(const [ symbol, item ] of itemMapping.entries()) {
      replaceChildren(symbol.children, item.children);
    }

    function replaceChildren(childSymbols: DocumentSymbol[], childCollection: TestItemCollection) {
      const newChildren = childSymbols.flatMap(child => {
        const childItem = itemMapping.get(child);
        return childItem ? [ childItem ] : [];
      });
      childCollection.replace(newChildren);
    }

    this.getItemsFilePromise(params.uri).resolve([ ...itemMapping.values() ]);
    return items;
  }

  private getItem(document: TextDocument, itemRange: Range, controller: TestController, uri: Uri) {
    const nameText = document.getText(itemRange);
    const item = controller.createTestItem(JSON.stringify(itemRange), nameText, uri);
    item.range = itemRange;
    return item;
  }

  private static convertRange(range: lspRange): Range {
    return new Range(
      VerificationSymbolStatusView.convertPosition(range.start),
      VerificationSymbolStatusView.convertPosition(range.end));
  }

  private static convertPosition(position: lspPosition): Position {
    return new Position(position.line, position.character);
  }
}