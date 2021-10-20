import { DecorationOptions, TextEditorDecorationType, window, ExtensionContext, workspace, DecorationRenderOptions } from 'vscode';
import { Diagnostic } from 'vscode-languageclient';

import { IGhostDiagnosticsParams } from '../language/api/ghostDiagnostics';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath, toVsRange } from '../tools/vscode';

const GhostDecoration: DecorationRenderOptions = {
  dark: {
    backgroundColor: '#545454'
  },
  light: {
    backgroundColor: '#d4d4d4'
  }
};

export default class GhostDiagnosticsView {
  private readonly dataByDocument = new Map<string, { diagnostics: IGhostDiagnosticsParams, decoration: TextEditorDecorationType }>();

  private constructor() {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): GhostDiagnosticsView {
    const instance = new GhostDiagnosticsView();
    context.subscriptions.push(
      workspace.onDidCloseTextDocument(document => instance.clearGhostDiagnostics(document.uri.toString())),
      languageClient.onGhostDiagnostics(params => instance.updateGhostDiagnostics(params)),
      instance
    );
    return instance;
  }

  private updateGhostDiagnostics(diagnostics: IGhostDiagnosticsParams): void {
    const documentPath = getVsDocumentPath(diagnostics);
    this.clearGhostDiagnostics(documentPath);
    if(diagnostics.diagnostics.length === 0) {
      return;
    }
    const editor = window.activeTextEditor;
    if(editor == null || editor.document.uri.toString() !== documentPath) {
      return;
    }
    const decorators = diagnostics.diagnostics.map(diagnostic => GhostDiagnosticsView.createDecorator(diagnostic));
    const decoration = window.createTextEditorDecorationType(GhostDecoration);
    editor.setDecorations(decoration, decorators);
    this.dataByDocument.set(documentPath, { diagnostics, decoration });
  }

  private clearGhostDiagnostics(documentPath: string): void {
    const data = this.dataByDocument.get(documentPath);
    if(data != null) {
      data.decoration.dispose();
      this.dataByDocument.delete(documentPath);
    }
  }

  private static createDecorator(diagnostic: Diagnostic): DecorationOptions {
    return {
      range: toVsRange(diagnostic.range),
      hoverMessage: diagnostic.message
    };
  }

  public dispose(): void {
    for(const [ _, { decoration } ] of this.dataByDocument) {
      decoration.dispose();
    }
  }
}