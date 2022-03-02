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
  status: NodeVerificationStatus;
}

export enum LineVerificationStatus {
  // Default value for every line, before the renderer figures it out.
  Unknown = 0,
  // For first-time computation not actively computing but soon. Synonym of "obsolete"
  // (scheduledComputation)
  Scheduled = 1,
  // For first-time computations, actively computing
  Verifying = 2,
  VerifiedObsolete = 3,
  VerifiedVerifying = 4,
  // Also applicable for empty spaces if they are not surrounded by errors.
  Verified = 5,
  // Dafny tried to do something but couldn't (timeout, out of resources...)
  Inconclusive = 6,
  // For containers of other diagnostics nodes (e.g. methods)
  ErrorRangeObsolete = 7,
  ErrorRangeVerifying = 8,
  ErrorRange = 9,
  // For individual assertions in error ranges
  ErrorRangeAssertionVerifiedObsolete = 10,
  ErrorRangeAssertionVerifiedVerifying = 11,
  ErrorRangeAssertionVerified = 12,
  // For specific lines which have errors on it.
  ErrorObsolete = 13,
  ErrorVerifying = 14,
  Error = 15,
  // For lines containing resolution or parse errors
  ResolutionError = 16,
  // Cosmetics, not part of server's output
  ErrorRangeStart = 17,
  ErrorRangeStartObsolete = 18,
  ErrorRangeStartVerifying = 19,
  ErrorRangeEnd = 20,
  ErrorRangeEndObsolete = 21,
  ErrorRangeEndVerifying = 22,
  NumberOfLineDiagnostics = 23
}

export enum NodeVerificationStatus {
  Unknown = 0,
  Scheduled = 1,
  Verifying = 2,
  VerifiedObsolete = 3,
  VerifiedVerifying = 4,
  Verified = 5,
  Inconclusive = 6,
  ErrorObsolete = 7,
  ErrorVerifying = 8,
  Error = 9
}

export enum ScrollColor {
  Unknown = '#00000000',
  Error = '#fe536aa0',
  ErrorActive = '#fe536ad0',
  ErrorRange = '#fad00080',
  Verified = '#62b45580'
}