/* eslint-disable max-depth */
import { commands, ExtensionContext, workspace, tests, Range, Position, Uri,
  TestRunRequest, TestController, TestRun, DocumentSymbol, TestItem, TestItemCollection, TextDocument, TestRunProfileKind, window,
  Event, EventEmitter } from 'vscode';
import { Range as lspRange, Position as lspPosition } from 'vscode-languageclient';
import { IVerificationSymbolStatusParams, PublishedVerificationStatus } from '../language/api/verificationSymbolStatusParams';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import CompilationStatusView from './compilationStatusView';

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
  return new VerificationSymbolStatusView(context, languageClient, compilationStatusView);
}

/**
 * This class shows verification tasks through the VSCode testing UI.
 */
export default class VerificationSymbolStatusView {

  public static createAndRegister(
    context: ExtensionContext,
    languageClient: DafnyLanguageClient,
    compilationStatusView: CompilationStatusView): VerificationSymbolStatusView {
    return new VerificationSymbolStatusView(context, languageClient, compilationStatusView);
  }

  private itemStates: Map<string, PublishedVerificationStatus> = new Map();
  private itemRuns: Map<string, ItemRunState> = new Map();
  private readonly runItemsLeft: Map<TestRun, number> = new Map();
  private readonly updateListenersPerFile: Map<string, ResolveablePromise<Range[]>> = new Map();
  private readonly updatesPerFile: Map<string, IVerificationSymbolStatusParams> = new Map();
  private readonly controller: TestController;
  private automaticRunEnd: boolean = false;
  private noRunCreationInProgress: Promise<void> = Promise.resolve();
  private readonly _onUpdates: EventEmitter<Uri> = new EventEmitter();
  public onUpdates: Event<Uri> = this._onUpdates.event;

  public constructor(
    private readonly context: ExtensionContext,
    private readonly languageClient: DafnyLanguageClient,
    private readonly compilationStatusView: CompilationStatusView) {
    this.controller = this.createController();
    context.subscriptions.push(this.controller);

    window.onDidChangeActiveTextEditor(e => {
      if(e !== undefined) {
        const lastUpdate = this.updatesPerFile.get(e.document.uri.toString());
        if(lastUpdate !== undefined) {
          this.update(lastUpdate);
        }
      }
    }, this, context.subscriptions);
    workspace.onDidChangeTextDocument(e => {
      console.log('document updated to', e.document.version);
      const uriString = e.document.uri.toString();
      this.updateListenersPerFile.delete(uriString);
      this.updatesPerFile.delete(uriString);
    }, this, context.subscriptions);
    workspace.onDidCloseTextDocument(e => {
      const uriString = e.uri.toString();
      this.updatesPerFile.delete(uriString);
    }, this, context.subscriptions);
    context.subscriptions.push(
      languageClient.onVerificationSymbolStatus(params => this.update(params)),
      languageClient.onCompilationStatus(params => compilationStatusView.compilationStatusChangedForBefore38(params))
    );
    window.onDidChangeActiveTextEditor(e => {
      if(e !== undefined) {
        const lastUpdate = this.updatesPerFile.get(e.document.uri.toString());
        if(lastUpdate === undefined) {
          this.controller.items.replace([]);
        } else {
          this.update(lastUpdate);
        }
      }
    });
  }

  public getUpdatesForFile(uri: string): IVerificationSymbolStatusParams | undefined {
    return this.updatesPerFile.get(uri);
  }

  private createController(): TestController {
    const controller = tests.createTestController('verificationStatus', 'Verification Status');
    controller.createRunProfile('Verify', TestRunProfileKind.Run, async (request) => {
      const items: TestItem[] = this.getItemsInRun(request, controller);
      const runningItems: TestItem[] = [];
      let outerResolve: () => void;
      await this.noRunCreationInProgress;
      try {
        this.noRunCreationInProgress = new Promise((resolve) => {
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
      } finally {
        outerResolve!();
      }
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
    await this.noRunCreationInProgress;
    const uri = Uri.parse(params.uri);
    params.uri = uri.toString();
    const document = await workspace.openTextDocument(uri);
    const rootSymbols = await commands.executeCommand('vscode.executeDocumentSymbolProvider', uri) as DocumentSymbol[] | undefined;

    // After this check we may no longer use awaits, because they allow the document to be updated and then our update becomes outdated.
    if(params.version !== document.version) {
      return;
    }
    this.updateForSpecificDocumentVersion(params, document, rootSymbols);
  }

  private updateForSpecificDocumentVersion(params: IVerificationSymbolStatusParams,
    document: TextDocument,
    rootSymbols: DocumentSymbol[] | undefined) {

    this.updatesPerFile.set(params.uri, params);
    this._onUpdates.fire(document.uri);
    if(window.activeTextEditor?.document.uri.toString() !== params.uri.toString()) {
      return;
    }
    this.compilationStatusView.updateStatusBar(params);
    const controller = this.controller;
    let leafItems: TestItem[];
    if(rootSymbols !== undefined) {
      leafItems = this.updateUsingSymbols(params, document, controller, rootSymbols);
    } else {
      leafItems = params.namedVerifiables.map(f => VerificationSymbolStatusView.getItem(document,
        VerificationSymbolStatusView.convertRange(f.nameRange), controller, document.uri));
      controller.items.replace(leafItems);
    }
    const allTestItems: TestItem[] = [];
    function collectTestItems(collection: TestItemCollection) {
      collection.forEach(item => {
        allTestItems.push(item);
        collectTestItems(item.children);
      });
    }
    collectTestItems(controller.items);
    this.getVerifiableRangesPromise(params.uri).resolve(allTestItems.map(v => v.range!));

    const runningItemsWithoutRun = params.namedVerifiables.
      map((element, index) => {
        return { verifiable: element, testItem: leafItems[index] };
      }).
      filter(({ verifiable, testItem }) => {
        return this.itemStates.get(testItem.id) !== verifiable.status
          && (this.itemRuns.get(testItem.id) === undefined
            || this.itemRuns.get(testItem.id)?.run.token.isCancellationRequested);
      }).map(r => r.testItem);
    if(runningItemsWithoutRun.length > 0) {
      this.createRun(runningItemsWithoutRun);
    }

    const newItemRuns = new Map();
    params.namedVerifiables.forEach((element, index) => {
      const testItem = leafItems[index];
      const itemRunState = this.itemRuns.get(testItem.id)!;
      if(this.itemStates.get(testItem.id) === element.status) {
        const isRunning = itemRunState !== undefined;
        if(isRunning) {
          newItemRuns.set(testItem.id, itemRunState);
        }
        return;
      }
      const { run, startedRunningTime } = itemRunState;

      const itemFinished = () => {
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
        itemFinished();
        break;
      }
      case PublishedVerificationStatus.Error:
        run.failed(testItem, [], getDuration());
        itemFinished();
        break;
      case PublishedVerificationStatus.Correct:
        run.passed(testItem, getDuration());
        itemFinished();
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
    this.itemStates = new Map(params.namedVerifiables.map((v, index) => [ leafItems[index].id, v.status ]));
    for(const [ id, oldItem ] of this.itemRuns.entries()) {
      if(!newItemRuns.has(id)) {
        oldItem.run.end();
      }
    }
    this.itemRuns = newItemRuns;
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
            item = VerificationSymbolStatusView.getItem(document, itemRange, controller, uri);
            itemMapping.set(symbol, item);
          }
          if(symbol.selectionRange.isEqual(leafRange)) {
            return item;
          } else {
            return updateMapping(symbol.children, leafRange);
          }
        }
      }
      console.error(`Could not find a symbol to map to item ${JSON.stringify(leafRange)}. Item won't be visible in symbol tree.`);
      return VerificationSymbolStatusView.getItem(document, leafRange, controller, uri);
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

    return items;
  }

  private static getItem(document: TextDocument, itemRange: Range, controller: TestController, uri: Uri) {
    const nameText = document.getText(itemRange);
    const item = controller.createTestItem(uri.toString() + JSON.stringify(itemRange), nameText, uri);
    item.range = itemRange;
    return item;
  }


  public static convertRange(range: lspRange): Range {
    return new Range(
      VerificationSymbolStatusView.convertPosition(range.start),
      VerificationSymbolStatusView.convertPosition(range.end));
  }

  private static convertPosition(position: lspPosition): Position {
    return new Position(position.line, position.character);
  }

  public getVerifiableRanges(uriString: string): Promise<Range[]> {
    return this.getVerifiableRangesPromise(uriString).promise;
  }

  private getVerifiableRangesPromise(uriString: string): ResolveablePromise<Range[]> {
    let listener = this.updateListenersPerFile.get(uriString);
    if(listener === undefined) {
      let storedResolve: (value: Range[]) => void;
      const promise = new Promise<Range[]>((resolve) => {
        storedResolve = resolve;
      });
      listener = { resolve: storedResolve!, promise };
      this.updateListenersPerFile.set(uriString, listener);
    }
    return listener;
  }
}