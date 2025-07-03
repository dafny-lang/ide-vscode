import { DecorationOptions, env, Position, Range, TextEditor, TextEditorDecorationType, Uri, window, workspace, commands, ExtensionContext } from 'vscode';

import { DafnyCommands } from '../commands';
import Configuration from '../configuration';
import { ConfigurationConstants } from '../constants';
import { IDebugAssumptionItem, IDebugAssumptionParams } from '../language/api/debugAssumption';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { debounce, DebounceError } from '../tools/debounce';

interface IColorOptions {
  backgroundColor: string | null;
  fontColor: string | null;
}

const DebugAssumptionUpdateDelayMs = 1000;
const DefaultMargin = '0 0 0 30px';
const DefaultDarkBackgroundColor = '#0d47a1';
const DefaultDarkFontColor = '#e3f2fd';
const DefaultLightBackgroundColor = '#bbdefb';
const DefaultLightFontColor = '#102027';

export default class DebugAssumptionsView {
  private readonly activeDecorations = new Map<Uri, TextEditorDecorationType>();
  private readonly documentsWithActiveDebugAssumptions = new Set<Uri>();
  private readonly getDebugAssumptionsDebounced = debounce(
    (param: IDebugAssumptionParams) => this.languageClient.getDebugAssumptions(param),
    DebugAssumptionUpdateDelayMs
  );

  private disposed: boolean = false;

  private constructor(private readonly languageClient: DafnyLanguageClient) {
    this.synchronizeContextMenu(true);
  }

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): DebugAssumptionsView {
    const instance = new DebugAssumptionsView(languageClient);
    context.subscriptions.push(
      window.onDidChangeActiveTextEditor(editor => instance.updateDebugAssumptions(editor)),
      workspace.onDidChangeTextDocument(() => instance.updateDebugAssumptions(window.activeTextEditor)),
      commands.registerCommand(DafnyCommands.ShowDebugAssumption, () => instance.enableDebugAssumptionsForActiveEditor()),
      commands.registerCommand(DafnyCommands.HideDebugAssumption, () => instance.disableDebugAssumptionsForActiveEditor()),
      commands.registerCommand(DafnyCommands.CopyDebugAssumption, () => instance.CopyDebugAssumptionForActiveEditor()),
      instance
    );
    return instance;
  }

  private async enableDebugAssumptionsForActiveEditor(): Promise<void> {
    const editor = window.activeTextEditor;
    if(editor == null) {
      return;
    }
    this.documentsWithActiveDebugAssumptions.add(editor.document.uri);
    await this.updateDebugAssumptions(editor, false);
  }

  private disableDebugAssumptionsForActiveEditor(): void {
    const editor = window.activeTextEditor;
    if(editor == null) {
      return;
    }
    this.documentsWithActiveDebugAssumptions.delete(editor.document.uri);
    this.hideDebugAssumptions(editor);
  }

  private async CopyDebugAssumptionForActiveEditor(): Promise<void> {
    const editor = window.activeTextEditor;
    if(editor == null) {
      return;
    }
    const document = editor.document.uri;
    try {
      const params: IDebugAssumptionParams = { textDocument: { uri: document.toString() } };
      const cs = await this.languageClient.getDebugAssumptions(params);
      const asText = cs
        .map(c => {
          const prop = editor.document.lineAt(c.position.line).text.trim();
          return c.assumption;
        })
        .join('\n\n');
      if(asText) {
        env.clipboard.writeText(asText);
      }
    } catch(error: unknown) {
      if(!(error instanceof DebounceError)) {
        window.showErrorMessage(`Counter-example request failed: ${error}`);
      }
    }
  }

  private async updateDebugAssumptions(editor?: TextEditor, debounce: boolean = true): Promise<void> {
    if(editor == null) {
      return;
    }
    const document = editor.document.uri;
    if(!this.documentsWithActiveDebugAssumptions.has(document)) {
      return;
    }
    this.hideDebugAssumptions(editor);
    try {
      const params: IDebugAssumptionParams = { textDocument: { uri: document.toString() } };
      const debugassumptions = debounce
        ? await this.getDebugAssumptionsDebounced(params)
        : await this.languageClient.getDebugAssumptions(params);
      if(!this.disposed) {
        this.showDebugAssumptions(debugassumptions, editor);
      }
    } catch(error: unknown) {
      if(!(error instanceof DebounceError)) {
        window.showErrorMessage(`DebugAssumption request failed: ${error}`);
      }
    }
  }

  private hideDebugAssumptions(editor: TextEditor): void {
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
    const canShowDebugAssumptions = typeof document === 'boolean' ? document : !this.activeDecorations.has(document);
    commands.executeCommand('setContext', 'dafny.debugassumptionMenu.CanShowDebugAssumption', canShowDebugAssumptions);
  }

  private showDebugAssumptions(debugassumptions: IDebugAssumptionItem[], editor: TextEditor): void {
    const document = editor.document.uri;
    if(this.activeDecorations.has(document)) {
      return;
    }
    const decorators = debugassumptions
      .filter(debugassumption => debugassumption.position.line >= 0)
      .map(debugassumption => DebugAssumptionsView.createDecorator(debugassumption));
    const decoration = DebugAssumptionsView.createTextEditorDecoration();
    this.activeDecorations.set(document, decoration);
    this.synchronizeContextMenu(document);
    editor.setDecorations(decoration, decorators);
  }

  private static createDecorator(debugassumption: IDebugAssumptionItem): DecorationOptions {
    const contentText = debugassumption.assumption;
    // TODO earlier versions showed a warning that there are references present.
    const line = debugassumption.position.line;
    return {
      range: new Range(
        new Position(line, debugassumption.position.character as number + 1),
        new Position(line, Number.MAX_VALUE)
      ),
      renderOptions: {
        after: { contentText }
      }
    };
  }

  private static createTextEditorDecoration(): TextEditorDecorationType {
    const customOptions = Configuration.get<IColorOptions>(ConfigurationConstants.DebugAssumptions.Color);
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
    this.getDebugAssumptionsDebounced.dispose();
    for(const [ _, decoration ] of this.activeDecorations) {
      decoration.dispose();
    }
  }
}
