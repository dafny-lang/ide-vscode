import { Disposable, ExtensionContext, OutputChannel, window, workspace, commands, Uri, CancellationToken } from 'vscode';
import { ExtensionConstants, LanguageServerConstants } from './constants';
import { DafnyCommands } from './commands';
import { DafnyLanguageClient } from './language/dafnyLanguageClient';
import checkAndInformAboutInstallation from './startupCheck';
import { DafnyInstaller } from './language/dafnyInstallation';
import createAndRegisterDafnyIntegration from './ui/dafnyIntegration';
import { timeout } from './tools/timeout';
import { fileIssueURL } from './ui/statusBarActionView';

// Promise.any() is only available since Node.JS 15.
import * as PromiseAny from 'promise.any';

const DafnyVersionTimeoutMs = 5_000;
let extensionRuntime: ExtensionRuntime | undefined;

export async function activate(context: ExtensionContext): Promise<void> {
  if(!await checkAndInformAboutInstallation(context)) {
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

export async function restartServer(): Promise<void> {
  await extensionRuntime?.restart();
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
    workspace.registerTextDocumentContentProvider('dafny', {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      provideTextDocumentContent: function(uri: Uri, token: CancellationToken) {
        return '// Viewing Dafny libraries in the Dafny IDE is not yet supported.';
      }
    });

    await this.startClientAndWaitForVersion();
    createAndRegisterDafnyIntegration(this.installer, this.client!, this.languageServerVersion!);
    commands.registerCommand(DafnyCommands.RestartServer, restartServer);
    this.statusOutput.appendLine('Dafny is ready');
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

  public async dispose(): Promise<void> {
    await this.client?.stop();
  }

  public async startClientAndWaitForVersion() {
    this.client = this.client ?? await DafnyLanguageClient.create(this.installer);
    await this.client.start();
    this.languageServerVersion = await this.getLanguageServerVersionAfterStartup();
  }

  public async restart(): Promise<void> {
    this.statusOutput.appendLine('Terminating Dafny...');
    try {
      await this.dispose();
    } catch(e: unknown) {
      this.statusOutput.appendLine('Server did not respond...');
    }
    // The first subscription is the statusOutput and should not be disposed.
    for(let i = 1; i < this.context.subscriptions.length; i++) {
      this.context.subscriptions[i].dispose();
    }
    this.context.subscriptions.splice(1);
    await this.startClientAndWaitForVersion();
    createAndRegisterDafnyIntegration(this.installer, this.client!, this.languageServerVersion!);
    const issueURL = await fileIssueURL(this.languageServerVersion ?? '???', this.context);
    this.statusOutput.appendLine(
      'Dafny is ready again.\nIf you have time, please let us know why you needed to restart by filing an issue:\n'
      + issueURL);
  }
}
