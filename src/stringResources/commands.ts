export class CommandStrings {
  public static RestartServer: string = "dafny.restartDafnyServer";
  public static Compile: string = "dafny.compile";
  public static CompileCustomArgs: string = "dafny.compileCustomArgs";
  public static CompileAndRun: string = "dafny.compileAndRun";
  public static ShowCounterExample: string = "dafny.showCounterExample";
  public static HideCounterExample: string = "dafny.hideCounterExample";
  public static ShowReferences: string = "dafny.showReferences";
}

export class VSCodeCommandStrings {
  public static Open: string = "vscode.open";
  public static ConfigSettings: string =
    "workbench.action.configureLanguageBasedSettings";
  public static ShowReferences: string = "editor.action.showReferences";
}

export class Config {
  public static DotnetExecutablePath: string = "dotnetExecutablePath";
  public static LanguageServerRuntimePath: string = "languageServerRuntimePath";
  public static LanguageServerLaunchArgs: string = "languageServerLaunchArgs";
  public static ColorCounterExamples: string = "colorCounterExamples";
  public static CompilationArguments: string = "compilationArgs";
  public static CompilerExePath: string = "compilerExePath"
}

export class EnvironmentConfig {
  public static Dafny: string = "dafny";
  public static DafnyFileExtension: string = "**/*.dfy";
  public static DafnySuffix: string = ".dfy";
  public static ExeSuffix: string = ".exe";
  public static DocumentSelector: string = "file";
  public static DafnyLanguageServerID: string = "dafny-vscode";
  public static DafnyLanguageServerName: string = "Dafny Language Server";

  public static Dotnet: string = "dotnet";
  public static DotnetListRuntimes: string = "--list-runtimes";
  public static DotnetSupportedRuntimePattern: RegExp = /Microsoft\.AspNetCore\.App\s*3\.1/i;
}
