import { DecorationOptions, Position, Range, TextEditor, TextEditorDecorationType, Uri, window, workspace, commands, ExtensionContext } from 'vscode';

import { DafnyCommands } from '../commands';
import Configuration from '../configuration';
import { ConfigurationConstants } from '../constants';
import { ICounterexampleItem, ICounterexampleParams } from '../language/api/counterexample';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { debounce, DebounceError } from '../tools/debounce';

interface IColorOptions {
  backgroundColor: string | null;
  fontColor: string | null;
}

const CounterexampleUpdateDelayMs = 1000;
const DefaultMargin = '0 0 0 30px';
const DefaultDarkBackgroundColor = '#0d47a1';
const DefaultDarkFontColor = '#e3f2fd';
const DefaultLightBackgroundColor = '#bbdefb';
const DefaultLightFontColor = '#102027';

export default class CounterexamplesView {
  private readonly activeDecorations = new Map<Uri, TextEditorDecorationType>();
  private readonly documentsWithActiveCounterexamples = new Set<Uri>();
  private readonly getCounterexamplesDebounced = debounce(
    (param: ICounterexampleParams) => this.languageClient.getCounterexamples(param),
    CounterexampleUpdateDelayMs
  );

  private disposed: boolean = false;

  private constructor(private readonly languageClient: DafnyLanguageClient) {
    this.synchronizeContextMenu(true);
  }

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): CounterexamplesView {
    const instance = new CounterexamplesView(languageClient);
    context.subscriptions.push(
      window.onDidChangeActiveTextEditor(editor => instance.updateCounterexamples(editor)),
      workspace.onDidChangeTextDocument(() => instance.updateCounterexamples(window.activeTextEditor)),
      commands.registerCommand(DafnyCommands.ShowCounterexample, () => instance.enableCounterexamplesForActiveEditor()),
      commands.registerCommand(DafnyCommands.HideCounterexample, () => instance.disableCounterexamplesForActiveEditor()),
      instance
    );
    return instance;
  }

  private async enableCounterexamplesForActiveEditor(): Promise<void> {
    const editor = window.activeTextEditor;
    if(editor == null) {
      return;
    }
    this.documentsWithActiveCounterexamples.add(editor.document.uri);
    await this.updateCounterexamples(editor, false);
  }

  private disableCounterexamplesForActiveEditor(): void {
    const editor = window.activeTextEditor;
    if(editor == null) {
      return;
    }
    this.documentsWithActiveCounterexamples.delete(editor.document.uri);
    this.hideCounterexamples(editor);
  }

  private async updateCounterexamples(editor?: TextEditor, debounce: boolean = true): Promise<void> {
    if(editor == null) {
      return;
    }
    const document = editor.document.uri;
    if(!this.documentsWithActiveCounterexamples.has(document)) {
      return;
    }
    this.hideCounterexamples(editor);
    try {
      const params: ICounterexampleParams = { textDocument: { uri: document.toString() } };
      const counterexamples = debounce
        ? await this.getCounterexamplesDebounced(params)
        : await this.languageClient.getCounterexamples(params);
      if(!this.disposed) {
        this.showCounterexamples(counterexamples, editor);
      }
    } catch(error: unknown) {
      if(!(error instanceof DebounceError)) {
        window.showErrorMessage(`Counterexample request failed: ${error}`);
      }
    }
  }

  private hideCounterexamples(editor: TextEditor): void {
    const document = editor.document.uri;
    const decoration = this.activeDecorations.get(document);
    if(decoration == null) {
      return;
    }
    decoration.dispose();
    this.activeDecorations.delete(document);
    this.synchronizeContextMenu(document);
  }

  private synchronizeContextMenu(document: Uri | boolean) {
    const canShowCounterexamples = typeof document === 'boolean' ? document : !this.activeDecorations.has(document);
    commands.executeCommand('setContext', 'dafny.counterexampleMenu.CanShowCounterExample', canShowCounterexamples);
  }

  private showCounterexamples(counterexamples: ICounterexampleItem[], editor: TextEditor): void {
    const document = editor.document.uri;
    if(this.activeDecorations.has(document)) {
      return;
    }
    const decorators = counterexamples
      .filter(counterexample => counterexample.position.line >= 0)
      .map(counterexample => CounterexamplesView.createDecorator(counterexample));
    const decoration = CounterexamplesView.createTextEditorDecoration();
    this.activeDecorations.set(document, decoration);
    this.synchronizeContextMenu(document);
    editor.setDecorations(decoration, decorators);
  }

  private static createDecorator(counterexample: ICounterexampleItem): DecorationOptions {
    const contentText = Object.entries(counterexample.variables)
      .map(([ name, value ]) => `${name} = ${value}`)
      .join(' ');
    // TODO earlier versions showed a warning that there are references present.
    const line = counterexample.position.line;
    return {
      range: new Range(
        new Position(line, counterexample.position.character as number + 1),
        new Position(line, Number.MAX_VALUE)
      ),
      renderOptions: {
        after: { contentText }
      }
    };
  }

  private static createTextEditorDecoration(): TextEditorDecorationType {
    const customOptions = Configuration.get<IColorOptions>(ConfigurationConstants.Counterexamples.Color);
    return window.createTextEditorDecorationType({
      dark:{
        after: {
          backgroundColor: customOptions.backgroundColor ?? DefaultDarkBackgroundColor,
          color: customOptions.fontColor ?? DefaultDarkFontColor,
          margin: DefaultMargin
        }
      },
      light: {
        after: {
          backgroundColor: customOptions.backgroundColor ?? DefaultLightBackgroundColor,
          color: customOptions.fontColor ?? DefaultLightFontColor,
          margin: DefaultMargin
        }
      }
    });
  }

  public dispose(): void {
    this.disposed = true;
    this.getCounterexamplesDebounced.dispose();
    for(const [ _, decoration ] of this.activeDecorations) {
      decoration.dispose();
    }
  }
}