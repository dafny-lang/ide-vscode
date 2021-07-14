"use strict";

import * as fs from "fs";
import * as path from "path";

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
import { getDotnetExecutablePath } from "../tools/_ToolsModule";

/**
 * Extends LanguageClient - provides basic config constructor for server initialization.
 * This class is used by dafnyLanguageServer and is basically just an extraction.
 */
export default class ServerOptions extends LanguageClient {
  constructor() {
    const config: WorkspaceConfiguration = workspace.getConfiguration(
      EnvironmentConfig.Dafny
    );
    const dotnetExecutablePath = getDotnetExecutablePath();
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

    const launchArguments: string[] =
      config.get<string[]>(Config.LanguageServerLaunchArgs) || [];
    const autoVerification: string =
      config.get<string>(Config.AutomaticVerification) || "onchange";
    const dotnetArguments = [
      languageServerRuntimePath,
      `--documents:verify=${autoVerification}`,
      ...launchArguments,
    ];
    const serverOptions: ClientServerOptions = {
      run: { command: dotnetExecutablePath, args: dotnetArguments },
      debug: { command: dotnetExecutablePath, args: dotnetArguments },
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
