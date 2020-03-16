"use strict";

import * as vscode from "vscode";
import { IVerificationResult } from "./IVerificationResult";
import { LocalQueue } from "./serverHelper/localQueue";

export class Context {
    public verificationResults: { [docPathName: string]: IVerificationResult } = {};
    public localQueue: LocalQueue = new LocalQueue();
    public decorators: { [docPathName: string]: vscode.TextEditorDecorationType } = {};
}
