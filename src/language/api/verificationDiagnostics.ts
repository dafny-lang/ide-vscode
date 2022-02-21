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
  // For first-time computation not actively computing but soon
  // (scheduledComputation)
  Scheduled = 1,
  // For first-time computations, actively computing
  Verifying = 2,
  VerifiedObsolete = 3,
  VerifiedVerifying = 4,
  // Also applicable for empty spaces if they are not surrounded by errors.
  Verified = 5,
  // For containers of other diagnostics nodes (e.g. methods)
  ErrorRangeObsolete = 6,
  ErrorRangePending = 7,
  ErrorRange = 8,
  // For specific lines which have errors on it.
  ErrorObsolete = 9,
  ErrorVerifying = 10,
  Error = 11,
  // For lines containing resolution or parse errors
  ResolutionError = 12
}

export enum NodeVerificationStatus {
  Unknown = 0,
  Scheduled = 1,
  Verifying = 2,
  VerifiedObsolete = 3,
  VerifiedVerifying = 4,
  Verified = 5,
  ErrorObsolete = 6,
  ErrorVerifying = 7,
  Error = 8
}