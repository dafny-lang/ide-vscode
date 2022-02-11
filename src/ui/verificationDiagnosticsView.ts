/* eslint-disable max-depth */
import { commands, DecorationOptions, Range, window, ExtensionContext, workspace, TextEditor, languages, Hover, TextDocument, Selection, CodeActionContext, ProviderResult, Command, CodeAction, CodeActionKind, WorkspaceEdit, Position } from 'vscode';
import { CancellationToken, Diagnostic, Disposable } from 'vscode-languageclient';
import { LanguageConstants } from '../constants';

import { IVerificationDiagnosticsParams } from '../language/api/verificationDiagnostics';
import { IVerificationIntermediateParams } from '../language/api/verificationIntermediate';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath, toVsRange } from '../tools/vscode';

interface ErrorGraph {
  [line: number]: Range [];
  fixableErrors: {
    [line: number]: Range
  };
}

// TODO: Find a way to not depend on this function
function rangeOf(r: any): Range {
  return new Range(
    new Position(r.start.line, r.start.character),
    new Position(r.end.line, r.end.character));
}

export default class VerificationDiagnosticsView {
  private errorDecoration: any;
  private errorsRelatedDecoration: any;
  private verifiedDecoration: any;
  private relatedDecorations: any;
  private errorsRelatedPathDecoration: any;
  private textEditorWatcher?: Disposable;

  private readonly dataByDocument = new Map<string, { errors: Range[], verified: Range[], errorGraph: ErrorGraph }>();

  private constructor() {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): VerificationDiagnosticsView {
    const instance = new VerificationDiagnosticsView();
    context.subscriptions.push(
      workspace.onDidCloseTextDocument(document => instance.clearVerificationDiagnostics(document.uri.toString())),
      window.onDidChangeActiveTextEditor(editor => instance.refreshDisplayedVerificationDiagnostics(editor)),
      languageClient.onVerificationDiagnostics(params => instance.updateVerificationDiagnostics(params))
    );
    const errorIcon = context.asAbsolutePath('images/errorSource.svg');
    const errorPathIcon = context.asAbsolutePath('images/errorPath.svg');
    const verifiedIcon = context.asAbsolutePath('images/verified.svg');
    const errorPathWayIcon = context.asAbsolutePath('images/errorPathWay.svg');
    const getDecoration = (icon: string) => window.createTextEditorDecorationType({
      isWholeLine: true,
      rangeBehavior: 1,
      gutterIconPath: icon
    });
    instance.errorDecoration = getDecoration(errorIcon);
    instance.errorsRelatedDecoration = getDecoration(errorPathIcon);
    instance.verifiedDecoration = getDecoration(verifiedIcon);
    instance.errorsRelatedPathDecoration = getDecoration(errorPathWayIcon);
    instance.relatedDecorations = window.createTextEditorDecorationType({
      isWholeLine: false,
      rangeBehavior: 1,
      outline: '#fe536a 2px solid'
    });
    instance.textEditorWatcher = window.onDidChangeTextEditorSelection((e) => instance.onTextChange(e));
    /*languages.registerHoverProvider(LanguageConstants.Id, {
      provideHover(document, position, token) {
        instance.onTextChange(position.line, token);
        return null;
        //return new Hover('I am a hover!');
      }
    });*/
    languages.registerCodeActionsProvider(LanguageConstants.Id, instance);
    return instance;
  }

  public rangeOfClosingBrace(document: TextDocument, originalRange: Range): { range: Range, indent: number } | undefined {
    const tmpRange = new Range(originalRange.start, new Position(originalRange.start.line + 1, 0));
    const documentText = document.getText(tmpRange).substring(1);
    let braceNumber = 1;
    let i = 0;
    let lastIndentBeforeBrace = 0;
    let first = true;
    let onlySpaces = true;
    let lastIndent = 0;
    while(documentText != null && documentText != '') {
      while(i < documentText.length && braceNumber != 0) {
        if(documentText[i] == '{') braceNumber++;
        if(documentText[i] == '}') braceNumber--;
        i++;
        if(!first && onlySpaces) {
          if(documentText[i] == ' ') {
            lastIndent = i;
          } else {
            onlySpaces = false;
          }
        }
      }
      if(braceNumber !== 0) {
        lastIndentBeforeBrace = lastIndent;
        tmpRange = new Range(tmpRange.end.line, tmpRange.end.character, tmpRange.end.line + 1, 0);
        documentText = document.getText(tmpRange);
        i = 0;
        first = false;
        onlySpaces = true;
        continue;
      } else {
        break;
      }
    }
    if(braceNumber == 0) {
      return {
        range: new Range(
          new Position(tmpRange.start.line, tmpRange.start.character + i - 1),
          new Position(tmpRange.start.line, tmpRange.start.character + i)),
        indent: lastIndentBeforeBrace + 1 };
    } else {
      return undefined;
    }
  }


  public provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): ProviderResult<CodeAction[]> {
    // If it's a related condition, try to inline it.
    const documentPath = document.uri.toString();
    const data = this.dataByDocument.get(documentPath);
    if(data == null || data.errorGraph == null) {
      return undefined;
    }
    const errorGraph = data.errorGraph;
    const line = range.start.line;
    if(errorGraph[line] == null || !errorGraph.fixableErrors[line]) {
      return undefined;
    }
    const codeActions = [];
    const originalRange = errorGraph.fixableErrors[line];
    for(const relatedRange of errorGraph[line]) {
      if(relatedRange == null) continue;
      // FIXME: Have the range already report the range of the expression, do not guess it !
      const relatedRangeExtended = new Range(
        relatedRange.start,
        new Position(relatedRange.end.line, 9993)
      );

      const originalBrace = document.getText(originalRange);
      if(originalBrace != '{') continue;
      const closingBraceIndent = this.rangeOfClosingBrace(document, originalRange);
      if(closingBraceIndent == undefined) continue;
      let { range: closingBrace, indent: indent } = closingBraceIndent;
      indent = Math.max(indent, closingBrace.start.character + 2);
      const indentationBrace = ' '.repeat(closingBrace.start.character);
      const missingChars = ' '.repeat(indent - closingBrace.start.character);
      const textToInsert = document.getText(relatedRangeExtended);
      const codeAction = new CodeAction(
        'Inline failing \'' + textToInsert
        + '\' of line ' + relatedRange.start.line + ' (experimental)',
        CodeActionKind.RefactorInline);
      codeAction.edit = new WorkspaceEdit();
      codeAction.edit.insert(document.uri, closingBrace.start, missingChars + 'assert ' + textToInsert + ';\n' + indentationBrace);
      codeActions.push(codeAction);
      break; // Let's offer to inline only one
    }
    return codeActions;
  }

  public onTextChange(e: any, token: CancellationToken) {
    const editor: TextEditor | undefined = window.activeTextEditor;
    if(editor == null) {
      return;
    }
    const documentPath = editor.document.uri.toString();
    const data = this.dataByDocument.get(documentPath);
    if(data == null) {
      return;
    }
    const errorGraph = data.errorGraph;
    const line = typeof e === 'number' ? e : e.selections[0]._start._line;
    if(errorGraph[line] == null) {
      editor.setDecorations(this.relatedDecorations, []);
      editor.setDecorations(this.errorsRelatedDecoration, []);
      editor.setDecorations(this.errorDecoration, data.errors);
      editor.setDecorations(this.errorsRelatedPathDecoration, []);
      return;
    }
    let filteredErrors: Range[] = [];
    const rangePaths = [];
    let ranges: Range[] = [];
    try {
      const maybeStopComputation = <T>(result: T): T => {
        if(token && token.isCancellationRequested) {
          throw 'cancelled';
        } else {
          return result;
        }
      };
      ranges = errorGraph[line].filter((x: any) => maybeStopComputation(x != null));
      filteredErrors = data.errors.filter(x =>
        ranges.every((importantRange: Range) => maybeStopComputation(importantRange.start.line != x.start.line)));
      const lines = ranges.map((x: any) => x.start.line).concat(line);
      const minLine = lines.length == 0 ? line : Math.min(...lines);
      const maxLine = lines.length == 0 ? line : Math.max(...lines);
      for(var l = minLine; l <= maxLine; l++) {
        if(ranges.every((importantRange: Range) => importantRange.start.line != l) && l != line) {
          rangePaths.push(maybeStopComputation(new Range(l, 0, l, 1)));
        }
      }
    } catch(e) {
      if(e == 'cancelled') return;
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

    editor.setDecorations(this.verifiedDecoration, data.verified);
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
    for(let i = 0; i < unverified.length; i++) {
      if(this.rangesIntersect(unverified[i], errorRange)) {
        return unverified[i];
      }
    }
    return null;
  }

  private rangesIntersect(range1: Range, range2: Range): boolean {
    return range1.start.line <= range2.end.line && range1.end.line >= range2.start.line;
  }

  private addEntry(errorGraph: ErrorGraph, range1: Range, range2: Range | null, fixable: boolean = false) {
    if(errorGraph[range1.start.line] === undefined) {
      errorGraph[range1.start.line] = [];
    }
    if(range2 != null) {
      errorGraph[range1.start.line].push(range2);
    }
    if(fixable) {
      errorGraph.fixableErrors[range1.start.line] = range1;
    }
  }

  private updateVerificationDiagnostics(params: IVerificationDiagnosticsParams): void {
    const documentPath = getVsDocumentPath(params);
    this.clearVerificationDiagnostics(documentPath);
    const diagnostics = params.diagnostics;
    const verified: Range[] = params.verified.map(rangeOf);
    const unverified: Range[] = params.unverified.map(rangeOf);
    const errorGraph: ErrorGraph = {
      fixableErrors: {}
    };

    const errors: Range[] = [];
    for(const diagnostic of diagnostics) {
      const range = rangeOf(diagnostic.range);
      const unverifiedRange = this.getUnverifiedRange(unverified, range);
      const relatedRangesAsErrors: Range[] = [];
      if(unverifiedRange != null && Array.isArray(diagnostic.relatedInformation)) {
        for(const relatedInformation of diagnostic.relatedInformation as any[]) {
          const location = relatedInformation.location;
          if(location == null || location.range == null) continue;
          const locationRange = rangeOf(location.range);
          this.addEntry(errorGraph, range, locationRange, true);
          if(unverifiedRange == null) {
            // We don't add this to the error graph.
          } else if(this.rangesIntersect(rangeOf(unverifiedRange), locationRange)) {
            if(params.uri == location.uri) {
              relatedRangesAsErrors.push(locationRange);
              this.addEntry(errorGraph, locationRange, range);
            }
          } else {
            this.addEntry(errorGraph, locationRange, null);
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