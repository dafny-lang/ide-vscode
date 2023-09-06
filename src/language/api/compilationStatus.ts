import { DocumentUri, integer } from 'vscode-languageclient';

export enum CompilationStatus {
  Parsing = 'Parsing',
  ParsingFailed = 'ParsingFailed',
  Resolving = 'ResolutionStarted',
  ResolutionFailed = 'ResolutionFailed',
  PreparingVerification = 'PreparingVerification',
  ResolutionSucceeded = 'ResolutionSucceeded',
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
