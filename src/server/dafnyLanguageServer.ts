"use strict";
import * as vscode from "vscode";
import { Trace } from 'vscode-jsonrpc';

import DafnyLanguageServerClient from "./dafnyLanguageClient";
import DafnyLanguageClient from "./dafnyLanguageClient";
import Commands from "../ui/commands";
import Notifications from "../ui/notifications";

import { DafnyProvider } from "../dafnyProvider";
import { DafnyRunner } from "../localExecutionHelpers/dafnyRunner";
import { LanguageServerNotification } from "../stringRessources/languageServer";
import { CommandStrings } from "../stringRessources/commands";

/*
* This starts basicly the Dafny language server and has been extracted from the extension.ts ("Main").
* It does also provide command registration for "restart language server".
*/
export default class DafnyLanguageServer {
    private languageServer: DafnyLanguageClient | undefined; 
    private languageServerDisposable: vscode.Disposable | undefined; 
    private runner: DafnyRunner;
    private extensionContext: vscode.ExtensionContext; 

    constructor(extensionContext: vscode.ExtensionContext) {
        this.runner =  new DafnyRunner()
        this.extensionContext = extensionContext; 
    }

    public startLanguageServer(): void {
        this.languageServer = new DafnyLanguageServerClient();
        this.languageServer.trace = Trace.Verbose;
    
        this.languageServer.onReady().then(() => {
            if(this.languageServer) {
                const provider = new DafnyProvider(this.extensionContext, this.languageServer);
        
                const commands = new Commands(this.extensionContext, this.languageServer, provider, this.runner);
                commands.registerCommands();
        
                const notifications = new Notifications(this.languageServer);
                notifications.registerNotifications();
        
                provider.registerEventListener();
            }
        });
    
        // Push the disposable to the context's subscriptions so that the
        // client can be deactivated on extension deactivation
        this.languageServerDisposable = this.languageServer.start();
        this.extensionContext.subscriptions.push(this.languageServerDisposable);
    }

    // This function is not registered in commands.ts since it has a higher cohesion here 
    public registerServerRestartCommand(): void {
        this.extensionContext.subscriptions.push(vscode.commands.registerCommand(
            CommandStrings.RestartServer, 
            async () => {
                vscode.window.showErrorMessage("Server stopped");
                await this.languageServer?.stop();
                this.languageServerDisposable?.dispose();

                vscode.window.showInformationMessage("Starting Server...");
                this.startLanguageServer();
            })
        );
    }
}