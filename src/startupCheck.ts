import { window, commands, Uri } from 'vscode';

import { VSCodeCommands } from './commands';
import { checkSupportedDotnetVersion } from './dotnet';
import { Messages } from './ui/messages';

export default async function checkAndInformAboutInstallation(): Promise<boolean> {
  return await checkDotnetInstallation();
}

async function checkDotnetInstallation(): Promise<boolean> {
  const answer = await checkSupportedDotnetVersion();
  if(answer !== undefined) {
    const selection = await window.showErrorMessage(
      answer,
      Messages.Dotnet.ChangeConfiguration,
      Messages.Dotnet.VisitDownload
    );
    switch(selection) {
    case Messages.Dotnet.ChangeConfiguration:
      commands.executeCommand(VSCodeCommands.ConfigureLanguageSettings);
      break;
    case Messages.Dotnet.VisitDownload:
      commands.executeCommand(VSCodeCommands.Open, Uri.parse(Messages.Dotnet.DownloadUri));
      break;
    }
    return false;
  }
  return true;
}
