# Dafny for Visual Studio Code

This extension adds _Dafny 3.0.0_ support to Visual Studio Code. If you require _Dafny 2_ support, consider using the [legacy extension](https://marketplace.visualstudio.com/items?itemName=correctnessLab.dafny-vscode).
This VSCode plugin requires the [Dafny language server](https://github.com/dafny-lang/language-server-csharp). The plugin will install it automatically upon first use.

## Features

- Compatible to **Dafny 3.0.0 PreRelease2**.
- **Compile and Run** `.dfy` files.
- **Verification** as one types.
- **Syntax highlighting** thanks to [sublime-dafny](https://github.com/erggo/sublime-dafny). See file `LICENSE_sublime-dafny.rst` for license.
- Display **CounterExample** for failing proof.
- **IntelliSense** to suggest symbols.
- **GoToDefinition** to quickly navigate.
- **Hover Information** for symbols.

You can find [examples below](#examples).

## Shortcuts

| Shortcut                  | Description                                                                             |
| :------------------------ | :-------------------------------------------------------------------------------------- |
| `Ctrl+Shift+B` or `⇧+⌘+B` | Compile to `.dll` or, if there is a `Main` method, to `.exe` file                       |
| `F2`                      | Rename a symbol                                                                         |
| `F5`                      | Compile and run, if the source file has a `Main` method                                 |
| `F6`                      | Compile with custom arguments                                                           |
| `F7`                      | Show _CounterExample_                                                                   |
| `F8`                      | Hide _CounterExample_                                                                   |
| `F9`                      | Restarts the _Dafny Language Server_, also installs the latest language server version. |

## Requirements

The plugin requires at least .NET Core 3.1 (the ASP.NET Core 3.1 runtime to be more specific) to run the _Dafny Language Server_. Please download a distribution from [Microsoft](https://dotnet.microsoft.com/download).
When you first open a _Dafny_ file, the extension will prompt you to install .NET Core manually. The language server gets installed automatically.

## Extension Settings

| Setting                           | Description                                                                                                                                                                                        | Default                                                        |
| :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| `dafny.languageServerRuntimePath` | Absolute or relative path to the _Dafny_ language server runtime (`DafnyLS.dll`).                                                                                                                  | `../../dafnyLanguageServer/DafnyLS.dll`                        |
| `dafny.languageServerLaunchArgs`  | Optional array of strings as _Dafny_ language server arguments.                                                                                                                                    | `[ ]`                                                          |
| `dafny.compilerRuntimePath`       | Absolute or relative path to the _Dafny_ compiler (`Dafny.dll`).                                                                                                                                   | `../../dafnyLanguageServer/Dafny.dll`                          |
| `dafny.compilerArgs`              | Optional array of strings as _Dafny_ compilation arguments.                                                                                                                                        | `[ "/verifyAllModules", "/compile:1", "/spillTargetCode:1" ]`  |
| `dafny.compilerOutputDir`         | Absolute or relative path to the compilation output directory.                                                                                                                                     | `bin`                                                          |
| `dafny.dotnetExecutablePath`      | Absolute path to the dotnet executable. Only necessary if dotnet is not in system PATH (you'll get an error if that's the case).                                                                   |                                                                |
| `dafny.colorCounterExamples`      | Customize the color (HEX) of Counter Examples. There are two default colors: for dark theme (#0d47a1, #e3f2fd) and light theme (#bbdefb, #102027). This color setting will override both defaults. | `{ "backgroundColor": null, "fontColor": null }`               |

Please note that in this new plugin version "automatic verification" is always on and a language server side feature.

## Examples

Here are a few impressions of the features.

### Installation

On the first start, the plugin will install the _Dafny_ language server automatically.

![Installation](readmeResources/Installation.png)

### Error Highlighting

![Syntax](readmeResources/Syntax.png)

Whenever a syntax, semantic, or verification error is present, the plugin will inform the user.

### Compile and Run

Press `F5` to compile and run the program.

![Compile](readmeResources/Compile.png)

### Show Counter Example

Press `F7` to show counterexamples.

![Counter](readmeResources/Counter.png)

### Hover Information

Hover a symbol to get information about that symbol.

![Hover](readmeResources/Hover.png)

### IntelliSense

Type a dot to get a list of possible members of the accessed symbol.

![IntelliSense](readmeResources/IntelliSense.png)

## Contribute

Dafny for Visual Studio Code is an MIT licensed open-source project that lives from code contributions.

We welcome your help! For a description of how you can contribute, as well as a list of issues you can work on, please visit the [Dafny-VSCode GitHub repository](https://github.com/DafnyVSCode/ide-vscode).
