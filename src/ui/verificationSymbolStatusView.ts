/* eslint-disable max-depth */
import { commands, ExtensionContext, workspace, Event, tests, Range, Position, Uri, TestRunRequest, TestController, TestRun, DocumentSymbol, TestItem, TestItemCollection, TextDocument, TestRunProfileKind, EventEmitter } from 'vscode';
import { Range as lspRange, Position as lspPosition } from 'vscode-languageclient';
import { IVerificationSymbolStatusParams, NamedVerifiableStatus, PublishedVerificationStatus } from '../language/api/verificationSymbolStatusParams';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';

class ResolveablePromise<T> {
  private _resolve: (value: T) => void = () => {};
  private readonly _promise: Promise<T>;

  public constructor() {
    this._promise = new Promise<T>((innerResolve) => {
      this._resolve = innerResolve;
    });
  }

  public resolve(value: T): void {
    this._resolve(value);
  }

  public get promise() {
    return this._promise;
  }
}

interface ItemRunState {
  run: TestRun;
  startedRunningTime?: number;
}

/**
 * This class shows verification tasks through the VSCode testing UI.
 */
export default class VerificationSymbolStatusView {

  public static createAndRegister(
    context: ExtensionContext,
    languageClient: DafnyLanguageClient): VerificationSymbolStatusView {
    return new VerificationSymbolStatusView(context, languageClient);
  }

  private itemStates: Map<string, PublishedVerificationStatus> = new Map();
  private itemRuns: Map<string, ItemRunState> = new Map();
  private readonly runItemsLeft: Map<TestRun, number> = new Map();
  private readonly controller: TestController;
  private automaticRunEnd: boolean = false;
  private noRunCreationInProgress: Promise<void> = Promise.resolve();
  private readonly _onUpdates: EventEmitter<Uri> = new EventEmitter();
  public onUpdates: Event<Uri> = this._onUpdates.event;

  public constructor(
    private readonly context: ExtensionContext,
    private readonly languageClient: DafnyLanguageClient) {
    this.controller = this.createController();
    context.subscriptions.push(this.controller);

    context.subscriptions.push(
      languageClient.onVerificationSymbolStatus(params => {
        this.update(params);
      })
    );
  }


  private createController(): TestController {
    const controller = tests.createTestController('verificationStatus', 'Verification Status');
    controller.createRunProfile('Verify', TestRunProfileKind.Run, async (request) => {
      const items: TestItem[] = this.getItemsInRun(request, controller);
      const runningItems: TestItem[] = [];
      await this.noRunCreationInProgress;
      const noRunCreationInProgress = new ResolveablePromise<void>();
      this.noRunCreationInProgress = noRunCreationInProgress.promise;
      try {

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
        noRunCreationInProgress.resolve!();
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
    await this.noRunCreationInProgress;
    params.uri = uri.toString();
    const document = await workspace.openTextDocument(uri);
    const rootSymbols = await commands.executeCommand('vscode.executeDocumentSymbolProvider', uri) as DocumentSymbol[] | undefined;
    // After this check we may no longer use awaits, because they allow the document to be updated and then our update becomes outdated.
    if((params.version ?? 1) !== document.version) {
      return;
    }
    this.updateForSpecificDocumentVersion(params, document, rootSymbols);
  }

  private clearItemsForUri(uri: Uri) {
    const nonUriItems: TestItem[] = [];
    this.controller.items.forEach(item => {
      if(item.uri !== uri) {
        nonUriItems.push(item);
      }
    });
    this.controller.items.replace(nonUriItems);
  }
  private updateForSpecificDocumentVersion(params: IVerificationSymbolStatusParams,
    document: TextDocument,
    rootSymbols: DocumentSymbol[] | undefined) {

    const controller = this.controller;

    this.clearItemsForUri(document.uri);

    let leafItems: TestItem[];
    if(rootSymbols !== undefined) {
      leafItems = this.updateUsingSymbols(params, controller, rootSymbols);
    } else {
      leafItems = params.namedVerifiables.map(f => {
        const vscodeRange = VerificationSymbolStatusView.convertRange(f.nameRange);
        return VerificationSymbolStatusView.getItem(document.getText(vscodeRange), vscodeRange, controller, document.uri);
      });
      for(const leafItem of leafItems) {
        controller.items.add(leafItem);
      }
    }
    this._onUpdates.fire(document.uri);

    const allTestItems: TestItem[] = [];
    function collectTestItems(collection: TestItemCollection) {
      collection.forEach(item => {
        allTestItems.push(item);
        collectTestItems(item.children);
      });
    }
    collectTestItems(controller.items);

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
      this.leafStatuses.set(testItem.id, element.status);

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

  private updateUsingSymbols(params: IVerificationSymbolStatusParams,
    controller: TestController, rootSymbols: DocumentSymbol[]): TestItem[] {

    const itemMapping: Map<DocumentSymbol, TestItem> = new Map();
    const uri = Uri.parse(params.uri);

    const updateMapping = (symbols: DocumentSymbol[], leafRange: Range): TestItem | undefined => {
      for(const symbol of symbols) {
        if(symbol.range.contains(leafRange)) {
          let item = itemMapping.get(symbol);
          if(!item) {
            const itemRange = symbol.selectionRange;
            item = VerificationSymbolStatusView.getItem(symbol.name, itemRange, controller, uri);
            itemMapping.set(symbol, item);
          }
          if(symbol.selectionRange.isEqual(leafRange)) {
            return item;
          } else {
            return updateMapping(symbol.children, leafRange);
          }
        }
      }
      const nameFromRange = JSON.stringify(leafRange);
      console.error(`Could not find a symbol to map to item ${nameFromRange}. Item won't be visible in symbol tree.`);
      return VerificationSymbolStatusView.getItem(nameFromRange, leafRange, controller, uri);
    };

    const items = params.namedVerifiables.map(element => {
      const vscodeRange = VerificationSymbolStatusView.convertRange(element.nameRange);
      return updateMapping(rootSymbols, vscodeRange)!;
    });

    const newRoots = rootSymbols.flatMap(child => {
      const childItem = itemMapping.get(child);
      return childItem ? [ childItem ] : [];
    });
    for(const newRoot of newRoots) {
      controller.items.add(newRoot);
    }
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

  private static getItem(name: string, itemRange: Range, controller: TestController, uri: Uri) {
    const id = uri.toString() + JSON.stringify(itemRange);
    const item = controller.createTestItem(id, name, uri);
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

  private readonly leafStatuses: Map<string, PublishedVerificationStatus> = new Map();

  public getVerifiableRangesForUri(uri: Uri): NamedVerifiableStatus[] {
    const stack: TestItemCollection[] = [ this.controller.items ];
    const ranges: NamedVerifiableStatus[] = [];
    while(stack.length !== 0) {
      const top = stack.pop()!;
      top.forEach(child => {
        if(child.uri?.toString() === uri.toString()) {
          const status = this.leafStatuses.get(child.id);
          if(child.range !== undefined && status !== undefined) {
            ranges.push({ nameRange: child.range, status: status });
          }
          stack.push(child.children);
        }
      });
    }
    return ranges;
  }
}