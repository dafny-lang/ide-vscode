/* eslint-disable max-depth */
/* eslint-disable @typescript-eslint/brace-style */
import { Diagnostic, DocumentSymbol, ExtensionContext, Range, Uri, window, workspace } from 'vscode';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import CompilationStatusView from './compilationStatusView';
import { IVerificationGutterStatusParams, LineVerificationStatus } from '../language/api/verificationGutterStatusParams';
import { NamedVerifiableStatus, PublishedVerificationStatus } from '../language/api/verificationSymbolStatusParams';
import VerificationSymbolStatusView from './verificationSymbolStatusView';

/**
 * This class shows verification tasks through the VSCode testing UI.
 */
export default class GutterIconsView {


  public constructor(
    private readonly context: ExtensionContext,
    private readonly languageClient: DafnyLanguageClient,
    private readonly compilationStatusView: CompilationStatusView)
  {
    languageClient.onPublishDiagnostics((uri, diagnostics) => {

    });
  }

  private nameToSymbolRange(rootSymbols: DocumentSymbol[]): Map<Range, Range> {

  }

  /*
  No support for first-time icons yet. For first time we pretend like the symbol was previously verified.
  Error context is only triggered if the symbol currently has an error, not if it only had an error and is currently verifying.
  */
  private async computeNewGutterIcons(uri: Uri, nameToSymbolRanges: Map<Range, Range>,
    statuses: NamedVerifiableStatus[],
    diagnostics: Diagnostic[]): Promise<IVerificationGutterStatusParams>
  {
    const document = await workspace.openTextDocument(uri);
    const statusPerLine = new Map<number, PublishedVerificationStatus>();
    const linesWithErrors = new Map<number, boolean>();
    const lineToSymbolRange = new Map<number, Range>();
    const linesInErrorContext = new Set<number>();

    for(const range of nameToSymbolRanges.values()) {
      for(let line = range.start.line; line < range.end.line; line++) {
        lineToSymbolRange.set(line, range);
      }
    }
    const perLineStatus: LineVerificationStatus[] = [];
    for(const diagnostic of diagnostics) {
      for(let line = diagnostic.range.start.line; line < diagnostic.range.end.line; line++) {
        linesWithErrors.set(line, diagnostic.source === 'Parser');
        const contextRange = lineToSymbolRange.get(line)!;
        for(let line = contextRange.start.line; line < contextRange.end.line; line++) {
          linesInErrorContext.add(line);
        }
      }
    }

    for(const status of statuses) {
      const symbolRange = nameToSymbolRanges.get(VerificationSymbolStatusView.convertRange(status.nameRange))!;
      for(let line = symbolRange.start.line; line < symbolRange.end.line; line++) {
        statusPerLine.set(line, status.status);
      }
    }
    for(let line = 0; line < document.lineCount; line++) {
      const error = linesWithErrors.get(line);
      if(error === true) {
        perLineStatus.push(LineVerificationStatus.ResolutionError);
      } else {
        let bigNumber: number;
        if(error === false) {
          bigNumber = LineVerificationStatus.AssertionFailed;
        } else {
          if(linesInErrorContext.has(line)) {
            bigNumber = LineVerificationStatus.ErrorContext;
          } else {
            bigNumber = LineVerificationStatus.Verified;
          }
        }
        let smallNumber: number;
        switch(statusPerLine.get(line)) {
        case PublishedVerificationStatus.Stale:
        case PublishedVerificationStatus.Queued:
          smallNumber = 0;
          break;
        case PublishedVerificationStatus.Running:
          smallNumber = 1;
          break;
        case PublishedVerificationStatus.Error:
        case PublishedVerificationStatus.Correct:
          smallNumber = 2;
          break;
        default: throw new Error(`unknown PublishedVerificationStatus ${statusPerLine.get(line)}`);
        }
        perLineStatus.push(bigNumber + smallNumber);
      }
    }
    return { uri: uri.toString(), perLineStatus: perLineStatus };
  }

//   export enum LineVerificationStatus {
//     // Default value for every line, before the renderer figures it out.
//     Nothing = 0,
//     // For first-time computation not actively computing but soon. Synonym of "obsolete"
//     // (scheduledComputation)
//     Scheduled = 1,
//     // For first-time computations, actively computing
//     Verifying = 2,
//     // Also applicable for empty spaces if they are not surrounded by errors.
//     Verified = 200,
//     VerifiedObsolete = 201,
//     VerifiedVerifying = 202,
//    // For trees containing children with errors (e.g. methods)
//     ErrorContext = 300,
//     ErrorContextObsolete = 301,
//     ErrorContextVerifying = 302,
//     // For individual assertions in error ranges
//     AssertionVerifiedInErrorContext = 350,
//     AssertionVerifiedInErrorContextObsolete = 351,
//     AssertionVerifiedInErrorContextVerifying = 352,
//     // For specific lines which have errors on it. They take over verified assertions
//     AssertionFailed = 400,
//     AssertionFailedObsolete = 401,
//     AssertionFailedVerifying = 402,
//     // For lines containing resolution or parse errors
//     ResolutionError = 500,
//   }
}