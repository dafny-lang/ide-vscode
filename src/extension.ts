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

async function waitForDiagnostics(uri: vscode.Uri): Promise<vscode.Diagnostic[]> {
  return new Promise((resolve, reject) => {
    const subscription = vscode.languages.onDidChangeDiagnostics((event) => {
      if (event.uris.some((eventUri) => eventUri.toString() === uri.toString())) {
        const diagnostics = vscode.languages.getDiagnostics(uri);
        console.log("diagnostics:", diagnostics);
        let errorDiagnostics = [];
        errorDiagnostics = diagnostics.filter(
          (diagnostic) =>
            diagnostic.source === "Verifier" ||
            diagnostic.source === "Parser" ||
            diagnostic.source === "Resolver"
        );

        subscription.dispose(); // Clean up the event listener
        resolve(errorDiagnostics); // Resolve the promise with the filtered diagnostics
      }
    });

    // Optional: Reject the promise after a timeout if the conditions are not met
    setTimeout(() => {
      subscription.dispose(); // Ensure to clean up if we hit the timeout
      reject(new Error("Timeout waiting for diagnostics to update."));
    }, 10000); // Increase timeout to 10 seconds as an example
  });
}

function findRangeToReplace(document: any, textToReplace: any) {
  const documentText = document.getText();
  const searchIndex = documentText.indexOf(textToReplace);
  const start = document.positionAt(searchIndex);
  const end = document.positionAt(searchIndex + textToReplace.length);
  const range = new vscode.Range(start, end);

  return range;
}

async function GenerateLoopInvariantsFunction(
  client: any,
  settingsAPIKey: any,
  retriesMax: any
): Promise<void> {
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
    "Generate loop invariants for the following code in Dafny\n" +
    "Do not include explanations.\n" +
    "Return only code.\n" +
    "Fix the code if it is incorrect.\n" +
    "Don't write redundant verifications.\n" +
    "Here is the code: ";

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
    const previousCompletion = "";
    let text = "";
    let originalText = "";

    console.log(retriesMax);

    while (tries <= retriesMax && !success) {
      window.showInformationMessage("Generating... Try number: " + tries);
      if (tries === 0) {
        selection = editor.selection;
        selectedTextRange = new vscode.Range(selection.start, selection.end);
        word = document.getText(selection);
        originalText = document.getText(selection);
      } else {
        word = text;
        selectedTextRange = findRangeToReplace(document, text);
      }

      console.log("text selected");

      text = await callOpenAi(settingsAPIKey, prompt, word, previousCompletion, errorPrompt);
      tries += 1;

      editor.edit((editBuilder) => {
        editBuilder.replace(selectedTextRange, text);
      });

      console.log("edited");

      //await vscode.commands.executeCommand("dafny.run");

      // await client.runVerification({
      //   textDocument: {
      //     uri: document.uri.toString(),
      //   },
      //   position: new Position(0, 0),
      // });

      const diagnostics = vscode.languages.getDiagnostics(document.uri);

      let errorDiagnostics = [];
      errorDiagnostics = diagnostics.filter(
        (diagnostic) => diagnostic.source === "Verifier" || diagnostic.source === "Parser"
      );

      console.log("diagnostics final:", errorDiagnostics);

      errorPrompt = "The following errors were found : ";
      errorDiagnostics.forEach((error) => {
        console.log(error);
        if (error.source === "Verifier" || error.source === "Parser") {
          errorPrompt += error.message + "-" + document.getText(error.range) + ";";
        }
      });

      if (errorDiagnostics.length === 0) {
        success = true;
      }

      // try {
      //   await document.save();
      //   const diag = await waitForDiagnostics(document.uri);
      //   console.log("diagnostics after verification:", diag);

      //   errorPrompt = "The following errors were found : ";
      //   diag.forEach((error) => {
      //     console.log(error);
      //     if (error.source === "Verifier" || error.source === "Parser") {
      //       errorPrompt += error.message + "-" + document.getText(error.range) + ";";
      //     }
      //   });

      //   if (diag.length === 0) {
      //     success = true;
      //   }
      // } catch (error) {
      //   console.error("Timeout or error while waiting for diagnostics:", error);
      // }
    }

    if (tries >= retriesMax) {
      editor.edit((editBuilder) => {
        editBuilder.replace(findRangeToReplace(document, text), originalText);
      });
      await document.save();
      window.showInformationMessage("Max tries exceeded!");
    }

    if (success) {
      window.showInformationMessage("Done! Successfully generated loop invariants...");
      await document.save();
    }
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
