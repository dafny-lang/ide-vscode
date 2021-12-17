import { commands, DecorationOptions, Range, window, ExtensionContext, workspace, TextEditor } from 'vscode';
import { Diagnostic, Disposable } from 'vscode-languageclient';

import { IVerificationDiagnosticsParams } from '../language/api/verificationDiagnostics';
import { IVerificationIntermediateParams } from '../language/api/verificationIntermediate';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath, toVsRange } from '../tools/vscode';

export default class VerificationDiagnosticsView {
  private errorDecoration: any;
  private errorsRelatedDecoration: any;
  private verifiedDecoration: any;
  private relatedDecorations: any;
  private errorsRelatedPathDecoration: any;
  private textEditorWatcher?: Disposable;

  private readonly dataByDocument = new Map<string, { errors: Range[], verified: Range[], errorGraph: any}>();

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
    const errorPathWayIcon = context.asAbsolutePath("images/errorPathWay.svg");
    var getDecoration = (icon: string) => window.createTextEditorDecorationType({
      isWholeLine: true,
      rangeBehavior: 1,
      gutterIconPath: icon,
    });
    instance.errorDecoration = getDecoration(errorIcon);
    instance.errorsRelatedDecoration = getDecoration(errorPathIcon);
    instance.verifiedDecoration = getDecoration(verifiedIcon);
    instance.errorsRelatedPathDecoration = getDecoration(errorPathWayIcon);
    instance.relatedDecorations = window.createTextEditorDecorationType({
      isWholeLine: false,
      rangeBehavior: 1,
      outline: '#fe536a 2px solid',
    });
    instance.textEditorWatcher = window.onDidChangeTextEditorSelection((e) => instance.onTextChange(e));
    return instance;
  }

  public onTextChange(e: any) {
    var editor: TextEditor | undefined = window.activeTextEditor;
    if(editor == null) {
      return;
    }
    const documentPath = editor.document.uri.toString();
    const data = this.dataByDocument.get(documentPath);
    if(data == null) {
      return;
    }
    const errorGraph = data.errorGraph;
    const start = e.selections[0]._start;
    const line = start._line;
    if(errorGraph[line] == null) {
      editor.setDecorations(this.relatedDecorations, []);
      editor.setDecorations(this.errorsRelatedDecoration, []);
      editor.setDecorations(this.errorDecoration, data.errors);
      editor.setDecorations(this.errorsRelatedPathDecoration, []);
      return;
    }
    var ranges = errorGraph[line].filter((x: any) => x != null);
    var filteredErrors = data.errors.filter(x =>
      ranges.every((importantRange: Range) => importantRange.start.line != x.start.line));
    var lines = ranges.map((x: any) => x.start.line).concat(line);
    var minLine = lines.length == 0 ? line : Math.min(...lines);
    var maxLine = lines.length == 0 ? line : Math.max(...lines);
    var rangePaths = [];
    for(var l = minLine; l <= maxLine; l++) {
      if(ranges.every((importantRange: Range) => importantRange.start.line != l) && l != line) {
        rangePaths.push(new Range(l, 0, l, 1));
      }
    }

    editor.setDecorations(this.relatedDecorations, ranges);
    editor.setDecorations(this.errorDecoration, filteredErrors);
    editor.setDecorations(this.errorsRelatedDecoration, ranges);
    editor.setDecorations(this.errorsRelatedPathDecoration, rangePaths);
    // If we are on an error or a related error,
    // Find other corresponding errors and highlight them.
    console.log('selection', e);
    console.log(window.activeTextEditor?.selections);
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

  private addEntry(errorGraph: any, range1: Range, range2: Range | null) {
    if(errorGraph[range1.start.line] === undefined) {
      errorGraph[range1.start.line] = [];
    }
    errorGraph[range1.start.line].push(range2);
  }

  private updateVerificationDiagnostics(params: IVerificationDiagnosticsParams): void {
    const documentPath = getVsDocumentPath(params);
    this.clearVerificationDiagnostics(documentPath);
    const diagnostics = params.diagnostics;
    const verified = params.verified as Range[];
    const unverified = params.unverified as Range[];
    const errorGraph: any = {};

    var errors: Range[] = [];
    for(let diagnostic of diagnostics) {
      let range = diagnostic.range as Range;
      let unverifiedRange = this.getUnverifiedRange(unverified, range);
      var relatedRangesAsErrors: Range[] = [];
      if(unverifiedRange != null && Array.isArray(diagnostic.relatedInformation)) {
        for(let relatedInformation of diagnostic.relatedInformation as any[]) {
          var location = relatedInformation.location;
          if(location == null || location.range == null) continue;
          this.addEntry(errorGraph, range, location.range);
          if(unverifiedRange == null) {
            // We don't add this to the error graph.
          } else if(this.rangesIntersect(unverifiedRange as Range, location.range)) {
            if(params.uri == location.uri) {
              relatedRangesAsErrors.push(location.range);
              this.addEntry(errorGraph, location.range, range);
            }
          } else {
            this.addEntry(errorGraph, location.range, null);
          }
        }
        if(relatedRangesAsErrors.length > 0) {
          errors.push(...relatedRangesAsErrors);
          errors.push(range);
        } else { // All related errors are outside of scope, we don't highlight them.
          errors.push(range);
        }
      } else {
        errors.push(range);
      }
    }

    this.dataByDocument.set(documentPath, { errors, verified, errorGraph });
    this.refreshDisplayedVerificationDiagnostics(window.activeTextEditor);
  }

  private static createDecorator(diagnostic: Diagnostic): DecorationOptions {
    return {
      range: toVsRange(diagnostic.range),
      hoverMessage: diagnostic.message
    };
  }

  public dispose(): void {
    if(this.textEditorWatcher) {
      this.textEditorWatcher.dispose();
    }
    /*for(const [ _, { decoration } ] of this.dataByDocument) {
      decoration.dispose();
    }*/
  }
}