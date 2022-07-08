import { TextDocumentIdentifier, Position } from 'vscode-languageclient';

export interface ICounterexampleItem {
  position: Position;
  variables: { [name: string]: string };
}

export interface ICounterexampleParams {
  textDocument: TextDocumentIdentifier;
}
