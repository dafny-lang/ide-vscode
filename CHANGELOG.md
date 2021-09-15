# Release Notes

## 2.0.0

- Revised the code base
- Setting a custom Dafny installation now disables automatic updates
- Now showing the Dafny installation progress in the terminal

## 1.8.0

- Group verification errors and their related locations by using the "Related Information" UI for diagnostics.
  
## 1.7.0

- Now showing parser and resolver errors in the status bar.

## 1.6.0

- Updated Dafny and language server to [v3.2.0](https://github.com/dafny-lang/dafny/releases/tag/v3.2.0)
- Updated keywords

## 1.5.0

- Made the terminal command prefix configurable.
- Added verification activity indicator to the status bar.
- Updated Dafny and language server to [v3.1.0](https://github.com/dafny-lang/dafny/releases/tag/v3.1.0)

## 1.4.0

- Updated the required .NET runtime to ASP.NET Core 5.0.
- Updated the language server to [v3.0.0](https://github.com/dafny-lang/language-server-csharp/releases/tag/v3.0.0).
- Added configuration for the automatic verification.

## 1.3.0

- Dropped the Preview notes

## 1.2.0

- Updated the language server to [v2.3.0](https://github.com/dafny-lang/language-server-csharp/releases/tag/v2.3.0) ([Dafny 3.0.0 PreRelease2](https://github.com/dafny-lang/dafny/releases/tag/v3.0.0-PreRelease2)).
- Removed the server starting/started notification messages.

## 1.1.1

- Fixed the compile command invocation for ubuntu and osx installations.

## 1.1.0

- Re-added the possibility to show counter examples.
- Re-added the compiler related commands.
- Updated the language server to [v2.2.0](https://github.com/dafny-lang/language-server-csharp/releases/tag/v2.2.0).

## 1.0.7

- Replaced the language server runtime with .NET Core.
- Added automatic installation of the language server for OSX and Linux.
- Updated the language server.

## 1.0.6

- Replaced the backing Dafny language server
- Added configuration options to specify the launch arguments of the language server

## 1.0.6

- Replaced the backing Dafny language server
- Added configuration options to specify the launch arguments of the language server

## 1.0.5

- Addes support for the Dafny language server version 1.2.3

## 1.0.4

- Code refactorings and README updated.

## 1.0.3

- The Dafny language server is automatically downloaded from the client.

## 1.0.2

- Clean up Release Information

## 1.0.1

- Test-Release for CI

## 1.0.0

- Use new Language Server integrated with Dafny

## 0.17.2

- Improve highlighting for current dafny version ([#56](https://github.com/DafnyVSCode/Dafny-VSCode/pull/56))
- Upgrade `https-proxy-agent` and `lodash` to fix security vulnerabilies

## 0.17.1

- Correct Dafny Github repository name ([#49](https://github.com/DafnyVSCode/Dafny-VSCode/issues/49))
- Change typescript target from es6 to es2017
- Upgrade `js-yaml` to 3.13.1 to fix security vunerability
- Upgrade Dafny in tests to 2.3.0

## 0.17.0

- Rename configuration option `monoPath` to `monoExecutable` ([#40](https://github.com/DafnyVSCode/Dafny-VSCode/pull/40))
- Update deprecated API calls ([#39](https://github.com/DafnyVSCode/Dafny-VSCode/pull/39))
- Remove deprecated Flow Graph Visualization
- Update minimal VSCode version to 1.25.1
- Update dependencies
- Extension code clean up

## 0.16.0

- Allow customizing the arguments passed to the verify backend ([#42](https://github.com/DafnyVSCode/Dafny-VSCode/pull/42)).
- Update insecure dependencies

## 0.15.0

- Change extension key from FunctionalCorrectness to correctnessLab.
- Fix tslint errors ([#38](https://github.com/DafnyVSCode/Dafny-VSCode/pull/38)).

## 0.14.3

- Rebranding and small readme fixes.

## 0.14.2

- Add workaround for dafny counterExample bug ([#23](https://github.com/DafnyVSCode/Dafny-VSCode/issues/23)).

## 0.14.1

- Clearify mono installation message on macOS.
- Fix incomplete copyright notice and improve contributors section in readme ([#37](https://github.com/DafnyVSCode/Dafny-VSCode/issues/37)).

## 0.14.0

- Fix installation of Dafny on some constellations on Windows ([#7](https://github.com/DafnyVSCode/Dafny-VSCode/issues/7)).
- Check for a recent mono version on launch.

## 0.13.0

- Fixed the CodeLens references counter (Thanks [@GoryMoon](https://github.com/GoryMoon)!)
- Dependencies were upgraded to prevent several vulnerabilities.

## 0.12.0

- The Dafny base path can now alternatively be set via the environment variable DAFNY_PATH.
- Dependencies were upgraded to prevent several vulnerabilities.

## 0.11.1

Use Dafny releases from Microsoft/dafny. Miscellaneous bug fixes.

## 0.10.10

BugFix: Decrease guard

## 0.10.9

BugFix: Rename method

## 0.10.8

Warning if no workspace is used
Changelog

## 0.10.7

BugFix Ubuntu

## 0.10.2

Added Context Menu Commands

## 0.10.1

Manually show counterexample, flow graph

## 0.10.0

Display counter example for failing proof. Switched to typescript implementation to download dependencies. Lots of bugfixes

## 0.9.0

Switched to Language Server. IntelliSense for classes, compile and execute Dafny program in VSCode. QuickFix for decrease, increase and object may be null.

## 0.8.0

CodeLens showing method references, Go to Definition, version checking for newer Dafny release.

## 0.6.0

DafnyDef allows to get SymbolInformation from DafnyServer, which will allow in the future to implement Refactorings. Go to Definition is already implemented.

## 0.5.5

Fallback to wget, if curl is not found.

## 0.5.4

Automatic validation as you type.

## 0.5.1

Smaller bugfixes.

## 0.5.0

Automatic download and installation task on osx and ubuntu `dafny.installDafny`. Also added uninstaller `dafny.uninstallDafny`.

## 0.4.4

Uninstall task of dafny on windows.

## 0.4.0

Automatic download and installation task on windows.

## 0.2.0

Full refactoring of the plugin. issues/3 from ferry~ fixed.

## 0.1.2

Refactored/tweaked UI code, Added `dafny.restartDafnyServer` ("Restart Dafny Server") command.

## 0.1.0

Added syntax highlighting, tested on Ubuntu and OSX.

## 0.0.3

Getting `mono` from PATH when `monoPath` isn't set.

## 0.0.2

Fixed readme and license, added use animation.

## 0.0.1

Initial release, some half baked features turned off.
