/* eslint-disable max-depth */
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import { versionToNumeric } from '../ui/dafnyIntegration';

import { ExtensionContext, OutputChannel } from 'vscode';
import { getCliPath } from './cliCloner';

import { ConfigurationConstants, LanguageServerConstants } from '../constants';
import Configuration from '../configuration';
import { Executable } from 'vscode-languageclient/node';

import { getDotnetExecutablePath } from '../dotnet';

import { execFile } from 'child_process';
const execFileAsync = promisify(execFile);
import { OldSkoolInstaller } from './oldSkoolInstaller';
import { mkdir } from 'fs/promises';

export class DafnyInstaller {
  public constructor(
    public readonly context: ExtensionContext,
    public readonly statusOutput: OutputChannel
  ) {}

  public async getLanguageServerExecutable(newArgs: string[], oldArgs: string[]): Promise<Executable> {
    const version = getPreferredVersion();

    if(versionToNumeric(version) >= versionToNumeric('3.10')) {
      return this.getCliExecutable(newArgs, oldArgs);
    } else {
      return await new OldSkoolInstaller(this.context, version, this.statusOutput).getExecutable(oldArgs);
    }
  }

  public async getCliExecutable(newArgs: string[], oldArgs: string[]): Promise<Executable> {
    const version = getPreferredVersion();
    const { path: dotnetExecutable } = await getDotnetExecutablePath();

    if(versionToNumeric(version) < versionToNumeric('3.7')) {
      throw new Error('Not supported');
    }

    const args = versionToNumeric(version) < versionToNumeric('3.10') ? oldArgs : newArgs;

    const configuredCliPath = await getCliPath(this.context);
    let localToolPath: string;
    if(configuredCliPath != null) {
      return {
        command: dotnetExecutable,
        args: [ configuredCliPath ].concat(args)
      };
    } else {
      const toolVersion = await this.getDotnetToolVersion();
      localToolPath = path.join(this.context.extensionPath, `out/resources/${toolVersion}/`);
      if(!fs.existsSync(localToolPath)) {
        try {
          await mkdir(localToolPath, { recursive: true });
          await execFileAsync(dotnetExecutable, [ 'new', 'tool-manifest' ], { cwd: localToolPath });
          this.statusOutput.show();
          this.writeStatus('Starting Dafny installation');
          await execFileAsync(dotnetExecutable, [ 'tool', 'install', 'Dafny', '--version', toolVersion ], { cwd: localToolPath });
          this.writeStatus('Dafny installation completed');
        } catch(error: unknown) {
          this.writeStatus('Dafny installation failed:');
          this.writeStatus(`> ${error}`);
          console.error('dafny installation failed', error);
        }
      }
      return {
        command: dotnetExecutable,
        args: [ 'tool', 'run', 'dafny' ].concat(args),
        options: { cwd: localToolPath }
      };
    }
  }

  private toolVersionCache: string | undefined;

  private async getDotnetToolVersion(): Promise<string> {
    if(this.toolVersionCache === undefined) {
      this.toolVersionCache = await DafnyInstaller.getDotnetToolVersionUncached();
    }
    return this.toolVersionCache;
  }

  private static async getDotnetToolVersionUncached(): Promise<string> {
    const { path: dotnetExecutable } = await getDotnetExecutablePath();
    const { stdout } = await execFileAsync(dotnetExecutable, [ 'tool', 'search', 'Dafny', '--detail', '--prerelease' ]);
    const entries = stdout.split('----------------').map(entry => entry.split('\n').filter(e => e !== ''));
    const dafnyEntry = entries.filter(entry => entry[0] === 'dafny')[0];
    const versions = dafnyEntry.slice(8).map(versionLine => versionLine.trimStart().split(' ')[0]);

    const versionDescription = process.env['dafnyIdeVersion'] ?? Configuration.get<string>(ConfigurationConstants.PreferredVersion);
    let toolVersion: string;
    switch(versionDescription) {
    case LanguageServerConstants.LatestStable: {
      const version = LanguageServerConstants.LatestVersion;
      toolVersion = versions.filter(l => l.startsWith(version))[0];
      break;
    }
    case LanguageServerConstants.LatestNightly: {
      const nightlies = versions.filter(l => l.includes('nightly'));
      const dates: { index: number, date: string }[] = nightlies.map((n, index) => {
        const split: string[] = n.split('-');
        return { index, date: split[2] + split[3] + split[4] };
      });
      dates.sort((a, b) => a.date < b.date ? 1 : -1);
      const latestNightly = nightlies[dates[0].index];
      toolVersion = latestNightly;
      break;
    }
    default: {
      toolVersion = versions.filter(l => l.startsWith(versionDescription))[0];
    }
    }

    return toolVersion;
  }

  public async isLanguageServerRuntimeAccessible(): Promise<boolean> {
    const executable = await this.getCliExecutable([ '--version' ], [ '--version' ]);
    try {
      await promisify(child_process.execFile.bind(child_process))(executable.command, executable.args, {
        cwd: executable.options?.cwd
      });
      // TODO Should we check stdout to find the expected version number?
      return true;
    } catch(e: unknown) {
      return false;
    }
  }

  private writeStatus(message: string): void {
    this.statusOutput.appendLine(message);
  }
}

export function isConfiguredToInstallLatestDafny(): boolean {
  return Configuration.get<string>(ConfigurationConstants.PreferredVersion) === LanguageServerConstants.LatestStable;
}

function getPreferredVersion(): string {
  return process.env['dafnyIdeVersion'] ?? Configuration.get<string>(ConfigurationConstants.PreferredVersion);
}

// public isLatestKnownLanguageServerOrNewer(version: string): boolean {
//   if(version === LanguageServerConstants.UnknownVersion) {
//     this.writeStatus('failed to resolve the installed Dafny version');
//     return true;
//   }
//   const givenParts = version.split('.');
//   const latestVersion = LanguageServerConstants.LatestVersion;
//   const latestParts = latestVersion.split('.');
//   for(let i = 0; i < Math.min(givenParts.length, latestParts.length); i++) {
//     const given = givenParts[i];
//     const latest = latestParts[i];
//     if(given < latest) {
//       this.writeStatus(`the installed Dafny version is older than the latest: ${version} < ${latestVersion}`);
//       return false;
//     }
//     if(given > latest) {
//       this.writeStatus(`the installed Dafny version is newer than the latest: ${version} > ${latestVersion}`);
//       return true;
//     }
//   }
//   this.writeStatus(`the installed Dafny version is the latest known: ${version} = ${latestVersion}`);
//   return true;
// }