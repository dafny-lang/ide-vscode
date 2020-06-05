"use strict";
import * as vscode from "vscode";

import { EnvironmentConfig } from "../stringResources/_StringResourcesModule";

/**
 * This is a helper class for UI components.
 * Repeated used function like "isDafnyFile"
 * and "getActiveFileName" are centralized in this class
 * as static functions.
 */
export class DafnyFileChecker {
  static getActiveFileName(): string {
    return vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.document?.uri?.toString()
      : "";
  }
  static isDafnyFile(document: vscode.TextDocument): boolean {
    return document !== null && document.languageId === EnvironmentConfig.Dafny;
  }
}
