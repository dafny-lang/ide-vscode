"use strict";
import { workspace, WorkspaceConfiguration, window } from "vscode";
import {
  LanguageClient,
  ServerOptions as ClientServerOptions,
} from "vscode-languageclient";
import { LanguageClientOptions } from "vscode-languageclient/lib/client";
import * as path from "path";
import * as fs from "fs";

import {
  EnvironmentConfig,
  Error,
  Config,
} from "../stringResources/_StringResourcesModule";

/**
 * Extends LanguageClient - provides basic config constructor for server initialize
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

    const dafnyLangServerExe = path.join(__dirname, serverExePath);

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
