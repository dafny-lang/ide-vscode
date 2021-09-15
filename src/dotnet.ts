import { execFile } from 'child_process';
import { promisify } from 'util';

import * as which from 'which';

import { ConfigurationConstants, DotnetConstants } from './constants';
import Configuration from './configuration';

const ListRuntimesArg = '--list-runtimes';
const execFileAsync = promisify(execFile);

export async function hasSupportedDotnetVersion(): Promise<boolean> {
  const dotnetExecutable = await getDotnetExecutablePath();
  try {
    const { stdout } = await execFileAsync(dotnetExecutable, [ ListRuntimesArg ]);
    return DotnetConstants.SupportedRuntimesPattern.test(stdout);
  } catch(error: unknown) {
    console.error(`error invoking ${DotnetConstants.ExecutableName} ${ListRuntimesArg}: ${error}`);
  }
  return false;
}

export async function getDotnetExecutablePath(): Promise<string> {
  const configuredPath = Configuration.get<string>(ConfigurationConstants.Dotnet.ExecutablePath).trim();
  if(configuredPath.length > 0) {
    return configuredPath;
  }
  try {
    const resolvedPath = await which(DotnetConstants.ExecutableName);
    return resolvedPath;
  } catch(error: unknown) {
    return DotnetConstants.ExecutableName;
  }
}
