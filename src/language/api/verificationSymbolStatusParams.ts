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
  FoundSomeErrors = 4, // Finished and had errors
  FoundAllErrors = 5,
  Correct = 6 // Finished and was correct
}