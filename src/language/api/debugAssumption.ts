import { TextDocumentIdentifier, Position } from 'vscode-languageclient';

export interface IDebugAssumptionItem {
  position: Position;
  assumption: string;
}

export interface IDebugAssumptionParams {
  textDocument: TextDocumentIdentifier;
}
