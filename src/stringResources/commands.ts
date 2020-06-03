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
  public static MonoExecutablePath: string = "monoExecutablePath";
  public static UseMono: string = "useMono";
  public static LanguageServerExePath: string = "languageServerExePath";
  public static ColorCounterExamples: string = "colorCounterExamples";
  public static CompilationArguments: string = "compilationArgs";
}

export class EnvironmentConfig {
  public static Dafny: string = "dafny";
  public static DafnyFileExtension: string = "**/*.dfy";
  public static DafnySuffix: string = ".dfy";
  public static ExeSuffix: string = ".exe";
  public static DocumentSelector: string = "file";
  public static DafnyLanguageServerID: string = "dafny-vscode";
  public static DafnyLanguageServerName: string = "Dafny Language Server";

  public static Mono: string = "mono";
  public static MonoVersion: string = "--version";

  public static Win32: string = "win32";
  public static OSX: string = "darwin";
}
