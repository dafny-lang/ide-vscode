import { Diagnostic, DocumentUri, integer } from 'vscode-languageclient';

export interface IGhostDiagnosticsParams {
  uri: DocumentUri;
  version?: integer;
  diagnostics: Diagnostic[];
}