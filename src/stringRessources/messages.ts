// tslint:disable:max-classes-per-file

export class Warning {
    public static NoWorkspace: string = "Please use a workspace (File - Open Folder). Otherwise some features aren't working properly";   //Note: Diese Nachricht geht mir übel auf den SAck, können wir die nicht löschen?
    public static ReferencesInCounterExample: string = "Object references can not be shown in counter examples."
    public static NoCounterExamples: string = "No counter examples could be found."
}

export class Error {
    public static NoSupportedMono: string = "Could not find compatible Mono. Dafny requires Mono >= 4.0. ";
    public static RestartCodeAfterMonoInstall: string = "Please restart Code after the Mono installation.";
    public static RestartMacAfterMonoInstall: string = "Please restart your Mac after the Mono installation.";
    public static GetMono: string = "Get Mono";
    public static GetMonoUri: string = "https://www.mono-project.com/download/stable/";
    public static ConfigureMonoExecutable: string = "Change dafny.monoExecutable";
    public static NoMainMethod: string = "Can't start a program without a Main method";
    public static ServerExeNotDefined: string = "Server Executable not defined: please check your config for languageServerExePath";
    public static ServerExeNotFound: string = "Server Executable not found";
    public static CanNotCompile: string = "Can not compile"; 
    public static NoAdditionalArgsGiven: string = "No additionaly arguments given";
}

export class Information {
    public static CompilationStarted: string = "Compilation started";
    public static CompilationFinished: string = "Compilation finished";
    public static CompilationStartRunner: string = "Running program...";
    public static CompilationFailed: string = "Compilation failed";
    public static CustomCompileArgsPlaceHolder: string = "Insert arguments, separated by space. They will be added additionaly to your compilationArgs-config."; 
    public static CustomCompileArgsLabel: string = "Additional Dafny Compilation Arguments";
}

export class StatusbarStrings {
    public static Verified: string = "$(thumbsup) Verified";
    public static NotVerified: string = "$(thumbsdown) Not verified";
    public static Errors: string = "Errors";
    public static Pending: string = "$(issue-opened) Server answer pending";
    public static DafnyVersion: string ="Servers Dafny Version"; 
    public static CurrentDocument: string ="Current Document"; 
    public static NoDocumentSelected: string ="No document selected yet."; 
    public static Started: string = "Server started";
}