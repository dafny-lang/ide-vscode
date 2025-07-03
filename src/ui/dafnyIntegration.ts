import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import CompilationStatusView from './compilationStatusView';
import CompileCommands from './compileCommands';
import DebugAssumptionsView from './debugAssumptionView';
import DafnyVersionView from './dafnyVersionView';
import GhostDiagnosticsView from './ghostDiagnosticsView';
import VerificationGutterStatusView from './verificationGutterStatusView';
import RelatedErrorView from './relatedErrorView';
import VerificationSymbolStatusView from './verificationSymbolStatusView';
import Configuration from '../configuration';
import { ConfigurationConstants, LanguageServerConstants } from '../constants';
import { DafnyInstaller } from '../language/dafnyInstallation';

export default function createAndRegisterDafnyIntegration(
  installer: DafnyInstaller,
  languageClient: DafnyLanguageClient,
  languageServerVersion: string
): void {
  DebugAssumptionsView.createAndRegister(installer.context, languageClient);
  GhostDiagnosticsView.createAndRegister(installer.context, languageClient);
  const serverSupportsSymbolStatusView = configuredVersionToNumeric('3.8.0') <= configuredVersionToNumeric(languageServerVersion);
  CompilationStatusView.createAndRegister(installer.context, languageClient, serverSupportsSymbolStatusView, languageServerVersion);
  let symbolStatusView: VerificationSymbolStatusView | undefined = undefined;
  if(serverSupportsSymbolStatusView && Configuration.get<boolean>(ConfigurationConstants.LanguageServer.DisplayVerificationAsTests)) {
    symbolStatusView = VerificationSymbolStatusView.createAndRegister(installer.context, languageClient);
  }
  VerificationGutterStatusView.createAndRegister(installer.context, languageClient, symbolStatusView);
  CompileCommands.createAndRegister(installer);
  RelatedErrorView.createAndRegister(installer.context, languageClient);
  DafnyVersionView.createAndRegister(installer, languageServerVersion);
}

export function configuredVersionToNumeric(version: string): number {
  if(version === LanguageServerConstants.LatestNightly) {
    return Number.MAX_SAFE_INTEGER;
  }
  if(version === LanguageServerConstants.LatestStable) {
    version = LanguageServerConstants.LatestVersion;
  }
  const numbers = version.split('.').map(x => Number.parseInt(x));
  return ((numbers[0] * 1000) + (numbers[1] ?? 0)) * 1000 + (numbers[2] ?? 0);
}
