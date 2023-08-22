/* eslint-disable max-depth */
/* eslint-disable @typescript-eslint/brace-style */
import { Diagnostic, DiagnosticSeverity, DocumentSymbol, Range, Uri, languages, commands, workspace, Position } from 'vscode';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { IVerificationGutterStatusParams, LineVerificationStatus } from '../language/api/verificationGutterStatusParams';
import { NamedVerifiableStatus, PublishedVerificationStatus } from '../language/api/verificationSymbolStatusParams';
import VerificationSymbolStatusView from './verificationSymbolStatusView';
import VerificationGutterStatusView from './verificationGutterStatusView';

/**
 * This class shows verification tasks through the VSCode testing UI.
 */
export default class GutterIconsView {

  public constructor(
    private readonly languageClient: DafnyLanguageClient,
    private readonly gutterViewUi: VerificationGutterStatusView,
    private readonly symbolStatusView: VerificationSymbolStatusView)
  {
    languageClient.onPublishDiagnostics((uri) => {
      this.update(uri);
    });
    symbolStatusView.onUpdates(uri => {
      this.update(uri);
    });
  }

  private async update(uri: Uri) {
    const rootSymbols = await commands.executeCommand('vscode.executeDocumentSymbolProvider', uri) as DocumentSymbol[] | undefined;
    if(rootSymbols === undefined) {
      return;
    }
    const nameToSymbolRange = this.getNameToSymbolRange(rootSymbols);
    const diagnostics = languages.getDiagnostics(uri);
    const symbolStatus = this.symbolStatusView.getUpdatesForFile(uri.toString());

    const icons = await this.computeNewGutterIcons(uri, nameToSymbolRange, symbolStatus?.namedVerifiables, diagnostics);
    this.gutterViewUi.updateVerificationStatusGutter(icons, false);
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
  private async computeNewGutterIcons(
    uri: Uri,
    nameToSymbolRanges: Map<string, Range> | undefined,
    statuses: NamedVerifiableStatus[] | undefined,
    diagnostics: Diagnostic[]): Promise<IVerificationGutterStatusParams>
  {
    const document = await workspace.openTextDocument(uri);
    const statusPerLine = new Map<number, PublishedVerificationStatus>();
    const errorLineSource = new Map<number, string>();
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
        errorLineSource.set(line, diagnostic.source ?? '');
        const contextRange = lineToSymbolRange.get(line);
        if(contextRange === undefined) {
          continue;
        }
        for(let contextLine = contextRange.start.line; line < contextRange.end.line; line++) {
          linesInErrorContext.add(contextLine);
        }
      }
    }

    if(nameToSymbolRanges === undefined || statuses === undefined) {
      for(let line = 0; line < document.lineCount; line++) {
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
    for(let line = 0; line < document.lineCount; line++) {
      if(linesToSkip.has(line)) {
        perLineStatus.push(LineVerificationStatus.Nothing);
        continue;
      }

      const error = errorLineSource.get(line);
      if(error === 'Parser' || error === 'Resolver') { // TODO what about the resolver?
        perLineStatus.push(LineVerificationStatus.ResolutionError);
      } else {
        let bigNumber: number;
        if(error !== undefined) {
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
          smallNumber = 1;
          break;
        case PublishedVerificationStatus.Running:
          smallNumber = 2;
          break;
        case PublishedVerificationStatus.Error:
        case PublishedVerificationStatus.Correct:
        case undefined:
          smallNumber = 0;
          break;
        default: throw new Error(`unknown PublishedVerificationStatus ${statusPerLine.get(line)}`);
        }
        perLineStatus.push(bigNumber + smallNumber);
      }
    }
    return { uri: uri.toString(), perLineStatus: perLineStatus };
  }
}

function positionToString(start: Position): string {
  return `${start.line},${start.character}`;
}
