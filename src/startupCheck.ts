import { window as Window } from 'vscode';

import { hasSupportedDotnetVersion } from './dotnet';
import { isLanguageServerRuntimeAccessible } from './language/dafnyLanguageClient';

export default async function checkAndInformAboutInstallation(): Promise<boolean> {
  return await checkDotnetInstallation()
    && await checkLanguageServerInstallation();
}

async function checkDotnetInstallation(): Promise<boolean> {
  if(!await hasSupportedDotnetVersion()) {
    console.error('no supported dotnet runtime found');
    // TODO handle selection
    Window.showErrorMessage(
      'There is no compatible dotnet runtime installed. Dafny requires the ASP.NET Core Runtime 5.0.',
      'Change dafny.dotnetExecutablePath',
      'Get dotnet'
    );
    return false;
  }
  return true;
}

async function checkLanguageServerInstallation(): Promise<boolean> {
  if(!await isLanguageServerRuntimeAccessible()) {
    Window.showErrorMessage('Cannot access the language server runtime');
    return false;
  }
  return true;
}
