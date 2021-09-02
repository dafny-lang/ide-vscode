import { Disposable } from 'vscode';

import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import CompilationStatusView from './compilationStatusView';
import CompileCommands from './compileCommands';
import CounterExamplesView from './counterExamplesView';

export default class DafnyIntegration {
  private constructor(
    private readonly registrations: Disposable
  ) {}

  public static createAndRegister(languageClient: DafnyLanguageClient): DafnyIntegration {
    return new DafnyIntegration(
      Disposable.from(
        CounterExamplesView.createAndRegister(languageClient),
        CompileCommands.createAndRegister(),
        CompilationStatusView.createAndRegister(languageClient)
      )
    );
  }

  dispose(): void {
    this.registrations.dispose();
  }
}