import { ExtensionContext } from 'vscode';

import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import CompilationStatusView from './compilationStatusView';
import CompileCommands from './compileCommands';
import CounterexamplesView from './counterExamplesView';
import DafnyVersionView from './dafnyVersionView';
import GhostDiagnosticsView from './ghostDiagnosticsView';
import VerificationGutterStatusView from './verificationGutterStatusView';
import RelatedErrorView from './relatedErrorView';
import VerificationSymbolStatusView from './verificationSymbolStatusView';

export default async function createAndRegisterDafnyIntegration(
  context: ExtensionContext,
  languageClient: DafnyLanguageClient,
  languageServerVersion: string
): Promise<void> {
  CounterexamplesView.createAndRegister(context, languageClient);
  GhostDiagnosticsView.createAndRegister(context, languageClient);
  const compilationStatusView = CompilationStatusView.createAndRegister(context, languageClient, languageServerVersion);
  let symbolStatusView: VerificationSymbolStatusView | undefined = undefined;
  const serverSupportsSymbolStatusView = versionToNumeric('3.8.0') <= versionToNumeric(languageServerVersion);
  if(serverSupportsSymbolStatusView) {
    symbolStatusView = VerificationSymbolStatusView.createAndRegister(context, languageClient, compilationStatusView);
  } else {
    compilationStatusView.registerBefore38Messages();
  }
  VerificationGutterStatusView.createAndRegister(context, languageClient, symbolStatusView);
  CompileCommands.createAndRegister(context);
  RelatedErrorView.createAndRegister(context, languageClient);
  await DafnyVersionView.createAndRegister(context, languageServerVersion);
}

function versionToNumeric(version: string): number {
  const numbers = version.split('.').map(x => Number.parseInt(x));
  return ((numbers[0] * 1000) + numbers[1]) * 1000 + numbers[2];
}
