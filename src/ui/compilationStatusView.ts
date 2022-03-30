import { StatusBarAlignment, StatusBarItem, TextDocument, window, workspace, ExtensionContext } from 'vscode';

import { CompilationStatus, ICompilationStatusParams, IVerificationCompletedParams, IVerificationStartedParams } from '../language/api/compilationStatus';
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

interface IDocumentStatusMessage {
  status: string;
  version?: number;
}

export default class CompilationStatusView {
  // We store the message string for easier backwards compatibility with the
  // legacy status messages.
  private readonly documentStatusMessages = new Map<string, IDocumentStatusMessage>();

  private constructor(private readonly statusBarItem: StatusBarItem) {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): CompilationStatusView {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, StatusBarPriority);
    const view = new CompilationStatusView(statusBarItem);
    context.subscriptions.push(
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

  private documentClosed(document: TextDocument): void {
    this.documentStatusMessages.delete(document.uri.toString());
    this.updateActiveDocumentStatus();
  }

  private areParamsOutdated(params: ICompilationStatusParams): boolean {
    const previous = this.documentStatusMessages.get(getVsDocumentPath(params));
    return previous?.version != null && params.version != null
       && previous.version > params.version;
  }

  private compilationStatusChanged(params: ICompilationStatusParams): void {
    if(this.areParamsOutdated(params)) {
      return;
    }
    this.documentStatusMessages.set(
      getVsDocumentPath(params),
      {
        status: toStatusMessage(params.status, params.message),
        version: params.version
      }
    );
    this.updateActiveDocumentStatus();
  }

  // Legacy methods
  private verificationStarted(params: IVerificationStartedParams): void {
    this.documentStatusMessages.set(
      getVsDocumentPath(params),
      { status: Messages.CompilationStatus.Verifying }
    );
    this.updateActiveDocumentStatus();
  }

  private verificationCompleted(params: IVerificationCompletedParams): void {
    this.documentStatusMessages.set(
      getVsDocumentPath(params),
      { status: params.verified ? Messages.CompilationStatus.Verified : Messages.CompilationStatus.NotVerified }
    );
    this.updateActiveDocumentStatus();
  }

  private updateActiveDocumentStatus(): void {
    const document = window.activeTextEditor?.document.uri.toString();
    if(document == null) {
      return;
    }
    this.statusBarItem.text = this.documentStatusMessages.get(document)?.status ?? '';
  }
}
