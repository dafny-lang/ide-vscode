import { window, ExtensionContext, workspace, DecorationRenderOptions, TextEditor, Range } from 'vscode';
import { Diagnostic } from 'vscode-languageclient';

import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath, toVsRange } from '../tools/vscode';

const RelatedErrorDecoration: DecorationRenderOptions = {
  dark: {
    backgroundColor: '#FF0000',
    color: '#FFFFFF'
  },
  light: {
    backgroundColor: '#FF0000',
    color: '#FFFFFF'
  }
};

interface IRelatedErrorView {
  ranges: Range[];
}

interface IPublishDiagnosticsParams {
  uri: string;
  diagnostics: Diagnostic[];
}

export default class RelatedErrorView {
  private readonly relatedViewByDocument = new Map<string, IRelatedErrorView>();
  private readonly errorDecoration = window.createTextEditorDecorationType(RelatedErrorDecoration);

  private constructor() {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): RelatedErrorView {
    const instance = new RelatedErrorView();
    context.subscriptions.push(
      workspace.onDidCloseTextDocument(document => instance.clearRelatedErrors(document.uri.toString())),
      window.onDidChangeActiveTextEditor(editor => instance.refreshRelatedErrors(editor)),
      languageClient.onNotification('textDocument/publishDiagnostics', (params: IPublishDiagnosticsParams) => {
        instance.updateRelatedErrors(params);
        return params;
      }),
      instance
    );
    return instance;
  }
  public updateRelatedErrors(params: IPublishDiagnosticsParams): void {
    const uri = params.uri;
    const documentPath = getVsDocumentPath(params);
    const relatedErrorView: IRelatedErrorView = {
      ranges: params.diagnostics.flatMap(diagnostic =>
        diagnostic.relatedInformation == null
          ? []
          : diagnostic.relatedInformation.flatMap(relatedInformation =>
            ((relatedInformation as any).isError as boolean)
              && relatedInformation.location.uri === uri
              ? [ toVsRange(relatedInformation.location.range) ]
              : [])
      )
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