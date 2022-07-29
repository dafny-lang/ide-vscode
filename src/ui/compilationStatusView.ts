import { StatusBarAlignment, StatusBarItem, TextDocument, window, workspace, commands, ExtensionContext } from 'vscode';
import { CompilationStatus, ICompilationStatusParams, IVerificationCompletedParams, IVerificationStartedParams } from '../language/api/compilationStatus';
import { DafnyCommands } from '../commands';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath } from '../tools/vscode';
import { enableOnlyForDafnyDocuments } from '../tools/visibility';
import { Messages } from './messages';
import StatusBarActionView from './statusBarActionView';

const StatusBarPriority = 10;

function toStatusMessage(status: CompilationStatus, message?: string | null): string {
  switch(status) {
  case CompilationStatus.ResolutionStarted:
    return Messages.CompilationStatus.ResolutionStarted;
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
    return message != null
      ? `${Messages.CompilationStatus.VerificationFailed} ${message}`
      : `${Messages.CompilationStatus.VerificationFailed}`;
  }
}

interface IDocumentStatusMessage {
  message: string;
  version?: number;
}

export default class CompilationStatusView {
  // We store the message string for easier backwards compatibility with the
  // legacy status messages.
  private readonly documentStatusMessages = new Map<string, IDocumentStatusMessage>();

  private constructor(private readonly statusBarItem: StatusBarItem,
    private readonly languageClient: DafnyLanguageClient,
    private readonly context: ExtensionContext) {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient, languageServerVersion: string): CompilationStatusView {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, StatusBarPriority);
    statusBarItem.command = DafnyCommands.OpenStatusBarMenu;
    const view = new CompilationStatusView(statusBarItem, languageClient, context);
    const statusBarActionView = new StatusBarActionView(view, languageServerVersion, context);
    context.subscriptions.push(
      commands.registerCommand(DafnyCommands.OpenStatusBarMenu, () => statusBarActionView.openStatusBarMenu()),
      workspace.onDidCloseTextDocument(document => view.documentClosed(document)),
      workspace.onDidChangeTextDocument(() => view.updateActiveDocumentStatus()),
      window.onDidChangeActiveTextEditor(() => view.updateActiveDocumentStatus()),
      enableOnlyForDafnyDocuments(statusBarItem),
      statusBarItem
    );
    return view;
  }

  public registerBefore38Messages(): void {
    this.context.subscriptions.push(
      this.languageClient.onCompilationStatus(params => this.compilationStatusChanged(params)),
      this.languageClient.onVerificationStarted(params => this.verificationStarted(params)),
      this.languageClient.onVerificationCompleted(params => this.verificationCompleted(params))
    );
  }

  // Not used from 3.8
  private verificationStarted(params: IVerificationStartedParams): void {
    this.documentStatusMessages.set(
      getVsDocumentPath(params),
      { message: Messages.CompilationStatus.Verifying }
    );
    this.updateActiveDocumentStatus();
  }

  // Not used from 3.8
  private verificationCompleted(params: IVerificationCompletedParams): void {
    this.documentStatusMessages.set(
      getVsDocumentPath(params),
      { message: params.verified ? Messages.CompilationStatus.Verified : Messages.CompilationStatus.NotVerified }
    );
    this.updateActiveDocumentStatus();
  }

  private documentClosed(document: TextDocument): void {
    this.documentStatusMessages.delete(document.uri.toString());
    this.updateActiveDocumentStatus();
  }

  public areParamsOutdated(params: ICompilationStatusParams): boolean {
    const previous = this.documentStatusMessages.get(getVsDocumentPath(params));
    return previous?.version != null && params.version != null
       && previous.version > params.version;
  }



  private static readonly handledMessages = new Set([
    CompilationStatus.ResolutionStarted,
    CompilationStatus.ParsingFailed,
    CompilationStatus.ResolutionFailed,
    CompilationStatus.CompilationSucceeded ]);

  public compilationStatusChanged38(params: ICompilationStatusParams): void {
    if(this.areParamsOutdated(params)) {
      return;
    }
    if(CompilationStatusView.handledMessages.has(params.status)) {
      this.setDocumentStatusMessage(
        getVsDocumentPath(params),
        toStatusMessage(params.status),
        params.version);
    }
  }

  private compilationStatusChanged(params: ICompilationStatusParams): void {
    if(this.areParamsOutdated(params)) {
      return;
    }
    this.setDocumentStatusMessage(
      getVsDocumentPath(params),
      toStatusMessage(params.status),
      params.version);
  }

  public setDocumentStatusMessage(uriString: string, message: string, version: number | undefined): void {
    this.documentStatusMessages.set(
      uriString,
      {
        message,
        version
      }
    );
    this.updateActiveDocumentStatus();
  }

  private updateActiveDocumentStatus(): void {
    const documentStatus = this.getCurrentDocumentStatus();
    if(documentStatus == null) {
      return;
    }
    this.statusBarItem.text = documentStatus;
  }

  public getCurrentDocumentStatus(): string | undefined {
    const document = window.activeTextEditor?.document.uri.toString();
    if(document == null) {
      return;
    }
    return this.documentStatusMessages.get(document)?.message ?? '';
  }
}
