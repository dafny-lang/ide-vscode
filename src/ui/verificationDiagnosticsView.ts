import { DecorationOptions, TextEditorDecorationType, Range, window, ExtensionContext, workspace, DecorationRenderOptions, TextEditor } from 'vscode';
import { Diagnostic } from 'vscode-languageclient';

import { IVerificationDiagnosticsParams } from '../language/api/verificationDiagnostics';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath, toVsRange } from '../tools/vscode';

export default class VerificationDiagnosticsView {
  private errorDecoration: any;
  private errorsRelatedDecoration: any;
  private verifiedDecoration: any;

  private readonly dataByDocument = new Map<string, { errors: Range[], errorsRelated: Range[], verified: Range[]}>();

  private constructor() {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): VerificationDiagnosticsView {
    const instance = new VerificationDiagnosticsView();
    context.subscriptions.push(
      workspace.onDidCloseTextDocument(document => instance.clearVerificationDiagnostics(document.uri.toString())),
      window.onDidChangeActiveTextEditor(editor => instance.refreshDisplayedVerificationDiagnostics(editor)),
      languageClient.onVerificationDiagnostics(params => instance.updateVerificationDiagnostics(params))
    );
    const errorIcon = context.asAbsolutePath("images/errorSource.svg");
    const errorPathIcon = context.asAbsolutePath("images/errorPath.svg");
    const verifiedIcon = context.asAbsolutePath("images/verified.svg");
    var getDecoration = (icon: string) => window.createTextEditorDecorationType({
      isWholeLine: true,
      rangeBehavior: 1,
      gutterIconPath: icon,
    });
    instance.errorDecoration = getDecoration(errorIcon);
    instance.errorsRelatedDecoration = getDecoration(errorPathIcon);
    instance.verifiedDecoration = getDecoration(verifiedIcon);

    return instance;
  }

  public refreshDisplayedVerificationDiagnostics(editor?: TextEditor): void {
    if(editor == null) {
      return;
    }
    const documentPath = editor.document.uri.toString();
    const data = this.dataByDocument.get(documentPath);
    if(data == null) {
      return;
    }
    
    editor.setDecorations(this.verifiedDecoration, data.verified as Range[]);
    editor.setDecorations(this.errorDecoration, data.errors);
    editor.setDecorations(this.errorsRelatedDecoration, data.errorsRelated);
  }

  private clearVerificationDiagnostics(documentPath: string): void {
    const data = this.dataByDocument.get(documentPath);
    if(data != null) {
      //data.decoration.dispose();
      this.dataByDocument.delete(documentPath);
    }
  }

  private getUnverifiedRange(unverified: Range[], errorRange: Range): Range | null {
    for(var i = 0; i < unverified.length; i++) {
      if(this.rangesIntersect(unverified[i], errorRange)) {
          return unverified[i];
      }
    }
    return null;
  }

  private rangesIntersect(range1: Range, range2: Range): boolean {
    return range1.start.line <= range2.end.line && range1.end.line >= range2.start.line;
  }

  private updateVerificationDiagnostics(params: IVerificationDiagnosticsParams): void {
    const documentPath = getVsDocumentPath(params);
    this.clearVerificationDiagnostics(documentPath);
    const diagnostics = params.diagnostics;
    const verified = params.verified as Range[];
    const unverified = params.unverified as Range[];

    var errorsRelated: Range[] = [];
    var errors: Range[] = [];
    for(let diagnostic of diagnostics) {
      let range = diagnostic.range as Range;
      let unverifiedRange = this.getUnverifiedRange(unverified, range);
      var relatedRangesAsErrors: Range[] = [];
      if(unverifiedRange != null && Array.isArray(diagnostic.relatedInformation)) {
        for(let relatedInformation of diagnostic.relatedInformation as any[]) {
          var location = relatedInformation.location;
          if(location == null || location.range == null) continue;
          if(unverifiedRange == null) {
            errorsRelated.push(range);
          } else if(this.rangesIntersect(unverifiedRange as Range, location.range)) {
            if(params.uri == location.uri) {
              relatedRangesAsErrors.push(location.range);
            }
          }
        }
        if(relatedRangesAsErrors.length > 0) {
          errors.push(...relatedRangesAsErrors);
          errorsRelated.push(range);
        } else { // All related errors are outside of scope, we don't highlight them.
          errors.push(range);
        }
      } else {
        errors.push(range);
      }
    }

    this.dataByDocument.set(documentPath, { errors, errorsRelated, verified });
    this.refreshDisplayedVerificationDiagnostics(window.activeTextEditor);
  }

  private static createDecorator(diagnostic: Diagnostic): DecorationOptions {
    return {
      range: toVsRange(diagnostic.range),
      hoverMessage: diagnostic.message
    };
  }

  public dispose(): void {
    /*for(const [ _, { decoration } ] of this.dataByDocument) {
      decoration.dispose();
    }*/
  }
}