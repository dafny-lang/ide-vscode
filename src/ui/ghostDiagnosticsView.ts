import { DecorationOptions, window, ExtensionContext, workspace, DecorationRenderOptions, TextEditor } from 'vscode';
import { Diagnostic } from 'vscode-languageclient';

import { IGhostDiagnosticsParams } from '../language/api/ghostDiagnostics';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath, toVsRange } from '../tools/vscode';

const GhostDecoration: DecorationRenderOptions = {
  dark: {
    backgroundColor: '#64646480'
  },
  light: {
    backgroundColor: '#79797980'
  }
};

export default class GhostDiagnosticsView {
  private readonly dataByDocument = new Map<string, Diagnostic[]>();
  private readonly decoration = window.createTextEditorDecorationType(GhostDecoration);

  private constructor() {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): GhostDiagnosticsView {
    const instance = new GhostDiagnosticsView();
    context.subscriptions.push(
      workspace.onDidCloseTextDocument(document => instance.clearGhostDiagnostics(document.uri.toString())),
      window.onDidChangeActiveTextEditor(editor => instance.handleEditorChange(editor)),
      languageClient.onGhostDiagnostics(params => instance.updateGhostDiagnostics(params)),
      instance
    );
    return instance;
  }

  private updateGhostDiagnostics(params: IGhostDiagnosticsParams): void {
    const documentPath = getVsDocumentPath(params);
    this.clearGhostDiagnostics(documentPath);
    const diagnostics = params.diagnostics;
    if(diagnostics.length === 0) {
      return;
    }
    this.dataByDocument.set(documentPath, diagnostics);
    this.refreshDisplayedGhostDiagnostics(window.activeTextEditor);
  }

  private handleEditorChange(editor?: TextEditor): void {
    if(editor == null) {
      return;
    }
    this.refreshDisplayedGhostDiagnostics(editor);
  }

  private refreshDisplayedGhostDiagnostics(editor?: TextEditor): void {
    if(editor == null) {
      return;
    }
    const documentPath = editor.document.uri.toString();
    const data = this.dataByDocument.get(documentPath);
    if(data == null) {
      return;
    }
    const decorators = data.map(diagnostic => GhostDiagnosticsView.createDecorator(diagnostic));
    editor.setDecorations(this.decoration, decorators);
  }

  private clearGhostDiagnostics(documentPath: string): void {
    this.dataByDocument.delete(documentPath);
  }

  private static createDecorator(diagnostic: Diagnostic): DecorationOptions {
    return {
      range: toVsRange(diagnostic.range),
      hoverMessage: diagnostic.message
    };
  }

  public dispose(): void {
    this.decoration.dispose();
  }
}