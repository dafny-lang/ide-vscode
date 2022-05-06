/* eslint-disable max-depth */
import { /*commands, */DecorationOptions, Range, window, ExtensionContext, workspace, TextEditor, /*languages, Hover, TextDocument, Selection, CodeActionContext, ProviderResult, Command, CodeAction, CodeActionKind, WorkspaceEdit, Position,*/ TextEditorDecorationType, TextEditorSelectionChangeEvent, Position, languages, Uri } from 'vscode';
import { /*CancellationToken, */Diagnostic, Disposable } from 'vscode-languageclient';
//import { LanguageConstants } from '../constants';
import Configuration from '../configuration';
import { ConfigurationConstants } from '../constants';

import { IVerificationStatusGutter, VerificationStatus, LineVerificationStatus, ScrollColor, IVerificationTree, obsoleteLineVerificationStatus, verifyingLineVerificationStatus, IRange } from '../language/api/verificationDiagnostics';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath, toVsRange } from '../tools/vscode';

interface ErrorGraphInfo {
  primary: Range[];
  secondary: Range[];
}

interface ErrorGraph {
  [line: number]: Map<Range, ErrorGraphInfo>;
}

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
  decorations: Map<LineVerificationStatus, Range[]>;
}
interface LinearVerificationDiagnostics extends DecorationSetRanges {
  version: number | undefined;
  errorGraph: ErrorGraph;
}

export default class VerificationDiagnosticsView {
  private readonly normalDecorations: DecorationSet;
  private readonly grayedeDecorations: DecorationSet;
  private readonly relatedDecorations: TextEditorDecorationType;
  private readonly relatedDecorationsPartial: TextEditorDecorationType;
  private readonly relatedDecorationsPartialActive: TextEditorDecorationType;
  private readonly secondaryRelatedDecorations: TextEditorDecorationType;

  private readonly textEditorWatcher?: Disposable;

  private readonly dataByDocument = new Map<string, LinearVerificationDiagnostics>();
  private animationCallback: NodeJS.Timeout | undefined = undefined;
  // Alternates between 0 and 1
  private animationFrame: number = 0;

  private static FillLineVerificationStatusMap(): Map<LineVerificationStatus, Range[]> {
    return new Map(
      Object.keys(LineVerificationStatus)
        .filter(key => parseInt(key, 10) >= 0)
        .map(key => [ parseInt(key, 10) as LineVerificationStatus, [] ]));
  }

  private static readonly emptyLinearVerificationDiagnostics: Map<LineVerificationStatus, Range[]>
    = VerificationDiagnosticsView.FillLineVerificationStatusMap();

  private constructor(context: ExtensionContext) {
    let grayMode = false;

    function iconOf(path: string): TextEditorDecorationType {
      const icon = context.asAbsolutePath(`images/${path}.png`);
      return window.createTextEditorDecorationType({
        isWholeLine: true,
        rangeBehavior: 1,
        gutterIconPath: icon,
        overviewRulerColor:
          grayMode ? (path === 'resolution-error' ? ScrollColor.Error : ScrollColor.Unknown)
            : path.startsWith('error-range')
              ? ScrollColor.ErrorRange
              : path.startsWith('error')
                ? ScrollColor.Error
                : path.startsWith('verified')
                  ? ScrollColor.Verified
                  : ScrollColor.Unknown
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
      [ LineVerificationStatus.AssertionFailed, makeIcon('error') ],
      [ LineVerificationStatus.AssertionFailedObsolete, makeIcon('error-obsolete') ],
      [ LineVerificationStatus.AssertionFailedVerifying, makeIcon('error-verifying', 'error-verifying-2') ],
      [ LineVerificationStatus.AssertionVerifiedInErrorContextObsolete, makeIcon('error-range-verified-obsolete') ],
      [ LineVerificationStatus.AssertionVerifiedInErrorContextVerifying, makeIcon('error-range-verified-verifying', 'error-range-verified-verifying-2') ],
      [ LineVerificationStatus.AssertionVerifiedInErrorContext, makeIcon('error-range-verified') ],
      [ LineVerificationStatus.ErrorContext, makeIcon('error-range') ],
      [ LineVerificationStatus.ErrorContextStart, makeIcon('error-range-start') ],
      [ LineVerificationStatus.ErrorContextStartObsolete, makeIcon('error-range-start-obsolete') ],
      [ LineVerificationStatus.ErrorContextStartVerifying, makeIcon('error-range-start-verifying', 'error-range-start-verifying-2') ],
      [ LineVerificationStatus.ErrorContextEnd, makeIcon('error-range-end') ],
      [ LineVerificationStatus.ErrorContextEndObsolete, makeIcon('error-range-end-obsolete') ],
      [ LineVerificationStatus.ErrorContextEndVerifying, makeIcon('error-range-end-verifying', 'error-range-end-verifying-2') ],
      [ LineVerificationStatus.ErrorContextObsolete, makeIcon('error-range-obsolete') ],
      [ LineVerificationStatus.ErrorContextVerifying, makeIcon('error-range-verifying', 'error-range-verifying-2') ],
      [ LineVerificationStatus.VerifiedObsolete, makeIcon('verified-obsolete') ],
      [ LineVerificationStatus.VerifiedVerifying, makeIcon('verified-verifying', 'verified-verifying-2') ],
      [ LineVerificationStatus.Verified, makeIcon('verified') ],
      [ LineVerificationStatus.Verifying, makeIcon('verifying', 'verifying-2') ],
      [ LineVerificationStatus.ResolutionError, makeIcon('resolution-error') ]
    ]);
    grayMode = true;
    this.grayedeDecorations = new Map<LineVerificationStatus, DecorationType>([
      [ LineVerificationStatus.Scheduled, makeIcon('scheduled') ],
      [ LineVerificationStatus.AssertionFailed, makeIcon('error_gray') ],
      [ LineVerificationStatus.AssertionFailedObsolete, makeIcon('error-obsolete_gray') ],
      [ LineVerificationStatus.AssertionFailedVerifying, makeIcon('error-verifying_gray') ],
      [ LineVerificationStatus.AssertionVerifiedInErrorContextObsolete, makeIcon('error-range-verified-obsolete-gray') ],
      [ LineVerificationStatus.AssertionVerifiedInErrorContextVerifying, makeIcon('error-range-verified-obsolete-gray') ],
      [ LineVerificationStatus.AssertionVerifiedInErrorContext, makeIcon('error-range-verified-obsolete-gray') ],
      [ LineVerificationStatus.ErrorContext, makeIcon('error-range_gray') ],
      [ LineVerificationStatus.ErrorContextStart, makeIcon('error-range-start_gray') ],
      [ LineVerificationStatus.ErrorContextStartObsolete, makeIcon('error-range-start_gray') ],
      [ LineVerificationStatus.ErrorContextStartVerifying, makeIcon('error-range-start_gray') ],
      [ LineVerificationStatus.ErrorContextEnd, makeIcon('error-range-end_gray') ],
      [ LineVerificationStatus.ErrorContextEndObsolete, makeIcon('error-range-end_gray') ],
      [ LineVerificationStatus.ErrorContextEndVerifying, makeIcon('error-range-end_gray') ],
      [ LineVerificationStatus.ErrorContextObsolete, makeIcon('error-range-obsolete_gray') ],
      [ LineVerificationStatus.ErrorContextVerifying, makeIcon('error-range-verifying_gray') ],
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
      outline: '#fe536aa0 2px solid',
      overviewRulerColor: ScrollColor.ErrorActive
      // textDecoration: 'underline overline #fe536ac0'
      // backgroundColor: '#fe536a50'
    });
    this.relatedDecorationsPartial = window.createTextEditorDecorationType({
      isWholeLine: false,
      rangeBehavior: 1,
      outline: '#fe536aa0 2px dashed'
      // textDecoration: 'underline overline #fe536ac0'
      // backgroundColor: '#fe536a50'
    });
    this.relatedDecorationsPartialActive = window.createTextEditorDecorationType({
      isWholeLine: false,
      rangeBehavior: 1,
      outline: '#fe536a 2px dashed',
      overviewRulerColor: ScrollColor.ErrorActive
      // textDecoration: 'underline overline #fe536ac0'
      // backgroundColor: '#fe536a50'
    });
    this.secondaryRelatedDecorations = window.createTextEditorDecorationType({
      isWholeLine: false,
      rangeBehavior: 1,
      //outline: '#fe536aa0 1px dashed',
      overviewRulerColor: ScrollColor.ErrorActive,
      // textDecoration: 'underline overline #fc5daf'
      backgroundColor: '#fe536aa0'
    });
    this.textEditorWatcher = window.onDidChangeTextEditorSelection((e) => this.onTextChange(e, false));
  }

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): VerificationDiagnosticsView {
    const instance = new VerificationDiagnosticsView(context);
    context.subscriptions.push(
      workspace.onDidCloseTextDocument(document => instance.clearVerificationDiagnostics(document.uri.toString())),
      window.onDidChangeActiveTextEditor(editor => instance.refreshDisplayedVerificationDiagnostics(editor)),
      languageClient.onVerificationDiagnostics(params => instance.updateVerificationDiagnostics(params))
    );
    return instance;
  }

  /////////////////// Related error rendering ///////////////////
  private rangeDistance(range1: Range, range2: Range): number {
    if(range1.intersection(range2)?.isEmpty === false
       || range1.contains(range2)
       || range2.contains(range1)) {
      return 0;
    }
    if(range1.end.line < range2.start.line) {
      return (range2.start.line - range1.end.line) * 1000;
    } else if(range2.end.line < range1.start.line) {
      return (range1.start.line - range2.end.line) * 1000;
    } else {
      // Same line
      if(range1.end.character < range2.start.character) {
        return range2.start.character - range1.end.character;
      } else {
        return range1.start.character - range2.end.character;
      }
    }
  }

  private readonly lastResolvedDocumentStates: Map<string, string> = new Map();

  public onTextChange(e: TextEditorSelectionChangeEvent | undefined = undefined, storeDocumentState: boolean = false): void {
    const editor: TextEditor | undefined = window.activeTextEditor;
    if(editor == null) {
      return;
    }
    if(e !== undefined && e.kind === undefined) {
      return;
    }
    const documentPath = editor.document.uri.toString();
    const data = this.dataByDocument.get(documentPath);
    const currentText = editor.document.getText();
    // Only works if we have the same text as the last resolved document states
    if(this.lastResolvedDocumentStates.get(documentPath) !== currentText) {
      if(storeDocumentState) {
        this.lastResolvedDocumentStates.set(documentPath, currentText);
      } else {
        return;
      }
    }

    const resetRelatedDecorations = () => {
      editor.setDecorations(this.relatedDecorations, []);
      editor.setDecorations(this.relatedDecorationsPartial, []);
      editor.setDecorations(this.relatedDecorationsPartialActive, []);
      editor.setDecorations(this.secondaryRelatedDecorations, []);
    };
    if(data == null) {
      resetRelatedDecorations();
      return;
    }
    const errorGraph = data.errorGraph;
    const selection = e === undefined ? editor.selection : e.selections[0];
    const line = selection.start.line;
    const errorGraphLine = errorGraph[line];
    if(errorGraphLine == null) {
      resetRelatedDecorations();
      return;
    }
    // Highlights all ranges on the line
    // Highlights ranges under cursor and dependency with active highlighting
    const keys = [ ...errorGraphLine.keys() ];
    if(keys.length === 0) {
      resetRelatedDecorations();
      return;
    }

    // Determine which keys is the closest to the selection.
    const closestKey = this.closestRange(selection, keys);
    const ranges = [], partialRanges = [], partialActiveRanges = [], secondaryRanges = [];
    for(const key of keys) {
      const closest = closestKey.isEqual(key);
      const relatedRanges = errorGraphLine.get(key) ?? { primary: [], secondary: [] };
      if(relatedRanges.primary.length <= 1) {
        ranges.push(key);
      } else { // Partial error
        if(closest || keys.length === 1) {
          partialActiveRanges.push(key);
          partialActiveRanges.push(...relatedRanges.primary);
          secondaryRanges.push(...relatedRanges.secondary);
        } else {
          partialRanges.push(key);
        }
      }
    }
    editor.setDecorations(this.relatedDecorations, ranges);
    editor.setDecorations(this.relatedDecorationsPartial, partialRanges);
    editor.setDecorations(this.relatedDecorationsPartialActive, partialActiveRanges);
    // TODO: should be visible only if an option is activated
    if(Configuration.get<boolean>(ConfigurationConstants.LanguageServer.DisplayVerificationTrace)) {
      editor.setDecorations(this.secondaryRelatedDecorations, secondaryRanges);
    }
  }

  private closestRange(selection: Range, ranges: Range[]) {
    let closestKey = ranges[0];
    let currentDistance = -1;
    for(const key of ranges) {
      const newDistance = this.rangeDistance(key, selection);
      if(newDistance < currentDistance || currentDistance < 0) {
        closestKey = key;
        currentDistance = newDistance;
      }
    }
    return closestKey;
  }

  /////////////////// Gutter rendering ///////////////////

  private animateIcon(editor: TextEditor, iconFrames: TextEditorDecorationType[], ranges: Range[]) {
    for(let i = 0; i < iconFrames.length; i++) {
      editor.setDecorations(iconFrames[i], this.animationFrame === i ? ranges : []);
    }
  }

  public refreshDisplayedVerificationDiagnostics(editor?: TextEditor, animateOnly: boolean = false): void {
    if(editor == null) {
      return;
    }
    if(!animateOnly) {
      this.onTextChange(undefined, true);
    }
    const documentPath = editor.document.uri.toString();
    const originalData = this.dataByDocument.get(documentPath);
    if(originalData == null) {
      return;
    }
    const resolutionErrors = originalData.decorations.get(LineVerificationStatus.ResolutionError);
    const resolutionFailed = resolutionErrors != null && resolutionErrors.length > 0;
    const decorationSets: { decorationSet: DecorationSet, active: boolean }[]
      = [
        { decorationSet: this.normalDecorations, active: !resolutionFailed },
        { decorationSet: this.grayedeDecorations, active: resolutionFailed } ];

    for(const { decorationSet, active } of decorationSets) {
      const decorations: Map<LineVerificationStatus, Range[]> = active ? originalData.decorations : VerificationDiagnosticsView.emptyLinearVerificationDiagnostics;
      for(const enumMember in LineVerificationStatus) {
        if(!(parseInt(enumMember, 10) >= 0)) {
          continue;
        }
        const lineVerificationStatus: LineVerificationStatus = parseInt(enumMember, 10);
        const ranges = this.getRanges(decorations, lineVerificationStatus);
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

  private addRelated(errorGraph: ErrorGraph, range1: Range, valueModifier: (e: ErrorGraphInfo) => ErrorGraphInfo) {
    const line = range1.start.line;
    if(errorGraph[line] === undefined) {
      errorGraph[line] = new Map();
    }
    let value = errorGraph[line].get(range1) ?? { primary:[], secondary:[] };
    value = valueModifier(value);
    errorGraph[line].set(range1, value);
  }

  private addImmediatelyRelated(errorGraph: ErrorGraph, range1: Range, range2: Range) {
    this.addRelated(errorGraph, range1, (value: ErrorGraphInfo) => {
      value.primary = value.primary.concat([ range2 ]);
      return value;
    });
  }

  private addLooselyRelated(errorGraph: ErrorGraph, range1: Range, secondaryRanges: Range[]) {
    this.addRelated(errorGraph, range1, (value: ErrorGraphInfo) => {
      value.secondary = value.secondary.concat(secondaryRanges);
      return value;
    });
  }

  private isNotErrorLine(diagnostic: LineVerificationStatus): boolean {
    return (diagnostic === LineVerificationStatus.Scheduled
      || diagnostic === LineVerificationStatus.Nothing
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
        if(lineDiagnostic === LineVerificationStatus.ErrorContext) {
          lineDiagnostics[line] = direction === 1 ? LineVerificationStatus.ErrorContextStart : LineVerificationStatus.ErrorContextEnd;
        } else if(lineDiagnostic === LineVerificationStatus.ErrorContextObsolete) {
          lineDiagnostics[line] = direction === 1 ? LineVerificationStatus.ErrorContextStartObsolete : LineVerificationStatus.ErrorContextEndObsolete;
        } else if(lineDiagnostic === LineVerificationStatus.ErrorContextVerifying) {
          lineDiagnostics[line] = direction === 1 ? LineVerificationStatus.ErrorContextStartVerifying : LineVerificationStatus.ErrorContextEndVerifying;
        }
      }
      previousLineDiagnostic = lineDiagnostic;
    }
    return lineDiagnostics;
  }
  // TODO: Find a way to not depend on this function
  private rangeOf(r: IRange, lineOffset: number = 0, charOffset: number = 0): Range {
    return new Range(
      new Position(r.start.line + lineOffset, r.start.character + charOffset),
      new Position(r.end.line + lineOffset, r.end.character + charOffset));
  }

  // For every error and related error, returns a mapping from line to affected ranges
  private getErrorGraph(params: IVerificationStatusGutter): ErrorGraph {
    const errorGraph: ErrorGraph = {};
    for(const verificationTree of params.verificationTrees) {
      this.buildGraph(errorGraph, verificationTree);
    }
    return errorGraph;
  }
  private buildGraphArray(errorGraph: ErrorGraph, children: IVerificationTree[]) {
    for(const verificationTree of children) {
      this.buildGraph(errorGraph, verificationTree);
    }
  }

  private rangeArrayOf(x: any): Range[] {
    if(x === undefined) {
      return [];
    } else {
      return (x as any[]).map(x => this.rangeOf(x));
    }
  }

  private buildGraph(errorGraph: ErrorGraph, verificationTree: IVerificationTree) {
    const verificationTreeRange = this.rangeOf(verificationTree.range);
    if(verificationTreeRange === undefined) {
      return;
    }
    if(verificationTree.statusVerification === VerificationStatus.Error
       && verificationTree.children.length === 0
    ) {
      const immediatelyRelatedRanges = this.rangeArrayOf(verificationTree.immediatelyRelatedRanges);
      const dynamicallyRelatedRanges = this.rangeArrayOf(verificationTree.dynamicallyRelatedRanges);
      const relatedRanges = this.rangeArrayOf(verificationTree.relatedRanges);
      const allImmediateRanges: Range[] = [ verificationTreeRange ].concat(immediatelyRelatedRanges);
      for(const range1 of allImmediateRanges) {
        this.addLooselyRelated(errorGraph, range1, relatedRanges);
        // We set a pointer from an immediately related range to a dynamically related range
        // but not the other way round because these are requires of other functions.
        for(const range2dynamic of dynamicallyRelatedRanges) {
          this.addImmediatelyRelated(errorGraph, range1, range2dynamic);
        }
        for(const range2 of allImmediateRanges) {
          this.addImmediatelyRelated(errorGraph, range1, range2);
        }
      }
    }
    this.buildGraphArray(errorGraph, verificationTree.children);
  }

  private getRangesOfLineStatus(params: IVerificationStatusGutter): Map<LineVerificationStatus, Range[]> {
    //// Per-line diagnostics
    const lineDiagnostics = this.addCosmetics(params.perLineDiagnostic);

    let previousLineDiagnostic = -1;
    let initialDiagnosticLine = -1;
    const ranges: Map<LineVerificationStatus, Range[]> = VerificationDiagnosticsView.FillLineVerificationStatusMap();

    // <= so that we add a virtual final line to commit the last range.
    for(let line = 0; line <= lineDiagnostics.length; line++) {
      const lineDiagnostic = line === lineDiagnostics.length ? -1 : lineDiagnostics[line];
      if(lineDiagnostic !== previousLineDiagnostic) {
        if(previousLineDiagnostic !== -1) { // Never assigned before
          const range = new Range(initialDiagnosticLine, 1, line - 1, 1);
          ranges.get(previousLineDiagnostic)?.push(range);
        }
        previousLineDiagnostic = lineDiagnostic;
        initialDiagnosticLine = line;
      } else {
        // Just continue
      }
    }
    return ranges;
  }

  private areParamsOutdated(params: IVerificationStatusGutter): boolean {
    const documentPath = getVsDocumentPath(params);
    const previousVersion = this.dataByDocument.get(documentPath)?.version;
    return (previousVersion !== undefined && params.version !== undefined
      && params.version < previousVersion);
  }

  private updateVerificationDiagnostics(params: IVerificationStatusGutter): void {
    if(this.areParamsOutdated(params)) {
      return;
    }
    const documentPath = getVsDocumentPath(params);
    //this.clearVerificationDiagnostics(documentPath);

    let errorGraph: ErrorGraph = {};
    const diagnostics = languages.getDiagnostics(Uri.parse(params.uri));
    for(const diagnostic of diagnostics) {
      if(diagnostic.source !== 'Verifier') {
        const range = diagnostic.range;
        this.addImmediatelyRelated(errorGraph, range, range);
      }
    }
    // We don't display related verification ranges if there are resolution errors.
    if(Object.keys(errorGraph).length === 0) {
      errorGraph = this.getErrorGraph(params);
    }
    const ranges = this.getRangesOfLineStatus(params);

    const newData: LinearVerificationDiagnostics = {
      decorations: ranges,
      errorGraph: errorGraph,
      version: params.version };

    this.setDisplayedVerificationDiagnostics(documentPath, newData);
  }


  private getRanges(ranges: Map<LineVerificationStatus, Range[]>, status: LineVerificationStatus): Range[] {
    let r = ranges.get(status);
    if(r === undefined) {
      r = [];
      ranges.set(status, r);
    }
    return r;
  }

  // Takes care of delaying the display of verification diagnostics to not interfere with UX.
  private setDisplayedVerificationDiagnostics(documentPath: string, newData: LinearVerificationDiagnostics) {
    const previousValue = this.dataByDocument.get(documentPath);
    const ranges = newData.decorations;
    if(this.animationCallback !== undefined) {
      clearInterval(this.animationCallback);
    }
    const mustBeDelayed = (ranges: Map<LineVerificationStatus, Range[]>, previousRanges: Map<LineVerificationStatus, Range[]>) =>
      (this.getRanges(ranges, LineVerificationStatus.ResolutionError).length >= 1
          && this.getRanges(previousRanges, LineVerificationStatus.ResolutionError).length === 0)
      || (obsoleteLineVerificationStatus.some(status => this.getRanges(ranges, status).length >= 1)
          && verifyingLineVerificationStatus.every(status => this.getRanges(ranges, status).length === 0)
          && obsoleteLineVerificationStatus.every(status => this.getRanges(previousRanges, status).length === 0)
      );
    if(mustBeDelayed(ranges, (previousValue === undefined ? VerificationDiagnosticsView.emptyLinearVerificationDiagnostics : previousValue.decorations))) {
      // Delay for 1 second resolution errors so that we don't interrupt the verification workflow if not necessary.
      this.animationCallback = setTimeout(() => {
        this.dataByDocument.set(documentPath, newData);
        this.refreshDisplayedVerificationDiagnostics(window.activeTextEditor);
      }, 2000);
    } else {
      this.dataByDocument.set(documentPath, newData);
      this.animationFrame = 1 - this.animationFrame;
      this.refreshDisplayedVerificationDiagnostics(window.activeTextEditor);
    }
    // Animated properties
    if(this.getRanges(ranges, LineVerificationStatus.Verifying).length > 0
      || this.getRanges(ranges, LineVerificationStatus.VerifiedVerifying).length > 0
      || this.getRanges(ranges, LineVerificationStatus.AssertionFailedVerifying).length > 0
      || this.getRanges(ranges, LineVerificationStatus.ErrorContextVerifying).length > 0
      || this.getRanges(ranges, LineVerificationStatus.ErrorContextStartVerifying).length > 0
      || this.getRanges(ranges, LineVerificationStatus.AssertionVerifiedInErrorContextVerifying).length > 0
      || this.getRanges(ranges, LineVerificationStatus.ErrorContextEndVerifying).length > 0) {
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
    for(const [ _, decoration ] of this.normalDecorations) {
      if(decoration === undefined) {
        continue;
      } else if(decoration.type === 'static') {
        decoration.icon.dispose();
      } else if(decoration.type === 'dynamic') {
        decoration.icons.forEach(icon => icon.dispose());
      }
    }
    this.relatedDecorations.dispose();
    this.relatedDecorationsPartial.dispose();
    this.relatedDecorationsPartialActive.dispose();
  }
}