
import { ExtensionContext, OutputChannel, window as Window } from 'vscode';
import { ExtensionConstants, LanguageServerConstants } from './constants';

import { DafnyLanguageClient, isCustomLanguageServerInstallation, isLanguageServerRuntimeAccessible } from './language/dafnyLanguageClient';
import checkAndInformAboutInstallation from './startupCheck';
import DafnyIntegration from './ui/dafnyIntegration';
import LanguageServerInstaller from './ui/languageServerInstaller';
import { Messages } from './ui/messages';

let languageClient: DafnyLanguageClient | undefined;
let dafnyIntegration: DafnyIntegration | undefined;
let statusOutput: OutputChannel | undefined;

export async function activate(context: ExtensionContext): Promise<void> {
  if(!await checkAndInformAboutInstallation()) {
    return;
  }
  statusOutput = Window.createOutputChannel(ExtensionConstants.ChannelName);
  if(!await isAutomaticLanguageServerInstallationPresent(context)) {
    if(!await installLanguageServer(context)) {
      await Window.showErrorMessage(Messages.Installation.Error);
      return;
    }
  }
  await initializeLanguageClient(context);
  languageClient!.onServerVersion(async version => {
    if(await updateLanguageServerIfNecessary(context, version)) {
      dafnyIntegration = DafnyIntegration.createAndRegister(context, languageClient!);
    } else {
      await Window.showErrorMessage(Messages.Installation.Error);
    }
  });
}

async function isAutomaticLanguageServerInstallationPresent(context: ExtensionContext): Promise<boolean> {
  return !isCustomLanguageServerInstallation(context)
    && await isLanguageServerRuntimeAccessible(context);
}

async function initializeLanguageClient(context: ExtensionContext): Promise<void> {
  statusOutput!.appendLine('starting Dafny');
  languageClient = await DafnyLanguageClient.create(context);
  languageClient.start();
  await languageClient.onReady();
}

async function installLanguageServer(context: ExtensionContext): Promise<boolean> {
  const installer = new LanguageServerInstaller(context, statusOutput!);
  return await installer.install();
}

async function updateLanguageServerIfNecessary(context: ExtensionContext, installedVersion: string): Promise<boolean> {
  if(isMinimumRequiredLanguageServer(installedVersion)) {
    return true;
  }
  if(isCustomLanguageServerInstallation(context)) {
    await Window.showInformationMessage(`Your Dafny installation is outdated. Recommended=${LanguageServerConstants.RequiredVersion}, Yours=${installedVersion}`);
    return true;
  }
  await languageClient!.stop();
  if(!await installLanguageServer(context)) {
    return false;
  }
  await initializeLanguageClient(context);
  return true;
}

export function isMinimumRequiredLanguageServer(version: string): boolean {
  const [ givenMajor, givenMinor ] = version.split('.');
  const [ requiredMajor, requiredMinor ] = LanguageServerConstants.RequiredVersion.split('.');
  return givenMajor > requiredMajor
    || givenMajor === requiredMajor && givenMinor >= requiredMinor;
}

export async function deactivate(): Promise<void> {
  await languageClient?.stop();
  dafnyIntegration?.dispose();
  statusOutput?.dispose();
}
