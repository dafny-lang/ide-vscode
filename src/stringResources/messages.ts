export class Warning {
  public static NoWorkspace: string =
    "Please use a workspace (File - Open Folder). Otherwise some features may not work properly";
  public static ReferencesInCounterExample: string =
    "Object references can not be shown in counter examples.";
  public static NoCounterExamples: string =
    "No counter examples could be found.";
}

export class Error {
  public static NoSupportedDotnet: string =
    "There is no compatible dotnet runtime installed. Dafny requires the ASP.NET Core Runtime 3.1.";
  public static RestartCodeAfterDotnetInstall: string =
    "Please restart VSCode after the dotnet installation.";
  public static RestartMacAfterDotnetInstall: string =
    "Please restart your Mac after the dotnet installation.";
  public static GetDotnet: string = "Get dotnet";
  public static GetDotnetUri: string = "https://dotnet.microsoft.com/";
  public static ConfigureDotnetExecutable: string =
    "Change dafny.dotnetExecutablePath";
  public static NoMainMethod: string =
    "Cannot start a program without a Main method";
  public static ServerRuntimeNotDefined: string =
    "Server executable not defined: please check your config for dafny.languageServerRuntimePath";
  public static CompilerRuntimeNotDefined: string =
    "Compiler executable not defined: please check your config for dafny.compilerRuntimePath";
  public static DotnetExeNotFound: string = "dotnet executable not found";
  public static CanNotCompile: string = "Compilation failed";
  public static CanNotGetCounterExample: string =
    "CounterExample request failed";
  public static NoAdditionalArgsGiven: string =
    "No additionaly arguments given";
  public static DotnetVersionNotParsed: string =
    "Dotnet version could not be parsed from version output.";
  public static DotnetBinaryNotExecuted: string =
    "Dotnet binary could not be executed.";
  public static ServerStopped: string = "Server stopped.";
  public static CouldNotStartServer: string =
    "Could not start Danfy Language Server.";
  public static CouldNotInstallServer: string =
    "Could not install Danfy Language Server.";
}

export class Information {
  public static StartingServer: string = "Starting Dafny Language Server...";
  public static InstallingServer: string =
    "Installing latest Dafny Language Server...";
  public static UpdatingServer: string =
    "Updating Dafny Language Server to latest version...";

  public static CompilationStarted: string = "Compilation started";
  public static CompilationFinished: string = "Compilation finished";
  public static CompilationStartRunner: string = "Running program...";
  public static CompilationFailed: string = "Compilation failed";
  public static CustomCompileArgsLabel: string = "Dafny Compilation Arguments";
  public static Run: string = "Run";
  public static Arguments: string = "Args";
}

export class StatusbarStrings {
  public static Verified: string = "$(thumbsup) Verified";
  public static NotVerified: string = "$(thumbsdown) Not verified";
  public static Errors: string = "Errors";
  public static Pending: string = "$(issue-opened) Server answer pending";
  public static DafnyVersion: string = "Dafny Language Server Version";
  public static CurrentDocument: string = "Current Document";
  public static NoDocumentSelected: string = "No document selected yet.";
  public static Started: string = "Server started";
}
