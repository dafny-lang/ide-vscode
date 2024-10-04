import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import { ExtensionContext, OutputChannel, window } from 'vscode';

const existsAsync = promisify(fs.exists);
import * as path from 'path';
import { ConfigurationConstants, LanguageServerConstants } from '../constants';
import Configuration from '../configuration';
import { getPreferredVersion } from './dafnyInstallation';
import { Executable } from 'vscode-languageclient/node';
import { getDotnetExecutablePath } from '../dotnet';

const mkdirAsync = promisify(fs.mkdir);

export class CustomPathInstaller {
  public constructor(
    public readonly context: ExtensionContext,
    public readonly statusOutput: OutputChannel
  ) {}

  // We cache the cli path so that we don't need to copy it every time.
  private cliPath: string | undefined | null = null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async getExecutable(context: ExtensionContext, server: boolean, newArgs: string[], oldArgs: string[]): Promise<Executable | undefined> {
    const configuredCliPath = await this.getCliPath(context);
    if(!configuredCliPath) {
      return undefined;
    }

    if(server) {
      newArgs.unshift('server');
    }
    if(configuredCliPath.endsWith('.dll')) {
      const { path: dotnetExecutable } = await getDotnetExecutablePath();
      return {
        command: dotnetExecutable,
        args: [ configuredCliPath ].concat(newArgs)
      };
    } else {
      return {
        command: configuredCliPath,
        args: newArgs
      };
    }
  }

  private async getCliPath(context: ExtensionContext): Promise<string> {
    if(this.cliPath != null) {
      return this.cliPath;
    }
    this.cliPath = await this.getCliPathUncached(context);
    return this.cliPath!;
  }

  private async getCliPathUncached(context: ExtensionContext): Promise<string> {
    let cliPathOverride = process.env['DAFNY_SERVER_OVERRIDE'] ?? '';
    const version = getPreferredVersion();
    let cliPath = Configuration.get<string | null>(ConfigurationConstants.LanguageServer.CliPath) ?? '';
    if(cliPath && !path.isAbsolute(cliPath)) {
      cliPath = path.join(context.extensionPath, cliPath);
    }
    if(cliPathOverride || cliPath && version === LanguageServerConstants.Custom) {
      const originalPath = cliPathOverride || cliPath;
      let acopyofDafny = originalPath;
      try {
        cliPathOverride = await this.copyNecessaryDllsToTempFolder(originalPath);
        acopyofDafny = `a copy of ${originalPath} in ${cliPathOverride}`;
      } catch(e: unknown) {
        // Ignore if copying fails. We'll run the original.
      }
      window.showInformationMessage(`Using ${acopyofDafny} as Dafny executable`);
    }
    if(cliPathOverride) {
      return cliPathOverride;
    }

    if(version !== LanguageServerConstants.Custom) {
      return '';
    }
    return cliPath;
  }

  // We copy Dafny.dll and all its dependencies to another location
  // so that rebuilding Dafny will not fail because it's open in VSCode
  private async copyNecessaryDllsToTempFolder(configuredPath: string): Promise<string> {
    const dll = '.dll';
    const runtimeconfigjson = '.runtimeconfig.json';
    const depsjson = '.deps.json';
    const installationDir = path.dirname(configuredPath);
    const executableName = path.basename(configuredPath);
    const vscodeDir = path.join(os.tmpdir(), await fs.promises.mkdtemp('vscode-dafny-dlls-'));
    console.log(`Copying all necessary dlls and executables to ${vscodeDir}...`);
    const cleanup = function() {
      fs.rmdirSync(vscodeDir, { recursive: true });
    };
    await this.ensureDirExists(vscodeDir);
    process.on('exit', cleanup);
    const files = await fs.promises.readdir(installationDir);
    for(const file of files) {
      // eslint-disable-next-line max-depth
      if(!(file.endsWith(dll)
        || file.endsWith(runtimeconfigjson)
        || file.endsWith(depsjson)
        || file.endsWith('.pdb')
        || file.endsWith('.exe')
        || file === 'z3'
        || file === 'DafnyPrelude.bpl'
        || file === 'runtimes'
        || file === executableName)) {
        continue;
      }
      // eslint-disable-next-line max-depth
      const srcFile = path.join(installationDir, file);
      const targetFile = path.join(vscodeDir, file);
      if((await fs.promises.stat(srcFile)).isDirectory()) {
        await this.copyDir(srcFile, targetFile);
      } else {
        await this.copyFile(srcFile, targetFile);
      }
    }

    const newPath = path.join(vscodeDir, executableName);
    return newPath;
  }

  private async ensureDirExists(
    dirName: string) {
    const existed = await existsAsync(dirName);
    if(!existed) {
      await mkdirAsync(dirName);
    }
  }

  private async copyFile(srcPath: string, targetFile: string) {
    await fs.promises.copyFile(srcPath, targetFile);
  }

  private async copyDir(src: string, dest: string) {
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    await this.ensureDirExists(dest);
    for(const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if(entry.isDirectory()) {
        await this.copyDir(srcPath, destPath);
      } else {
        await this.copyFile(srcPath, destPath);
      }
    }
  }
}