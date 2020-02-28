//
// note: This example test is leveraging the Mocha test framework.
// please refer to their documentation on https://mochajs.org/ for help.
// tslint:disable:only-arrow-functions

// the module 'assert' provides assertion methods from node
import * as path from "path";
import * as vscode from "vscode";
import { Context } from "../src/context";

const extensionID = "correctnessLab.dafny-vscode";
const samplesFolder = vscode.extensions.getExtension(extensionID)!.extensionPath + "/test/sampleFolder/";

export class UnitTestCallback {
    // tslint:disable:no-empty
    public backendStarted = () => { };
    public verificationComplete = () => { };
    public ideIsIdle = () => { };
    public activated = () => { };
    public viperUpdateComplete = () => { };
    public viperUpdateFailed = () => { };
    // tslint:enable:no-empty
}

Context.unitTest = new UnitTestCallback();

function log(msg: string) {
    console.log("[UnitTest] " + msg);
}

function waitForBackendStarted(): Promise<boolean> {
    return new Promise((resolve) => {
        Context.unitTest.backendStarted = () => {
            log("Backend started");
            resolve(true);
        };
    });
}

function waitForVerification(fileName: string): Promise<boolean> {
    return new Promise((resolve) => {
        Context.unitTest.verificationComplete = (/*verificationResult: VerificationResult*/) => {
            log("Verification finished: " + fileName);
            resolve(true);
        };
    });
}

function openFile(fileName: string): Promise<vscode.TextDocument> {
    return new Promise((resolve) => {
        const filePath = path.join(samplesFolder, fileName);
        log("open " + filePath);
        vscode.workspace.openTextDocument(filePath).then((document) => {
            vscode.window.showTextDocument(document).then(() => {
                resolve(document);
            });
        });
    });
}

function StartViperIdeTests() {
    describe("ViperIDE Startup tests:", function () {

        it("Language Detection, and Backend Startup test.", function (done) {
            log("Language Detection, and Backend Startup test.");
            this.timeout(40000);

            openFile("simple.dfy").then((document: any) => {
                if (document.languageId !== "dafny") {
                    throw new Error("The language of dafny file was not detected correctly: should: dafny, is: " + document.languageId);
                }
                return waitForBackendStarted();
            }).then(() => {
                // backend ready
                done();
            });
        });

        it("Test simple verification", function (done) {
            log("Test simple verification");
            this.timeout(25000);

            waitForVerification(samplesFolder + "simple.dfy").then(() => {
                done();
            });
        });
    });
}

StartViperIdeTests();
