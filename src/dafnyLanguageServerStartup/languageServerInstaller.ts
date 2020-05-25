"use strict";
import * as path from "path";
import * as semver from "semver";
import * as fs from "fs";
import * as rimraf from "rimraf";
import * as https from "https";
import * as os from "os";
import * as uri from "vscode-uri";
import { https as redirect } from "follow-redirects";
const DecompressZip = require("decompress-zip");

import { EnvironmentConfig } from "../stringRessources/_StringRessourcesModule";

import { ILanguageServerInstaller } from "./ILanguageServerInstaller";
/**
 * This is a fake implementation for the origin dafnyInstaller.ts:
 * https://github.com/DafnyVSCode/Dafny-VSCode/blob/develop/server/src/backend/dafnyInstaller.ts
 * Some functions and code blocks were taken from the origin file.
 *
 * It simulates the online availability of the Dafny language server on our CI GitLab server.
 * In our version, the upload of the server can only be automated in a limited way and is only a temporary interim solution.
 */
export class LanguageServerInstaller implements ILanguageServerInstaller {
  private readonly tmpServerFolder: string = "dafnyTMPServer";

  private readonly basePath: string = this.resolvePath(
    path.join(__dirname, "..", "..", this.tmpServerFolder)
  );
  private readonly downloadFile: string = this.resolvePath(
    path.join(this.basePath, "..", "dafnyLanguageServer.zip")
  );

  private readonly tmpBinaryURL: string =
    "https://wuza.ch/specials/SA/artifacts.zip";
  // "https://gitlab.dev.ifs.hsr.ch/dafny-ba/dafny-language-server/-/jobs/artifacts/master/download?job=build_server_and_sonar";
  private readonly tmpReleaseVersion: string = "1.0.0";

  constructor() {}
  public anyVersionInstalled(): boolean {
    return fs.existsSync(this.basePath); // serverExePath
  }

  public async installLatestVersion(): Promise<boolean> {
    if (this.anyVersionInstalled()) {
      this.deleteInstalledVersion();
    }
    this.downloadLatestServerRelease(this.tmpBinaryURL, this.downloadFile).then(
      () => {
        this.extractZip(this.downloadFile).then(() => {
          this.cleanupSetPermission().then(() => {
            return true;
          });
        });
      }
    );
    return false;
  }

  private deleteInstalledVersion(): void {
    rimraf.sync(this.basePath);
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
    return new Promise<string>(() => {
      this.tmpReleaseVersion;
    });
  }

  private downloadLatestServerRelease(
    url: string,
    filePath: string
  ): Promise<boolean> {
    return new Promise<any>((resolve, reject) => {
      try {
        //this.notificationService.startProgress();
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

          //const len = parseInt(response.headers["content-length"], 10);
          //let cur = 0;
          //response.on("data", (chunk: string) => {
          //cur += chunk.length;
          //this.notificationService.progress("Downloading Dafny ", cur, len);
          // });

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
        console.error("Error downloading Dafny: " + e);
        return reject(false);
      }
    });
  }

  private cleanupSetPermission(): Promise<string> {
    if (os.platform() !== EnvironmentConfig.Win32) {
      fs.chmodSync(
        path.join(this.basePath, this.tmpServerFolder, "z3", "bin", "z3"),
        "755"
      );
      fs.chmodSync(
        path.join(this.basePath, this.tmpServerFolder, "DafnyServer.exe"),
        "755"
      );
      fs.chmodSync(
        path.join(this.basePath, this.tmpServerFolder, "Dafny.exe"),
        "755"
      );
    }

    fs.unlink(this.downloadFile, (err) => {
      if (err) {
        console.error("Error deleting archive: " + err);
      }
    });
    console.log("prepared dafny");

    return Promise.resolve(path.join(this.basePath, this.tmpServerFolder));
  }

  private extractZip(filePath: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        console.log("Extracting files...");
        //this.notificationService.startProgress();

        const unzipper = new DecompressZip(filePath);

        unzipper.on("error", (e: any) => {
          if (e.code && e.code === "ENOENT") {
            console.error(
              "Error updating Dafny, missing create file permission in the dafny directory: " +
                e
            );
          } else if (e.code && e.code === "EACCES") {
            console.error(
              "Error extracting " + filePath + ": " + e + " | " + e.message
            );
          } else {
            console.error("Error extracting " + filePath + ": " + e);
          }
          return reject(e);
        });

        unzipper.on("extract", () => {
          return resolve();
        });

        if (!fs.existsSync(this.basePath)) {
          fs.mkdirSync(this.basePath);
        }
        unzipper.extract({
          //filter: (file: any) => file.type !== "SymbolicLink",
          path: this.basePath,
        });
      } catch (e) {
        console.error("Error extracting Dafny: " + e);
        return reject(false);
      }
    });
  }
}
