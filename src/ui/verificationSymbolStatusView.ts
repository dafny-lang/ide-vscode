/* eslint-disable max-depth */
import { commands, ExtensionContext, workspace, tests, Range, Position, Uri, TestRunRequest, TestController, TextDocumentChangeEvent, TestRun, DocumentSymbol, TestItem, TestItemCollection, TestMessage } from 'vscode';
import { Range as lspRange, Position as lspPosition } from 'vscode-languageclient';
import { IVerificationSymbolStatusParams, PublishedVerificationStatus } from '../language/api/verificationSymbolStatusParams';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';

class FileState {
  public constructor(public readonly controller: TestController, public run: TestRun | undefined) {}
}

export default class VerificationSymbolStatusView {

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): VerificationSymbolStatusView {
    const instance = new VerificationSymbolStatusView(context);
    workspace.onDidChangeTextDocument(e => instance.documentChanged(e));
    context.subscriptions.push(
      languageClient.onVerificationSymbolStatus(params => instance.update(params))
    );
    return instance;
  }

  private constructor(private readonly context: ExtensionContext) {
  }

  private readonly fileStates: Map<string, FileState> = new Map();

  private documentChanged(e: TextDocumentChangeEvent) {
    const fileState = this.fileStates.get(e.document.uri.toString());
    if(fileState) {
      if(fileState.run) {
        fileState.run.end();
        fileState.run = undefined;
      }
    }
  }

  private createController(params: IVerificationSymbolStatusParams): FileState {
    const controller = tests.createTestController('verificationStatus', 'Verification Status');
    const uri = Uri.parse(params.uri);
    const result = new FileState(controller, undefined);
    this.fileStates.set(uri.toString(), result);
    return result;
  }

  private async update(params: IVerificationSymbolStatusParams): Promise<void> {
    const uri = Uri.parse(params.uri);
    const fileState = this.fileStates.get(uri.toString()) ?? this.createController(params);
    const controller = fileState.controller;

    const rootSymbols = await commands.executeCommand('vscode.executeDocumentSymbolProvider', uri) as DocumentSymbol[];
    const itemMapping: Map<DocumentSymbol, TestItem> = new Map();

    function updateMapping(parentChildren: TestItemCollection, symbols: DocumentSymbol[], range: Range): TestItem | undefined {
      for(const symbol of symbols) {
        if(symbol.range.contains(range)) {
          let item = itemMapping.get(symbol);
          if(!item) {
            const nameText = document.getText(symbol.selectionRange);
            item = controller.createTestItem(JSON.stringify(symbol.selectionRange), nameText, uri);
            item.range = range;
            itemMapping.set(symbol, item);
            parentChildren.add(item);
          }
          return updateMapping(item.children, symbol.children, range) ?? item;
        }
      }
      return undefined;
    }

    const document = await workspace.openTextDocument(uri.fsPath);
    fileState.controller.items.replace([]);
    const items = params.namedVerifiables.map(element => {
      const vscodeRange = VerificationSymbolStatusView.convertRange(element.nameRange);
      return updateMapping(fileState.controller.items, rootSymbols, vscodeRange)!;
    });

    if(!fileState.run) {
      console.log('new run');
      fileState.run = fileState.controller.createTestRun(new TestRunRequest(items));
    }

    const run = fileState.run;
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
    }
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