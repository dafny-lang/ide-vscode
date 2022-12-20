
import { StatusBarAlignment, window } from 'vscode';

import { enableOnlyForDafnyDocuments } from '../tools/visibility';
import { version as ExtensionVersion } from '../../package.json';
import { DafnyInstaller } from '../language/dafnyInstallation';

const StatusBarPriority = 10;

export default class DafnyVersionView {
  private constructor() {}

  public static createAndRegister(installer: DafnyInstaller, languageServerVersion: string): void {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority);
    statusBarItem.text = languageServerVersion;
    statusBarItem.tooltip = `Dafny: ${languageServerVersion}\nExtension: ${ExtensionVersion}`;
    installer.context.subscriptions.push(
      enableOnlyForDafnyDocuments(statusBarItem),
      statusBarItem
    );
  }
}
