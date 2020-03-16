import { workspace, WorkspaceConfiguration } from "vscode";
import { LanguageClient, ServerOptions } from "vscode-languageclient";
import { LanguageClientOptions } from "vscode-languageclient/lib/client";
import { window } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { EnvironmentConfig } from "../stringRessources";

export default class DafnyLanguageClient extends LanguageClient {
    constructor() {
        const config: WorkspaceConfiguration = workspace.getConfiguration(EnvironmentConfig.Dafny);
        var serverExePath : string | undefined = config.get("serverExePath");
        if(serverExePath === undefined)  {
            window.showErrorMessage("Server Executable not defined: please check your config for serverExePath");
            return; 
        }

        const dafnyLangServerExe = path.join(__dirname, serverExePath);

        fs.exists(dafnyLangServerExe, (exist) => {
            if (!exist) {
                window.showErrorMessage("Server Executable not found: " + dafnyLangServerExe);
            }
        });

        const serverOptions: ServerOptions = {
            run: { command: dafnyLangServerExe, args: [] },
            debug: { command: dafnyLangServerExe, args: [] }
        }

        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                {
                    pattern: '**/*.dfy',
                },
                {
                    language: "dafny",
                    scheme: "file",
                }
            ],
            synchronize: {
                fileEvents: workspace.createFileSystemWatcher('**/*.dfy'),
                configurationSection: "dafny",
            },
        }

        super("dafny-vscode", "Dafny Language Server", serverOptions, clientOptions);
    }
}
