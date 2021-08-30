import { StatusBarAlignment, StatusBarItem, TextDocument, Uri, window as Window, workspace as Workspace } from 'vscode';
import { Disposable } from 'vscode-languageclient';
import { LanguageConstants } from '../constants';

import { CompilationStatus, ICompilationStatusParams } from '../language/api/compilationStatus';
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

export default class CompilationStatusView implements Disposable {
  // TODO legacy verification status for dafny <=3.2
  private readonly documentStatuses = new Map<string, CompilationStatus>();

  private eventRegistrations: Disposable[] = [];

  private constructor(private readonly statusBarItem: StatusBarItem) {}

  public static createAndRegister(languageClient: DafnyLanguageClient): CompilationStatusView {
    const view = new CompilationStatusView(
      Window.createStatusBarItem(StatusBarAlignment.Left, StatusBarPriority)
    );
    view.eventRegistrations = [
      languageClient.onCompilationStatus(params => view.updateCompilationStatus(params)),
      Workspace.onDidCloseTextDocument(document => view.documentClosed(document)),
      Workspace.onDidChangeTextDocument(() => view.updateActiveDocumentStatus()),
      Window.onDidChangeActiveTextEditor(() => view.updateActiveDocumentStatus())
    ];
    return view;
  }

  private documentClosed(document: TextDocument): void {
    this.documentStatuses.delete(document.uri.toString());
    this.updateActiveDocumentStatus();
  }

  private getStatusBarText(document: TextDocument): string {
    const status = this.documentStatuses.get(document.uri.toString());
    if(status == null) {
      return '';
    }
    return COMPILATION_STATUS_MESSAGE_MAPPINGS[status];
  }

  private updateCompilationStatus(params: ICompilationStatusParams): void {
    this.documentStatuses.set(Uri.parse(params.uri).toString(), params.status);
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

  dispose(): void {
    this.statusBarItem.dispose();
    for(const registration of this.eventRegistrations) {
      registration.dispose();
    }
  }
}