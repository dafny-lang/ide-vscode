"use strict";
import * as path from "path";
import * as fs from "fs";

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

/**
 * Extends LanguageClient - provides basic config constructor for server initialization.
 * This class is used by dafnyLanguageServer and is basically just an extraction.
 */
export default class ServerOptions extends LanguageClient {
  constructor() {
    const config: WorkspaceConfiguration = workspace.getConfiguration(
      EnvironmentConfig.Dafny
    );
    let serverExePath: string | undefined = config.get<string>(
      Config.LanguageServerExePath
    );
    if (serverExePath === undefined) {
      window.showErrorMessage(Error.ServerExeNotDefined);
      throw Error.ServerExeNotDefined;
    }

    const dafnyLangServerExe = path.isAbsolute(serverExePath) ? serverExePath : path.join(__dirname, serverExePath);

    fs.exists(dafnyLangServerExe, (exist) => {
      if (!exist) {
        window.showErrorMessage(
          `${Error.ServerExeNotFound}: ${dafnyLangServerExe}`
        );
      }
    });

    const serverOptions: ClientServerOptions = {
      run: { command: dafnyLangServerExe, args: [] },
      debug: { command: dafnyLangServerExe, args: [] },
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
