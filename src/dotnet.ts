import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

import * as which from 'which';

import { ConfigurationConstants, DotnetConstants } from './constants';
import Configuration from './configuration';
import { Messages } from './ui/messages';

const ListRuntimesArg = '--list-runtimes';
const execFileAsync = promisify(execFile);

// Returns an error message or undefined.
export async function checkSupportedDotnetVersion(): Promise<string | undefined> {
  const { path: dotnetExecutable, manual } = await getDotnetExecutablePath();
  try {
    const stats = await fs.promises.stat(dotnetExecutable);
    if(!stats.isFile()) {
      return dotnetExecutable + Messages.Dotnet.IsNotAnExecutableFile;
    }
    const { stdout } = await execFileAsync(dotnetExecutable, [ ListRuntimesArg ]);
    const runtimeVersions = [ ...stdout.matchAll(DotnetConstants.SupportedRuntimesPattern) ]
      .map(match => {
        const full = match[1];
        const major = parseInt(match[2], 10);
        return { full, major };
      });
    if(runtimeVersions.find(({ major }) => major >= DotnetConstants.SupportedRuntimesMinVersion) !== undefined) {
      return undefined;
    }
    const runtimeVersionsStr = runtimeVersions.length === 0
      ? ' no installed versions'
      : runtimeVersions.map(({ full }) => full).join(', ');
    return dotnetExecutable + Messages.Dotnet.NotASupportedDotnetInstallation + runtimeVersionsStr;
  } catch(error: unknown) {
    const errorMsg = `Error invoking ${dotnetExecutable} ${ListRuntimesArg}: ${error}`;
    console.error(errorMsg);
    return manual ? `${errorMsg}\n${Messages.Dotnet.FailedDotnetExecution}` : Messages.Dotnet.NoCompatibleInstallation;
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
