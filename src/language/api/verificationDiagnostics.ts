import { Position } from 'vscode';
import { Diagnostic, DocumentUri, Range, integer } from 'vscode-languageclient';

export interface IVerificationDiagnosticsParams {
  uri: DocumentUri;
  version?: integer;
  diagnostics: Diagnostic[];
  perNodeDiagnostic: NodeDiagnostic[];// of size linesCount
  linesCount: integer;
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
  Obsolete = 1,
  // For first-time computations, actively computing
  Pending = 2,
  // Also applicable for empty spaces if they are not surrounded by errors.
  Verified = 3,
  // For containers of other diagnostics nodes (e.g. methods)
  ErrorRangeObsolete = 4,
  ErrorRangePending = 5,
  ErrorRange = 6,
  // For specific lines which have errors on it.
  ErrorObsolete = 7,
  ErrorPending = 8,
  Error = 9
}

export enum NodeVerificationStatus {
  Unknown = 0,
  Obsolete = 1,
  Pending = 2,
  Verified = 3,
  ErrorObsolete = 4,
  ErrorPending = 5,
  Error = 6
}