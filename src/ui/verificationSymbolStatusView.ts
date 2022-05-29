/* eslint-disable max-depth */
import { ExtensionContext, workspace, tests, Range, Position, Uri, TestRunRequest, TestMessage, TestController } from 'vscode';
import { Range as lspRange, Position as lspPosition } from 'vscode-languageclient';
import { IVerificationSymbolStatusParams, PublishedVerificationStatus } from '../language/api/verificationSymbolStatusParams';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';

export default class VerificationSymbolStatusView {

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): VerificationSymbolStatusView {
    const instance = new VerificationSymbolStatusView(context);
    context.subscriptions.push(
      languageClient.onVerificationSymbolStatus(params => instance.update(params))
    );
    return instance;
  }

  private constructor(private readonly context: ExtensionContext) {
  }

  private controller?: TestController = undefined;

  private async update(params: IVerificationSymbolStatusParams): Promise<void> {
    this.controller?.dispose();
    // if(this.controller) {
    //   return;
    // }
    const controller = tests.createTestController('verificationStatus', 'Verification Status');
    this.controller = controller;
    const fsPath = Uri.parse(params.uri).fsPath;
    const document = await workspace.openTextDocument(fsPath);

    const run = controller.createTestRun(new TestRunRequest());
    let ids = 0;
    let running = false;
    params.namedVerifiables.forEach(element => {
      const vscodeRange = VerificationSymbolStatusView.convertRange(element.nameRange);
      const nameText = document.getText(vscodeRange);
      const testItem = controller.createTestItem((ids++).toString(), nameText, Uri.parse(params.uri));
      testItem.range = vscodeRange;
      controller.items.add(testItem);
      switch(element.status) {
      case PublishedVerificationStatus.Error: run.failed(testItem, new TestMessage('err'));
        break;
      case PublishedVerificationStatus.Correct: run.passed(testItem);
        break;
      case PublishedVerificationStatus.Running: run.started(testItem);
        running = true;
        break;
      case PublishedVerificationStatus.Queued: run.enqueued(testItem);
        break;
      }
    });
    if(!running) {
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