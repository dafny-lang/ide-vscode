import { Uri, Range as VsRange, Position as VsPosition, DocumentFilter as VsDocumentFilter } from 'vscode';
import { DocumentUri, Range, Position, DocumentFilter } from 'vscode-languageclient';
import { LanguageConstants } from '../constants';

export function getVsDocumentPath(params: { uri: DocumentUri }): string {
  return Uri.parse(params.uri).toString();
}

export function toVsRange(range: Range): VsRange {
  return new VsRange(
    toVsPosition(range.start),
    toVsPosition(range.end)
  );
}

export function toVsPosition(position: Position): VsPosition {
  return new VsPosition(position.line, position.character);
}

export const DafnyDocumentFilter: DocumentFilter & VsDocumentFilter = {
  scheme: 'file',
  language: LanguageConstants.Id
};
