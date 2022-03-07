import { Position } from 'vscode';
import { Diagnostic, DocumentUri, Range, integer } from 'vscode-languageclient';

export interface IVerificationDiagnosticsParams {
  uri: DocumentUri;
  version?: integer;
  diagnostics: Diagnostic[];
  perNodeDiagnostic: NodeDiagnostic[];// of size linesCount
  linesCount: integer;
  diagnosticsAreResolutionErrors: boolean;
  perLineDiagnostic: LineVerificationStatus[];
}

export interface NodeDiagnostic {
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
  children: NodeDiagnostic[];
  statusCurrent: CurrentStatus;
  statusVerification: VerificationStatus;
  relatedRanges: Range[];
}

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
  ErrorRangeObsolete = 301,
  ErrorRangeVerifying = 302,
  ErrorRange = 300,
  // For individual assertions in error ranges
  ErrorRangeAssertionVerifiedObsolete = 351,
  ErrorRangeAssertionVerifiedVerifying = 352,
  ErrorRangeAssertionVerified = 350,
  // For specific lines which have errors on it. They take over verified assertions
  ErrorObsolete = 401,
  ErrorVerifying = 402,
  Error = 400,
  // For lines containing resolution or parse errors
  ResolutionError = 16,
  // Cosmetics, not part of server's output
  ErrorRangeStart = 310,
  ErrorRangeStartObsolete = 311,
  ErrorRangeStartVerifying = 312,
  ErrorRangeEnd = 320,
  ErrorRangeEndObsolete = 321,
  ErrorRangeEndVerifying = 322
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