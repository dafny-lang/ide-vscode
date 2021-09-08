import { Disposable, ExtensionContext } from 'vscode';

import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import CompilationStatusView from './compilationStatusView';
import CompileCommands from './compileCommands';
import CounterExamplesView from './counterExamplesView';
import DafnyVersionView from './dafnyVersionView';

export default class DafnyIntegration {
  private constructor(
    private readonly registrations: Disposable
  ) {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient, dafnyVersion: string): DafnyIntegration {
    return new DafnyIntegration(
      Disposable.from(
        CounterExamplesView.createAndRegister(languageClient),
        CompileCommands.createAndRegister(context),
        CompilationStatusView.createAndRegister(languageClient),
        DafnyVersionView.createAndRegister(dafnyVersion)
      )
    );
  }

  dispose(): void {
    this.registrations.dispose();
  }
}