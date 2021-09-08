import { ExtensionContext } from 'vscode';

import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import CompilationStatusView from './compilationStatusView';
import CompileCommands from './compileCommands';
import CounterExamplesView from './counterExamplesView';
import DafnyVersionView from './dafnyVersionView';

export default function createAndRegisterDafnyIntegration(context: ExtensionContext, languageClient: DafnyLanguageClient, dafnyVersion: string): void {
  CounterExamplesView.createAndRegister(context, languageClient);
  CompileCommands.createAndRegister(context);
  CompilationStatusView.createAndRegister(context, languageClient);
  DafnyVersionView.createAndRegister(context, dafnyVersion);
}
