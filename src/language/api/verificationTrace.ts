import { TextDocumentIdentifier, Position } from 'vscode-languageclient';

export interface IVerificationTraceItem {
  position: Position;
  assumption: string;
}

export interface IVerificationTraceParams {
  textDocument: TextDocumentIdentifier;
}
