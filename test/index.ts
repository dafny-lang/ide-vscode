//
// pLEASE DO NOT MODIFY / DELETE UNLESS YOU KNOW WHAT YOU ARE DOING
//
// this file is providing the test runner to use when running extension tests.
// by default the test runner in use is Mocha based.
//
// you can provide your own test runner if you want to override it by exporting
// a function run(testRoot: string, clb: (error:Error) => void) that the extension
// host can call to run the tests. The test runner is expected to use console.log
// to report the results back to the caller. When the tests are finished, return
// a possible error to the callback or null if none.

import * as testRunner from "vscode/lib/testrunner";

// <ou can directly control Mocha options by uncommenting the following lines
// see https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info
testRunner.configure({
    ui: "tdd", 		// the TDD UI is being used in extension.test.ts (suite, test, etc.)
    useColors: true, // colored output from test results
});

module.exports = testRunner;
