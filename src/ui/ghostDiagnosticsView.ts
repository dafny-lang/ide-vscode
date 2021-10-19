import { DecorationOptions, TextEditorDecorationType, window, ExtensionContext, workspace } from 'vscode';
import { Diagnostic } from 'vscode-languageclient';

import { IGhostDiagnosticsParams } from '../language/api/ghostDiagnostics';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath, toVsRange } from '../tools/languageClient';

const DarkBackgroundColor = '#706f6c';
const LightBackgroundColor = DarkBackgroundColor;

export default class GhostDiagnosticsView {
  private readonly activeDecorations = new Map<string, TextEditorDecorationType>();

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

  private updateGhostDiagnostics(params: IGhostDiagnosticsParams): void {
    const documentPath = getVsDocumentPath(params);
    this.clearGhostDiagnostics(documentPath);
    if(params.diagnostics.length === 0) {
      return;
    }
    const editor = window.activeTextEditor;
    if(editor == null || editor.document.uri.toString() !== documentPath) {
      return;
    }
    const decorators = params.diagnostics.map(diagnostic => GhostDiagnosticsView.createDecorator(diagnostic));
    const decoration = GhostDiagnosticsView.createTextEditorDecoration();
    this.activeDecorations.set(documentPath, decoration);
    editor.setDecorations(decoration, decorators);
  }

  private clearGhostDiagnostics(documentPath: string): void {
    const oldDecoration = this.activeDecorations.get(documentPath);
    if(oldDecoration != null) {
      oldDecoration.dispose();
      this.activeDecorations.delete(documentPath);
    }
  }

  private static createDecorator(diagnostic: Diagnostic): DecorationOptions {
    return {
      range: toVsRange(diagnostic.range)
    };
  }

  private static createTextEditorDecoration(): TextEditorDecorationType {
    return window.createTextEditorDecorationType({
      dark:{
        backgroundColor: DarkBackgroundColor
      },
      light: {
        backgroundColor: LightBackgroundColor
      }
    });
  }

  public dispose(): void {
    for(const [ _, decoration ] of this.activeDecorations) {
      decoration.dispose();
    }
  }
}