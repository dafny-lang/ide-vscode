
import path = require('path');
import * as os from 'os';
import { chdir as processChdir, cwd as processCwd } from 'process';
import { ExtensionContext, OutputChannel, Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';
import { LanguageServerConstants } from '../constants';
import { checkSupportedDotnetVersion, getDotnetExecutablePath } from '../dotnet';
import { configuredVersionToNumeric } from '../ui/dafnyIntegration';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs';
import { GitHubReleaseInstaller } from './githubReleaseInstaller';
import { Executable } from 'vscode-languageclient/node';
import { getPreferredVersion } from './dafnyInstallation';
const execAsync = promisify(exec);
const mkdirAsync = promisify(fs.mkdir);

export class FromSourceInstaller {
  private readonly githubInstaller: GitHubReleaseInstaller;

  public constructor(
    public readonly context: ExtensionContext,
    public readonly statusOutput: OutputChannel
  ) {
    this.githubInstaller = new GitHubReleaseInstaller(this.context, this.statusOutput);
  }

  public async getExecutable(server: boolean, newArgs: string[], oldArgs: string[]): Promise<Executable> {
    const version = getPreferredVersion();
    const { path: dotnetExecutable } = await getDotnetExecutablePath();
    const directory = await this.installFromSource();
    if(!server || configuredVersionToNumeric(version) >= configuredVersionToNumeric('3.10')) {
      if(server) {
        newArgs.unshift('server');
      }
      return { command: dotnetExecutable, args: [ path.join(directory, 'dafny', 'Binaries', 'Dafny.dll'), ...newArgs ] };
    } else {
      return { command: dotnetExecutable, args: [ path.join(directory, 'dafny', 'Binaries', 'DafnyLanguageServer.dll'), ...oldArgs ] };
    }
  }

  private async installFromSource(): Promise<string> {
    this.statusOutput.show();
    const installationPath = await this.getFromSourceInstallationPath(os.arch());
    if(fs.existsSync(path.join(installationPath.fsPath, 'dafny', 'Binaries'))) {
      this.writeStatus('Using language server previously built from source.');
      return installationPath.fsPath;
    }
    await this.githubInstaller.cleanInstallDir(installationPath);
    await mkdirAsync(installationPath.fsPath, { recursive: true });
    this.writeStatus(`Found a non-supported architecture OSX:${os.arch()}. Going to install from source.`);
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
        return '';
      }
    }
    const configuredVersion = await this.githubInstaller.getConfiguredVersion();
    if(configuredVersionToNumeric(configuredVersion) < configuredVersionToNumeric('3.9.0')) {
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
        return '';
      }
    }

    const tag = configuredVersion.startsWith('nightly') ? configuredVersion.split('-').pop() : `v${configuredVersion}`;
    await this.execLog('rm -rf dafny');
    await this.execLog(`git clone -b ${tag} --depth 1 --recurse-submodules ${LanguageServerConstants.DafnyGitUrl}`);
    processChdir(Utils.joinPath(installationPath, 'dafny').fsPath);

    const { path: dotnet } = await getDotnetExecutablePath();
    // The DafnyCore.csproj has a few targets that call `dotnet` directly.
    // If dotnet is configured in dafny.dotnetExecutablePath
    // it MAY NOT be on the path.
    // This will cause the build to fail.
    // This works around this edge case.
    const injectPath = `PATH=${path.dirname(dotnet)}:$PATH`;

    // If java is not installed, remove from Source/DafnyRuntime/DafnyRuntime.csproj
    // the section <Target Name="BuildDafnyRuntimeJar">...</Target>
    try {
      await this.execLog(`${injectPath} java -version`);
    } catch(e: unknown) {
      // Read the project file, and then remove the section
      let DafnyRunTimeCsprojContent = await fs.promises.readFile(Utils.joinPath(installationPath, 'dafny', 'Source', 'DafnyRuntime', 'DafnyRuntime.csproj').fsPath, 'utf8');
      DafnyRunTimeCsprojContent = DafnyRunTimeCsprojContent.replace(/<Target Name="BuildDafnyRuntimeJar"[\s\S]*?<\/Target>/, '');
      // Remove the line <Content Include="DafnyRuntimeJava\build\libs\DafnyRuntime.jar" Link="DafnyRuntime.jar" CopyToOutputDirectory="PreserveNewest" />
      // from Source/DafnyRuntime/DafnyRuntime.csproj
      DafnyRunTimeCsprojContent = DafnyRunTimeCsprojContent.replace(/<Content Include="DafnyRuntimeJava.*?\/>/, '');
      await fs.promises.writeFile(Utils.joinPath(installationPath, 'dafny', 'Source', 'DafnyRuntime', 'DafnyRuntime.csproj').fsPath, DafnyRunTimeCsprojContent);
    }
    const projectToBuild = 'Dafny.sln'; // includes the language server, the runtime and the driver.
    await this.execLog(`${injectPath} ${ (await getDotnetExecutablePath()).path } build Source/${projectToBuild}`);
    const binaries = Utils.joinPath(installationPath, 'dafny', 'Binaries').fsPath;
    processChdir(binaries);
    try {
      await this.execLog('brew update'); // Could help some users not get "Error: The `brew link` step did not complete successfully"
    } catch(error: unknown) {
      this.writeStatus(`Could not run \`brew update\` but this step is optional (${error})`);
    }

    const z3urlOsx = this.GetZ3DownloadUrlOSX();
    const z3filenameOsx = this.GetZ3FileNameOSX();
    const archive = await this.githubInstaller.downloadArchive(z3urlOsx, 'Z3');
    await this.githubInstaller.extractArchive(archive, 'Z3');
    await workspace.fs.delete(archive, { useTrash: false });

    await this.execLog(`mv ${(await this.githubInstaller.getInstallationPath()).fsPath}/${z3filenameOsx} z3`);
    processChdir((await this.githubInstaller.getInstallationPath()).fsPath);
    await this.execLog('mkdir -p ./dafny/');
    await this.execLog(`cp -R ${binaries}/* ./dafny/`);
    processChdir(previousDirectory);
    return installationPath.fsPath;
  }

  private async getFromSourceInstallationPath(typeArch: string): Promise<Uri> {
    return Utils.joinPath(
      this.context.extensionUri,
      ...LanguageServerConstants.GetResourceFolder(await this.githubInstaller.getConfiguredVersion()),
      'custom', typeArch
    );
  }

  private async execLog(command: string): Promise<{ stderr: string, stdout: string }> {
    this.writeStatus(`Executing: ${command}`);
    return await execAsync(command);
  }

  private writeStatus(message: string): void {
    this.githubInstaller.statusOutput.appendLine(message);
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