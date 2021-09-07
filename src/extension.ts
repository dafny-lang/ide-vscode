
import { ExtensionContext, OutputChannel, window as Window } from 'vscode';
import { ExtensionConstants, LanguageServerConstants } from './constants';

import { DafnyLanguageClient } from './language/dafnyLanguageClient';
import checkAndInformAboutInstallation from './startupCheck';
import DafnyIntegration from './ui/dafnyIntegration';
import { DafnyInstaller } from './language/dafnyInstallation';
import { Messages } from './ui/messages';

let extensionRuntime: ExtensionRuntime | undefined;
let statusOutput: OutputChannel | undefined;

export async function activate(context: ExtensionContext): Promise<void> {
  if(!await checkAndInformAboutInstallation()) {
    return;
  }
  statusOutput = Window.createOutputChannel(ExtensionConstants.ChannelName);
  extensionRuntime = new ExtensionRuntime(context, statusOutput);
  await extensionRuntime.initialize();
}

export async function deactivate(): Promise<void> {
  await extensionRuntime?.dispose();
  statusOutput?.dispose();
}

class ExtensionRuntime {
  private readonly installer: DafnyInstaller;
  private client?: DafnyLanguageClient;
  private integration?: DafnyIntegration;

  constructor(
    private readonly context: ExtensionContext,
    private readonly statusOutput: OutputChannel
  ) {
    this.installer = new DafnyInstaller(context, statusOutput);
  }

  public async initialize(): Promise<void> {
    if(!await this.installer.isAutomaticInstallationPresent()) {
      if(!await this.installer.install()) {
        await Window.showErrorMessage(Messages.Installation.Error);
        return;
      }
    }
    await this.initializeClient();
    // Only register the version handler during the first iteration to not create an infinite loop of updates.
    this.client!.onServerVersion(async version => {
      if(!await this.updateDafnyIfNecessary(version)) {
        this.statusOutput.appendLine('Dafny initialization failed');
        return;
      }
      this.integration = DafnyIntegration.createAndRegister(this.context, this.client!);
      this.statusOutput.appendLine('Dafny is ready');
    });
  }

  private async initializeClient(): Promise<void> {
    this.statusOutput.appendLine('starting Dafny');
    this.client = await DafnyLanguageClient.create(this.context);
    this.client.start();
    await this.client.onReady();
  }

  private async updateDafnyIfNecessary(installedVersion: string): Promise<boolean> {
    if(DafnyInstaller.isMinimumRequiredLanguageServer(installedVersion)) {
      return true;
    }
    if(this.installer.isCustomInstallation()) {
      await Window.showInformationMessage(`Your Dafny installation is outdated. Recommended=${LanguageServerConstants.RequiredVersion}, Yours=${installedVersion}`);
      return true;
    }
    await this.client!.stop();
    if(!await this.installer.install()) {
      await Window.showErrorMessage(Messages.Installation.Error);
      return false;
    }
    await this.initializeClient();
    return true;
  }

  async dispose(): Promise<void> {
    this.integration?.dispose();
    await this.client?.stop();
  }
}
