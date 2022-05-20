import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

import * as which from 'which';

import { ConfigurationConstants, DotnetConstants } from './constants';
import Configuration from './configuration';
import { Messages } from './ui/messages';

const ListRuntimesArg = '--list-runtimes';
const execFileAsync = promisify(execFile);

// Returns an error message
export async function hasSupportedDotnetVersion(): Promise<string> {
  const { path: dotnetExecutable, manual } = await getDotnetExecutablePath();
  try {
    if(!fs.lstatSync(dotnetExecutable).isFile()) {
      return dotnetExecutable + Messages.Dotnet.IsNotAnExecutableFile;
    }
    const { stdout } = await execFileAsync(dotnetExecutable, [ ListRuntimesArg ]);
    return DotnetConstants.SupportedRuntimesPattern.test(stdout) ? ''
      : dotnetExecutable + Messages.Dotnet.NotASupportedDotnetInstallation + stdout;
  } catch(error: unknown) {
    const errorMsg = `Error invoking ${dotnetExecutable} ${ListRuntimesArg}: ${error}`;
    console.error(errorMsg);
    return manual ? errorMsg : Messages.Dotnet.NoCompatibleInstallation;
  }
}

export async function getDotnetExecutablePath(): Promise<{ path: string, manual: boolean }> {
  const configuredPath = Configuration.get<string>(ConfigurationConstants.Dotnet.ExecutablePath).trim();
  if(configuredPath.length > 0) {
    return { path: configuredPath, manual: true };
  }
  try {
    const resolvedPath = await which(DotnetConstants.ExecutableName);
    return { path: resolvedPath, manual: false };
  } catch(error: unknown) {
    return { path: DotnetConstants.ExecutableName, manual: false };
  }
}
