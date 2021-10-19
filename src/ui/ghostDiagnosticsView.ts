import { DecorationOptions, TextEditorDecorationType, window, ExtensionContext, workspace, languages, HoverProvider, Hover, Position, ProviderResult, TextDocument } from 'vscode';
import { Diagnostic, Range } from 'vscode-languageclient';

import { IGhostDiagnosticsParams } from '../language/api/ghostDiagnostics';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { DafnyDocumentFilter, getVsDocumentPath, toVsRange } from '../tools/vscode';

const TextOpacity = '0.4';

function isInsideRange(position: Position, range: Range): boolean {
  return (range.start.line < position.line || range.start.line === position.line && range.start.character <= position.character)
    && (range.end.line > position.line || range.end.line === position.line && range.end.character >= position.character);
}

export default class GhostDiagnosticsView implements HoverProvider {
  private readonly dataByDocument = new Map<string, { diagnostics: IGhostDiagnosticsParams, decoration: TextEditorDecorationType }>();

  private constructor() {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): GhostDiagnosticsView {
    const instance = new GhostDiagnosticsView();
    context.subscriptions.push(
      languages.registerHoverProvider(DafnyDocumentFilter, instance),
      workspace.onDidCloseTextDocument(document => instance.clearGhostDiagnostics(document.uri.toString())),
      languageClient.onGhostDiagnostics(params => instance.updateGhostDiagnostics(params)),
      instance
    );
    return instance;
  }

  public provideHover(document: TextDocument, position: Position): ProviderResult<Hover> {
    const data = this.dataByDocument.get(document.uri.toString());
    if(data == null) {
      return;
    }
    const diagnostic = data.diagnostics.diagnostics
      .find(diagnostic => isInsideRange(position, diagnostic.range));
    if(diagnostic == null) {
      return new Hover([]);
    }
    return new Hover(diagnostic.message, toVsRange(diagnostic.range));
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
    const decoration = GhostDiagnosticsView.createTextEditorDecoration();
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
      range: toVsRange(diagnostic.range)
    };
  }

  private static createTextEditorDecoration(): TextEditorDecorationType {
    return window.createTextEditorDecorationType({
      opacity: TextOpacity
    });
  }

  public dispose(): void {
    for(const [ _, { decoration } ] of this.dataByDocument) {
      decoration.dispose();
    }
  }
}