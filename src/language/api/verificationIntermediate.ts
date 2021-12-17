import { Diagnostic, DocumentUri, Range, integer } from 'vscode-languageclient';

export interface IVerificationIntermediateParams {
  uri: DocumentUri;
  version?: integer;
  methodNameBeingVerified: string,
  methodNameVerified: string,
  verified: boolean;
  range?: Range;
}