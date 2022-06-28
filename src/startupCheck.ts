import { window, commands, Uri, ExtensionContext } from 'vscode';

import { VSCodeCommands } from './commands';
import { ConfigurationConstants } from './constants';
import { checkSupportedDotnetVersion } from './dotnet';
import { Messages } from './ui/messages';

export default async function checkAndInformAboutInstallation(context: ExtensionContext): Promise<boolean> {
  return await checkDotnetInstallation(context);
}

async function checkDotnetInstallation(context: ExtensionContext): Promise<boolean> {
  const answer = await checkSupportedDotnetVersion();
  if(answer !== undefined) {
    const selection = await window.showErrorMessage(
      answer,
      Messages.Dotnet.ChangeConfiguration,
      Messages.Dotnet.VisitDownload
    );
    const extension = context.extension;
    switch(selection) {
    case Messages.Dotnet.ChangeConfiguration:
      commands.executeCommand(VSCodeCommands.ConfigureDafnySettings,
        `@ext:${extension.id} ${ConfigurationConstants.Dotnet.ExecutablePath}`);
      break;
    case Messages.Dotnet.VisitDownload:
      commands.executeCommand(VSCodeCommands.Open, Uri.parse(Messages.Dotnet.DownloadUri));
      break;
    }
    return false;
  }
  return true;
}
