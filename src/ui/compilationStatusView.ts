import { StatusBarAlignment, StatusBarItem, TextDocument, Uri, window as Window, workspace as Workspace, ExtensionContext } from 'vscode';
import { DocumentUri } from 'vscode-languageserver-protocol';

import { LanguageConstants } from '../constants';
import { CompilationStatus, ICompilationStatusParams, IVerificationCompletedParams, IVerificationStartedParams } from '../language/api/compilationStatus';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { Messages } from './messages';

const StatusBarPriority = 10;

const COMPILATION_STATUS_MESSAGE_MAPPINGS = {
  [CompilationStatus.ParsingFailed]: Messages.CompilationStatus.ParsingFailed,
  [CompilationStatus.ResolutionFailed]: Messages.CompilationStatus.ResolutionFailed,
  [CompilationStatus.CompilationSucceeded]: Messages.CompilationStatus.CompilationSucceeded,
  [CompilationStatus.VerificationStarted]: Messages.CompilationStatus.Verifying,
  [CompilationStatus.VerificationSucceeded]: Messages.CompilationStatus.VerificationSucceeded,
  [CompilationStatus.VerificationFailed]: Messages.CompilationStatus.VerificationFailed
};

function getVsDocumentPath(params: { uri: DocumentUri }): string {
  return Uri.parse(params.uri).toString();
}

export default class CompilationStatusView {
  // We store the message string for easer backwards compatibility with the
  // legacy status messages.
  private readonly documentStatusMessages = new Map<string, string>();

  private constructor(private readonly statusBarItem: StatusBarItem) {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): CompilationStatusView {
    const statusBarItem = Window.createStatusBarItem(StatusBarAlignment.Left, StatusBarPriority);
    const view = new CompilationStatusView(statusBarItem);
    context.subscriptions.push(
      languageClient.onCompilationStatus(params => view.compilationStatusChanged(params)),
      languageClient.onVerificationStarted(params => view.verificationStarted(params)),
      languageClient.onVerificationCompleted(params => view.verificationCompleted(params)),
      Workspace.onDidCloseTextDocument(document => view.documentClosed(document)),
      Workspace.onDidChangeTextDocument(() => view.updateActiveDocumentStatus()),
      Window.onDidChangeActiveTextEditor(() => view.updateActiveDocumentStatus()),
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
      COMPILATION_STATUS_MESSAGE_MAPPINGS[params.status]
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
    const editor = Window.activeTextEditor;
    if(editor == null) {
      return;
    }
    const document = editor.document;
    this.statusBarItem.text = this.getStatusBarText(document);
    if(document.languageId === LanguageConstants.Id) {
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }
}