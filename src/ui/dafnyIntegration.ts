import { ExtensionContext } from 'vscode';

import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import CompilationStatusView from './compilationStatusView';
import CompileCommands from './compileCommands';
import CounterExamplesView from './counterExamplesView';
import DafnyVersionView from './dafnyVersionView';

export default async function createAndRegisterDafnyIntegration(
  context: ExtensionContext,
  languageClient: DafnyLanguageClient,
  languageServerVersion: string
): Promise<void> {
  CounterExamplesView.createAndRegister(context, languageClient);
  CompileCommands.createAndRegister(context);
  CompilationStatusView.createAndRegister(context, languageClient);
  await DafnyVersionView.createAndRegister(context, languageServerVersion);
}
