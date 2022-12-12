/* eslint-disable max-depth */
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import { versionToNumeric } from '../ui/dafnyIntegration';

import { ExtensionContext, OutputChannel, window } from 'vscode';
import { getCliPath } from './cliCopier';

import { ConfigurationConstants, LanguageServerConstants } from '../constants';
import Configuration from '../configuration';
import { Executable } from 'vscode-languageclient/node';

import { getDotnetExecutablePath } from '../dotnet';

import { execFile } from 'child_process';
const execFileAsync = promisify(execFile);
import { StandaloneLanguageServerInstaller } from './standaloneLanguageServerInstaller';
import { mkdir } from 'fs/promises';
import { Messages } from '../ui/messages';

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
      return await new StandaloneLanguageServerInstaller(this.context, version, this.statusOutput).getExecutable(oldArgs);
    }
  }

  public async getCliExecutable(newArgs: string[], oldArgs: string[]): Promise<Executable> {
    const version = getPreferredVersion();
    const { path: dotnetExecutable } = await getDotnetExecutablePath();

    if(versionToNumeric(version) < versionToNumeric('3.7')) {
      throw new Error('Dafny versions below 3.7 are not supported.');
    }

    const args = versionToNumeric(version) < versionToNumeric('3.10') ? oldArgs : newArgs;

    const configuredCliPath = await getCliPath(this.context);
    if(configuredCliPath != null) {
      if(configuredCliPath.endsWith('.dll')) {
        return {
          command: dotnetExecutable,
          args: [ configuredCliPath ].concat(args)
        };
      } else {
        return {
          command: configuredCliPath,
          args: args
        };
      }
    } else {
      const localToolPath = await this.ensureDafnyIsInstalled();
      return {
        command: dotnetExecutable,
        args: [ 'tool', 'run', 'dafny' ].concat(args),
        options: { cwd: localToolPath }
      };
    }
  }

  private async ensureDafnyIsInstalled(): Promise<string> {
    const { path: dotnetExecutable } = await getDotnetExecutablePath();
    const toolVersion = await this.getDotnetToolVersion();
    const localToolPath = path.join(this.context.extensionPath, `out/resources/${toolVersion}/`);
    if(fs.existsSync(localToolPath)) {
      return localToolPath;
    }

    try {
      await mkdir(localToolPath, { recursive: true });
      await execFileAsync(dotnetExecutable, [ 'new', 'tool-manifest' ], { cwd: localToolPath });
      this.statusOutput.show();
      window.showErrorMessage(Messages.Installation.Start);
      this.writeStatus(Messages.Installation.Start);
      await execFileAsync(dotnetExecutable, [ 'tool', 'install', 'Dafny', '--version', toolVersion ], { cwd: localToolPath });
      this.writeStatus(Messages.Installation.Completed);
    } catch(error: unknown) {
      window.showErrorMessage(Messages.Installation.Error);
      this.writeStatus(Messages.Installation.Error);
      this.writeStatus(`> ${error}`);
      console.error('dafny installation failed', error);
    }
    return localToolPath;
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

  public async checkCliAccessible(): Promise<boolean> {
    const executable = await this.getCliExecutable([ '--version' ], [ '--version' ]);
    try {
      await promisify(child_process.execFile.bind(child_process))(executable.command, executable.args, {
        cwd: executable.options?.cwd
      });
      return true;
    } catch(e: unknown) {
      window.showErrorMessage(`Could not start the Dafny CLI using ${JSON.stringify(executable)}. Please check if the installation is corrupt.`);
      return false;
    }
  }

  private writeStatus(message: string): void {
    this.statusOutput.appendLine(message);
  }
}

function getPreferredVersion(): string {
  return process.env['dafnyIdeVersion'] ?? Configuration.get<string>(ConfigurationConstants.PreferredVersion);
}