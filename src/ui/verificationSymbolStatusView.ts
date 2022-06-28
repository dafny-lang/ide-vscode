/* eslint-disable max-depth */
import { commands, ExtensionContext, workspace, tests, Range, Position, Uri, TestRunRequest, TestController, TextDocumentChangeEvent, TestRun, DocumentSymbol, TestItem, TestItemCollection, TextDocument, TestRunProfileKind } from 'vscode';
import { Range as lspRange, Position as lspPosition } from 'vscode-languageclient';
import { IVerificationSymbolStatusParams, PublishedVerificationStatus } from '../language/api/verificationSymbolStatusParams';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';

class FileState {
  public constructor(public readonly controller: TestController, public run: TestRun | undefined) {}
}

export default class VerificationSymbolStatusView {

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): VerificationSymbolStatusView {
    const instance = new VerificationSymbolStatusView(context, languageClient);
    workspace.onDidChangeTextDocument(e => instance.documentChanged(e));
    context.subscriptions.push(
      languageClient.onVerificationSymbolStatus(params => instance.update(params))
    );
    return instance;
  }

  private constructor(
    private readonly context: ExtensionContext,
    private readonly languageClient: DafnyLanguageClient) {
  }

  private readonly projectStates: Map<string, FileState> = new Map();

  private documentChanged(e: TextDocumentChangeEvent) {
    const fileState = this.projectStates.get(e.document.uri.toString());
    if(fileState) {
      if(fileState.run) {
        fileState.run.end();
        fileState.run = undefined;
      }
    }
  }

  // TODO this doesn't work yet with multiple files.

  private createController(uriString: string): FileState {
    const controller = tests.createTestController('verificationStatus', 'Verification Status');
    controller.createRunProfile('Verify', TestRunProfileKind.Run, async (request, cancellationToken) => {
      const items: TestItem[] = this.getItemsInRun(request, controller);
      const projectState = this.projectStates.get(uriString)!;
      // if(projectState.run) {
      //   throw new Error('run already busy');
      // }

      const runningItems: TestItem[] = [];
      const runs = items.map(item => this.languageClient.runVerification({ position: item.range!.start, textDocument: { uri: uriString } }));
      for(const index in runs) {
        const success = await runs[index];
        if(success) {
          runningItems.push(items[index]);
        }
      }
      if(runningItems.length) {
        projectState.run = projectState.controller.createTestRun(new TestRunRequest(runningItems));
      }

      cancellationToken.onCancellationRequested(() => {
        for(const item of items) {
          this.languageClient.cancelVerification({ position: item.range!.start, textDocument: { uri: uriString } });
        }
      });
    }, true);
    const result = new FileState(controller, undefined);
    this.projectStates.set(uriString, result);
    return result;
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
    const projectState = this.projectStates.get(uri.toString()) ?? this.createController(params.uri);
    const controller = projectState.controller;

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

    if(!projectState.run) {
      console.log('new run');
      projectState.run = projectState.controller.createTestRun(new TestRunRequest(items));
    }

    const run = projectState.run;
    let stillRunning = false;
    params.namedVerifiables.forEach((element, index) => {
      const testItem = items[index];
      switch(element.status) {
      case PublishedVerificationStatus.Stale: run.skipped(testItem);
        console.log(`stale ${index}`);
        break;
      case PublishedVerificationStatus.Error: run.failed(testItem, []);
        console.log(`failed ${index}`);
        break;
      case PublishedVerificationStatus.Correct: run.passed(testItem);
        console.log(`correct ${index}`);
        break;
      case PublishedVerificationStatus.Running: run.started(testItem);
        console.log(`running ${index}`);
        stillRunning = true;
        break;
      case PublishedVerificationStatus.Queued: run.enqueued(testItem);
        console.log(`queued ${index}`);
        stillRunning = true;
        break;
      }
    });
    if(!stillRunning) {
      console.log('ending run');
      run.end();
      projectState.run = undefined;
    }
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