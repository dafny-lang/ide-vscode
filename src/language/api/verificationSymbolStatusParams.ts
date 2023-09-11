import { Range, DocumentUri, integer } from 'vscode-languageclient';

export interface IVerificationSymbolStatusParams {
  uri: DocumentUri;
  version?: integer;
  namedVerifiables: NamedVerifiableStatus[];
}
export interface NamedVerifiableStatus {
  nameRange: Range;
  status: PublishedVerificationStatus;
}

// Taken from https://github.com/dafny-lang/dafny/blob/afd3138abffec0ddeace3f0d79bd7535290f39fd/Source/DafnyLanguageServer/Workspace/FileVerificationStatus.cs#L45
export enum PublishedVerificationStatus {
  Stale = 0, // Not scheduled to be run
  Queued = 1, // Scheduled to be run but waiting for resources
  Running = 2, // Currently running
  Error = 4, // Finished and had errors
  Correct = 5, // Finished and was correct
  FoundAllErrors = 6 // Finished, had errors and found them all
}