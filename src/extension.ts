import { Disposable, ExtensionContext, OutputChannel, window } from 'vscode';
import { ExtensionConstants, LanguageServerConstants } from './constants';

import { DafnyLanguageClient } from './language/dafnyLanguageClient';
import checkAndInformAboutInstallation from './startupCheck';
import { DafnyInstaller, getLanguageServerRuntimePath, isConfiguredToInstallLatestDafny } from './language/dafnyInstallation';
import { Messages } from './ui/messages';
import createAndRegisterDafnyIntegration from './ui/dafnyIntegration';
import { timeout } from './tools/timeout';

// Promise.any() is only available since Node.JS 15.
import * as PromiseAny from 'promise.any';

const DafnyVersionTimeoutMs = 5_000;
let extensionRuntime: ExtensionRuntime | undefined;

export async function activate(context: ExtensionContext): Promise<void> {
  if(!await checkAndInformAboutInstallation()) {
    return;
  }
  const statusOutput = window.createOutputChannel(ExtensionConstants.ChannelName);
  context.subscriptions.push(statusOutput);
  extensionRuntime = new ExtensionRuntime(context, statusOutput);
  await extensionRuntime.initialize();
}

export async function deactivate(): Promise<void> {
  await extensionRuntime?.dispose();
}

class ExtensionRuntime {
  private readonly installer: DafnyInstaller;
  private client?: DafnyLanguageClient;
  private languageServerVersion?: string;

  public constructor(
    private readonly context: ExtensionContext,
    private readonly statusOutput: OutputChannel
  ) {
    this.installer = new DafnyInstaller(context, statusOutput);
  }

  public async initialize(): Promise<void> {
    if(!this.installer.isCustomInstallation() && !await this.installer.isLanguageServerRuntimeAccessible()) {
      if(!await this.installer.install()) {
        window.showErrorMessage(Messages.Installation.Error);
        return;
      }
    }
    await this.initializeClient();
    if(!await this.updateDafnyIfNecessary(this.languageServerVersion!)) {
      this.statusOutput.appendLine('Dafny initialization failed');
      return;
    }
    await createAndRegisterDafnyIntegration(this.context, this.client!, this.languageServerVersion!);
    this.statusOutput.appendLine('Dafny is ready');
  }

  private async initializeClient(): Promise<void> {
    this.statusOutput.appendLine(`starting Dafny from ${getLanguageServerRuntimePath(this.context)}`);
    this.client = await DafnyLanguageClient.create(this.context);
    this.client.start();
    await this.client.onReady();
    this.languageServerVersion = await this.getLanguageServerVersionAfterStartup();
  }

  private async getLanguageServerVersionAfterStartup(): Promise<string> {
    let versionRegistration: Disposable | undefined;
    const version = await PromiseAny([
      new Promise<string>(resolve => {
        versionRegistration = this.client!.onServerVersion(version => resolve(version));
      }),
      // Fallback to unknown in case the server does not report the version.
      timeout(DafnyVersionTimeoutMs, LanguageServerConstants.UnknownVersion)
    ]);
    versionRegistration!.dispose();
    return version;
  }

  private async updateDafnyIfNecessary(installedVersion: string): Promise<boolean> {
    if(this.installer.isLatestKnownLanguageServerOrNewer(installedVersion)) {
      return true;
    }
    if(this.installer.isCustomInstallation() || !isConfiguredToInstallLatestDafny()) {
      window.showInformationMessage(
        `${Messages.Installation.Outdated} ${installedVersion} < ${LanguageServerConstants.LatestVersion}`
      );
      return true;
    }
    await this.client!.stop();
    if(!await this.installer.install()) {
      window.showErrorMessage(Messages.Installation.Error);
      return false;
    }
    await this.initializeClient();
    return true;
  }

  public async dispose(): Promise<void> {
    await this.client?.stop();
  }
}
