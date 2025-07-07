import { DecorationOptions, env, Position, Range, TextEditor, TextEditorDecorationType, Uri, window, workspace, commands, ExtensionContext } from 'vscode';

import { DafnyCommands } from '../commands';
import Configuration from '../configuration';
import { ConfigurationConstants } from '../constants';
import { IVerificationTraceItem, IVerificationTraceParams } from '../language/api/verificationTrace';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { debounce, DebounceError } from '../tools/debounce';

interface IColorOptions {
  backgroundColor: string | null;
  fontColor: string | null;
}

const VerificationTraceUpdateDelayMs = 1000;
const DefaultMargin = '0 0 0 30px';
const DefaultDarkBackgroundColor = '#0d47a1';
const DefaultDarkFontColor = '#e3f2fd';
const DefaultLightBackgroundColor = '#bbdefb';
const DefaultLightFontColor = '#102027';
const AssumePrefix = "assume ";
const SemicolonSuffix = ";";

export default class VerificationTraceView {
  private readonly activeDecorations = new Map<Uri, TextEditorDecorationType>();
  private readonly documentsWithActiveVerificationTrace = new Set<Uri>();
  private readonly getVerificationTraceDebounced = debounce(
    (param: IVerificationTraceParams) => this.languageClient.getVerificationTrace(param),
    VerificationTraceUpdateDelayMs
  );

  private disposed: boolean = false;

  private constructor(private readonly languageClient: DafnyLanguageClient) {
    this.synchronizeContextMenu(true);
  }

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): VerificationTraceView {
    const instance = new VerificationTraceView(languageClient);
    context.subscriptions.push(
      window.onDidChangeActiveTextEditor(editor => instance.updateVerificationTrace(editor)),
      workspace.onDidChangeTextDocument(() => instance.updateVerificationTrace(window.activeTextEditor)),
      commands.registerCommand(DafnyCommands.ShowVerificationTrace, () => instance.enableVerificationTraceForActiveEditor()),
      commands.registerCommand(DafnyCommands.HideVerificationTrace, () => instance.disableVerificationTraceForActiveEditor()),
      commands.registerCommand(DafnyCommands.CopyVerificationTrace, () => instance.CopyVerificationTraceForActiveEditor()),
      instance
    );
    return instance;
  }

  private async enableVerificationTraceForActiveEditor(): Promise<void> {
    const editor = window.activeTextEditor;
    if(editor == null) {
      return;
    }
    this.documentsWithActiveVerificationTrace.add(editor.document.uri);
    await this.updateVerificationTrace(editor, false);
  }

  private disableVerificationTraceForActiveEditor(): void {
    const editor = window.activeTextEditor;
    if(editor == null) {
      return;
    }
    this.documentsWithActiveVerificationTrace.delete(editor.document.uri);
    this.hideVerificationTrace(editor);
  }

  private async CopyVerificationTraceForActiveEditor(): Promise<void> {
    const editor = window.activeTextEditor;
    if(editor == null) {
      return;
    }
    const document = editor.document.uri;
    try {
      const params: IVerificationTraceParams = { textDocument: { uri: document.toString() } };
      const cs = await this.languageClient.getVerificationTrace(params);
      const asText = cs
        .map(c => {
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

  private async updateVerificationTrace(editor?: TextEditor, debounce: boolean = true): Promise<void> {
    if(editor == null) {
      return;
    }
    const document = editor.document.uri;
    if(!this.documentsWithActiveVerificationTrace.has(document)) {
      return;
    }
    this.hideVerificationTrace(editor);
    try {
      const params: IVerificationTraceParams = { textDocument: { uri: document.toString() } };
      const verificationTrace = debounce
        ? await this.getVerificationTraceDebounced(params)
        : await this.languageClient.getVerificationTrace(params);
      if(!this.disposed) {
        this.showVerificationTrace(verificationTrace, editor);
      }
    } catch(error: unknown) {
      if(!(error instanceof DebounceError)) {
        window.showErrorMessage(`VerificationTrace request failed: ${error}`);
      }
    }
  }

  private hideVerificationTrace(editor: TextEditor): void {
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
    const canShowVerificationTrace = typeof document === 'boolean' ? document : !this.activeDecorations.has(document);
    commands.executeCommand('setContext', 'dafny.verificationTraceMenu.CanShowVerificationTrace', canShowVerificationTrace);
  }

  private showVerificationTrace(verificationTrace: IVerificationTraceItem[], editor: TextEditor): void {
    const document = editor.document.uri;
    if(this.activeDecorations.has(document)) {
      return;
    }
    const decorators = verificationTrace
      .filter(verificationTrace => verificationTrace.position.line >= 0)
      .map(verificationTrace => VerificationTraceView.createDecorator(verificationTrace));
    const decoration = VerificationTraceView.createTextEditorDecoration();
    this.activeDecorations.set(document, decoration);
    this.synchronizeContextMenu(document);
    editor.setDecorations(decoration, decorators);
  }

  private static normalizeVerificationTraceForDisplay(contentText: string): string {
    if (contentText.startsWith(AssumePrefix)) {
      contentText = contentText.substring(AssumePrefix.length);
    }
    if (contentText.endsWith(SemicolonSuffix)) {
      contentText = contentText.substring(0, contentText.length - SemicolonSuffix.length).trimEnd();
    }
    contentText = contentText.split(" && ").map((v: string) => {
      // If the information is presented like
      // value == variable, we reformulate it like
      // variable == value which feels nicer.
      var r = /^.* == [\w'\?]+$/;
      if (r.test(v)) {
        const parts = v.split(' == ');
        return parts[1] + ' == ' + parts[0];
      }
      return v;
    }).join(", ");
    return contentText;
  }

  private static createDecorator(verificationTrace: IVerificationTraceItem): DecorationOptions {
    let contentText = verificationTrace.assumption;
    contentText = VerificationTraceView.normalizeVerificationTraceForDisplay(contentText);
    // TODO earlier versions showed a warning that there are references present.
    const line = verificationTrace.position.line;
    return {
      range: new Range(
        new Position(line, verificationTrace.position.character as number + 1),
        new Position(line, Number.MAX_VALUE)
      ),
      renderOptions: {
        after: { contentText }
      }
    };
  }

  private static createTextEditorDecoration(): TextEditorDecorationType {
    const customOptions = Configuration.get<IColorOptions>(ConfigurationConstants.VerificationTrace.Color);
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
    this.getVerificationTraceDebounced.dispose();
    for(const [ _, decoration ] of this.activeDecorations) {
      decoration.dispose();
    }
  }
}
