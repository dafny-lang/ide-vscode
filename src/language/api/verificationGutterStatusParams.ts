import { DocumentUri, integer } from 'vscode-languageclient';

export interface IVerificationGutterStatusParams {
  uri: DocumentUri;
  version?: integer;
  perLineStatus: LineVerificationStatus[];
}

// Except for cosmetics, this enumeration is a copy-paste from Dafny's
// Source/DafnyLanguageServer/Workspace/Notifications/VerificationDiagnosticsParams.cs
export enum LineVerificationStatus {
  // Default value for every line, before the renderer figures it out.
  Nothing = 0,
  // For first-time computation not actively computing but soon. Synonym of "obsolete"
  // (scheduledComputation)
  Scheduled = 1,
  // For first-time computations, actively computing
  Verifying = 2,
  VerifiedObsolete = 201,
  VerifiedVerifying = 202,
  // Also applicable for empty spaces if they are not surrounded by errors.
  Verified = 200,
 // For trees containing children with errors (e.g. methods)
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

export enum ScrollColor {
  Unknown = '#00000000',
  Error = '#fe536aa0',
  ErrorActive = '#fe536ad0',
  ErrorRange = '#fad00080',
  Verified = '#62b45580'
}

export const obsoleteLineVerificationStatus: LineVerificationStatus[] = [
  LineVerificationStatus.AssertionFailedObsolete,
  LineVerificationStatus.VerifiedObsolete,
  LineVerificationStatus.ErrorContextObsolete,
  LineVerificationStatus.ErrorContextStartObsolete,
  LineVerificationStatus.ErrorContextEndObsolete
];
export const verifyingLineVerificationStatus: LineVerificationStatus[] = [
  LineVerificationStatus.Verifying,
  LineVerificationStatus.AssertionFailedVerifying,
  LineVerificationStatus.ErrorContextEndVerifying,
  LineVerificationStatus.ErrorContextVerifying,
  LineVerificationStatus.ErrorContextStartVerifying,
  LineVerificationStatus.VerifiedVerifying,
  LineVerificationStatus.AssertionVerifiedInErrorContextVerifying
];
export const nonErrorLineVerificationStatus: LineVerificationStatus[] = [
  LineVerificationStatus.Scheduled,
  LineVerificationStatus.Nothing,
  LineVerificationStatus.Verified,
  LineVerificationStatus.VerifiedObsolete,
  LineVerificationStatus.VerifiedVerifying,
  LineVerificationStatus.Verifying
];