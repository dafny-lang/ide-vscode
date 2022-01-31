import { StatusBarAlignment, StatusBarItem, TextDocument, window, workspace, commands, ExtensionContext } from 'vscode';

import { CompilationStatus, ICompilationStatusParams, IVerificationCompletedParams, IVerificationStartedParams } from '../language/api/compilationStatus';
import { restartServer } from '../extension';
import { DafnyCommands } from '../commands';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath } from '../tools/vscode';
import { enableOnlyForDafnyDocuments } from '../tools/visibility';
import { Messages } from './messages';

const StatusBarPriority = 10;

function toStatusMessage(status: CompilationStatus, message?: string | null): string {
  switch(status) {
  case CompilationStatus.ParsingFailed:
    return Messages.CompilationStatus.ParsingFailed;
  case CompilationStatus.ResolutionFailed:
    return Messages.CompilationStatus.ResolutionFailed;
  case CompilationStatus.CompilationSucceeded:
    return Messages.CompilationStatus.CompilationSucceeded;
  case CompilationStatus.VerificationStarted:
    return message != null
      ? `${Messages.CompilationStatus.Verifying} ${message}...`
      : `${Messages.CompilationStatus.Verifying}...`;
  case CompilationStatus.VerificationSucceeded:
    return Messages.CompilationStatus.VerificationSucceeded;
  case CompilationStatus.VerificationFailed:
    return Messages.CompilationStatus.VerificationFailed;
  }
}

interface StatusBarAction {
  label: string;
  description: string;
  command: string;
}

const RestartDafny: StatusBarAction = {
  label: 'Restart Dafny',
  description: 'Terminate the Dafny LSP server, relaunch it, and reverify the current file.',
  command: DafnyCommands.RestartServer
};

export default class CompilationStatusView {
  // We store the message string for easier backwards compatibility with the
  // legacy status messages.
  private readonly documentStatusMessages = new Map<string, string>();

  private constructor(private readonly statusBarItem: StatusBarItem) {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): CompilationStatusView {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, StatusBarPriority);
    statusBarItem.command = DafnyCommands.OpenStatusBarMenu;
    const view = new CompilationStatusView(statusBarItem);
    context.subscriptions.push(
      commands.registerCommand(DafnyCommands.OpenStatusBarMenu, () => view.openStatusBarMenu()),
      commands.registerCommand(DafnyCommands.RestartServer, restartServer),
      languageClient.onCompilationStatus(params => view.compilationStatusChanged(params)),
      languageClient.onVerificationStarted(params => view.verificationStarted(params)),
      languageClient.onVerificationCompleted(params => view.verificationCompleted(params)),
      workspace.onDidCloseTextDocument(document => view.documentClosed(document)),
      workspace.onDidChangeTextDocument(() => view.updateActiveDocumentStatus()),
      window.onDidChangeActiveTextEditor(() => view.updateActiveDocumentStatus()),
      enableOnlyForDafnyDocuments(statusBarItem),
      statusBarItem
    );
    return view;
  }

  private async openStatusBarMenu() {
    const targets: StatusBarAction[] = [
      RestartDafny
    ];
    const target = await window.showQuickPick(targets, {
      matchOnDescription: true,
      placeHolder: 'Pick an action'
    });
    target && commands.executeCommand(target.command);
  }

  private documentClosed(document: TextDocument): void {
    this.documentStatusMessages.delete(document.uri.toString());
    this.updateActiveDocumentStatus();
  }

  private compilationStatusChanged(params: ICompilationStatusParams): void {
    this.documentStatusMessages.set(
      getVsDocumentPath(params),
      toStatusMessage(params.status, params.message)
    );
    this.updateActiveDocumentStatus();
  }

  private verificationStarted(params: IVerificationStartedParams): void {
    this.documentStatusMessages.set(
      getVsDocumentPath(params),
      Messages.CompilationStatus.Verifying
    );
    this.updateActiveDocumentStatus();
  }

  private verificationCompleted(params: IVerificationCompletedParams): void {
    this.documentStatusMessages.set(
      getVsDocumentPath(params),
      params.verified ? Messages.CompilationStatus.Verified : Messages.CompilationStatus.NotVerified
    );
    this.updateActiveDocumentStatus();
  }

  private updateActiveDocumentStatus(): void {
    const document = window.activeTextEditor?.document.uri.toString();
    if(document == null) {
      return;
    }
    this.statusBarItem.text = this.documentStatusMessages.get(document) ?? '';
  }
}
