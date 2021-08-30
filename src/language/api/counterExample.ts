import { TextDocumentIdentifier, Position } from 'vscode-languageclient';

export interface ICounterExampleItem {
  position: Position;
  variables: { [name: string]: string };
}

export interface ICounterExampleParams {
  textDocument: TextDocumentIdentifier;
}
