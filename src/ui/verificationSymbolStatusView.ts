/* eslint-disable max-depth */
import { ExtensionContext, workspace, tests, Range, Position, Uri, TestRunRequest, TestMessage, TestController, TextDocumentChangeEvent, TestRun } from 'vscode';
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

  private async createController(params: IVerificationSymbolStatusParams): Promise<FileState> {
    const controller = tests.createTestController('verificationStatus', 'Verification Status');
    const uri = Uri.parse(params.uri);
    const document = await workspace.openTextDocument(uri.fsPath);
    params.namedVerifiables.forEach(element => {
      const vscodeRange = VerificationSymbolStatusView.convertRange(element.nameRange);
      const nameText = document.getText(vscodeRange);
      const testItem = controller.createTestItem(JSON.stringify(element.nameRange), nameText, Uri.parse(params.uri));
      testItem.range = vscodeRange;
      controller.items.add(testItem);
    });
    const result = new FileState(controller, undefined);
    this.fileStates.set(uri.toString(), result);
    return result;
  }

  private async update(params: IVerificationSymbolStatusParams): Promise<void> {
    const uri = Uri.parse(params.uri);
    const fileState = this.fileStates.get(uri.toString()) ?? await this.createController(params);

    if(!fileState.run) {
      const items = params.namedVerifiables.map(f => fileState.controller.items.get(JSON.stringify(f.nameRange))!);
      console.log("new run");
      fileState.run = fileState.controller.createTestRun(new TestRunRequest(items));
    }
    const run = fileState.run;
    let stillRunning = false;
    params.namedVerifiables.forEach((element, index) => {
      const testItem = fileState.controller.items.get(JSON.stringify(element.nameRange))!;
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
      console.log("ending run");
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