import { execFile } from 'child_process';
import { promisify } from 'util';

import { ExtensionContext, StatusBarAlignment, window } from 'vscode';

import { LanguageServerConstants } from '../constants';
import { enableOnlyForDafnyDocuments } from '../tools/visibility';
import { version as ExtensionVersion } from '../../package.json';
import { DafnyInstaller } from '../language/dafnyInstallation';

const UnknownVersion = LanguageServerConstants.UnknownVersion;
const StatusBarPriority = 10;
const execFileAsync = promisify(execFile);

async function getTooltipText(installer: DafnyInstaller, languageServerVersion: string): Promise<string> {
  const compilerVersion = await getCompilerVersion(installer);
  return `Compiler: ${compilerVersion}\nLanguage Server: ${languageServerVersion}\nExtension: ${ExtensionVersion}`;
}

async function getCompilerVersion(installer: DafnyInstaller): Promise<string> {
  const compilerPath = await installer.getCliExecutable([ '--version' ], [ '/version' ]);
  try {
    const { stdout } = await execFileAsync(compilerPath.command, compilerPath.args);
    const version = /\d+\.\d+\.\d+\.\d+/.exec(stdout);
    return (version == null || version.length === 0) ? UnknownVersion : version[0];
  } catch(error: unknown) {
    console.error('failed to retrieve the compiler version', error);
    return UnknownVersion;
  }
}

export default class DafnyVersionView {
  private constructor() {}

  public static async createAndRegister(installer: DafnyInstaller, languageServerVersion: string): Promise<void> {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority);
    statusBarItem.text = languageServerVersion;
    statusBarItem.tooltip = await getTooltipText(installer, languageServerVersion);
    installer.context.subscriptions.push(
      enableOnlyForDafnyDocuments(statusBarItem),
      statusBarItem
    );
  }
}
