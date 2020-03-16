import * as vscode from "vscode";
import { DafnyClientProvider } from "../dafnyProvider";
import DafnyLanguageServer from "../server/dafnyLanguageClient";
import { Answer, LanguageServerNotification } from "../stringRessources";
import Commands from "./commands";

/**
 * VSCode UI Notifications
 */
export default class Notifications {
    public extensionContext: vscode.ExtensionContext;
    public languageServer: DafnyLanguageServer;
    public provider: DafnyClientProvider;
    public commands: Commands;

    public notifications = [
        { method: LanguageServerNotification.Error, handler: vscode.window.showErrorMessage },
        { method: LanguageServerNotification.Warning, handler: vscode.window.showWarningMessage },
        { method: LanguageServerNotification.Info, handler: vscode.window.showInformationMessage },
        { method: LanguageServerNotification.DafnyMissing, handler: (message: string) => this.askToInstall(message) },
    ];

    constructor(extensionContext: vscode.ExtensionContext, languageServer: DafnyLanguageServer, provider: DafnyClientProvider, commands: Commands) {
        this.extensionContext = extensionContext;
        this.languageServer = languageServer;
        this.provider = provider;
        this.commands = commands;
    }

    public registerNotifications() {
        for (const notification of this.notifications) {
            this.languageServer.onNotification(notification.method, notification.handler);
        }
    }

    public askToInstall(text: string) {
        vscode.window.showInformationMessage(text, Answer.Yes, Answer.No).then((value) => {
            if (Answer.Yes === value) {
                this.commands.installDafny();
            }
        });
    }
}
