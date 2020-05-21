"use strict";
import * as vscode from "vscode";

import { EnvironmentConfig } from "../stringRessources/_StringRessourcesModule";

/**
 * This is a helper class for UI components.
 * Repeated used function like "is the current file a Dafny file"
 * and get the name of the current file are centralized in this class
 * as static functions.
 */
export class DafnyFileChecker {
  static getActiveFileName(): string {
    return vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.document?.uri?.toString()
      : "";
  }
  static isDafnyFile(document: vscode.TextDocument) {
    return document !== null && document.languageId === EnvironmentConfig.Dafny;
  }
}
