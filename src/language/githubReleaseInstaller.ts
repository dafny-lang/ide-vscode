import { ExtensionContext, FileSystemError, OutputChannel, Uri, window, workspace } from 'vscode';
import { LanguageServerConstants } from '../constants';
import * as os from 'os';
import fetch from 'cross-fetch';
import extract = require('extract-zip');
import * as fs from 'fs';
import got from 'got/dist/source';
import { promisify } from 'util';
import { Utils } from 'vscode-uri';
const mkdirAsync = promisify(fs.mkdir);
import { Executable } from 'vscode-languageclient/node';
import { getDotnetExecutablePath } from '../dotnet';
import path = require('path');
import { DafnyInstaller, getPreferredVersion } from './dafnyInstallation';
import { configuredVersionToNumeric } from '../ui/dafnyIntegration';
import { pickAssetForPlatform } from './releaseAssetMatcher';
const ArchiveFileName = 'dafny.zip';

const DafnyReleaseTagApi = 'https://api.github.com/repos/dafny-lang/dafny/releases/tags';

/**
 * Subset of the GitHub Releases API response we rely on. `name` and
 * `browser_download_url` are required fields on release assets per the
 * documented schema, so we model them as non-optional.
 */
interface GitHubRelease {
  name?: string;
  assets: GitHubReleaseAsset[];
}

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

async function fetchReleaseByTag(tag: string): Promise<GitHubRelease> {
  const response = await fetch(`${DafnyReleaseTagApi}/${tag}`);
  if(!response.ok) {
    throw new Error(`GitHub Releases API returned ${response.status} ${response.statusText} for ${tag}`);
  }
  const release = await response.json() as Partial<GitHubRelease>;
  return { name: release.name, assets: release.assets ?? [] };
}

/**
 * The `nightly` release's display name is of the form `Dafny nightly-<date>-<sha>`.
 * Strip the `Dafny ` prefix to obtain the version string we pass downstream
 * (e.g. `nightly-2026-04-28-99d0f0d`). Returns undefined if the name is absent
 * or doesn't start with the expected prefix.
 */
function parseNightlyVersionFromReleaseName(name: string | undefined): string | undefined {
  const versionPrefix = 'Dafny ';
  if(name === undefined || !name.startsWith(versionPrefix)) {
    return undefined;
  }
  return name.substring(versionPrefix.length);
}

export class GitHubReleaseInstaller {
  public constructor(
    public readonly context: ExtensionContext,
    public readonly statusOutput: OutputChannel
  ) {}

  private readonly releaseByTagCache = new Map<string, Promise<GitHubRelease>>();

  /**
   * Per-instance memo around {@link fetchReleaseByTag}. A single install can
   * end up resolving the same tag twice — for `latest nightly`, once to learn
   * the concrete version string, and again to pick the matching asset. The
   * Promise is cached eagerly so concurrent callers share a single in-flight
   * request; on failure the entry is evicted so a retry can try again.
   */
  private fetchReleaseByTagCached(tag: string): Promise<GitHubRelease> {
    let pending = this.releaseByTagCache.get(tag);
    if(pending === undefined) {
      pending = fetchReleaseByTag(tag).catch(error => {
        this.releaseByTagCache.delete(tag);
        throw error;
      });
      this.releaseByTagCache.set(tag, pending);
    }
    return pending;
  }

  public async getExecutable(server: boolean, newArgs: string[], oldArgs: string[]): Promise<Executable | undefined> {
    const version = getPreferredVersion();
    const { path: dotnetExecutable } = await getDotnetExecutablePath();

    const cliPath = path.join((await this.getInstallationPath()).fsPath, 'dafny', 'Dafny.dll');
    if(!fs.existsSync(cliPath)) {
      const installed = await this.install();
      if(!installed) {
        return undefined;
      }
    }

    if(!server || configuredVersionToNumeric(version) >= configuredVersionToNumeric('3.10')) {
      if(server) {
        newArgs.unshift('server');
      }
      return { command: dotnetExecutable, args: [ cliPath, ...newArgs ] };
    } else {
      const standaloneServerpath = path.join((await (this.getInstallationPath())).fsPath, 'dafny', 'DafnyLanguageServer.dll');
      return { command: dotnetExecutable, args: [ standaloneServerpath, ...oldArgs ] };
    }
  }

  private async install(): Promise<boolean> {
    this.statusOutput.show();
    const startMessage = 'Standalone language server installation started.';
    window.showInformationMessage(startMessage);
    this.writeStatus(startMessage);
    try {
      await this.cleanInstallDir(await this.getInstallationPath());
      const archive = await this.downloadArchive(await this.getDafnyDownloadAddress(), 'Dafny');
      await this.extractArchive(archive, 'Dafny');
      await workspace.fs.delete(archive, { useTrash: false });
      const finishMessage = 'Standalone language server installation completed.';
      window.showInformationMessage(finishMessage);
      this.writeStatus(finishMessage);
      return true;
    } catch(error: unknown) {
      this.writeStatus('Standalone language server installation failed:');
      this.writeStatus(`> ${error}`);
      return false;
    }
  }

  public async cleanInstallDir(installPath: Uri): Promise<void> {
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

  private async getDafnyDownloadAddress(): Promise<string> {
    const [ tag, version ] = await this.getConfiguredTagAndVersion();
    const arch = await this.getDotnetArchitecture();
    const release = await this.fetchReleaseByTagCached(tag);
    const assetNames = release.assets.map(a => a.name);
    const chosenName = pickAssetForPlatform(assetNames, version, arch, os.type());
    if(chosenName === undefined) {
      throw new Error(
        `No Dafny release asset on tag ${tag} matches version=${version}, arch=${arch}, os=${os.type()}. `
        + `Available assets: ${assetNames.join(', ') || '(none)'}`
      );
    }
    const chosen = release.assets.find(a => a.name === chosenName)!;
    return chosen.browser_download_url;
  }

  private async getDotnetArchitecture(): Promise<string> {
    if(os.type() === 'Darwin') {
      // On macOS, detect .NET runtime architecture to handle Rosetta translation
      // This is crucial because ARM64 Macs may run .NET in x64 mode via Rosetta
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // First try to get .NET runtime architecture
        const { stdout } = await execAsync('dotnet --info');

        // Look for RID (Runtime Identifier) which shows the actual .NET runtime architecture
        const ridRegex = /RID:\s*osx-(x64|arm64)/;
        const ridMatch = ridRegex.exec(stdout);
        if(ridMatch) {
          this.writeStatus(`Detected .NET RID: osx-${ridMatch[1]}`);
          return ridMatch[1]; // Returns 'x64' or 'arm64'
        }

        // Fallback: look for Architecture field
        const archRegex = /Architecture:\s*(x64|Arm64)/i;
        const archMatch = archRegex.exec(stdout);
        if(archMatch) {
          const detectedArch = archMatch[1].toLowerCase() === 'arm64' ? 'arm64' : 'x64';
          this.writeStatus(`Detected .NET Architecture: ${detectedArch}`);
          return detectedArch;
        }

        this.writeStatus('Could not parse .NET architecture from dotnet --info output');
        this.writeStatus('Falling back to system architecture detection');

        // Fallback to system architecture detection using same execAsync
        const { stdout: systemStdout } = await execAsync('uname -m');
        const systemArch = systemStdout.trim();
        return systemArch === 'x86_64' ? 'x64' : systemArch === 'arm64' ? 'arm64' : 'x64';
      } catch(error: unknown) {
        this.writeStatus(`Failed to detect architecture: ${error}`);
        this.writeStatus('Falling back to Node.js process architecture detection');
        return os.arch();
      }
    }

    // For non-macOS systems, use Node.js detection (preserve original behavior)
    return os.arch();
  }

  public async getConfiguredVersion(): Promise<string> {
    const [ , version ] = await this.getConfiguredTagAndVersion();
    return version;
  }

  private getConfiguredTagAndVersionCache: [string, string] | undefined;

  private async getConfiguredTagAndVersion(): Promise<[string, string]> {
    if(this.getConfiguredTagAndVersionCache === undefined) {
      const result = await this.getConfiguredGitTagAndVersionUncached();
      if(this.getConfiguredTagAndVersionCache === undefined) {
        this.getConfiguredTagAndVersionCache = result;
      }
    }
    return this.getConfiguredTagAndVersionCache;
  }

  private async getConfiguredGitTagAndVersionUncached(): Promise<[string, string]> {
    const preferredVersion = getPreferredVersion();
    let version = preferredVersion;
    switch(preferredVersion) {
    case LanguageServerConstants.LatestStable:
      version = await DafnyInstaller.dafny4upgradeCheck(
        this.context,
        preferredVersion,
        LanguageServerConstants.LatestVersion);
      break;
    case LanguageServerConstants.LatestNightly: {
      let name: string | undefined;
      try {
        const release = await this.fetchReleaseByTagCached('nightly');
        name = release.name;
        const parsed = parseNightlyVersionFromReleaseName(name);
        if(parsed !== undefined) {
          this.context.globalState.update('nightly-version', parsed);
          return [ 'nightly', parsed ];
        }
      } catch{
        // continue
      }
      // Github has some API limitations on how many times to call its API, so this is a good fallback.
      const cachedVersion = this.context.globalState.get('nightly-version');
      if(cachedVersion !== undefined) {
        version = cachedVersion as string;
        return [ 'nightly', version ];
      }
      window.showWarningMessage('Failed to install latest nightly version of Dafny. Using latest stable version instead.\n'
        + (name !== undefined ? `The name of the nightly release we found was: ${name}` : ''));
      version = LanguageServerConstants.LatestVersion;
    }
    }
    return [ `v${version}`, version ];
  }

  public async downloadArchive(downloadUri: string, downloadTarget: string): Promise<Uri> {
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

  public async extractArchive(archivePath: Uri, extractName: string): Promise<void> {
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

  public async getInstallationPath(): Promise<Uri> {
    return Utils.joinPath(
      this.context.extensionUri,
      ...LanguageServerConstants.GetResourceFolder(await this.getConfiguredVersion()),
      'github'
    );
  }

  private async getZipPath(): Promise<Uri> {
    return Utils.joinPath(await this.getInstallationPath(), ArchiveFileName);
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
