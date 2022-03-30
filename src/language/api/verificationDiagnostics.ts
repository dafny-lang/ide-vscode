import { Position } from 'vscode';
import { Diagnostic, DocumentUri, Range, integer } from 'vscode-languageclient';

export interface IVerificationDiagnosticsParams {
  uri: DocumentUri;
  version?: integer;
  diagnostics: Diagnostic[];
  perNodeDiagnostic: INodeDiagnostic[];
  diagnosticsAreResolutionErrors: boolean;
  perLineDiagnostic: LineVerificationStatus[];
}

export interface INodeDiagnostic {
  displayName: string;
  identifier: string;
  position: Position;
  started: boolean;
  finished: boolean;
  startTime: integer;
  endTime: integer;
  timeSpent: integer;
  resourceCount: integer;
  range: Range;
  children: INodeDiagnostic[];
  statusCurrent: CurrentStatus;
  statusVerification: VerificationStatus;
  relatedRanges: Range[];
  immediatelyRelatedRanges?: Range[];
  dynamicallyRelatedRanges?: Range[];
}

// Except for cosmetics, this enumeration is a copy-paste from Dafny's
// Source/DafnyLanguageServer/Workspace/Notifications/VerificationDiagnosticsParams.cs
export enum LineVerificationStatus {
  // Default value for every line, before the renderer figures it out.
  Unknown = 0,
  // For first-time computation not actively computing but soon. Synonym of "obsolete"
  // (scheduledComputation)
  Scheduled = 1,
  // For first-time computations, actively computing
  Verifying = 2,
  VerifiedObsolete = 201,
  VerifiedVerifying = 202,
  // Also applicable for empty spaces if they are not surrounded by errors.
  Verified = 200,
  // For containers of other diagnostics nodes (e.g. methods)
  ErrorContextObsolete = 301,
  ErrorContextVerifying = 302,
  ErrorContext = 300,
  // For individual assertions in error ranges
  AssertionVerifiedInErrorContextObsolete = 351,
  AssertionVerifiedInErrorContextVerifying = 352,
  AssertionVerifiedInErrorContext = 350,
  // For specific lines which have errors on it. They take over verified assertions
  AssertionFailedObsolete = 401,
  AssertionFailedVerifying = 402,
  AssertionFailed = 400,
  // For lines containing resolution or parse errors
  ResolutionError = 500,
  // Cosmetics, not part of server's output
  ErrorContextStart = 310,
  ErrorContextStartObsolete = 311,
  ErrorContextStartVerifying = 312,
  ErrorContextEnd = 320,
  ErrorContextEndObsolete = 321,
  ErrorContextEndVerifying = 322
}

export enum VerificationStatus {
  Unknown = 0,
  Verified = 200,
  Error = 400
}

export enum CurrentStatus {
  Current = 0,
  Obsolete = 1,
  Verifying = 2
}

export enum ScrollColor {
  Unknown = '#00000000',
  Error = '#fe536aa0',
  ErrorActive = '#fe536ad0',
  ErrorRange = '#fad00080',
  Verified = '#62b45580'
}