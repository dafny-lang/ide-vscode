"use strict";

import * as os from "os";
import * as path from "path";
import * as semver from "semver";
import * as fs from "fs";
import * as rimraf from "rimraf";
import * as https from "https";
import * as child_process from "child_process";
import * as util from "util";
import { https as redirect } from "follow-redirects";
const DecompressZip = require("decompress-zip");

import { window, URI } from "../ideApi/_IdeApi";
import { LanguageServerConfig } from "../stringResources/_StringResourcesModule";

import { ILanguageServerInstaller } from "./ILanguageServerInstaller";

/**
 * This is a fake implementation for the origin dafnyInstaller.ts:
 * https://github.com/DafnyVSCode/Dafny-VSCode/blob/develop/server/src/backend/dafnyInstaller.ts
 * Some functions and code blocks were taken from the origin file.
 *
 * It simulates the online availability of the Dafny language server on our server.
 * In this version, the upload of the server can only be automated in a limited way and is only a temporary interim solution.
 *
 * Since this is a temporary solution, strings have not been outsourced to stringResources.
 */

function getLanguageServerPlatformSuffix(): string {
  switch (os.type()) {
    case "Windows_NT":
      return "win";
    case "Darwin":
      return "osx-10.14.2";
    default:
      return "ubuntu-16.04";
  }
}

export class LanguageServerInstaller implements ILanguageServerInstaller {
  private readonly resourcesFolderName: string =
    LanguageServerConfig.ResourcesFolder;

  private readonly basePathToOutFolder: string = this.resolvePath(
    path.join(__dirname, "..", "..", this.resourcesFolderName)
  );
  private readonly downloadFile: string = this.resolvePath(
    path.join(this.basePathToOutFolder, "..", this.resourcesFolderName + ".zip")
  );
  private readonly z3ExecutablePath = this.resolvePath(
    path.join(this.basePathToOutFolder, "dafny", "z3", "bin", "z3")
  );

  private readonly serverURL: string = LanguageServerConfig.getServerDownloadAddress(
    getLanguageServerPlatformSuffix()
  );
  private readonly serverReleaseVersion: string =
    LanguageServerConfig.RequiredVersion;

  constructor() {}

  public anyVersionInstalled(): boolean {
    return fs.existsSync(this.basePathToOutFolder); // serverExePath
  }

  private requiresExecutionPermissions(): boolean {
    return os.type() !== "Windows_NT";
  }

  public async installLatestVersion(): Promise<boolean> {
    if (this.anyVersionInstalled()) {
      this.deleteInstalledVersion();
    }
    window.showInformationMessage(
      "Download started. This will take a moment..."
    );
    const latestVersionInstalled: boolean = await this.downloadLatestServerRelease(
      this.serverURL,
      this.downloadFile
    );
    if (latestVersionInstalled) {
      const extracted: boolean = await this.extractZip(this.downloadFile);
      if (extracted) {
        await this.makeZ3ExecutableIfNecessary();
        return await this.cleanup();
      }
    }
    return Promise.reject(false);
  }

  private async makeZ3ExecutableIfNecessary(): Promise<void> {
    if (!this.requiresExecutionPermissions()) {
      return;
    }
    const yesResponse = "Yes";
    const promtResponse = await window.showInformationMessage(
      "The z3 executable bundled with the language server requires execution permissions. " +
        "Automatically apply `chmod u+x`?",
      yesResponse,
      "No"
    );
    if (promtResponse === yesResponse) {
      await this.makeZ3Executable();
    }
  }

  private async makeZ3Executable(): Promise<void> {
    try {
      await util.promisify(child_process.exec)(
        `chmod u+x "${this.z3ExecutablePath}"`
      );
    } catch (e) {
      console.log("Could not set the execution permissions for z3: " + e);
      window.showErrorMessage(
        "Could not set the execution permissions for z3. Please set it manually to " +
          this.z3ExecutablePath
      );
    }
  }

  private deleteInstalledVersion(): void {
    try {
      rimraf.sync(this.basePathToOutFolder);
    } catch (e) {
      console.log("Could not remove old dafny language server: " + e);
      window.showErrorMessage(
        "Could not remove old Dafny Language Server. Please delete this folder: " +
          this.basePathToOutFolder
      );
    }
  }

  public async latestVersionInstalled(localVersion: string): Promise<boolean> {
    try {
      const latestVersion: string = await this.getLatestVersion();

      const localVersionSemVer = localVersion.match(/(\d+\.\d+\.\d+).*/);
      const latestVersionSemVer = latestVersion.match(/(\d+\.\d+\.\d+)/);

      if (localVersionSemVer != null && latestVersionSemVer != null) {
        console.log("Local: " + localVersionSemVer[0]);
        console.log("Remote:" + latestVersionSemVer[0]);
        return semver.gte(localVersionSemVer[0], latestVersionSemVer[0]);
      } else {
        console.log("Can not parse version numbers");
        return Promise.reject(false);
      }
    } catch (e) {
      console.log("Can not get release information: " + e);
      return Promise.reject(false);
    }
  }

  private resolvePath(str: string) {
    if (str.substr(0, 2) === "~/") {
      str =
        (process.env.HOME ||
          process.env.HOMEPATH ||
          process.env.HOMEDIR ||
          process.cwd()) + str.substr(1);
    }
    return path.resolve(str);
  }

  // this would be an http api request to the GitHub CI server.
  private getLatestVersion(): Promise<string> {
    return Promise.resolve(this.serverReleaseVersion);
  }

  private downloadLatestServerRelease(
    url: string,
    filePath: string
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        const options: https.RequestOptions = {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT x.y; rv:10.0) Gecko/20100101 Firefox/10.0",
          },
          host: URI.parse(url).authority,
          path: URI.parse(url).path,
        };

        const file = fs.createWriteStream(filePath);
        const request = redirect.get(options, (response: any) => {
          response.pipe(file);

          file.on("finish", () => {
            file.close();
            return resolve(true);
          });
        });
        request.on("error", (err: Error) => {
          fs.unlink(filePath, () => {});
          throw err;
        });
      } catch (e) {
        console.error("Error downloading Dafny Language Server: " + e);
        return reject(false);
      }
    });
  }

  private cleanup(): Promise<boolean> {
    fs.unlink(this.downloadFile, (err) => {
      if (err) {
        console.error("Error deleting archive: " + err);
      }
    });
    return Promise.resolve(true);
  }

  private extractZip(filePath: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        console.log("Extracting files...");

        const unzipper = new DecompressZip(filePath);

        unzipper.on("error", (e: any) => {
          if (e.code && e.code === "ENOENT") {
            console.error(
              "Error updating Dafny Language Server, missing create file permission in the Dafny directory: " +
                e
            );
          } else if (e.code && e.code === "EACCES") {
            console.error(
              "Error extracting " + filePath + ": " + e + " | " + e.message
            );
          } else {
            console.error("Error extracting " + filePath + ": " + e);
          }
          return reject(false);
        });

        unzipper.on("extract", () => {
          return resolve(true);
        });

        if (!fs.existsSync(this.basePathToOutFolder)) {
          fs.mkdirSync(this.basePathToOutFolder);
        }
        unzipper.extract({
          path: this.basePathToOutFolder,
        });
      } catch (e) {
        console.error("Error extracting Dafny Language Server: " + e);
        return reject(false);
      }
    });
  }
}
