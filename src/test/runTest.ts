import * as path from 'path';

import { runTests } from '@vscode/test-electron';
import { LanguageServerConstants } from '../constants';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Download VS Code, unzip it and run the integration test
    await runTests({
      version: '1.85.2', // Use older VSCode version compatible with GLIBC 2.26
      launchArgs: [ '--disable-extensions' ],
      extensionDevelopmentPath,
      extensionTestsPath,
      extensionTestsEnv: { dafnyIdeVersion: LanguageServerConstants.Custom }
    });
  } catch(error: unknown) {
    console.error('Failed to run tests');
    console.error(`${error}`);
    process.exit(1);
  }
}

main();
