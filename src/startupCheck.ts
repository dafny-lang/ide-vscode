import { window as Window } from 'vscode';

import { hasSupportedDotnetVersion } from './dotnet';
import { Messages } from './ui/messages';

export default async function checkAndInformAboutInstallation(): Promise<boolean> {
  return await checkDotnetInstallation();
}

async function checkDotnetInstallation(): Promise<boolean> {
  if(!await hasSupportedDotnetVersion()) {
    // TODO handle selection
    Window.showErrorMessage(
      Messages.Dotnet.NoCompatibleInstallation,
      Messages.Dotnet.ChangeConfiguration,
      Messages.Dotnet.VisitDownload
    );
    return false;
  }
  return true;
}
