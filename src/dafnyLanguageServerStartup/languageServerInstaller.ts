"use strict";
import { ILanguageServerInstaller } from "./ILanguageServerInstaller";
/**
 * This is a fake implementation for the origin dafnyInstaller.ts:
 * https://github.com/DafnyVSCode/Dafny-VSCode/blob/develop/server/src/backend/dafnyInstaller.ts
 *
 * It simulates the online availability of the Dafny language server on a private, separate server.
 * In our version, the upload of the server can only be automated in a limited way and is only a temporary interim solution.
 */
export class LanguageServerInstaller implements ILanguageServerInstaller {
  private readonly basePath = this.resolvePath(
    pathHelper.join(__dirname, "..", "..", "dafny")
  );
  private readonly downloadFile = this.resolvePath(
    pathHelper.join(this.basePath, "..", "dafny.zip")
  );

  constructor(private notificationService: NotificationService) {}

  public async latestVersionInstalled(localVersion: string): Promise<boolean> {
    try {
      const json = await this.getLatestVersion();
      const localVersionSemVer = localVersion.match(/(\d+\.\d+\.\d+)/);
      if (json && json.name) {
        const latestVersion = json.name; // semver ignores leading v
        const latestVersionSemVer = latestVersion.match(/(\d+\.\d+\.\d+)/);
        if (localVersionSemVer != null && latestVersionSemVer != null) {
          console.log("Local: " + localVersionSemVer[0]);
          console.log("Remote:" + latestVersionSemVer[0]);
          return semver.gte(localVersionSemVer[0], latestVersionSemVer[0]);
        } else {
          console.log("Can't parse version numbers");
          return Promise.reject(false);
        }
      } else {
        throw new Error("Could not read dafny version from JSON");
      }
    } catch (e) {
      console.log("Can't get release information: " + e);
      return Promise.reject(false);
    }
  }

  private getLatestVersion(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const options: https.RequestOptions = {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT x.y; rv:10.0) Gecko/20100101 Firefox/10.0",
        },
        host: uri.parse(Installer.ReleaseUrl).authority,
        path: uri.parse(Installer.ReleaseUrl).path,
      };

      https
        .get(options, (res) => {
          let body = "";

          res.on("data", (chunk) => {
            body += chunk;
          });

          res.on("end", () => {
            try {
              const json = JSON.parse(body);
              resolve(json);
            } catch (e) {
              console.log("Could not parse Dafny release information JSON");
              reject();
            }
          });
        })
        .on("error", (e) => {
          console.error(e);
          return reject(e);
        });
    });
  }

  private removeCurrentVErsion() {
    // if exists.
  }

  private downloadLatestServerRelease(json: any): Promise<boolean> {
    if (!json || !json.assets) {
      const msg = "Could not get Dafny Release assets from JSON response.";
      console.log(msg);
      return Promise.reject(msg);
    }

    let platform;
    switch (os.platform()) {
      case EnvironmentConfig.Win32:
        platform = "win";
        break;
      case EnvironmentConfig.OSX:
        platform = "osx";
        break;
      case EnvironmentConfig.Ubuntu:
        platform = "ubuntu";
        break;
    }
    if (!platform) {
      return Promise.reject(`Unsupported platform: "${os.platform()}"`);
    }

    const url = this.getReleaseUrl(json.assets, platform);
    if (!url) {
      return Promise.reject(
        `Could not find dafny release for platform "${platform}"`
      );
    }

    return this.download(url, this.downloadFile);
  }

  private cleanupSetPermission(): Promise<string> {
    if (os.platform() !== EnvironmentConfig.Win32) {
      fs.chmodSync(
        pathHelper.join(this.basePath, "dafny", "z3", "bin", "z3"),
        "755"
      );
      fs.chmodSync(
        pathHelper.join(this.basePath, "dafny", "DafnyServer.exe"),
        "755"
      );
      fs.chmodSync(pathHelper.join(this.basePath, "dafny", "Dafny.exe"), "755");
    }

    fs.unlink(this.downloadFile, (err) => {
      if (err) {
        console.error("Error deleting archive: " + err);
      }
    });
    console.log("prepared dafny");

    return Promise.resolve(pathHelper.join(this.basePath, "dafny"));
  }

  private download(url: string, filePath: string): Promise<boolean> {
    return new Promise<any>((resolve, reject) => {
      try {
        this.notificationService.startProgress();
        const options: https.RequestOptions = {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT x.y; rv:10.0) Gecko/20100101 Firefox/10.0",
          },
          host: uri.parse(url).authority,
          path: uri.parse(url).path,
        };

        const file = fs.createWriteStream(filePath);
        const request = redirect.get(options, (response: any) => {
          response.pipe(file);

          const len = parseInt(response.headers["content-length"], 10);
          let cur = 0;
          response.on("data", (chunk: string) => {
            cur += chunk.length;
            this.notificationService.progress("Downloading Dafny ", cur, len);
          });

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
        console.error("Error downloading dafny: " + e);
        return reject(false);
      }
    });
  }

  private extract(filePath: string): Promise<boolean> {
    return new Promise<any>((resolve, reject) => {
      try {
        console.log("Extracting files...");
        this.notificationService.startProgress();

        const unzipper = new DecompressZip(filePath);

        unzipper.on("progress", (fileIndex: number, fileCount: number) => {
          this.notificationService.progress(
            "Extracting Dafny ",
            fileIndex + 1,
            fileCount
          );
        });

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
          filter: (file: any) => file.type !== "SymbolicLink",
          path: this.basePath,
        });
      } catch (e) {
        console.error("Error extracting dafny: " + e);
        return reject(false);
      }
    });
  }
}
