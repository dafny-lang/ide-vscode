/* eslint-disable max-depth */
import { /*commands, */DecorationOptions, Range, window, ExtensionContext, workspace, TextEditor, /*languages, Hover, TextDocument, Selection, CodeActionContext, ProviderResult, Command, CodeAction, CodeActionKind, WorkspaceEdit, Position,*/ TextEditorDecorationType } from 'vscode';
import { /*CancellationToken, */Diagnostic, Disposable } from 'vscode-languageclient';
//import { LanguageConstants } from '../constants';

import { IVerificationDiagnosticsParams, LineVerificationStatus } from '../language/api/verificationDiagnostics';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath, toVsRange } from '../tools/vscode';

interface ErrorGraph {
  [line: number]: Range [];
  fixableErrors: {
    [line: number]: Range
  };
}

/*// TODO: Find a way to not depend on this function
function rangeOf(r: any): Range {
  return new Range(
    new Position(r.start.line, r.start.character),
    new Position(r.end.line, r.end.character));
}*/

type DecorationType = undefined | {
  type: 'static',
  path: string,
  icon: TextEditorDecorationType
} | {
  type: 'dynamic',
  paths: string[],
  icons: TextEditorDecorationType[]
};

// Indexed by LineVerificationStatus
type DecorationSet = Map<LineVerificationStatus, DecorationType>;

interface DecorationSetRanges {
  // First array indexed by LineVerificationStatus
  decorations: Range[][];
}
interface LinearVerificationDiagnostics extends DecorationSetRanges {
  errorGraph: ErrorGraph;
}

export default class VerificationDiagnosticsView {
  private readonly normalDecorations: DecorationSet;
  private readonly grayedeDecorations: DecorationSet;
  private readonly relatedDecorations: TextEditorDecorationType;
  private readonly textEditorWatcher?: Disposable;

  private readonly dataByDocument = new Map<string, LinearVerificationDiagnostics>();
  private animationCallback: unknown = 0;
  // Alternates between 0 and 1
  private animationFrame: number = 0;

  private static readonly emptyLinearVerificationDiagnostics: LinearVerificationDiagnostics = {
    errorGraph: { fixableErrors: {} },
    decorations: Array(LineVerificationStatus.NumberOfLineDiagnostics).fill([])
  };

  private constructor(context: ExtensionContext) {
    function iconOf(path: string): TextEditorDecorationType {
      const icon = context.asAbsolutePath(`images/${path}.png`);
      return window.createTextEditorDecorationType({
        isWholeLine: true,
        rangeBehavior: 1,
        gutterIconPath: icon
      });
    }
    function makeIcon(...paths: string[]): DecorationType {
      if(paths.length === 1) {
        return { type: 'static', path: paths[0], icon: iconOf(paths[0]) };
      } else if(paths.length > 1) {
        return { type: 'dynamic', paths: paths, icons: paths.map(path => iconOf(path)) };
      } else {
        return undefined;
      }
    }
    this.normalDecorations = new Map<LineVerificationStatus, DecorationType>([
      [ LineVerificationStatus.Scheduled, makeIcon('scheduled') ],
      [ LineVerificationStatus.Error, makeIcon('error') ],
      [ LineVerificationStatus.ErrorObsolete, makeIcon('error-obsolete') ],
      [ LineVerificationStatus.ErrorVerifying, makeIcon('error-verifying', 'error-verifying-2') ],
      [ LineVerificationStatus.ErrorRange, makeIcon('error-range') ],
      [ LineVerificationStatus.ErrorRangeStart, makeIcon('error-range-start') ],
      [ LineVerificationStatus.ErrorRangeStartObsolete, makeIcon('error-range-start-obsolete') ],
      [ LineVerificationStatus.ErrorRangeStartVerifying, makeIcon('error-range-start-verifying', 'error-range-start-verifying-2') ],
      [ LineVerificationStatus.ErrorRangeEnd, makeIcon('error-range-end') ],
      [ LineVerificationStatus.ErrorRangeEndObsolete, makeIcon('error-range-end-obsolete') ],
      [ LineVerificationStatus.ErrorRangeEndVerifying, makeIcon('error-range-end-verifying', 'error-range-end-verifying-2') ],
      [ LineVerificationStatus.ErrorRangeObsolete, makeIcon('error-range-obsolete') ],
      [ LineVerificationStatus.ErrorRangeVerifying, makeIcon('error-range-verifying', 'error-range-verifying-2') ],
      [ LineVerificationStatus.VerifiedObsolete, makeIcon('verified-obsolete') ],
      [ LineVerificationStatus.VerifiedVerifying, makeIcon('verified-verifying', 'verified-verifying-2') ],
      [ LineVerificationStatus.Verified, makeIcon('verified') ],
      [ LineVerificationStatus.Verifying, makeIcon('verifying', 'verifying-2') ],
      [ LineVerificationStatus.ResolutionError, makeIcon('resolution-error') ]
    ]);
    this.grayedeDecorations = new Map<LineVerificationStatus, DecorationType>([
      [ LineVerificationStatus.Scheduled, makeIcon('scheduled') ],
      [ LineVerificationStatus.Error, makeIcon('error_gray') ],
      [ LineVerificationStatus.ErrorObsolete, makeIcon('error-obsolete_gray') ],
      [ LineVerificationStatus.ErrorVerifying, makeIcon('error-verifying_gray') ],
      [ LineVerificationStatus.ErrorRange, makeIcon('error-range_gray') ],
      [ LineVerificationStatus.ErrorRangeStart, makeIcon('error-range-start_gray') ],
      [ LineVerificationStatus.ErrorRangeStartObsolete, makeIcon('error-range-start_gray') ],
      [ LineVerificationStatus.ErrorRangeStartVerifying, makeIcon('error-range-start_gray') ],
      [ LineVerificationStatus.ErrorRangeEnd, makeIcon('error-range-end_gray') ],
      [ LineVerificationStatus.ErrorRangeEndObsolete, makeIcon('error-range-end_gray') ],
      [ LineVerificationStatus.ErrorRangeEndVerifying, makeIcon('error-range-end_gray') ],
      [ LineVerificationStatus.ErrorRangeObsolete, makeIcon('error-range-obsolete_gray') ],
      [ LineVerificationStatus.ErrorRangeVerifying, makeIcon('error-range-verifying_gray') ],
      [ LineVerificationStatus.VerifiedObsolete, makeIcon('verified_gray') ],
      [ LineVerificationStatus.VerifiedVerifying, makeIcon('verified_gray') ],
      [ LineVerificationStatus.Verified, makeIcon('verified_gray') ],
      [ LineVerificationStatus.Verifying, makeIcon('verified_gray') ],
      [ LineVerificationStatus.ResolutionError, makeIcon('resolution-error') ]
    ]);
    // For dynamic error highlighting
    this.relatedDecorations = window.createTextEditorDecorationType({
      isWholeLine: false,
      rangeBehavior: 1,
      outline: '#fe536a 2px solid'
    });
  }

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): VerificationDiagnosticsView {
    const instance = new VerificationDiagnosticsView(context);
    context.subscriptions.push(
      workspace.onDidCloseTextDocument(document => instance.clearVerificationDiagnostics(document.uri.toString())),
      window.onDidChangeActiveTextEditor(editor => instance.refreshDisplayedVerificationDiagnostics(editor)),
      languageClient.onVerificationDiagnostics(params => instance.updateVerificationDiagnostics(params))
    );
    //instance.textEditorWatcher = window.onDidChangeTextEditorSelection((e) => instance.onTextChange(e, null));
    /*languages.registerHoverProvider(LanguageConstants.Id, {
      provideHover(document, position, token) {
        instance.onTextChange(position.line, token);
        return null;
        //return new Hover('I am a hover!');
      }
    });*/
    // Quick code fix
    //languages.registerCodeActionsProvider(LanguageConstants.Id, instance);
    return instance;
  }
  /*
  public rangeOfClosingBrace(document: TextDocument, originalRange: Range): { range: Range, indent: number } | undefined {
    let tmpRange = new Range(originalRange.start, new Position(originalRange.start.line + 1, 0));
    let documentText = document.getText(tmpRange).substring(1);
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
*/
  /*
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
*/
  /*
  public onTextChange(e: any, token: CancellationToken | null = null): void {
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
*/
  private animateIcon(editor: TextEditor, iconFrames: TextEditorDecorationType[], ranges: Range[]) {
    for(let i = 0; i < iconFrames.length; i++) {
      editor.setDecorations(iconFrames[i], this.animationFrame === i ? ranges : []);
    }
  }

  public refreshDisplayedVerificationDiagnostics(editor?: TextEditor, animateOnly: boolean = false): void {
    if(editor == null) {
      return;
    }
    const documentPath = editor.document.uri.toString();
    const originalData = this.dataByDocument.get(documentPath);
    if(originalData == null) {
      return;
    }
    const resolutionFailed = originalData.decorations[LineVerificationStatus.ResolutionError].length > 0;
    const decorationSets: { decorationSet: DecorationSet, active: boolean }[]
      = [
        { decorationSet: this.normalDecorations, active: !resolutionFailed },
        { decorationSet: this.grayedeDecorations, active: resolutionFailed } ];

    for(const { decorationSet, active } of decorationSets) {
      const data: LinearVerificationDiagnostics = active ? originalData : VerificationDiagnosticsView.emptyLinearVerificationDiagnostics;
      const decorations = data.decorations;
      for(let lineVerificationStatus = 0; lineVerificationStatus < LineVerificationStatus.NumberOfLineDiagnostics; lineVerificationStatus++) {
        const ranges = decorations[lineVerificationStatus];
        const decorationType = decorationSet.get(lineVerificationStatus);
        if(decorationType === undefined) {
          continue;
        } else if(decorationType.type === 'static' && !animateOnly) {
          editor.setDecorations(decorationType.icon, ranges);
        } else if(decorationType.type === 'dynamic') {
          this.animateIcon(editor, decorationType.icons, ranges);
        }
      }
    }
  }

  private clearVerificationDiagnostics(documentPath: string): void {
    const data = this.dataByDocument.get(documentPath);
    if(data != null) {
      //data.decoration.dispose();
      this.dataByDocument.delete(documentPath);
    }
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

  private isNotErrorLine(diagnostic: LineVerificationStatus): boolean {
    return (diagnostic === LineVerificationStatus.Scheduled
      || diagnostic === LineVerificationStatus.Unknown
      || diagnostic === LineVerificationStatus.Verified
      || diagnostic === LineVerificationStatus.VerifiedObsolete
      || diagnostic === LineVerificationStatus.VerifiedVerifying
      || diagnostic === LineVerificationStatus.Verifying);
  }

  private addCosmetics(lineDiagnostics: LineVerificationStatus[]): LineVerificationStatus[] {
    let previousLineDiagnostic = LineVerificationStatus.Verified;
    let direction = 1;
    for(let line = 0; line >= 0; line += direction) {
      if(line === lineDiagnostics.length) {
        direction = -1;
        previousLineDiagnostic = LineVerificationStatus.Verified;
        continue;
      }
      const lineDiagnostic = lineDiagnostics[line];
      if(this.isNotErrorLine(previousLineDiagnostic)) {
        if(lineDiagnostic === LineVerificationStatus.ErrorRange) {
          lineDiagnostics[line] = direction === 1 ? LineVerificationStatus.ErrorRangeStart : LineVerificationStatus.ErrorRangeEnd;
        } else if(lineDiagnostic === LineVerificationStatus.ErrorRangeObsolete) {
          lineDiagnostics[line] = direction === 1 ? LineVerificationStatus.ErrorRangeStartObsolete : LineVerificationStatus.ErrorRangeEndObsolete;
        } else if(lineDiagnostic === LineVerificationStatus.ErrorRangeVerifying) {
          lineDiagnostics[line] = direction === 1 ? LineVerificationStatus.ErrorRangeStartVerifying : LineVerificationStatus.ErrorRangeEndVerifying;
        }
      }
      previousLineDiagnostic = lineDiagnostic;
    }
    return lineDiagnostics;
  }

  private updateVerificationDiagnostics(params: IVerificationDiagnosticsParams): void {
    const documentPath = getVsDocumentPath(params);
    const previousValue = this.dataByDocument.get(documentPath);
    //this.clearVerificationDiagnostics(documentPath);
    const lineDiagnostics = this.addCosmetics(params.perLineDiagnostic);

    let previousLineDiagnostic = -1;
    let initialDiagnosticLine = -1;
    const ranges: Range[][] = Array(LineVerificationStatus.NumberOfLineDiagnostics);
    for(let i = 0; i < ranges.length; i++) {
      ranges[i] = [];
    }

    // <= so that we add a virtual final line to commit the last range.
    for(let line = 0; line <= lineDiagnostics.length; line++) {
      const lineDiagnostic = line === lineDiagnostics.length ? -1 : lineDiagnostics[line];
      if(lineDiagnostic !== previousLineDiagnostic) {
        if(previousLineDiagnostic !== -1) { // Never assigned before
          const range = new Range(initialDiagnosticLine, 1, line - 1, 1);
          ranges[previousLineDiagnostic].push(range);
        }
        previousLineDiagnostic = lineDiagnostic;
        initialDiagnosticLine = line;
      } else {
        // Just continue
      }
    }

    const newData: LinearVerificationDiagnostics = {
      decorations: ranges,
      errorGraph: { fixableErrors:{} } };
    clearInterval(this.animationCallback as any);
    const mustBeDelayed = (ranges: Range[][], previousDecorations: Range[][]) => (
      (ranges[LineVerificationStatus.ResolutionError].length >= 1
          && previousDecorations[LineVerificationStatus.ResolutionError].length === 0)
      || ((ranges[LineVerificationStatus.ErrorObsolete].length >= 1
           || ranges[LineVerificationStatus.VerifiedObsolete].length >= 1
           || ranges[LineVerificationStatus.ErrorRangeObsolete].length >= 1
           || ranges[LineVerificationStatus.ErrorRangeStartObsolete].length >= 1
           || ranges[LineVerificationStatus.ErrorRangeEndObsolete].length >= 1)
          && ranges[LineVerificationStatus.Verifying].length === 0
          && ranges[LineVerificationStatus.ErrorVerifying].length === 0
          && ranges[LineVerificationStatus.ErrorRangeEndVerifying].length === 0
          && ranges[LineVerificationStatus.ErrorRangeVerifying].length === 0
          && ranges[LineVerificationStatus.ErrorRangeStartVerifying].length === 0
          && ranges[LineVerificationStatus.VerifiedVerifying].length === 0)
    );
    if(mustBeDelayed(ranges, (previousValue === undefined ? VerificationDiagnosticsView.emptyLinearVerificationDiagnostics : previousValue).decorations)) {
      // Delay for 1 second resolution errors so that we don't interrupt the verification workflow if not necessary.
      this.animationCallback = setTimeout(() => {
        this.dataByDocument.set(documentPath, newData);
        this.refreshDisplayedVerificationDiagnostics(window.activeTextEditor);
      }, 2000);
    } else {
      this.dataByDocument.set(documentPath, newData);
      this.refreshDisplayedVerificationDiagnostics(window.activeTextEditor);
    }
    // Animated properties
    if(ranges[LineVerificationStatus.Verifying].length > 0
      || ranges[LineVerificationStatus.VerifiedVerifying].length > 0
      || ranges[LineVerificationStatus.ErrorVerifying].length > 0
      || ranges[LineVerificationStatus.ErrorRangeVerifying].length > 0
      || ranges[LineVerificationStatus.ErrorRangeStartVerifying].length > 0
      || ranges[LineVerificationStatus.ErrorRangeStartVerifying].length > 0) {
      this.animationCallback = setInterval(() => {
        this.animationFrame = 1 - this.animationFrame;
        this.refreshDisplayedVerificationDiagnostics(window.activeTextEditor, true);
      }, 200);
    }
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