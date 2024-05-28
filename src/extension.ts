import {
  Disposable,
  ExtensionContext,
  OutputChannel,
  window,
  workspace,
  commands,
  Uri,
  CancellationToken,
  Position,
} from "vscode";
import { ExtensionConstants, LanguageServerConstants } from "./constants";
import { DafnyCommands } from "./commands";
import { DafnyLanguageClient } from "./language/dafnyLanguageClient";
import checkAndInformAboutInstallation from "./startupCheck";
import { DafnyInstaller } from "./language/dafnyInstallation";
import createAndRegisterDafnyIntegration from "./ui/dafnyIntegration";
import { timeout } from "./tools/timeout";
import { fileIssueURL } from "./ui/statusBarActionView";

import * as vscode from "vscode";

const OpenAI = require("openai");

// Promise.any() is only available since Node.JS 15.
import * as PromiseAny from "promise.any";

const DafnyVersionTimeoutMs = 5_000;
let extensionRuntime: ExtensionRuntime | undefined;

export async function activate(context: ExtensionContext): Promise<void> {
  if (!(await checkAndInformAboutInstallation(context))) {
    return;
  }
  const statusOutput = window.createOutputChannel(ExtensionConstants.ChannelName);
  context.subscriptions.push(statusOutput);
  extensionRuntime = new ExtensionRuntime(context, statusOutput);
  await extensionRuntime.initialize();
}

export async function deactivate(): Promise<void> {
  await extensionRuntime?.dispose();
}

export async function restartServer(): Promise<void> {
  await extensionRuntime?.restart();
}

async function callOpenAi(
  settingsAPIKey: string,
  prompt: string,
  code: string,
  previousCompletion: string,
  error: string
): Promise<string> {
  const openai = new OpenAI({
    apiKey: settingsAPIKey,
  });

  let completion;

  if (error !== "") {
    completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            prompt +
            "The code: " +
            code +
            "The error: " +
            error +
            "The previous completion: " +
            previousCompletion,
        },
      ],
      model: "gpt-4o",
    });
  } else {
    completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt + "The code: " + code }],
      model: "gpt-4o",
    });
  }

  return completion.choices[0].message.content
    .trim()
    .replace(/`/g, "")
    .replace(/^dafny\n/, "");
}

export async function GenerateLoopInvariantsFunction(
  client: any,
  settingsAPIKey: any,
  retriesMax: any
): Promise<void> {
  window.showInformationMessage("Generating...");

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("dafny")) {
      settingsAPIKey = vscode.workspace.getConfiguration("dafny").get("settingsAPIKey");
      retriesMax = vscode.workspace.getConfiguration("dafny").get("retriesMax");
    }
  });

  let success = false;
  let tries = 0;

  const editor = window.activeTextEditor;

  const prompt =
    "Generate loop invariants for this code in Dafny  (no explanations , just the completed code, without changing the original code ,Don't change the original code ,The upper bound in the 'for' loop is exclusive, Reference types (arrays, classes, etc.) do not admit null unless annotated with '?' ,The loop invariant for bounds is not needed for 'for' loops,You can use a return value directly in the 'return' instruction,Don't write redundant verifications.";

  if (editor) {
    const document = editor.document;
    let selection = editor.selection;
    let selectedTextRange = new vscode.Range(selection.start, selection.end);

    await client.runVerification({
      textDocument: {
        uri: document.uri.toString(),
      },
      position: new Position(0, 0),
    });

    let word = document.getText(selection);
    let errorPrompt = "";
    let previousCompletion = "";

    while (tries <= retriesMax && !success) {
      selection = editor.selection;
      selectedTextRange = new vscode.Range(selection.start, selection.end);

      word = document.getText(selection);

      const text = await callOpenAi(settingsAPIKey, prompt, word, previousCompletion, errorPrompt);
      tries += 1;

      editor.edit((editBuilder) => {
        editBuilder.replace(selection, text);
      });

      await document.save();

      const succeeded = await client.runVerification({
        textDocument: {
          uri: document.uri.toString(),
        },
        position: new Position(0, 0),
      });

      if (succeeded) {
        window.showInformationMessage("Done!");
        success = true;
        errorPrompt = "";
        previousCompletion = "";
        return;
      } else {
        const diagnosticsChangeHandler = vscode.languages.onDidChangeDiagnostics((event) => {
          if (event.uris.some((uri) => uri.toString() === document.uri.toString())) {
            let errorCount = 0;
            const diagnostics = vscode.languages.getDiagnostics(document.uri);

            errorPrompt = "The following errors were found (format errormessage-code) : ";

            diagnostics.forEach((error) => {
              if (error.source === "Verifier" && selectedTextRange.contains(error.range)) {
                errorCount++;
                errorPrompt += error.message + "-" + document.getText(error.range) + ";";
              }
            });

            if (errorCount === 0) {
              window.showInformationMessage("Done!");
              success = true;
              errorPrompt = "";
              previousCompletion = "";
              diagnosticsChangeHandler.dispose(); // remove the event handler
              return;
            } else {
              vscode.window.showInformationMessage(
                "Generating failed, trying again... (" + tries + ")"
              );
            }
          }
        });
      }
    }
    if (tries >= retriesMax) window.showInformationMessage("Max tries exceeded!");
  }

  return;
}
class ExtensionRuntime {
  private readonly installer: DafnyInstaller;
  private client?: DafnyLanguageClient;
  private languageServerVersion?: string;

  public constructor(
    private readonly context: ExtensionContext,
    private readonly statusOutput: OutputChannel
  ) {
    this.installer = new DafnyInstaller(context, statusOutput);
  }

  public async initialize(): Promise<void> {
    workspace.registerTextDocumentContentProvider("dafny", {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      provideTextDocumentContent: function (uri: Uri, token: CancellationToken) {
        return "// Viewing Dafny libraries in the Dafny IDE is not yet supported.";
      },
    });

    const config = vscode.workspace.getConfiguration("dafny");
    const settingsAPIKey = config.get("openAiApiKey");
    const retries = config.get("numberOfRetries");

    await this.startClientAndWaitForVersion();
    createAndRegisterDafnyIntegration(this.installer, this.client!, this.languageServerVersion!);
    commands.registerCommand(DafnyCommands.RestartServer, restartServer);
    commands.registerCommand(DafnyCommands.GenerateLoopInvariants, () =>
      GenerateLoopInvariantsFunction(this.client, settingsAPIKey, retries)
    );
    this.statusOutput.appendLine("Dafny is ready");
  }

  private async getLanguageServerVersionAfterStartup(): Promise<string> {
    let versionRegistration: Disposable | undefined;
    const version = await PromiseAny([
      new Promise<string>((resolve) => {
        versionRegistration = this.client!.onServerVersion((version) => resolve(version));
      }),
      // Fallback to unknown in case the server does not report the version.
      timeout(DafnyVersionTimeoutMs, LanguageServerConstants.UnknownVersion),
    ]);
    versionRegistration!.dispose();
    return version;
  }

  public async dispose(): Promise<void> {
    await this.client?.stop();
  }

  public async startClientAndWaitForVersion() {
    this.client = this.client ?? (await DafnyLanguageClient.create(this.installer));
    await this.client.start();
    this.languageServerVersion = await this.getLanguageServerVersionAfterStartup();
  }

  public async restart(): Promise<void> {
    this.statusOutput.appendLine("Terminating Dafny...");
    try {
      await this.dispose();
    } catch (e: unknown) {
      this.statusOutput.appendLine("Server did not respond...");
    }
    // The first subscription is the statusOutput and should not be disposed.
    for (let i = 1; i < this.context.subscriptions.length; i++) {
      this.context.subscriptions[i].dispose();
    }
    this.context.subscriptions.splice(1);
    await this.startClientAndWaitForVersion();
    createAndRegisterDafnyIntegration(this.installer, this.client!, this.languageServerVersion!);
    const issueURL = await fileIssueURL(this.languageServerVersion ?? "???", this.context);
    this.statusOutput.appendLine(
      "Dafny is ready again.\nIf you have time, please let us know why you needed to restart by filing an issue:\n" +
        issueURL
    );
  }
}
