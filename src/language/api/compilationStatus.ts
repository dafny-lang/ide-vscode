import { DocumentUri, integer } from 'vscode-languageclient';

export enum CompilationStatus {
  ResolutionStarted = 'ResolutionStarted',
  ParsingFailed = 'ParsingFailed',
  ResolutionFailed = 'ResolutionFailed',
  CompilationSucceeded = 'CompilationSucceeded',
  VerificationStarted = 'VerificationStarted',
  VerificationFailed = 'VerificationFailed',
  VerificationSucceeded = 'VerificationSucceeded'
}

export interface ICompilationStatusParams {
  uri: DocumentUri;
  version?: integer;
  status: CompilationStatus;
  message?: string | null;
}

export interface IVerificationStartedParams {
  uri: DocumentUri;
}

export interface IVerificationCompletedParams {
  uri: DocumentUri;
  verified: boolean;
}
