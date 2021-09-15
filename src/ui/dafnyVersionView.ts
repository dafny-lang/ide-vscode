import { execFile } from 'child_process';
import { promisify } from 'util';

import { ExtensionContext, StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { DafnyCommands } from '../commands';

import { LanguageConstants, LanguageServerConstants } from '../constants';
import { getDotnetExecutablePath } from '../dotnet';
import { getCompilerRuntimePath } from '../language/dafnyInstallation';

const UnknownVersion = LanguageServerConstants.UnknownVersion;
const CompilerVersionArg = '/version';
const StatusBarPriority = 10;
const execFilePromisified = promisify(execFile);

async function getTooltipText(context: ExtensionContext, languageServerVersion: string): Promise<string> {
  const compilerVersion = await getCompilerVersion(context);
  const extensionVersion = require(context.asAbsolutePath('./package.json')).version;
  return `Compiler: ${compilerVersion}\nLanguage Server: ${languageServerVersion}\nExtension: ${extensionVersion}`;
}

async function getCompilerVersion(context: ExtensionContext): Promise<string> {
  const dotnetPath = await getDotnetExecutablePath();
  const compilerPath = getCompilerRuntimePath(context);
  try {
    const { stdout } = await execFilePromisified(dotnetPath, [ compilerPath, CompilerVersionArg ]);
    const version = /\d+\.\d+\.\d+\.\d+/.exec(stdout);
    return (version == null || version.length === 0) ? UnknownVersion : version[0];
  } catch(error: unknown) {
    console.error('failed to retrieve the compiler version', error);
    return UnknownVersion;
  }
}

export default class DafnyVersionView {
  private constructor(
    private readonly context: ExtensionContext,
    private readonly languageServerVersion: string,
    private readonly statusBarItem: StatusBarItem
  ) {}

  public static async createAndRegister(context: ExtensionContext, languageServerVersion: string): Promise<DafnyVersionView> {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority);
    statusBarItem.text = languageServerVersion;
    statusBarItem.command = DafnyCommands.ShowVersion;
    statusBarItem.tooltip = await getTooltipText(context, languageServerVersion);
    const view = new DafnyVersionView(context, languageServerVersion, statusBarItem);
    context.subscriptions.push(
      window.onDidChangeActiveTextEditor(() => view.refreshVersionView()),
      statusBarItem
    );
    view.refreshVersionView();
    return view;
  }

  private refreshVersionView(): void {
    const editor = window.activeTextEditor;
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
}
