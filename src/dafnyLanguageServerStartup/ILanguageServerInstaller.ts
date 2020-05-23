"use strict";
/**
 * This is an adapted interface version for the origin dafnyInstaller.ts:
 * https://github.com/DafnyVSCode/Dafny-VSCode/blob/develop/server/src/backend/dafnyInstaller.ts
 *
 * Once the new language server goes live, an installer based on the original code can be used.
 * Until then, the current implementation "languageServerInstaller.ts" will be used.
 * It simulates the online availability of the Dafny language server on a private, separate server.
 * In our version, the upload of the server can only be automated in a limited way and is only a temporary interim solution.
 */
export interface ILanguageServerInstaller {
  latestVersionInstalled(localVersion: string): Promise<boolean>;
  installLatestVersion(): Promise<string>;
}
