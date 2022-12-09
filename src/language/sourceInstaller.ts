
import path = require('path');
import * as os from 'os';
import { chdir as processChdir, cwd as processCwd } from 'process';
import { Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';
import { LanguageServerConstants } from '../constants';
import { checkSupportedDotnetVersion, getDotnetExecutablePath } from '../dotnet';
import { versionToNumeric } from '../ui/dafnyIntegration';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs';
import { OldSkoolInstaller } from './oldSkoolInstaller';
const execAsync = promisify(exec);
const mkdirAsync = promisify(fs.mkdir);

export class SourceInstaller {
  public constructor(
    private readonly oldSkoolInstaller: OldSkoolInstaller
  ) {}

  public async installFromSource(): Promise<boolean> {
    const installationPath = await this.getCustomInstallationPath(os.arch());
    await mkdirAsync(installationPath.fsPath, { recursive: true });
    this.writeStatus(`Installing Dafny from source in ${installationPath.fsPath}.\n`);
    const previousDirectory = processCwd();
    processChdir(installationPath.fsPath);
    try {
      await checkSupportedDotnetVersion();
    } catch(error: unknown) {
      try {
        this.writeStatus('dotnet not found in $PATH, trying to install from brew.');
        await this.execLog('brew install dotnet-sdk');
      } catch(error: unknown) {
        this.writeStatus('An error occurred while running this command.');
        this.writeStatus(`${error}`);
        this.writeStatus(`If brew is installed on your system, this can usually be resolved by adding add all brew commands to your ~/.zprofile,
        e.g. by running the script there https://apple.stackexchange.com/a/430904 :
  
        > echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        > eval "$(/opt/homebrew/bin/brew shellenv)"
  
        and restart VSCode, which may reinstall Dafny.`);
        return false;
      }
    }
    const configuredVersion = await this.oldSkoolInstaller.getConfiguredVersion();
    if(versionToNumeric(configuredVersion) < versionToNumeric('3.9.0')) {
      try {

        const process = await this.execLog('javac -version');
        if(!(/javac \d+\.\d+/.exec(process.stdout))
          && !(/javac \d+\.\d+/.exec(process.stderr))) {
          throw '';
        }
      } catch(error: unknown) {
        const errorMsg = error === '' ? 'Javac not found' : `${error}`;
        this.writeStatus(`${errorMsg}. Javac is needed because you use a version of Dafny older than 3.9.0. Please install a valid JDK`
        + ' and ensure that the path containing javac is in the PATH environment variable. '
        + 'You can obtain a free open-source JDK 1.8 from here: '
        + 'https://aws.amazon.com/corretto/');
        return false;
      }
    }

    // Clone the right version
    await this.execLog(`git clone -b v${configuredVersion} --depth 1 --recurse-submodules ${LanguageServerConstants.DafnyGitUrl}`);
    processChdir(Utils.joinPath(installationPath, 'dafny').fsPath);

    const { path: dotnet } = await getDotnetExecutablePath();
    // The DafnyCore.csproj has a few targets that call `dotnet` directly.
    // If dotnet is configured in dafny.dotnetExecutablePath
    // it MAY NOT be on the path.
    // This will cause the build to fail.
    // This works around this edge case.
    const injectPath = `PATH=${path.dirname(dotnet)}:$PATH`;
    // Build the DafnyLanguageServer
    await this.execLog(`${injectPath} ${ (await getDotnetExecutablePath()).path } build Source/DafnyLanguageServer/DafnyLanguageServer.csproj`);
    const binaries = Utils.joinPath(installationPath, 'dafny', 'Binaries').fsPath;
    processChdir(binaries);
    try {
      await this.execLog('brew update'); // Could help some users not get "Error: The `brew link` step did not complete successfully"
    } catch(error: unknown) {
      this.writeStatus(`Could not run \`brew update\` but this step is optional (${error})`);
    }

    const z3urlOsx = this.GetZ3DownloadUrlOSX();
    const z3filenameOsx = this.GetZ3FileNameOSX();
    const archive = await this.oldSkoolInstaller.downloadArchive(z3urlOsx, 'Z3');
    await this.oldSkoolInstaller.extractArchive(archive, 'Z3');
    await workspace.fs.delete(archive, { useTrash: false });

    await this.execLog(`mv ${(await this.oldSkoolInstaller.getInstallationPath()).fsPath}/${z3filenameOsx} z3`);
    processChdir((await this.oldSkoolInstaller.getInstallationPath()).fsPath);
    await this.execLog('mkdir -p ./dafny/');
    await this.execLog(`cp -R ${binaries}/* ./dafny/`);
    processChdir(previousDirectory);
    return true;
  }


  private async getCustomInstallationPath(typeArch: string): Promise<Uri> {
    return Utils.joinPath(
      await this.oldSkoolInstaller.getInstallationPath(), 'custom', typeArch
    );
  }

  private async execLog(command: string): Promise<{ stderr: string, stdout: string }> {
    this.writeStatus(`Executing: ${command}`);
    return await execAsync(command);
  }

  private writeStatus(message: string): void {
    this.oldSkoolInstaller.statusOutput.appendLine(message);
  }

  private GetZ3DownloadUrlOSX(): string {
    const z3v = LanguageServerConstants.Z3VersionForCustomInstallation;
    const z3filenameOsx = this.GetZ3FileNameOSX();
    return `https://github.com/Z3Prover/z3/releases/download/Z3-${z3v}/${z3filenameOsx}.zip`;
  }

  private GetZ3FileNameOSX(): string {
    const z3v = LanguageServerConstants.Z3VersionForCustomInstallation;
    return `z3-${z3v}-x64-osx-10.14.2`;
  }
}