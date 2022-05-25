/* eslint-disable max-depth */
import { Range, window, ExtensionContext, workspace, TextEditor, TextEditorDecorationType } from 'vscode';
import { Disposable } from 'vscode-languageclient';
import {
  IVerificationGutterStatusParams,
  LineVerificationStatus,
  ScrollColor,
  obsoleteLineVerificationStatus,
  verifyingLineVerificationStatus,
  nonErrorLineVerificationStatus } from '../language/api/verificationGutterStatusParams';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { getVsDocumentPath } from '../tools/vscode';

const DELAY_IF_RESOLUTION_ERROR = 2000;
const ANIMATION_INTERVAL = 200;

type GutterDecorationType = undefined | {
  type: 'static',
  path: string,
  icon: TextEditorDecorationType
} | {
  type: 'dynamic',
  paths: string[],
  icons: TextEditorDecorationType[]
};

// Indexed by LineVerificationStatus
type GutterDecorationSet = Map<LineVerificationStatus, GutterDecorationType>;

interface GutterDecorationSetRanges {
  // First array indexed by LineVerificationStatus
  decorations: Map<LineVerificationStatus, Range[]>;
}
interface LinearVerificationGutterStatus extends GutterDecorationSetRanges {
  version: number | undefined;
}

export default class VerificationGutterStatusView {
  private readonly normalDecorations: GutterDecorationSet;
  private readonly grayedDecorations: GutterDecorationSet;

  private readonly textEditorWatcher?: Disposable;

  private readonly dataByDocument = new Map<string, LinearVerificationGutterStatus>();
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
    = VerificationGutterStatusView.FillLineVerificationStatusMap();

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
    function makeIcon(...paths: string[]): GutterDecorationType {
      if(paths.length === 1) {
        return { type: 'static', path: paths[0], icon: iconOf(paths[0]) };
      } else if(paths.length > 1) {
        return { type: 'dynamic', paths: paths, icons: paths.map(path => iconOf(path)) };
      } else {
        return undefined;
      }
    }
    this.normalDecorations = new Map<LineVerificationStatus, GutterDecorationType>([
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
    this.grayedDecorations = new Map<LineVerificationStatus, GutterDecorationType>([
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
  }

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): VerificationGutterStatusView {
    const instance = new VerificationGutterStatusView(context);
    context.subscriptions.push(
      workspace.onDidCloseTextDocument(document => instance.clearVerificationDiagnostics(document.uri.toString())),
      window.onDidChangeActiveTextEditor(editor => instance.refreshDisplayedVerificationGutterStatuses(editor)),
      languageClient.onVerificationStatusGutter(params => instance.updateVerificationStatusGutter(params))
    );
    return instance;
  }

  /////////////////// Gutter rendering ///////////////////

  // For every decoration in the set of animated decorations,
  // sets all their ranges to empty except for the one corresponding to the animation frame.
  private animateIcon(editor: TextEditor, iconFrames: TextEditorDecorationType[], ranges: Range[]) {
    for(let i = 0; i < iconFrames.length; i++) {
      editor.setDecorations(iconFrames[i], this.animationFrame === i ? ranges : []);
    }
  }

  // Display the gutter icons with respect to the right animation frame.
  // Display icons in gray if there is at least one resolution error.
  public refreshDisplayedVerificationGutterStatuses(editor?: TextEditor, animateOnly: boolean = false): void {
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
    const decorationSets: { decorationSet: GutterDecorationSet, active: boolean }[]
      = [
        { decorationSet: this.normalDecorations, active: !resolutionFailed },
        { decorationSet: this.grayedDecorations, active: resolutionFailed } ];

    for(const { decorationSet, active } of decorationSets) {
      const decorations: Map<LineVerificationStatus, Range[]> = active ? originalData.decorations : VerificationGutterStatusView.emptyLinearVerificationDiagnostics;
      for(const enumMember in LineVerificationStatus) {
        if(!(parseInt(enumMember, 10) >= 0)) {
          continue;
        }
        const lineVerificationStatus: LineVerificationStatus = parseInt(enumMember, 10);
        this.addDecorationFor(lineVerificationStatus, decorations, decorationSet, animateOnly, editor);
      }
    }
  }

  // eslint-disable-next-line max-params
  private addDecorationFor(
    lineVerificationStatus: LineVerificationStatus,
    decorations: Map<LineVerificationStatus, Range[]>,
    decorationSet: GutterDecorationSet,
    animateOnly: boolean,
    editor: TextEditor) {
    const ranges = this.getRanges(decorations, lineVerificationStatus);
    const decorationType = decorationSet.get(lineVerificationStatus);
    // eslint-disable-next-line no-empty
    if(decorationType === undefined) {
    } else if(decorationType.type === 'static' && !animateOnly) {
      editor.setDecorations(decorationType.icon, ranges);
    } else if(decorationType.type === 'dynamic') {
      this.animateIcon(editor, decorationType.icons, ranges);
    }
  }

  private clearVerificationDiagnostics(documentPath: string): void {
    const data = this.dataByDocument.get(documentPath);
    if(data != null) {
      this.dataByDocument.delete(documentPath);
    }
  }

  private isErrorLine(lineStatus: LineVerificationStatus): boolean {
    return !nonErrorLineVerificationStatus.includes(lineStatus);
  }

  private addCosmeticsLine(lineStatus: LineVerificationStatus, beginning: boolean): LineVerificationStatus {
    if(lineStatus === LineVerificationStatus.ErrorContext) {
      return beginning ? LineVerificationStatus.ErrorContextStart : LineVerificationStatus.ErrorContextEnd;
    } else if(lineStatus === LineVerificationStatus.ErrorContextObsolete) {
      return beginning ? LineVerificationStatus.ErrorContextStartObsolete : LineVerificationStatus.ErrorContextEndObsolete;
    } else if(lineStatus === LineVerificationStatus.ErrorContextVerifying) {
      return beginning ? LineVerificationStatus.ErrorContextStartVerifying : LineVerificationStatus.ErrorContextEndVerifying;
    } else {
      return lineStatus;
    }
  }

  // Replace "error context" by "error context start" and "error context end" at the right place.
  private addCosmetics(lineDiagnostics: LineVerificationStatus[]): LineVerificationStatus[] {
    const newLineDiagnostics = [ ...lineDiagnostics ];
    let previousLineDiagnostic = LineVerificationStatus.Verified;
    for(let line = 0; line < newLineDiagnostics.length; line += 1) {
      const lineDiagnostic = newLineDiagnostics[line];
      if(!this.isErrorLine(previousLineDiagnostic)) {
        newLineDiagnostics[line] = this.addCosmeticsLine(lineDiagnostic, true);
      }
      previousLineDiagnostic = lineDiagnostic;
    }
    previousLineDiagnostic = LineVerificationStatus.Verified;
    for(let line = newLineDiagnostics.length - 1; line >= 0; line--) {
      const lineDiagnostic = newLineDiagnostics[line];
      if(!this.isErrorLine(previousLineDiagnostic)) {
        newLineDiagnostics[line] = this.addCosmeticsLine(lineDiagnostic, false);
      }
      previousLineDiagnostic = lineDiagnostic;
    }

    return newLineDiagnostics;
  }

  // Converts the IVerificationStatusGutter to a map from line verification status
  // to an array of ranges that VSCode can consume.
  private getRangesOfLineStatus(params: IVerificationGutterStatusParams): Map<LineVerificationStatus, Range[]> {
    const perLineStatus = this.addCosmetics(params.perLineStatus);

    let previousLineStatus = -1;
    let initialStatusLine = -1;
    const ranges: Map<LineVerificationStatus, Range[]> = VerificationGutterStatusView.FillLineVerificationStatusMap();

    // <= so that we add a virtual final line to commit the last range.
    for(let line = 0; line <= perLineStatus.length; line++) {
      const lineDiagnostic = line === perLineStatus.length ? -1 : perLineStatus[line];
      if(lineDiagnostic !== previousLineStatus) {
        if(previousLineStatus !== -1) { // Never assigned before
          const range = new Range(initialStatusLine, 1, line - 1, 1);
          ranges.get(previousLineStatus)?.push(range);
        }
        previousLineStatus = lineDiagnostic;
        initialStatusLine = line;
      }
    }
    return ranges;
  }

  // Returns true if the params are for a different version of this document
  private areParamsOutdated(params: IVerificationGutterStatusParams): boolean {
    const documentPath = getVsDocumentPath(params);
    const previousVersion = this.dataByDocument.get(documentPath)?.version;
    return (previousVersion !== undefined && params.version !== undefined
      && params.version < previousVersion);
  }

  // Entry point when receiving IVErificationStatusGutter
  private updateVerificationStatusGutter(params: IVerificationGutterStatusParams): void {
    if(this.areParamsOutdated(params)) {
      return;
    }
    const documentPath = getVsDocumentPath(params);
    const ranges = this.getRangesOfLineStatus(params);

    const newData: LinearVerificationGutterStatus = {
      decorations: ranges,
      version: params.version };

    this.setDisplayedVerificationStatusGutter(documentPath, newData);
  }

  // Gets the ranges associated to a line verification status
  // Adds an empty array if necessary
  private getRanges(ranges: Map<LineVerificationStatus, Range[]>, status: LineVerificationStatus): Range[] {
    let r = ranges.get(status);
    if(r === undefined) {
      r = [];
      ranges.set(status, r);
    }
    return r;
  }

  // Given current data and previous data, should we delay the display of the new data?
  private mustBeDelayed(ranges: Map<LineVerificationStatus, Range[]>, previousRanges: Map<LineVerificationStatus, Range[]>): boolean {
    const thereIsAResolutionError = this.getRanges(ranges, LineVerificationStatus.ResolutionError).length >= 1;
    const thereWasNoResolutionErrorBefore = this.getRanges(previousRanges, LineVerificationStatus.ResolutionError).length === 0;
    const firstTimeResolutionError = thereIsAResolutionError && thereWasNoResolutionErrorBefore;

    const thereIsALineMarkedObsolete = obsoleteLineVerificationStatus.some(status => this.getRanges(ranges, status).length >= 1);
    const noLineIsCurrentlyVerifying = verifyingLineVerificationStatus.every(status => this.getRanges(ranges, status).length === 0);
    const thereWasNoObsoleteStatusBefore = obsoleteLineVerificationStatus.every(status => this.getRanges(previousRanges, status).length === 0);

    const firstTimeEverythingIsObsolete = thereIsALineMarkedObsolete && noLineIsCurrentlyVerifying && thereWasNoObsoleteStatusBefore;
    return firstTimeResolutionError || firstTimeEverythingIsObsolete;
  }

  // Assigns the line verification gutter statuses to the given document.
  // Launches the animation if necessary, including delaying if necessary
  private setDisplayedVerificationStatusGutter(documentPath: string, newData: LinearVerificationGutterStatus) {
    const previousValue = this.dataByDocument.get(documentPath);
    const ranges = newData.decorations;
    if(this.animationCallback !== undefined) {
      clearInterval(this.animationCallback);
    }
    const previousRanges = previousValue === undefined ? VerificationGutterStatusView.emptyLinearVerificationDiagnostics : previousValue.decorations;
    if(this.mustBeDelayed(ranges, previousRanges)) {
      // Delay resolution errors so that we don't interrupt the verification workflow if they are corrected fast enough.
      this.animationCallback = setTimeout(() => {
        this.dataByDocument.set(documentPath, newData);
        this.refreshDisplayedVerificationGutterStatuses(window.activeTextEditor);
      }, DELAY_IF_RESOLUTION_ERROR);
    } else {
      this.dataByDocument.set(documentPath, newData);
      this.nextAnimationStep();
      this.refreshDisplayedVerificationGutterStatuses(window.activeTextEditor);
    }
    // Animated properties
    if(verifyingLineVerificationStatus.some(line =>this.getRanges(ranges, line).length > 0)) {
      this.animationCallback = setInterval(() => {
        this.nextAnimationStep();
        this.refreshDisplayedVerificationGutterStatuses(window.activeTextEditor, true);
      }, ANIMATION_INTERVAL);
    }
  }

  private nextAnimationStep() {
    this.animationFrame = 1 - this.animationFrame;
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
  }
}