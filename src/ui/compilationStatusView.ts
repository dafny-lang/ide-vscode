import { StatusBarAlignment, StatusBarItem, TextDocument, window, workspace, commands, ExtensionContext } from 'vscode';
import { CompilationStatus, ICompilationStatusParams } from '../language/api/compilationStatus';
import { DafnyCommands } from '../commands';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath } from '../tools/vscode';
import { enableOnlyForDafnyDocuments } from '../tools/visibility';
import { Messages } from './messages';
import StatusBarActionView from './statusBarActionView';

const StatusBarPriority = 10;

function toStatusMessage(status: CompilationStatus): string {
  switch(status) {
  case CompilationStatus.ResolutionStarted:
    return Messages.CompilationStatus.ResolutionStarted;
  case CompilationStatus.ParsingFailed:
    return Messages.CompilationStatus.ParsingFailed;
  case CompilationStatus.ResolutionFailed:
    return Messages.CompilationStatus.ResolutionFailed;
  case CompilationStatus.CompilationSucceeded:
    return Messages.CompilationStatus.CompilationSucceeded;
  default: throw new Error(`Should not handle status message ${status}`);
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

  private constructor(private readonly statusBarItem: StatusBarItem) {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient, languageServerVersion: string): CompilationStatusView {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, StatusBarPriority);
    statusBarItem.command = DafnyCommands.OpenStatusBarMenu;
    const view = new CompilationStatusView(statusBarItem);
    const statusBarActionView = new StatusBarActionView(view, languageServerVersion, context);
    context.subscriptions.push(
      commands.registerCommand(DafnyCommands.OpenStatusBarMenu, () => statusBarActionView.openStatusBarMenu()),
      languageClient.onCompilationStatus(params => view.compilationStatusChanged(params)),
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
    if(params.status < CompilationStatus.VerificationStarted) {
      this.setDocumentStatusMessage(
        getVsDocumentPath(params),
        toStatusMessage(params.status),
        params.version);
    }
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
