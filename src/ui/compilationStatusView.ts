import { StatusBarAlignment, StatusBarItem, TextDocument, window, workspace, commands, ExtensionContext, Uri } from 'vscode';
import { CompilationStatus, ICompilationStatusParams, IVerificationCompletedParams, IVerificationStartedParams } from '../language/api/compilationStatus';
import { DafnyCommands } from '../commands';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath } from '../tools/vscode';
import { enableOnlyForDafnyDocuments } from '../tools/visibility';
import { Messages } from './messages';
import StatusBarActionView from './statusBarActionView';
import { IVerificationSymbolStatusParams, PublishedVerificationStatus } from '../language/api/verificationSymbolStatusParams';
import VerificationSymbolStatusView from './verificationSymbolStatusView';

const StatusBarPriority = 10;

function toStatusMessage(status: CompilationStatus | any, message?: string | null): string {
  switch(status) {
  case CompilationStatus.Parsing:
    return Messages.CompilationStatus.Parsing;
  case CompilationStatus.Resolving:
    return Messages.CompilationStatus.Resolving;
  case CompilationStatus.ParsingFailed:
    return Messages.CompilationStatus.ParsingFailed;
  case CompilationStatus.ResolutionFailed:
    return Messages.CompilationStatus.ResolutionFailed;
  case CompilationStatus.PreparingVerification:
    return Messages.CompilationStatus.PreparingVerification;
  case CompilationStatus.CompilationSucceeded:
    return Messages.CompilationStatus.CompilationSucceeded;

  // Backwards compatibility for versions of Dafny <= 3.8.0
  case CompilationStatus.VerificationStarted:
    return message != null
      ? `${Messages.CompilationStatus.Verifying} ${message}...`
      : `${Messages.CompilationStatus.Verifying}...`;
  // Backwards compatibility for versions of Dafny <= 3.8.0
  case CompilationStatus.VerificationSucceeded:
    return Messages.CompilationStatus.VerificationSucceeded;
  // Backwards compatibility for versions of Dafny <= 3.8.0
  case CompilationStatus.VerificationFailed:
    return message != null
      ? `${Messages.CompilationStatus.VerificationFailedOld} ${message}`
      : `${Messages.CompilationStatus.VerificationFailedOld}`;
  }
  return status.toString();
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

  public registerAfter38Messages(): void {
    this.context.subscriptions.push(
      this.languageClient.onCompilationStatus(params => this.compilationStatusChangedForBefore38(params)),
      this.languageClient.onVerificationSymbolStatus(params => this.updateStatusBar(params))
    );
  }

  // Backwards compatibility for versions of Dafny <= 3.8.0
  private verificationStarted(params: IVerificationStartedParams): void {
    this.documentStatusMessages.set(
      getVsDocumentPath(params),
      { message: Messages.CompilationStatus.Verifying }
    );
    this.updateActiveDocumentStatus();
  }

  // Backwards compatibility for versions of Dafny <= 3.8.0
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
    CompilationStatus.Parsing,
    CompilationStatus.Resolving,
    CompilationStatus.ParsingFailed,
    CompilationStatus.ResolutionFailed,
    CompilationStatus.PreparingVerification,
    CompilationStatus.CompilationSucceeded ]);

  public compilationStatusChangedForBefore38(params: ICompilationStatusParams): void {
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

  public async updateStatusBar(params: IVerificationSymbolStatusParams): Promise<void> {
    const completed = params.namedVerifiables.filter(v => v.status >= PublishedVerificationStatus.Error).length;
    const queued = params.namedVerifiables.filter(v => v.status === PublishedVerificationStatus.Queued);
    const running = params.namedVerifiables.filter(v => v.status === PublishedVerificationStatus.Running);
    const total = params.namedVerifiables.length;
    let message: string;
    params.uri = Uri.parse(params.uri).toString();// Makes the Uri canonical
    if(running.length > 0 || queued.length > 0) {
      const document = await workspace.openTextDocument(Uri.parse(params.uri));
      const verifying = running.map(item => document.getText(VerificationSymbolStatusView.convertRange(item.nameRange))).join(', ');
      message = `$(sync~spin) Verified ${completed}/${total}`;
      if(running.length > 0) {
        message += `, verifying ${verifying}`;
      } else {
        message += ', waiting for free solvers';
      }
    } else {
      const skipped = params.namedVerifiables.filter(v => v.status === PublishedVerificationStatus.Stale).length;
      const errors = params.namedVerifiables.filter(v => v.status === PublishedVerificationStatus.Error).length;
      const succeeded = completed - errors;

      if(errors === 0) {
        if(skipped === 0) {
          message = Messages.CompilationStatus.VerificationSucceeded;
        } else {
          message = `Verified ${succeeded} declarations, skipped ${skipped}`;
        }
      } else {
        message = `${Messages.CompilationStatus.VerificationFailed} ${(errors > 1 ? `${errors} declarations` : 'the declaration')}`;
      }
    }
    this.setDocumentStatusMessage(params.uri.toString(), message, params.version);
  }
}
