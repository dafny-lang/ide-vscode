import { DecorationOptions, Position, Range, TextEditor, TextEditorDecorationType, Uri, window as Window, workspace as Workspace, commands as Commands, Disposable } from 'vscode';

import { DafnyCommands } from '../commands';
import Configuration from '../configuration';
import { ConfigurationConstants } from '../constants';
import { ICounterExampleItem, ICounterExampleParams } from '../language/api/counterExample';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { debounce, DebounceError } from '../tools/debounce';

interface IColorOptions {
  backgroundColor: string | null;
  fontColor: string | null;
}

const CounterExampleUpdateDelayMs = 1000;
const DefaultMargin = '0 0 0 30px';
const DefaultDarkBackgroundColor = '#0d47a1';
const DefaultDarkFontColor = '#e3f2fd';
const DefaultLightBackgroundColor = '#bbdefb';
const DefaultLightFontColor = '#102027';

export default class CounterExamplesView {
  private readonly activeDecorations = new Map<Uri, TextEditorDecorationType>();
  private readonly documentsWithActiveCounterExamples = new Set<Uri>();

  private readonly getCounterExamplesDebounced = debounce(
    (param: ICounterExampleParams) => this.languageClient.getCounterExamples(param),
    CounterExampleUpdateDelayMs
  );

  private eventRegistrations?: Disposable;
  private disposed: boolean = false;

  private constructor(private readonly languageClient: DafnyLanguageClient) {}

  public static createAndRegister(languageClient: DafnyLanguageClient): CounterExamplesView {
    const instance = new CounterExamplesView(languageClient);
    instance.eventRegistrations = Disposable.from(
      Window.onDidChangeActiveTextEditor(editor => instance.updateCounterExamples(editor)),
      Workspace.onDidChangeTextDocument(() => instance.updateCounterExamples(Window.activeTextEditor)),
      Commands.registerCommand(DafnyCommands.ShowCounterExample, () => instance.enableCounterExamplesForActiveEditor()),
      Commands.registerCommand(DafnyCommands.HideCounterExample, () => instance.disableCounterExamplesForActiveEditor())
    );
    return instance;
  }

  private async enableCounterExamplesForActiveEditor(): Promise<void> {
    const editor = Window.activeTextEditor;
    if(editor == null) {
      return;
    }
    this.documentsWithActiveCounterExamples.add(editor.document.uri);
    await this.updateCounterExamples(editor, false);
  }

  private disableCounterExamplesForActiveEditor(): void {
    const editor = Window.activeTextEditor;
    if(editor == null) {
      return;
    }
    this.documentsWithActiveCounterExamples.delete(editor.document.uri);
    this.hideCounterExamples(editor);
  }

  private async updateCounterExamples(editor?: TextEditor, debounce: boolean = true): Promise<void> {
    if(editor == null) {
      return;
    }
    const document = editor.document.uri;
    if(!this.documentsWithActiveCounterExamples.has(document)) {
      return;
    }
    this.hideCounterExamples(editor);
    try {
      const params: ICounterExampleParams = { textDocument: { uri: document.toString() } };
      const counterExamples = debounce
        ? await this.getCounterExamplesDebounced(params)
        : await this.languageClient.getCounterExamples(params);
      if(!this.disposed) {
        this.showCounterExamples(counterExamples, editor);
      }
    } catch(error: unknown) {
      if(!(error instanceof DebounceError)) {
        Window.showErrorMessage(`CounterExample request failed: ${error}`);
      }
    }
  }

  private hideCounterExamples(editor: TextEditor): void {
    const document = editor.document.uri;
    const decoration = this.activeDecorations.get(document);
    if(decoration == null) {
      return;
    }
    decoration.dispose();
    this.activeDecorations.delete(document);
  }

  private showCounterExamples(counterExamples: ICounterExampleItem[], editor: TextEditor): void {
    const document = editor.document.uri;
    if(this.activeDecorations.has(document)) {
      return;
    }
    const decorators = counterExamples
      .filter(counterExample => counterExample.position.line >= 0)
      .map(counterExample => CounterExamplesView.createDecorator(counterExample));
    const decoration = CounterExamplesView.createTextEditorDecoration();
    this.activeDecorations.set(document, decoration);
    editor.setDecorations(decoration, decorators);
  }

  private static createDecorator(counterExample: ICounterExampleItem): DecorationOptions {
    const contentText = Object.keys(counterExample.variables)
      .map(variableName => `${variableName} = ${counterExample.variables[variableName]}`)
      .join(' ');
    // TODO earlier versions showed a warning that there are references present.
    const line = counterExample.position.line;
    return {
      range: new Range(
        new Position(line, counterExample.position.character + 1),
        new Position(line, Number.MAX_VALUE)
      ),
      renderOptions: {
        after: { contentText }
      }
    };
  }

  private static createTextEditorDecoration(): TextEditorDecorationType {
    const customOptions = Configuration.get<IColorOptions>(ConfigurationConstants.CounterExamples.Color);
    return Window.createTextEditorDecorationType({
      dark:{
        after: {
          backgroundColor: customOptions.backgroundColor ?? DefaultDarkBackgroundColor,
          color: customOptions.fontColor ?? DefaultDarkFontColor,
          margin: DefaultMargin,
        },
      },
      light: {
        after: {
          backgroundColor: customOptions.backgroundColor ?? DefaultLightBackgroundColor,
          color: customOptions.fontColor ?? DefaultLightFontColor,
          margin: DefaultMargin,
        },
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    this.getCounterExamplesDebounced.dispose();
    for(const [_, decoration] of this.activeDecorations) {
      decoration.dispose();
    }
    this.eventRegistrations?.dispose();
  }
}