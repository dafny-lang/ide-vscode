import { StatusBarAlignment, StatusBarItem, TextDocument, Uri, window, workspace, ExtensionContext } from 'vscode';
import { DocumentUri } from 'vscode-languageserver-protocol';

import { CompilationStatus, ICompilationStatusParams, IVerificationCompletedParams, IVerificationStartedParams } from '../language/api/compilationStatus';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { enableOnlyForDafnyDocuments } from '../tools/visibility';
import { Messages } from './messages';

const StatusBarPriority = 10;

function getVsDocumentPath(params: { uri: DocumentUri }): string {
  return Uri.parse(params.uri).toString();
}

function toStatusMessage(status: CompilationStatus): string {
  switch(status) {
  case CompilationStatus.ParsingFailed:
    return Messages.CompilationStatus.ParsingFailed;
  case CompilationStatus.ResolutionFailed:
    return Messages.CompilationStatus.ResolutionFailed;
  case CompilationStatus.CompilationSucceeded:
    return Messages.CompilationStatus.CompilationSucceeded;
  case CompilationStatus.VerificationStarted:
    return Messages.CompilationStatus.Verifying;
  case CompilationStatus.VerificationSucceeded:
    return Messages.CompilationStatus.VerificationSucceeded;
  case CompilationStatus.VerificationFailed:
    return Messages.CompilationStatus.VerificationFailed;
  default:
    throw unhandledStatusMessage(status);
  }
}

function unhandledStatusMessage(status: never): Error {
  return new Error(`unknown status message: ${status}`);
}

export default class CompilationStatusView {
  // We store the message string for easier backwards compatibility with the
  // legacy status messages.
  private readonly documentStatusMessages = new Map<string, string>();

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

  private getStatusBarText(document: TextDocument): string {
    const status = this.documentStatusMessages.get(document.uri.toString());
    if(status == null) {
      return '';
    }
    return status;
  }

  private compilationStatusChanged(params: ICompilationStatusParams): void {
    this.documentStatusMessages.set(
      getVsDocumentPath(params),
      toStatusMessage(params.status)
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
    const document = window.activeTextEditor?.document;
    if(document == null) {
      return;
    }
    this.statusBarItem.text = this.getStatusBarText(document);
  }
}