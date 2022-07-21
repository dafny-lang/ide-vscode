/* eslint-disable max-depth */
import { commands, ExtensionContext, workspace, tests, Range, Position, Uri, TestRunRequest, TestController, TestRun, DocumentSymbol, TestItem, TestItemCollection, TextDocument, TestRunProfileKind } from 'vscode';
import { Range as lspRange, Position as lspPosition } from 'vscode-languageclient';
import { IVerificationSymbolStatusParams, PublishedVerificationStatus } from '../language/api/verificationSymbolStatusParams';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';

export default class VerificationSymbolStatusView {

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): VerificationSymbolStatusView {
    const instance = new VerificationSymbolStatusView(context, languageClient);
    context.subscriptions.push(
      languageClient.onVerificationSymbolStatus(params => instance.update(params))
    );
    return instance;
  }

  private constructor(
    private readonly context: ExtensionContext,
    private readonly languageClient: DafnyLanguageClient) {
    this.controller = this.createController();
  }

  private readonly itemRuns: Map<string, TestRun> = new Map();
  private readonly controller: TestController;

  // TODO this doesn't work yet with multiple files.

  private createController(): TestController {
    const controller = tests.createTestController('verificationStatus', 'Verification Status');
    controller.createRunProfile('Verify', TestRunProfileKind.Run, async (request, cancellationToken) => {
      const items: TestItem[] = this.getItemsInRun(request, controller);
      const runningItems: TestItem[] = [];
      const runs = items.map(item => this.languageClient.runVerification({ position: item.range!.start, textDocument: { uri: item.uri!.toString() } }));
      for(const index in runs) {
        const success = await runs[index];
        console.log(`Run call for ${items[index].label} returned ${success}`);
        if(success) {
          runningItems.push(items[index]);
        }
      }

      cancellationToken.onCancellationRequested(() => {
        for(const item of items) {
          this.languageClient.cancelVerification({ position: item.range!.start, textDocument: { uri: item.uri!.toString() } });
        }
      });
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

  private async update(params: IVerificationSymbolStatusParams): Promise<void> {
    const uri = Uri.parse(params.uri);
    const controller = this.controller;

    const rootSymbols = await commands.executeCommand('vscode.executeDocumentSymbolProvider', uri) as DocumentSymbol[];
    let items: TestItem[];
    const document = await workspace.openTextDocument(uri.fsPath);
    if(rootSymbols !== undefined) {

      items = this.updateUsingSymbols(params, document, controller, rootSymbols);
    } else {
      console.log('No document symbols found');
      items = params.namedVerifiables.map(f => VerificationSymbolStatusView.getItem(document,
        VerificationSymbolStatusView.convertRange(f.nameRange), controller, uri));
    }

    params.namedVerifiables.forEach((element, index) => {
      const testItem = items[index];
      let run = this.itemRuns.get(testItem.id);

      if(run === undefined) {
        run = this.controller.createTestRun(new TestRunRequest([ testItem ]));
        console.log('Created run.');
        this.itemRuns.set(testItem.id, run);
      }
      switch(element.status) {
      case PublishedVerificationStatus.Stale:
        run.skipped(testItem);
        console.log(`Update state for ${testItem.label} to stale`);
        run.end();
        this.itemRuns.delete(testItem.id);
        break;
      case PublishedVerificationStatus.Error:
        run.failed(testItem, []);
        console.log(`Update state for ${testItem.label} to failed`);
        run.end();
        this.itemRuns.delete(testItem.id);
        break;
      case PublishedVerificationStatus.Correct:
        run.passed(testItem);
        console.log(`Update state for ${testItem.label} to correct`);
        run.end();
        this.itemRuns.delete(testItem.id);
        break;
      case PublishedVerificationStatus.Running:
        run.started(testItem);
        console.log(`Update state for ${testItem.label} to running`);
        break;
      case PublishedVerificationStatus.Queued:
        run.enqueued(testItem);
        console.log(`Update state for ${testItem.label} to queued`);
        break;
      }
    });
  }

  private updateUsingSymbols(params: IVerificationSymbolStatusParams, document: TextDocument,
    controller: TestController, rootSymbols: DocumentSymbol[]): TestItem[] {

    const itemMapping: Map<DocumentSymbol, TestItem> = new Map();
    const uri = Uri.parse(params.uri);

    function updateMapping(symbols: DocumentSymbol[], range: Range): TestItem | undefined {
      for(const symbol of symbols) {
        if(symbol.range.contains(range)) {
          let item = itemMapping.get(symbol);
          if(!item) {
            const itemRange = symbol.selectionRange;
            item = VerificationSymbolStatusView.getItem(document, itemRange, controller, uri);
            itemMapping.set(symbol, item);
          }
          return updateMapping(symbol.children, range) ?? item;
        }
      }
      return undefined;
    }

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