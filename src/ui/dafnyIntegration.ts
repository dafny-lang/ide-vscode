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
import * as dafnyInstallation from '../language/dafnyInstallation';

export default async function createAndRegisterDafnyIntegration(
  context: ExtensionContext,
  languageClient: DafnyLanguageClient,
  languageServerVersion: string
): Promise<void> {
  CounterexamplesView.createAndRegister(context, languageClient);
  GhostDiagnosticsView.createAndRegister(context, languageClient);
  const compilationStatusView = CompilationStatusView.createAndRegister(context, languageClient, languageServerVersion);
  let symbolStatusView: VerificationSymbolStatusView | undefined = undefined;
  const apiVersion = await dafnyInstallation.getServerApiVersion();
  const usingDafny38OrHigher = dafnyInstallation.versionToNumeric('3.8.0') <= dafnyInstallation.versionToNumeric(apiVersion);
  if(usingDafny38OrHigher) {
    symbolStatusView = VerificationSymbolStatusView.createAndRegister(context, languageClient, compilationStatusView);
  }
  VerificationGutterStatusView.createAndRegister(context, languageClient, symbolStatusView);
  CompileCommands.createAndRegister(context);
  RelatedErrorView.createAndRegister(context, languageClient);
  await DafnyVersionView.createAndRegister(context, languageServerVersion);
}
