/* eslint-disable max-depth */
/* eslint-disable @typescript-eslint/brace-style */
import { Diagnostic, DiagnosticSeverity, DocumentSymbol, Range, Uri, languages, commands, workspace, Position } from 'vscode';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { LineVerificationStatus } from '../language/api/verificationGutterStatusParams';
import { NamedVerifiableStatus, PublishedVerificationStatus } from '../language/api/verificationSymbolStatusParams';
import VerificationSymbolStatusView from './verificationSymbolStatusView';
import VerificationGutterStatusView from './verificationGutterStatusView';
import SymbolStatusService from './symbolStatusService';

// TODO merge with VerificationGutterStatusView
export default class GutterIconsView {

  public constructor(
    private readonly languageClient: DafnyLanguageClient,
    private readonly gutterViewUi: VerificationGutterStatusView,
    private readonly symbolStatusService: SymbolStatusService)
  {
    languageClient.onPublishDiagnostics((uri) => {
      this.update(uri);
    });
    symbolStatusService.onUpdates(params => {
      this.update(Uri.parse(params.uri));
    });
  }

  private async update(uri: Uri) {
    const rootSymbols = await commands.executeCommand('vscode.executeDocumentSymbolProvider', uri) as DocumentSymbol[] | undefined;
    if(rootSymbols === undefined) {
      return;
    }
    const nameToSymbolRange = this.getNameToSymbolRange(rootSymbols);
    const diagnostics = languages.getDiagnostics(uri);
    const symbolStatus = this.symbolStatusService.getUpdatesForFile(uri.toString());

    const document = await workspace.openTextDocument(uri);
    const perLineStatus = GutterIconsView.computeGutterIcons(document.lineCount, nameToSymbolRange, symbolStatus?.namedVerifiables, diagnostics);
    this.gutterViewUi.updateVerificationStatusGutter({ uri: uri.toString(), perLineStatus: perLineStatus }, false);
  }

  private getNameToSymbolRange(rootSymbols: DocumentSymbol[]): Map<string, Range> {
    const result = new Map<string, Range>();
    const stack = rootSymbols;
    while(stack.length > 0) {
      const top = stack.pop()!;
      const children = top.children ?? [];
      stack.push(...children);
      result.set(positionToString(top.selectionRange.start), top.range);
    }
    return result;
  }

  /*
  No support for first-time icons yet. For first time we pretend like the symbol was previously verified.
  */
  public static computeGutterIcons(
    lineCount: number,
    nameToSymbolRanges: Map<string, Range> | undefined,
    statuses: NamedVerifiableStatus[] | undefined,
    diagnostics: Diagnostic[]): LineVerificationStatus[]
  {
    const statusPerLine = new Map<number, PublishedVerificationStatus>();
    const lineToErrorSource = new Map<number, string>();
    const lineToSymbolRange = new Map<number, Range>();
    const linesInErrorContext = new Set<number>();
    const linesToSkip = new Set<number>();

    if(nameToSymbolRanges !== undefined) {
      for(const range of nameToSymbolRanges.values()) {
        for(let line = range.start.line; line < range.end.line; line++) {
          lineToSymbolRange.set(line, range);
        }
      }
    }
    const perLineStatus: LineVerificationStatus[] = [];
    for(const diagnostic of diagnostics) {
      if(diagnostic.severity !== DiagnosticSeverity.Error) {
        continue;
      }
      for(let line = diagnostic.range.start.line; line <= diagnostic.range.end.line; line++) {
        lineToErrorSource.set(line, diagnostic.source ?? '');
        const contextRange = lineToSymbolRange.get(line);
        if(contextRange === undefined) {
          continue;
        }
        for(let contextLine = contextRange.start.line; contextLine <= contextRange.end.line; contextLine++) {
          linesInErrorContext.add(contextLine);
        }
      }
    }

    if(nameToSymbolRanges === undefined || statuses === undefined) {
      for(let line = 0; line < lineCount; line++) {
        statusPerLine.set(line, PublishedVerificationStatus.Stale);
      }
    } else {
      for(const status of statuses) {
        const convertedRange = VerificationSymbolStatusView.convertRange(status.nameRange);
        const symbolRange = nameToSymbolRanges.get(positionToString(convertedRange.start));
        linesToSkip.add(convertedRange.start.line);
        if(symbolRange === undefined) {
          console.error('symbol mismatch between documentSymbol and symbolStatus API');
          continue;
        }
        for(let line = symbolRange.start.line; line <= symbolRange.end.line; line++) {
          statusPerLine.set(line, status.status);
        }
      }
    }
    for(let line = 0; line < lineCount; line++) {
      if(linesToSkip.has(line)) {
        perLineStatus.push(LineVerificationStatus.Nothing);
        continue;
      }

      const error = lineToErrorSource.get(line);
      if(error === 'Parser' || error === 'Resolver') {
        perLineStatus.push(LineVerificationStatus.ResolutionError);
      } else {
        let resultStatus: number;
        if(error !== undefined) {
          resultStatus = LineVerificationStatus.AssertionFailed;
        } else {
          if(linesInErrorContext.has(line)) {
            resultStatus = LineVerificationStatus.ErrorContext;
          } else {
            resultStatus = LineVerificationStatus.Verified;
          }
        }
        let progressStatus: number;
        switch(statusPerLine.get(line)) {
        case PublishedVerificationStatus.Stale:
        case PublishedVerificationStatus.Queued:
          progressStatus = GutterIconProgress.Stale;
          break;
        case PublishedVerificationStatus.Running:
          progressStatus = GutterIconProgress.Running;
          break;
        case PublishedVerificationStatus.Error:
        case PublishedVerificationStatus.Correct:
        case undefined:
          progressStatus = GutterIconProgress.Done;
          break;
        default: throw new Error(`unknown PublishedVerificationStatus ${statusPerLine.get(line)}`);
        }
        perLineStatus.push(resultStatus + progressStatus);
      }
    }
    return perLineStatus;
  }
}

export enum GutterIconProgress {
  Stale = 1,
  Running = 2,
  Done = 0
}

function positionToString(start: Position): string {
  return `${start.line},${start.character}`;
}
