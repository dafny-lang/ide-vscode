import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

import { workspace as Workspace, window as Window, ExtensionContext, Uri, OutputChannel, FileSystemError } from 'vscode';
import { Utils } from 'vscode-uri';

import { fetch } from 'cross-fetch';
import * as extract from 'extract-zip';

import { ConfigurationConstants, LanguageServerConstants } from '../constants';
import Configuration from '../configuration';

const ArchiveFileName = 'dafny.zip';

export function getLanguageServerRuntimePath(context: ExtensionContext): string {
  const configuredPath = getConfiguredLanguageServerRuntimePath() ?? LanguageServerConstants.DefaultPath;
  if(path.isAbsolute(configuredPath)) {
    return configuredPath;
  }
  return path.join(context.extensionPath, configuredPath);
}

function getConfiguredLanguageServerRuntimePath(): string | null {
  return Configuration.get<string | null>(ConfigurationConstants.LanguageServer.RuntimePath);
}

function getDafnyPlatformSuffix(): string {
  switch (os.type()) {
  case 'Windows_NT':
    return 'win';
  case 'Darwin':
    return 'osx-10.14.2';
  default:
    return 'ubuntu-16.04';
  }
}

function getDafnyDownloadAddress(): string {
  const baseUri = LanguageServerConstants.DownloadBaseUri;
  const version = LanguageServerConstants.RequiredVersion;
  const suffix = getDafnyPlatformSuffix();
  return `${baseUri}/v${version}/dafny-${version}-x64-${suffix}.zip`;
}

export class DafnyInstaller {
  public constructor(
    private readonly context: ExtensionContext,
    private readonly statusOutput: OutputChannel
  ) {}

  public static isMinimumRequiredLanguageServer(version: string): boolean {
    if(version === LanguageServerConstants.UnknownVersion) {
      return true;
    }
    const [ givenMajor, givenMinor ] = version.split('.');
    const [ requiredMajor, requiredMinor ] = LanguageServerConstants.RequiredVersion.split('.');
    return givenMajor > requiredMajor
      || givenMajor === requiredMajor && givenMinor >= requiredMinor;
  }

  public async install(): Promise<boolean> {
    this.writeStatus('starting Dafny installation');
    this.statusOutput.show();
    await this.cleanInstallDir();
    const archive = await this.downloadArchive(getDafnyDownloadAddress());
    if(archive == null) {
      return false;
    }
    await this.extractArchive(archive);
    await Workspace.fs.delete(archive);
    this.writeStatus('Dafny installation completed');
    return true;
  }

  public async updateNecessary(installedVersion: string): Promise<boolean> {
    if(DafnyInstaller.isMinimumRequiredLanguageServer(installedVersion)) {
      return false;
    }
    if(this.isCustomInstallation()) {
      await Window.showInformationMessage(`Your Dafny installation is outdated. Recommended=${LanguageServerConstants.RequiredVersion}, Yours=${installedVersion}`);
      return false;
    }
    return true;
  }

  public isCustomInstallation(): boolean {
    return getConfiguredLanguageServerRuntimePath() != null;
  }

  public async isLanguageServerRuntimeAccessible(): Promise<boolean> {
    const languageServerDll = getLanguageServerRuntimePath(this.context);
    try {
      await fs.promises.access(languageServerDll, fs.constants.R_OK);
      return true;
    } catch(error: unknown) {
      console.error(`cannot access language server: ${error}`);
      return false;
    }
  }

  private async cleanInstallDir(): Promise<void> {
    const installPath = this.getInstallationPath();
    this.writeStatus(`deleting previous Dafny installation at ${installPath}`);
    try {
      await Workspace.fs.delete(
        installPath,
        {
          recursive: true,
          useTrash: false
        }
      );
    } catch(error: unknown) {
      if(!(error instanceof FileSystemError) || error.code !== 'FileNotFound') {
        this.writeStatus(`error deleting folder: ${error}`);
        throw error;
      }
    }
  }

  private async downloadArchive(downloadUri: string): Promise<Uri | undefined> {
    this.writeStatus(`downloading Dafny from ${downloadUri}`);
    const response = await fetch(downloadUri);
    if(!response.ok) {
      this.writeStatus(`Dafny download failed: ${response.status} (${response.statusText})`);
      return;
    }
    if(response.body == null) {
      this.writeStatus('Dafny download failed: No Content');
      return;
    }
    const content = await response.arrayBuffer();
    const archivePath = this.getZipPath();
    await Workspace.fs.writeFile(archivePath, new Uint8Array(content));
    return archivePath;
  }

  private async extractArchive(archivePath: Uri): Promise<void> {
    const dirPath = this.getInstallationPath();
    this.writeStatus(`extracting Dafny to ${dirPath}`);
    await extract(archivePath.fsPath, { dir: dirPath.fsPath });
  }

  private getZipPath(): Uri {
    return Utils.joinPath(this.getInstallationPath(), ArchiveFileName);
  }

  private getInstallationPath(): Uri {
    return Utils.joinPath(this.context.extensionUri, ...LanguageServerConstants.ResourceFolder);
  }

  private writeStatus(message: string): void {
    this.statusOutput.appendLine(message);
  }
}
