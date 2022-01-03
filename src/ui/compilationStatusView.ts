import { StatusBarAlignment, StatusBarItem, TextDocument, window, workspace, ExtensionContext } from 'vscode';

import { CompilationStatus, ICompilationStatusParams, IVerificationCompletedParams, IVerificationStartedParams } from '../language/api/compilationStatus';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath } from '../tools/vscode';
import { enableOnlyForDafnyDocuments } from '../tools/visibility';
import { Messages } from './messages';
import { IVerificationIntermediateParams } from '../language/api/verificationIntermediate';
import { ENGINE_METHOD_PKEY_ASN1_METHS } from 'constants';

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
      languageClient.onVerificationIntermediate(params => view.verificationIntermediate(params)),
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

  
  public verificationIntermediate(params: IVerificationIntermediateParams): void {
    var documentVSPath = getVsDocumentPath(params);
    var currentMessage = this.documentStatusMessages.get(documentVSPath)
    if(currentMessage == Messages.CompilationStatus.VerificationFailed ||
       currentMessage == Messages.CompilationStatus.VerificationSucceeded) {
      return;
    }
    var method = params.methodNameBeingVerified;
    if(method.startsWith("_module.")) {
      method= method.substring(8);
    }
    if(method.startsWith("__default.")) {
      method = method.substring(10);
    }
    this.documentStatusMessages.set(
      documentVSPath,
      Messages.CompilationStatus.Verifying + method
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
