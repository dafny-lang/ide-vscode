"use strict";

import * as vscode from "vscode";
import { UnitTestCallback } from "../test/extension.test";
import { IVerificationResult } from "./IVerificationResult";
import { LocalQueue } from "./serverHelper/localQueue";

export class Context {
    public static unitTest: UnitTestCallback;
    public verificationResults: { [docPathName: string]: IVerificationResult } = {};
    public localQueue: LocalQueue = new LocalQueue();
    public decorators: { [docPathName: string]: vscode.TextEditorDecorationType } = {};
}
