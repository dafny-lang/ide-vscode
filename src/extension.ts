
import { DafnyLanguageClient } from './language/dafnyLanguageClient';
import checkAndInformAboutInstallation from './startupCheck';
import DafnyIntegration from './ui/dafnyIntegration';

let languageClient: DafnyLanguageClient | undefined;
let dafnyIntegration: DafnyIntegration | undefined;

export async function activate(): Promise<void> {
  if(!await checkAndInformAboutInstallation()) {
    return;
  }
  languageClient = await DafnyLanguageClient.create();
  languageClient.start();
  // TODO block all UI interactions or only the ones depending on the language client?
  await languageClient.onReady();
  dafnyIntegration = DafnyIntegration.createAndRegister(languageClient);
}

export async function deactivate(): Promise<void> {
  if(languageClient != null) {
    await languageClient.stop();
  }
  if(dafnyIntegration != null) {
    dafnyIntegration.dispose();
  }
}
