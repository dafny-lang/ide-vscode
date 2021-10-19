import { Uri, Range as VsRange, Position as VsPosition } from 'vscode';
import { DocumentUri, Range, Position } from 'vscode-languageclient';

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
