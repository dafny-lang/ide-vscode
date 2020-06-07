"use strict";
import { ide } from "../ideApi/_IdeApi";
import { EnvironmentConfig } from "../stringResources/_StringResourcesModule";

/**
 * This is a helper class for UI components.
 * Repeated used function like "isDafnyFile"
 * and "getActiveFileName" are centralized in this class
 * as static functions.
 */
export class DafnyFileChecker {
  static getActiveFileName(): string {
    return ide.window.activeTextEditor
      ? ide.window.activeTextEditor.document?.uri?.toString()
      : "";
  }
  static isDafnyFile(document: ide.TextDocument): boolean {
    return document !== null && document.languageId === EnvironmentConfig.Dafny;
  }
}
