import { Disposable, ExtensionContext, OutputChannel, window as Window } from 'vscode';
import { ExtensionConstants, LanguageServerConstants } from './constants';

import { DafnyLanguageClient } from './language/dafnyLanguageClient';
import checkAndInformAboutInstallation from './startupCheck';
import { DafnyInstaller, getLanguageServerRuntimePath } from './language/dafnyInstallation';
import { Messages } from './ui/messages';
import createAndRegisterDafnyIntegration from './ui/dafnyIntegration';

let extensionRuntime: ExtensionRuntime | undefined;
let statusOutput: OutputChannel | undefined;
let dafnyVersion: string | undefined;

export async function activate(context: ExtensionContext): Promise<void> {
  if(!await checkAndInformAboutInstallation()) {
    return;
  }
  statusOutput = Window.createOutputChannel(ExtensionConstants.ChannelName);
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

  constructor(
    private readonly context: ExtensionContext,
    private readonly statusOutput: OutputChannel
  ) {
    this.installer = new DafnyInstaller(context, statusOutput);
  }

  public async initialize(): Promise<void> {
    if(!this.installer.isCustomInstallation() && !await this.installer.isLanguageServerRuntimeAccessible()) {
      if(!await this.installer.install()) {
        Window.showErrorMessage(Messages.Installation.Error);
        return;
      }
    }
    await this.initializeClient();
    // Only register the version handler during the first iteration to not create an infinite loop of updates.
    if(!await this.updateDafnyIfNecessary(dafnyVersion!)) {
      this.statusOutput.appendLine('Dafny initialization failed');
      return;
    }
    createAndRegisterDafnyIntegration(this.context, this.client!, dafnyVersion!);
    this.statusOutput.appendLine('Dafny is ready');
  }

  private async initializeClient(): Promise<void> {
    this.statusOutput.appendLine(`starting Dafny from ${getLanguageServerRuntimePath(this.context)}`);
    this.client = await DafnyLanguageClient.create(this.context);
    this.client.start();
    await this.client.onReady();
    dafnyVersion = await this.getDafnyVersionAfterStartup();
  }

  private async getDafnyVersionAfterStartup(): Promise<string> {
    let versionRegistration: Disposable | undefined;
    const version = await new Promise<string>(resolve => {
      versionRegistration = this.client!.onServerVersion(version => resolve(version));
    });
    versionRegistration?.dispose();
    return version;
  }

  private async updateDafnyIfNecessary(installedVersion: string): Promise<boolean> {
    if(DafnyInstaller.isMinimumRequiredLanguageServer(installedVersion)) {
      return true;
    }
    if(this.installer.isCustomInstallation()) {
      Window.showInformationMessage(`Your Dafny installation is outdated. Recommended=${LanguageServerConstants.RequiredVersion}, Yours=${installedVersion}`);
      return true;
    }
    await this.client!.stop();
    if(!await this.installer.install()) {
      Window.showErrorMessage(Messages.Installation.Error);
      return false;
    }
    await this.initializeClient();
    return true;
  }

  async dispose(): Promise<void> {
    await this.client?.stop();
  }
}
