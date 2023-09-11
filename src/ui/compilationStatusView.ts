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

  public static createAndRegister(context: ExtensionContext,
    languageClient: DafnyLanguageClient,
    useOnVerificationSymbolStatus: boolean,
    languageServerVersion: string): CompilationStatusView {
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

    if(useOnVerificationSymbolStatus) {
      context.subscriptions.push(
        languageClient.OnVerificationSymbolStatus(params => {
          view.showVerifiableRangesInStatusBar(params);
        }),
        languageClient.onCompilationStatus(params => view.compilationStatusChangedAfter38(params))
      );
    } else {
      view.registerBefore38Messages();
    }
    return view;
  }

  public registerBefore38Messages(): void {
    this.context.subscriptions.push(
      this.languageClient.onCompilationStatus(params => this.compilationStatusChanged(params)),
      this.languageClient.onVerificationStarted(params => this.verificationStarted(params)),
      this.languageClient.onVerificationCompleted(params => this.verificationCompleted(params))
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
    CompilationStatus.ResolutionSucceeded,
    CompilationStatus.PreparingVerification,
    CompilationStatus.CompilationSucceeded ]);

  public compilationStatusChangedAfter38(params: ICompilationStatusParams): void {
    if(this.areParamsOutdated(params)) {
      return;
    }
    if(params.status === CompilationStatus.ResolutionSucceeded) {
      const verifiableRangeMessage = this.verifiableRangeMessages.get(params.uri);
      if(verifiableRangeMessage === undefined) {
        // If we have not yet received verification symbols, then pretend we're still resolving.
        this.compilationStatusChangedAfter38({ ...params, status: CompilationStatus.Resolving });
      } else {
        this.setDocumentStatusMessage(
          getVsDocumentPath(params),
          verifiableRangeMessage,
          params.version);
      }
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

  private readonly verifiableRangeMessages = new Map<string, string>();
  public async showVerifiableRangesInStatusBar(params: IVerificationSymbolStatusParams): Promise<void> {
    const uri = Uri.parse(params.uri);

    const document = await workspace.openTextDocument(uri);
    const statuses = params.namedVerifiables;
    const completed = statuses.filter(v => v.status >= PublishedVerificationStatus.Error).length;
    const queued = statuses.filter(v => v.status === PublishedVerificationStatus.Queued);
    const running = statuses.filter(v => v.status === PublishedVerificationStatus.Running);
    const total = statuses.length;
    let message: string;
    if(running.length > 0 || queued.length > 0) {
      const verifying = running.map(item => document.getText(VerificationSymbolStatusView.convertRange(item.nameRange))).join(', ');
      message = `$(sync~spin) Verified ${completed}/${total}`;
      if(running.length > 0) {
        message += `, verifying ${verifying}`;
      } else {
        message += ', preparing verification';
      }
    } else {
      const skipped = statuses.filter(v => v.status === PublishedVerificationStatus.Stale).length;
      const errors = statuses.filter(v => v.status === PublishedVerificationStatus.Error);
      const errorCount = errors.length;
      const succeeded = completed - errorCount;

      if(errorCount === 0) {
        if(skipped === 0) {
          message = Messages.CompilationStatus.VerificationSucceeded;
        } else {
          message = `Verified ${succeeded} declarations, skipped ${skipped}`;
        }
      } else {
        const object = errorCount > 1
          ? `${errorCount} declarations`
          : (document.getText(VerificationSymbolStatusView.convertRange(errors[0].nameRange)) ?? 'a declaration');
        message = `${Messages.CompilationStatus.VerificationFailed} ${object}`;
      }
    }
    this.verifiableRangeMessages.set(uri.toString(), message);
    this.setDocumentStatusMessage(uri.toString(), message, document.version);
  }
}
