"use strict";

import * as vscode from "vscode";
import { IVerificationResult } from "./typeInterfaces/IVerificationResult";
import { LocalQueue } from "./types/localQueue";

export class Context {
    public verificationResults: { [docPathName: string]: IVerificationResult } = {};
    public localQueue: LocalQueue = new LocalQueue();
    public decorators: { [docPathName: string]: vscode.TextEditorDecorationType } = {};
}
