"use strict";

import * as fs from "fs";
import * as path from "path";
import * as which from "which";

import {
  workspace,
  WorkspaceConfiguration,
  window,
  LanguageClientOptions,
  LanguageClient,
  ClientServerOptions,
} from "../ideApi/_IdeApi";
import {
  EnvironmentConfig,
  Error,
  Config,
} from "../stringResources/_StringResourcesModule";

function getDotnetExecutablePath(config: WorkspaceConfiguration): string {
  let dotnetExecutablePath: string | undefined = config.get<string>(
    Config.DotnetExecutablePath
  );
  // TODO Somehow and empty string is returned if this setting is not configured?
  if (
    dotnetExecutablePath !== undefined &&
    dotnetExecutablePath.trim().length > 0
  ) {
    return dotnetExecutablePath;
  }
  const resolvedDotnetPath = which.sync("dotnet", { nothrow: true });
  console.log("Resolved dotnet at: " + resolvedDotnetPath);
  return resolvedDotnetPath || "dotnet";
}

/**
 * Extends LanguageClient - provides basic config constructor for server initialization.
 * This class is used by dafnyLanguageServer and is basically just an extraction.
 */
export default class ServerOptions extends LanguageClient {
  constructor() {
    const config: WorkspaceConfiguration = workspace.getConfiguration(
      EnvironmentConfig.Dafny
    );
    const dotnetExecutablePath = getDotnetExecutablePath(config);
    fs.exists(dotnetExecutablePath, (exist) => {
      if (!exist) {
        window.showErrorMessage(
          `${Error.DotnetExeNotFound}: ${dotnetExecutablePath}`
        );
      }
    });

    let languageServerRuntimePath = config.get<string>(
      Config.LanguageServerRuntimePath
    );
    if (languageServerRuntimePath === undefined) {
      window.showErrorMessage(Error.ServerRuntimeNotDefined);
      throw Error.ServerRuntimeNotDefined;
    }
    if (!path.isAbsolute(languageServerRuntimePath)) {
      languageServerRuntimePath = path.join(
        __dirname,
        languageServerRuntimePath
      );
    }
    fs.exists(languageServerRuntimePath, (exist) => {
      if (!exist) {
        window.showErrorMessage(
          `${Error.ServerRuntimeNotDefined}: ${languageServerRuntimePath}`
        );
      }
    });

    const launchArguments: string[] | undefined =
      config.get<string[]>(Config.LanguageServerLaunchArgs) || [];
    launchArguments.splice(0, 0, languageServerRuntimePath);
    const serverOptions: ClientServerOptions = {
      run: { command: dotnetExecutablePath, args: launchArguments },
      debug: { command: dotnetExecutablePath, args: launchArguments },
    };

    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        {
          pattern: EnvironmentConfig.DafnyFileExtension,
        },
        {
          language: EnvironmentConfig.Dafny,
          scheme: EnvironmentConfig.DocumentSelector,
        },
      ],
      synchronize: {
        fileEvents: workspace.createFileSystemWatcher(
          EnvironmentConfig.DafnyFileExtension
        ),
        configurationSection: EnvironmentConfig.Dafny,
      },
    };

    super(
      EnvironmentConfig.DafnyLanguageServerID,
      EnvironmentConfig.DafnyLanguageServerName,
      serverOptions,
      clientOptions
    );
  }
}
