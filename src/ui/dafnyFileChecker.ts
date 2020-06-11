"use strict";
import { window, TextDocument } from "../ideApi/_IdeApi";
import { EnvironmentConfig } from "../stringResources/_StringResourcesModule";

/**
 * This is a helper class for UI components.
 * Functions often used like "isDafnyFile"
 * and "getActiveFileName" are centralized in this class
 * as static functions.
 */
export class DafnyFileChecker {
  static getActiveFileName(): string {
    return window.activeTextEditor
      ? window.activeTextEditor.document?.uri?.toString()
      : "";
  }
  static isDafnyFile(document: TextDocument): boolean {
    return document !== null && document.languageId === EnvironmentConfig.Dafny;
  }
}
