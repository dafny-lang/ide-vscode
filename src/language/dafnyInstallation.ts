import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { versionToNumeric } from '../ui/dafnyIntegration';

import { workspace, ExtensionContext, Uri, OutputChannel, FileSystemError, window } from 'vscode';
import { Utils } from 'vscode-uri';

import got from 'got';
import * as extract from 'extract-zip';

import { ConfigurationConstants, LanguageServerConstants } from '../constants';
import Configuration from '../configuration';
import { exec } from 'child_process';
import { chdir as processChdir, cwd as processCwd } from 'process';
import fetch from 'cross-fetch';

import { checkSupportedDotnetVersion, getDotnetExecutablePath } from '../dotnet';

const execAsync = promisify(exec);
const existsAsync = promisify(fs.exists);

const ArchiveFileName = 'dafny.zip';
const mkdirAsync = promisify(fs.mkdir);

// Equivalent to a || b but without ESLint warnings
async function ifNullOrEmpty(a: string | null, b: () => Promise<string>): Promise<string> {
  return a === null || a === '' ? await b() : Promise.resolve(a);
}

async function getConfiguredVersion(context: ExtensionContext): Promise<string> {
  const [ _, version ] = await getConfiguredTagAndVersion(context);
  return version;
}

let getConfiguredTagAndVersionCache: [string, string];
async function getConfiguredTagAndVersion(context: ExtensionContext): Promise<[string, string]> {
  if(getConfiguredTagAndVersionCache === undefined) {
    const result = await getConfiguredGitTagAndVersionUncached(context);
    if(getConfiguredTagAndVersionCache === undefined) {
      getConfiguredTagAndVersionCache = result;
    }
  }
  return getConfiguredTagAndVersionCache;
}

async function getConfiguredGitTagAndVersionUncached(context: ExtensionContext): Promise<[string, string]> {
  let version = process.env['dafnyIdeVersion'] ?? Configuration.get<string>(ConfigurationConstants.PreferredVersion);
  switch(version) {
  case LanguageServerConstants.LatestStable:
    version = LanguageServerConstants.LatestVersion;
    break;
  case LanguageServerConstants.LatestNightly: {
    const result: any = await (await fetch('https://api.github.com/repos/dafny-lang/dafny/releases/tags/nightly')).json();
    if(result.name !== undefined) {
      const name: string = result.name;
      const versionPrefix = 'Dafny ';
      if(name.startsWith(versionPrefix)) {
        const version = name.substring(versionPrefix.length);
        context.globalState.update('nightly-version', version);
        return [ 'nightly', version ];
      }
    }
    // Github has some API limitations on how many times to call its API, so this is a good fallback.
    const cachedVersion = context.globalState.get('nightly-version');
    if(cachedVersion !== undefined) {
      return [ 'nightly', cachedVersion as string ];
    }
    window.showWarningMessage('Failed to install latest nightly version of Dafny. Using latest stable version instead.\n'
      + `The name of the nightly release we found was: ${result.name}`);
    version = LanguageServerConstants.LatestVersion;
  }
  }
  return [ `v${version}`, version ];
}

export function isConfiguredToInstallLatestDafny(): boolean {
  return Configuration.get<string>(ConfigurationConstants.PreferredVersion) === LanguageServerConstants.LatestStable;
}

export async function getCompilerRuntimePath(context: ExtensionContext): Promise<string> {
  const configuredPath = await ifNullOrEmpty(
    Configuration.get<string | null>(ConfigurationConstants.Compiler.RuntimePath),
    async () => LanguageServerConstants.GetDefaultCompilerPath(await getConfiguredVersion(context))
  );
  if(!path.isAbsolute(configuredPath)) {
    return path.join(context.extensionPath, configuredPath);
  }
  return configuredPath;
}

// We cache the language server runtime path so that we don't need to copy it every time.
let LanguageServerRuntimePath: string | null = null;

function isNullOrEmpty(s: string | null): boolean {
  return s === '' || s == null;
}

async function ensureDirExists(
  dirName: string) {
  const existed = await existsAsync(dirName);
  if(!existed) {
    await mkdirAsync(dirName);
  }
}

async function copyFile(srcPath: string, targetFile: string) {
  await fs.promises.copyFile(srcPath, targetFile);
}

async function copyDir(src: string, dest: string) {
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  await ensureDirExists(dest);
  for(const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if(entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

export async function getOrComputeLanguageServerRuntimePath(context: ExtensionContext): Promise<string> {
  if(LanguageServerRuntimePath != null) {
    return LanguageServerRuntimePath;
  }
  const configuredLanguageServerPath = getConfiguredLanguageServerRuntimePath();
  const isCustomInstallation = !isNullOrEmpty(configuredLanguageServerPath);

  let configuredPath = await ifNullOrEmpty(
    configuredLanguageServerPath,
    async () => LanguageServerConstants.GetDefaultPath(await getConfiguredVersion(context))
  );
  if(!path.isAbsolute(configuredPath)) {
    configuredPath = path.join(context.extensionPath, configuredPath);
  }
  if(isCustomInstallation) {
    configuredPath = await cloneAllNecessaryDlls(configuredLanguageServerPath);
  }
  LanguageServerRuntimePath = configuredPath;
  return configuredPath;
}

// We copy DafnyLanguageServer.dll to another location and all its dependencies
// so that rebuilding Dafny will not fail because it's open in VSCode
async function cloneAllNecessaryDlls(configuredPath: string): Promise<string> {
  const dlsName = 'DafnyLanguageServer';
  const dll = '.dll';
  const runtimeconfigjson = '.runtimeconfig.json';
  const depsjson = '.deps.json';
  const dls = dlsName + dll;
  if(!configuredPath.endsWith(dls)) {
    return configuredPath;
  }
  const installationDir = path.dirname(configuredPath);
  // copy all the files from installationDir to a new temporary folder
  const vscodeDir = path.join(os.tmpdir(), await fs.promises.mkdtemp('vscode-dafny-dlls-'));
  console.log(`Copying all necessary dlls to ${vscodeDir}...`);
  const cleanup = function() {
    fs.rmdirSync(vscodeDir, { recursive: true });
  };
  await ensureDirExists(vscodeDir);
  // Copy all the files from installationDir to vscodeDir
  const files = await fs.promises.readdir(installationDir);
  for(const file of files) {
    // eslint-disable-next-line max-depth
    if(!(file.endsWith(dll)
      || file.endsWith(runtimeconfigjson)
      || file.endsWith(depsjson)
      || file.endsWith('.pdb')
      || file === 'z3'
      || file === 'DafnyPrelude.bpl'
      || file === 'runtimes')) {
      continue;
    }
    // If it's a directory, we use the function above
    // eslint-disable-next-line max-depth
    const srcFile = path.join(installationDir, file);
    const targetFile = path.join(vscodeDir, file);
    if((await fs.promises.stat(srcFile)).isDirectory()) {
      await copyDir(srcFile, targetFile);
    } else {
      await copyFile(srcFile, targetFile);
    }
  }

  const newPath = path.join(vscodeDir, dls);
  process.on('exit', cleanup);
  return newPath;
}

function getConfiguredLanguageServerRuntimePath(): string {
  const languageServerOverride = process.env['DAFNY_SERVER_OVERRIDE'] ?? '';
  if(languageServerOverride) {
    window.showInformationMessage(`Using $DAFNY_SERVER_OVERRIDE = ${languageServerOverride} for the server path`);
  }
  const languageServerSetting = Configuration.get<string | null>(ConfigurationConstants.LanguageServer.RuntimePath) ?? '';
  return languageServerOverride || languageServerSetting;
}

function getDafnyPlatformSuffix(): string {
  switch(os.type()) {
  case 'Windows_NT':
    return 'win';
  case 'Darwin':
    return 'osx-10.14.2';
  default:
    return 'ubuntu-16.04';
  }
}

async function getDafnyDownloadAddress(context: ExtensionContext): Promise<string> {
  const baseUri = LanguageServerConstants.DownloadBaseUri;
  const [ tag, version ] = await getConfiguredTagAndVersion(context);
  const suffix = getDafnyPlatformSuffix();
  return `${baseUri}/${tag}/dafny-${version}-x64-${suffix}.zip`;
}

export class DafnyInstaller {
  public constructor(
    private readonly context: ExtensionContext,
    private readonly statusOutput: OutputChannel
  ) {}

  public isLatestKnownLanguageServerOrNewer(version: string): boolean {
    if(version === LanguageServerConstants.UnknownVersion) {
      this.writeStatus('failed to resolve the installed Dafny version');
      return true;
    }
    const givenParts = version.split('.');
    const latestVersion = LanguageServerConstants.LatestVersion;
    const latestParts = latestVersion.split('.');
    for(let i = 0; i < Math.min(givenParts.length, latestParts.length); i++) {
      const given = givenParts[i];
      const latest = latestParts[i];
      if(given < latest) {
        this.writeStatus(`the installed Dafny version is older than the latest: ${version} < ${latestVersion}`);
        return false;
      }
      if(given > latest) {
        this.writeStatus(`the installed Dafny version is newer than the latest: ${version} > ${latestVersion}`);
        return true;
      }
    }
    this.writeStatus(`the installed Dafny version is the latest known: ${version} = ${latestVersion}`);
    return true;
  }

  public async install(): Promise<boolean> {
    this.statusOutput.show();
    this.writeStatus('Starting Dafny installation');
    try {
      await this.cleanInstallDir();
      if(os.type() === 'Darwin' && os.arch() !== 'x64') {
        // Need to build from source and move all files from Binary/ to the out/resource folder
        this.writeStatus(`Found a non-supported architecture OSX:${os.arch()}. Going to install from source.`);
        return await this.installFromSource();
      } else {
        const archive = await this.downloadArchive(await getDafnyDownloadAddress(this.context), 'Dafny');
        await this.extractArchive(archive, 'Dafny');
        await workspace.fs.delete(archive, { useTrash: false });
        this.writeStatus('Dafny installation completed');
        return true;
      }
    } catch(error: unknown) {
      this.writeStatus('Dafny installation failed:');
      this.writeStatus(`> ${error}`);
      console.error('dafny installation failed', error);
      return false;
    }
  }

  private async execLog(command: string): Promise<{ stderr: string, stdout: string }> {
    this.writeStatus(`Executing: ${command}`);
    return await execAsync(command);
  }
  private GetZ3FileNameOSX(): string {
    const z3v = LanguageServerConstants.Z3VersionForCustomInstallation;
    return `z3-${z3v}-x64-osx-10.14.2`;
  }
  private GetZ3DownloadUrlOSX(): string {
    const z3v = LanguageServerConstants.Z3VersionForCustomInstallation;
    const z3filenameOsx = this.GetZ3FileNameOSX();
    return `https://github.com/Z3Prover/z3/releases/download/Z3-${z3v}/${z3filenameOsx}.zip`;
  }

  private async installFromSource() {
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
    const configuredVersion = await getConfiguredVersion(this.context);
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
    const archive = await this.downloadArchive(z3urlOsx, 'Z3');
    await this.extractArchive(archive, 'Z3');
    await workspace.fs.delete(archive, { useTrash: false });

    await this.execLog(`mv ${(await this.getInstallationPath()).fsPath}/${z3filenameOsx} z3`);
    processChdir((await this.getInstallationPath()).fsPath);
    await this.execLog('mkdir -p ./dafny/');
    await this.execLog(`cp -R ${binaries}/* ./dafny/`);
    processChdir(previousDirectory);
    return true;
  }

  public isCustomInstallation(): boolean {
    return getConfiguredLanguageServerRuntimePath() !== '';
  }

  public async isLanguageServerRuntimeAccessible(): Promise<boolean> {
    const languageServerDll = await getOrComputeLanguageServerRuntimePath(this.context);
    try {
      await fs.promises.access(languageServerDll, fs.constants.R_OK);
      return true;
    } catch(error: unknown) {
      return false;
    }
  }

  private async cleanInstallDir(): Promise<void> {
    const installPath = await this.getInstallationPath();
    this.writeStatus(`deleting previous Dafny installation at ${installPath.fsPath}`);
    try {
      await workspace.fs.delete(
        installPath,
        {
          recursive: true,
          useTrash: false
        }
      );
    } catch(error: unknown) {
      if(!(error instanceof FileSystemError) || error.code !== 'FileNotFound') {
        throw error;
      }
    }
  }

  private async downloadArchive(downloadUri: string, downloadTarget: string): Promise<Uri> {
    await mkdirAsync((await this.getInstallationPath()).fsPath, { recursive: true });
    const archivePath = await this.getZipPath();
    return await new Promise<Uri>((resolve, reject) => {
      const archiveHandle = fs.createWriteStream(archivePath.fsPath);
      this.writeStatus(`downloading ${downloadTarget} from ${downloadUri}`);
      const progressReporter = new ProgressReporter(this.statusOutput);
      archiveHandle
        .on('finish', () => resolve(archivePath))
        .on('error', error => reject(error));
      got.stream(downloadUri)
        .on('error', error => reject(error))
        .on('downloadProgress', progress => progressReporter.updateDownloadProgress(progress))
        .pipe(archiveHandle);
    });
  }

  private async extractArchive(archivePath: Uri, extractName: string): Promise<void> {
    const dirPath = await this.getInstallationPath();
    this.writeStatus(`extracting ${extractName} to ${dirPath.fsPath}`);
    const progressReporter = new ProgressReporter(this.statusOutput);
    await extract(
      archivePath.fsPath,
      {
        dir: dirPath.fsPath,
        onEntry: (_, archive) => progressReporter.update(archive.entriesRead / archive.entryCount)
      }
    );
  }

  private async getZipPath(): Promise<Uri> {
    return Utils.joinPath(await this.getInstallationPath(), ArchiveFileName);
  }

  private async getInstallationPath(): Promise<Uri> {
    return Utils.joinPath(
      this.context.extensionUri,
      ...LanguageServerConstants.GetResourceFolder(await getConfiguredVersion(this.context))
    );
  }

  private async getCustomInstallationPath(typeArch: string): Promise<Uri> {
    return Utils.joinPath(
      await this.getInstallationPath(), 'custom', typeArch
    );
  }

  private writeStatus(message: string): void {
    this.statusOutput.appendLine(message);
  }
}

class ProgressReporter {
  private lastTenth = -1;

  public constructor(private readonly statusOutput: OutputChannel) {}

  public updateDownloadProgress(progress: { percent: number, transferred: number }) {
    if(progress.transferred > 0) {
      // The transferred byte count has to be checked since got reports percent=1 at the beginning.
      this.update(progress.percent);
    }
  }

  public update(percent: number) {
    const tenth = Math.round(percent * 10);
    if(tenth > this.lastTenth) {
      this.statusOutput.append(`${tenth * 10}%`);
      if(tenth === 10) {
        this.statusOutput.appendLine('');
      } else {
        this.statusOutput.append('...');
      }
      this.lastTenth = tenth;
    }
  }
}
