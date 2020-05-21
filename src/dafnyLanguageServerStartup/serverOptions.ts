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
} from "../stringRessources/_StringRessourcesModule";

/*
 * Extends LanguageClient - provides basic config constructor for server initialize
 * This class is used by dafnyLanguageServer and is basicly just an extraction.
 */
export default class ServerOptions extends LanguageClient {
  constructor() {
    const config: WorkspaceConfiguration = workspace.getConfiguration(
      EnvironmentConfig.Dafny
    );
    const serverExePath: string | undefined = config.get(
      "languageServerExePath"
    );
    if (serverExePath === undefined) {
      window.showErrorMessage(Error.ServerExeNotDefined);
      return;
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
          pattern: "**/*.dfy",
        },
        {
          language: "dafny",
          scheme: "file",
        },
      ],
      synchronize: {
        fileEvents: workspace.createFileSystemWatcher("**/*.dfy"),
        configurationSection: "dafny",
      },
    };

    super(
      "dafny-vscode",
      "Dafny Language Server",
      serverOptions,
      clientOptions
    );
  }
}
