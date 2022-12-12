
import { StatusBarAlignment, window } from 'vscode';

import { enableOnlyForDafnyDocuments } from '../tools/visibility';
import { version as ExtensionVersion } from '../../package.json';
import { DafnyInstaller } from '../language/dafnyInstallation';

const StatusBarPriority = 10;

async function getTooltipText(installer: DafnyInstaller, dafnyVersion: string): Promise<string> {
  return `Dafny: ${dafnyVersion}\nExtension: ${ExtensionVersion}`;
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
