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
  VerificationGutterStatusView.createAndRegister(context, languageClient);
  VerificationSymbolStatusView.createAndRegister(context, languageClient);
  CompileCommands.createAndRegister(context);
  CompilationStatusView.createAndRegister(context, languageClient, languageServerVersion);
  RelatedErrorView.createAndRegister(context, languageClient);
  await DafnyVersionView.createAndRegister(context, languageServerVersion);
}
