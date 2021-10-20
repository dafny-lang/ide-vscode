import { DecorationOptions, TextEditorDecorationType, window, ExtensionContext, workspace, DecorationRenderOptions, TextEditor } from 'vscode';
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
  private readonly dataByDocument = new Map<string, { diagnostics: Diagnostic[], decoration: TextEditorDecorationType }>();

  private constructor() {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): GhostDiagnosticsView {
    const instance = new GhostDiagnosticsView();
    context.subscriptions.push(
      workspace.onDidCloseTextDocument(document => instance.clearGhostDiagnostics(document.uri.toString())),
      window.onDidChangeActiveTextEditor(editor => instance.refreshDisplayedGhostDiagnostics(editor)),
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
    const decoration = window.createTextEditorDecorationType(GhostDecoration);
    this.dataByDocument.set(documentPath, { diagnostics, decoration });
    this.refreshDisplayedGhostDiagnostics(window.activeTextEditor);
  }

  public refreshDisplayedGhostDiagnostics(editor?: TextEditor): void {
    if(editor == null) {
      return;
    }
    const documentPath = editor.document.uri.toString();
    const data = this.dataByDocument.get(documentPath);
    if(data == null) {
      return;
    }
    const decorators = data.diagnostics.map(diagnostic => this.createDecorator(diagnostic));
    editor.setDecorations(data.decoration, decorators);
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