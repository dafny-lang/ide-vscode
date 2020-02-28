//
// note: This example test is leveraging the Mocha test framework.
// please refer to their documentation on https://mochajs.org/ for help.
//

// the module 'assert' provides assertion methods from node
import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { Context } from "../src/context";
import { IVerificationResult } from "../src/IVerificationResult";

const extensionID = "correctnessLab.dafny-vscode";
const samplesFolder = vscode.extensions.getExtension(extensionID)!.extensionPath + "/test/sampleFolder/";

export class UnitTestCallback {
    // tslint:disable-next-line:no-empty
    public backendStarted = () => { };
    public verificationComplete = (verificationResult: IVerificationResult) => {
        log("Status:" + verificationResult.verificationStatus.toString());
    }
    // tslint:disable-next-line:no-empty
    public activated = () => { };
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

async function waitForVerification(fileName: string, expectedResult: any): Promise<void> {
    const verificationResult = await new Promise((resolve) => {
        Context.unitTest.verificationComplete = (innerVerificationResult) => resolve(innerVerificationResult);
    });
    log(`Verification finished: ${fileName}`);
    log(JSON.stringify(verificationResult));
    assert.deepEqual(verificationResult, expectedResult);
}

async function waitForCounterExample(fileName: string, isCounterModelEmpty: boolean): Promise<void> {
    const counterModel: any = await new Promise((resolve) => {
        Context.unitTest.verificationComplete = (verificationResult1: IVerificationResult) => {
            log("CounterExample finished: " + fileName);
            log(JSON.stringify(verificationResult1.counterModel));
            resolve(verificationResult1.counterModel);
        };
    });
    if (isCounterModelEmpty) {
        assert.equal(counterModel.States.length, 0, "Model is notempty");
    } else {
        assert.notEqual(counterModel.States.length, 0, "Model is empty");
    }
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

function closeActiveEditor(): Promise<unknown> {
    return executeCommand("workbench.action.closeActiveEditor");
}

function executeCommand(command: string, args?: any) {
    return new Promise((resolve, reject) => vscode.commands.executeCommand(command, args).then(resolve, reject));
}

suite("DafnyServer Tests", () => {
    // tslint:disable-next-line:only-arrow-functions
    test("Verify simple.dfy", async function () {
        log("Language Detection, and Backend Startup test.");
        this.timeout(40000);

        const document = await openFile("simple.dfy");
        if (document.languageId !== "dafny") {
            throw new Error("The language of dafny file was not detected correctly: should: dafny, is: " + document.languageId);
        }
        return waitForBackendStarted();
    });

    // tslint:disable-next-line:only-arrow-functions
    test("Verify simple_invalid_assert.dfy", async function () {
        log("Test simple verification");
        this.timeout(15000);
        await waitForVerification(samplesFolder + "simple.dfy", { crashed: false, errorCount: 0, proofObligations: 2 });
        await closeActiveEditor();
    });

    // tslint:disable-next-line:only-arrow-functions
    test("Verify countermodel", async function () {
        this.timeout(60000);

        const verification = waitForVerification(samplesFolder + "abs_failing.dfy", { crashed: false, errorCount: 1, proofObligations: 1 });
        await openFile("abs_failing.dfy");
        await verification;
        await new Promise((resolve) => setTimeout(resolve, 5000)); // wait until everything is loaded
        await executeCommand("dafny.showCounterExample");
        await waitForCounterExample("abs_failing.dfy", false);
        await closeActiveEditor();
    });

    // tslint:disable-next-line:only-arrow-functions
    test("Verify countermodel empty", async function () {
        this.timeout(60000);

        const verification = waitForVerification(samplesFolder + "simple2.dfy", { crashed: false, errorCount: 0, proofObligations: 2 });
        await openFile("simple2.dfy");
        await verification;
        await new Promise((resolve) => setTimeout(resolve, 5000)); // wait until everything is loaded
        await executeCommand("dafny.showCounterExample");
        await waitForCounterExample("simple2.dfy", true);
        await closeActiveEditor();
    });
});
