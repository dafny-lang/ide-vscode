"use strict";
import * as path from "path";
import * as semver from "semver";
import * as fs from "fs";
import * as rimraf from "rimraf";
import * as https from "https";
import * as uri from "vscode-uri";
import { https as redirect } from "follow-redirects";
const DecompressZip = require("decompress-zip");

import * as vscode from "vscode";

import { LanguageServerConfig } from "../stringResources/_StringResourcesModule";

import { ILanguageServerInstaller } from "./ILanguageServerInstaller";
/**
 * This is a fake implementation for the origin dafnyInstaller.ts:
 * https://github.com/DafnyVSCode/Dafny-VSCode/blob/develop/server/src/backend/dafnyInstaller.ts
 * Some functions and code blocks were taken from the origin file.
 *
 * It simulates the online availability of the Dafny language server on our server.
 * In this version, the upload of the server can only be automated in a limited way and is only a temporary interim solution.
 */
export class LanguageServerInstaller implements ILanguageServerInstaller {
  private readonly serverFolderName: string = LanguageServerConfig.ServerFolder;

  private readonly basePathToOutFolder: string = this.resolvePath(
    path.join(__dirname, "..", "..", this.serverFolderName)
  );
  private readonly downloadFile: string = this.resolvePath(
    path.join(this.basePathToOutFolder, "..", this.serverFolderName + ".zip")
  );

  private readonly serverURL: string =
    LanguageServerConfig.ServerDownloadAddress;
  private readonly serverReleaseVersion: string =
    LanguageServerConfig.RequiredVersion;

  constructor() {}
  public anyVersionInstalled(): boolean {
    return fs.existsSync(this.basePathToOutFolder); // serverExePath
  }

  public async installLatestVersion(): Promise<boolean> {
    if (this.anyVersionInstalled()) {
      this.deleteInstalledVersion();
    }
    vscode.window.showInformationMessage(
      "Download started. This will take a moment..."
    );
    const latestVersionInstalled: boolean = await this.downloadLatestServerRelease(
      this.serverURL,
      this.downloadFile
    );
    if (latestVersionInstalled) {
      const extracted: boolean = await this.extractZip(this.downloadFile);
      if (extracted) {
        return await this.cleanup();
      }
    }
    return Promise.reject(false);
  }

  private deleteInstalledVersion(): void {
    try {
      rimraf.sync(this.basePathToOutFolder);
    } catch (e) {
      console.log("Could not remove old dafny language server: " + e);
      vscode.window.showErrorMessage(
        "Could not remove old Dafny Language Server. Please delete this folder: " +
          this.basePathToOutFolder
      );
    }
  }

  public async latestVersionInstalled(localVersion: string): Promise<boolean> {
    try {
      const latestVersion: string = await this.getLatestVersion();

      const localVersionSemVer = localVersion.match(/(\d+\.\d+\.\d+)/);
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
          host: uri.URI.parse(url).authority,
          path: uri.URI.parse(url).path,
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
          fs.unlink(filePath);
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
