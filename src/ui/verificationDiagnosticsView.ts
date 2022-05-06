/* eslint-disable max-depth */
import { /*commands, */DecorationOptions, Range, window, ExtensionContext, workspace, TextEditor, /*languages, Hover, TextDocument, Selection, CodeActionContext, ProviderResult, Command, CodeAction, CodeActionKind, WorkspaceEdit, Position,*/ TextEditorDecorationType, Position } from 'vscode';
import { /*CancellationToken, */Diagnostic, Disposable } from 'vscode-languageclient';
//import { LanguageConstants } from '../constants';

import { IVerificationStatusGutter, LineVerificationStatus, ScrollColor, obsoleteLineVerificationStatus, verifyingLineVerificationStatus, IRange } from '../language/api/verificationDiagnostics';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath, toVsRange } from '../tools/vscode';

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
  }

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): VerificationDiagnosticsView {
    const instance = new VerificationDiagnosticsView(context);
    context.subscriptions.push(
      workspace.onDidCloseTextDocument(document => instance.clearVerificationDiagnostics(document.uri.toString())),
      window.onDidChangeActiveTextEditor(editor => instance.refreshDisplayedVerificationDiagnostics(editor)),
      languageClient.onVerificationStatusGutter(params => instance.updateVerificationDiagnostics(params))
    );
    return instance;
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

  private getRangesOfLineStatus(params: IVerificationStatusGutter): Map<LineVerificationStatus, Range[]> {
    //// Per-line diagnostics
    const lineDiagnostics = this.addCosmetics(params.perLineStatus);

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
    const ranges = this.getRangesOfLineStatus(params);

    const newData: LinearVerificationDiagnostics = {
      decorations: ranges,
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