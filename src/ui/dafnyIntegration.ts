import { Disposable } from 'vscode-languageclient';

import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import CompilationStatusView from './compilationStatusView';
import CompileCommands from './compileCommands';
import CounterExamplesView from './counterExamplesView';

export default class DafnyIntegration implements Disposable {
  private constructor(
    private readonly registrations: Disposable[]
  ) {}

  public static createAndRegister(languageClient: DafnyLanguageClient): DafnyIntegration {
    return new DafnyIntegration(
      [
        CounterExamplesView.createAndRegister(languageClient),
        CompileCommands.createAndRegister(),
        CompilationStatusView.createAndRegister(languageClient)
      ]
    );
  }

  dispose(): void {
    for(const registration of this.registrations) {
      registration.dispose();
    }
  }
}