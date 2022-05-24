import { window, ExtensionContext, workspace, DecorationRenderOptions, TextEditor, Range, Diagnostic, Uri } from 'vscode';

import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath } from '../tools/vscode';

const RelatedErrorDecoration: DecorationRenderOptions = {
  dark: {
    textDecoration: 'underline wavy red 1px'
  },
  light: {
    textDecoration: 'underline wavy red 1px'
  }
};

interface IRelatedErrorView {
  ranges: Range[];
}

export default class RelatedErrorView {
  private readonly relatedViewByDocument = new Map<string, IRelatedErrorView>();
  private readonly errorDecoration = window.createTextEditorDecorationType(RelatedErrorDecoration);

  private constructor() {}

  public static instance: RelatedErrorView;

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): RelatedErrorView {
    RelatedErrorView.instance = new RelatedErrorView();
    context.subscriptions.push(
      workspace.onDidCloseTextDocument(document => RelatedErrorView.instance.clearRelatedErrors(document.uri.toString())),
      window.onDidChangeActiveTextEditor(editor => RelatedErrorView.instance.refreshRelatedErrors(editor)),
      RelatedErrorView.instance
    );
    languageClient.onPublishDiagnostics((uri: Uri, diagnostics: Diagnostic[]) => {
      RelatedErrorView.instance.updateRelatedErrors(uri, diagnostics);
    });
    return RelatedErrorView.instance;
  }
  public updateRelatedErrors(uri: Uri, diagnostics: Diagnostic[]): void {
    const documentPath = getVsDocumentPath({ uri: uri.toString() });
    const relatedErrorView: IRelatedErrorView = {
      ranges: diagnostics.flatMap(diagnostic =>
        diagnostic.relatedInformation == null || diagnostic.relatedInformation.length === 0
        || !diagnostic.message.startsWith('A postcondition might not hold')
          ? []
          : [ diagnostic.relatedInformation[0].location.range ])
    };
    this.relatedViewByDocument.set(documentPath, relatedErrorView);
    this.refreshRelatedErrors(window.activeTextEditor);
  }
  public refreshRelatedErrors(editor?: TextEditor): void {
    if(editor == null) {
      return;
    }
    const documentPath = editor.document.uri.toString();
    const relatedViewErrors = this.relatedViewByDocument.get(documentPath);
    if(relatedViewErrors == null) {
      return;
    }
    const decorators = relatedViewErrors.ranges;
    editor.setDecorations(this.errorDecoration, decorators);
  }
  public clearRelatedErrors(documentPath: string): void {
    this.relatedViewByDocument.delete(documentPath);
  }
  public dispose(): void {
    this.errorDecoration.dispose();
  }
}
