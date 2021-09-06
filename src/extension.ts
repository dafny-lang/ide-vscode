
import { ExtensionContext, OutputChannel, window as Window } from 'vscode';
import { ExtensionConstants } from './constants';

import { DafnyLanguageClient } from './language/dafnyLanguageClient';
import checkAndInformAboutInstallation from './startupCheck';
import DafnyIntegration from './ui/dafnyIntegration';
import LanguageServerInstaller from './ui/languageServerInstaller';

let languageClient: DafnyLanguageClient | undefined;
let dafnyIntegration: DafnyIntegration | undefined;
let statusOutput: OutputChannel | undefined;

export async function activate(context: ExtensionContext): Promise<void> {
  if(!await checkAndInformAboutInstallation(context)) {
    return;
  }
  statusOutput = Window.createOutputChannel(ExtensionConstants.ChannelName);
  await installLanguageServer(context);
  languageClient = await DafnyLanguageClient.create(context);
  languageClient.onServerVersion(version => console.log('received version: ' + version));
  languageClient.start();
  // TODO block all UI interactions or only the ones depending on the language client?
  await languageClient.onReady();
  dafnyIntegration = DafnyIntegration.createAndRegister(context, languageClient);
}

async function installLanguageServer(context: ExtensionContext): Promise<void> {
  const installer = new LanguageServerInstaller(context, statusOutput!);
  await installer.install();
}

export async function deactivate(): Promise<void> {
  await languageClient?.stop();
  dafnyIntegration?.dispose();
  statusOutput?.dispose();
}
