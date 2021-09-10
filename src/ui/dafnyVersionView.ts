import { execFile } from 'child_process';
import { promisify } from 'util';

import { ExtensionContext, StatusBarAlignment, StatusBarItem, window as Window, commands as Commands } from 'vscode';
import { DafnyCommands } from '../commands';

import { LanguageConstants, LanguageServerConstants } from '../constants';
import { getDotnetExecutablePath } from '../dotnet';
import { getCompilerRuntimePath } from '../language/dafnyInstallation';

const UnknownVersion = LanguageServerConstants.UnknownVersion;
const CompilerVersionArg = '/version';
const StatusBarPriority = 10;
const execFilePromisified = promisify(execFile);

export default class DafnyVersionView {
  private constructor(
    private readonly context: ExtensionContext,
    private readonly languageServerVersion: string,
    private readonly statusBarItem: StatusBarItem
  ) {}

  public static createAndRegister(context: ExtensionContext, languageServerVersion: string): DafnyVersionView {
    const statusBarItem = Window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority);
    statusBarItem.text = languageServerVersion;
    statusBarItem.command = DafnyCommands.ShowVersion;
    const view = new DafnyVersionView(context, languageServerVersion, statusBarItem);
    context.subscriptions.push(
      Window.onDidChangeActiveTextEditor(() => view.refreshVersionView()),
      Commands.registerCommand(DafnyCommands.ShowVersion, () => view.showDafnyVersion()),
      statusBarItem
    );
    view.refreshVersionView();
    return view;
  }

  private refreshVersionView(): void {
    const editor = Window.activeTextEditor;
    if(editor == null) {
      return;
    }
    const document = editor.document;
    if(document.languageId === LanguageConstants.Id) {
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  private async showDafnyVersion(): Promise<void> {
    const compilerVersion = await this.getCompilerVersion();
    const extensionVersion = require(this.context.asAbsolutePath('./package.json')).version;
    Window.showInformationMessage(
      `Compiler: ${compilerVersion}, Language Server: ${this.languageServerVersion}, Extension: ${extensionVersion}`
    );
  }

  private async getCompilerVersion(): Promise<string> {
    const dotnetPath = await getDotnetExecutablePath();
    const compilerPath = getCompilerRuntimePath(this.context);
    try {
      const { stdout } = await execFilePromisified(dotnetPath, [ compilerPath, CompilerVersionArg ]);
      const version = /\d+\.\d+\.\d+\.\d+/.exec(stdout);
      return (version == null || version.length === 0) ? UnknownVersion : version[0];
    } catch(error: unknown) {
      console.error('failed to retrieve the compiler version', error);
      return UnknownVersion;
    }
  }
}