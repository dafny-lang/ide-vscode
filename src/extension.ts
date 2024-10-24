/* eslint-disable */

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
import { OpenAI } from "openai";
import { Anthropic } from "@anthropic-ai/sdk";

const DafnyVersionTimeoutMs = 5_000;
let extensionRuntime: ExtensionRuntime | undefined;

import * as PromiseAny from "promise.any";

export async function activate(context: ExtensionContext): Promise<void> {
  if (!(await checkAndInformAboutInstallation(context))) {
    return;
  }
  const statusOutput = window.createOutputChannel(
    ExtensionConstants.ChannelName
  );
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

async function callAI(
  openAiApiKey: string,
  claudeApiKey: string,
  prompt: string,
  code: string,
  provider: string
): Promise<string> {
  if (provider === "openai") {
    if (!openAiApiKey) {
      throw new Error(
        "OpenAI API key is not set. Please configure it in the settings."
      );
    }
    const openai = new OpenAI({
      apiKey: openAiApiKey,
    });

    try {
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: code },
        ],
        model: "gpt-4o",
      });

      return completion.choices[0].message.content
        .trim()
        .replace(/```dafny\n/g, "")
        .replace(/```/g, "");
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      } else {
        throw new Error("An unknown error occurred while calling OpenAI API");
      }
    }
  } else if (provider === "claude") {
    if (!claudeApiKey) {
      throw new Error(
        "Claude API key is not set. Please configure it in the settings."
      );
    }
    const anthropic = new Anthropic({
      apiKey: claudeApiKey,
    });

    try {
      const completion = await anthropic.completions.create({
        model: "claude-3-opus-20240229",
        max_tokens_to_sample: 1000,
        prompt: `${prompt}\n\nHuman: ${code}\n\nAssistant:`,
      });

      return completion.completion
        .trim()
        .replace(/```dafny\n/g, "")
        .replace(/```/g, "");
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Claude API error: ${error.message}`);
      } else {
        throw new Error("An unknown error occurred while calling Claude API");
      }
    }
  } else {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

async function GenerateLoopInvariantsFunction(
  client: DafnyLanguageClient,
  openAiApiKey: string,
  claudeApiKey: string,
  maxTries: number,
  aiProvider: string
): Promise<void> {
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("dafny")) {
      const config = vscode.workspace.getConfiguration("dafny");
      openAiApiKey = config.get("openAiApiKey") || "";
      claudeApiKey = config.get("claudeApiKey") || "";
      maxTries = config.get("numberOfRetries") || 3;
      aiProvider = config.get("aiProvider") || "openai";
    }
  });

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found.");
    return;
  }

  let selection = editor.selection;
  const firstSelection = selection;
  const originalText = editor.document.getText(selection);

  console.log("originalText", originalText);

  if (!originalText) {
    vscode.window.showErrorMessage(
      "No text selected. Please select the code you want to process."
    );
    return;
  }

  let currentText = originalText;
  let tries = 0;
  let success = false;
  let lastErrors: string[] = [];

  while (tries < maxTries && !success) {
    console.log("selection text", editor.document.getText(selection));
    tries++;
    console.log("selection", selection);
    try {
      let prompt =
        "Analyze the following Dafny code. Add appropriate loop invariants and fix any errors you find. Do not change the original code structure or functionality. Only add loop invariants and fix errors. Provide the resulting code without any explanations or additional text:";

      if (lastErrors.length > 0) {
        prompt +=
          "\n\nThe previous attempt resulted in the following errors. Please address these specifically:\n" +
          lastErrors.join("\n");
      }

      const waitMessage = vscode.window.setStatusBarMessage(
        `Generating loop invariants... (Attempt ${tries}/${maxTries})`
      );

      const aiResponse = await callAI(
        openAiApiKey,
        claudeApiKey,
        prompt,
        currentText,
        aiProvider
      );

      waitMessage.dispose();

      const formattedResponse = aiResponse.trim().replace(/\n{2,}/g, "\n");

      await editor.edit((editBuilder) => {
        editBuilder.replace(selection, formattedResponse);
      });

      selection = editor.selection;

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
      const errors = diagnostics.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Error
      );

      if (errors.length === 0) {
        success = true;
        vscode.window.showInformationMessage(
          `Loop invariants added and errors fixed without changing the original code structure. (Attempt ${tries}/${maxTries})`
        );
      } else {
        lastErrors = errors.map((e) => e.message);
        const errorMessages = lastErrors.join("\n");
        vscode.window.showWarningMessage(
          `Errors found after modification (Attempt ${tries}/${maxTries}):\n${errorMessages}`
        );

        currentText = editor.document.getText(selection); // Use the latest response for the next iteration
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error processing Dafny code (Attempt ${tries}/${maxTries}): ${error}`
      );
    }
  }

  if (!success) {
    // Roll back to the original code
    try {
      await vscode.commands.executeCommand("workbench.action.files.revert");
      vscode.window.showInformationMessage("Unsaved changes removed.");
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to remove unsaved changes: ${error}`
      );
    }
  }
}

export class ExtensionRuntime {
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
      provideTextDocumentContent: function (
        uri: Uri,
        token: CancellationToken
      ) {
        return "// Viewing Dafny libraries in the Dafny IDE is not yet supported.";
      },
    });

    const config = vscode.workspace.getConfiguration("dafny");
    const openAiApiKey = config.get<string>("openAiApiKey") || "";
    const claudeApiKey = config.get<string>("claudeApiKey") || "";
    const maxTries = config.get<number>("numberOfRetries") || 3;
    const aiProvider = config.get<string>("aiProvider") || "openai";

    await this.startClientAndWaitForVersion();
    createAndRegisterDafnyIntegration(
      this.installer,
      this.client!,
      this.languageServerVersion!
    );
    commands.registerCommand(DafnyCommands.RestartServer, restartServer);
    commands.registerCommand(DafnyCommands.GenerateLoopInvariants, () =>
      GenerateLoopInvariantsFunction(
        this.client!,
        openAiApiKey,
        claudeApiKey,
        maxTries,
        aiProvider
      )
    );
    this.statusOutput.appendLine("Dafny is ready");
  }

  private async getLanguageServerVersionAfterStartup(): Promise<string> {
    let versionRegistration: Disposable | undefined;
    const version = await PromiseAny([
      new Promise<string>((resolve) => {
        versionRegistration = this.client!.onServerVersion((version) =>
          resolve(version)
        );
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
    this.client =
      this.client ?? (await DafnyLanguageClient.create(this.installer));
    await this.client.start();
    this.languageServerVersion =
      await this.getLanguageServerVersionAfterStartup();
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
    createAndRegisterDafnyIntegration(
      this.installer,
      this.client!,
      this.languageServerVersion!
    );
    const issueURL = await fileIssueURL(
      this.languageServerVersion ?? "???",
      this.context
    );
    this.statusOutput.appendLine(
      "Dafny is ready again.\nIf you have time, please let us know why you needed to restart by filing an issue:\n" +
        issueURL
    );
  }
}
