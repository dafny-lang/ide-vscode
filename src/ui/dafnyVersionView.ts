import { execFile } from 'child_process';
import { promisify } from 'util';

import { ExtensionContext, StatusBarAlignment, window } from 'vscode';

import { LanguageServerConstants } from '../constants';
import { getDotnetExecutablePath } from '../dotnet';
import { getCompilerRuntimePath } from '../language/dafnyInstallation';
import { enableOnlyForDafnyDocuments } from '../tools/visibility';
import { version as ExtensionVersion } from '../../package.json';

const UnknownVersion = LanguageServerConstants.UnknownVersion;
const CompilerVersionArg = '/version';
const StatusBarPriority = 10;
const execFileAsync = promisify(execFile);

async function getTooltipText(context: ExtensionContext, languageServerVersion: string): Promise<string> {
  const compilerVersion = await getCompilerVersion(context);
  return `Compiler: ${compilerVersion}\nLanguage Server: ${languageServerVersion}\nExtension: ${ExtensionVersion}`;
}

async function getCompilerVersion(context: ExtensionContext): Promise<string> {
  const { path: dotnetPath } = await getDotnetExecutablePath();
  const compilerPath = await getCompilerRuntimePath(context);
  try {
    const { stdout } = await execFileAsync(dotnetPath, [ compilerPath, CompilerVersionArg ]);
    const version = /\d+\.\d+\.\d+\.\d+/.exec(stdout);
    return (version == null || version.length === 0) ? UnknownVersion : version[0];
  } catch(error: unknown) {
    console.error('failed to retrieve the compiler version', error);
    return UnknownVersion;
  }
}

export default class DafnyVersionView {
  private constructor() {}

  public static async createAndRegister(context: ExtensionContext, languageServerVersion: string): Promise<void> {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority);
    statusBarItem.text = languageServerVersion;
    statusBarItem.tooltip = await getTooltipText(context, languageServerVersion);
    context.subscriptions.push(
      enableOnlyForDafnyDocuments(statusBarItem),
      statusBarItem
    );
  }
}
