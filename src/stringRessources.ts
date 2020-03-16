// tslint:disable:max-classes-per-file

export class Severity {
    public static Warning: string = "Warning";
    public static Error: string = "Error";

}
export class WarningMsg {
    public static MonoExecutableWrong: string = "dafny.monoExecutable set incorrectly; found mono in system PATH and will use it";
    public static NoWorkspace: string = "Please use a workspace (File - Open Folder). Otherwise some features aren't working properly";
}

export class ErrorMsg {
    public static NoMono: string = "Could not find mono, neither in system PATH nor at dafny.monoExecutable";
    public static NoSupportedMono: string = "Could not find compatible Mono. Dafny requires Mono >= 4.0. ";
    public static RestartCodeAfterMonoInstall: string = "Please restart Code after the Mono installation.";
    public static RestartMacAfterMonoInstall: string = "Please restart your Mac after the Mono installation.";
    public static GetMono: string = "Get Mono";
    public static GetMonoUri: string = "https://www.mono-project.com/download/stable/";
    public static ConfigureMonoExecutable: string = "Change dafny.monoExecutable";
    public static DafnyServerRestart: string = "DafnyServer process quit unexpectedly; attempting restart";
    public static DafnyServerRestartFailed: string = "DafnyServer restart failed";
    public static DafnyServerWrongPath: string = "Failed to start DafnyServer, check paths in config";
    public static ServerPathNotSet: string = "Dafny Verifier error: dafnyServerPath not set";
    public static DafnyInstallationFailed: string = "Automatic installation failed. Please install manually.";
    public static MaxRetriesReached: string = "Maximum retries to start the server reached. Please restart the server manually";
    public static DafnyCantBeStarted: string = "DafnyServer.exe can not be started. Either it is not installed or the basepath is wrong";
    public static NoMainMethod: string = "Can't start a program without a Main method";
}

export class Config {
    public static MonoPath: string = "monoPath"; // deprecated monoPath configuration option #40
    public static MonoExecutable: string = "monoExecutable";
    public static UseMono: string = "useMono";
    public static AutomaticVerification: string = "automaticVerification";
    public static AutomaticVerificationDelay: string = "automaticVerificationDelayMS";
    public static DafnyBasePath: string = "basePath";
    public static AutomaticShowCounterExample: string = "automaticShowCounterModel";
}

export class Application {
    public static DafnyServer: string = "DafnyServer.exe";
}

export class CommandStrings {
    public static RestartServer: string = "dafny.restartDafnyServer";
    public static InstallDafny: string = "dafny.installDafny";
    public static UninstallDafny: string = "dafny.uninstallDafny";
    public static EditText: string = "dafny.editText";
    public static ShowReferences: string = "dafny.showReferences";
    public static Compile: string = "dafny.compile";
    public static CompileAndRun: string = "dafny.compileAndRun";
    public static ShowCounterExample: string = "dafny.showCounterExample";
    public static HideCounterExample: string = "dafny.hideCounterExample";
}

export class InfoMsg {
    public static DafnyServerRestartSucceded: string = "DafnyServer restart succeeded";
    public static DafnyInstallationSucceeded: string = "Automatic installation complete";
    public static DafnyUninstallationSucceeded: string = "Uninstallation complete";
    public static DafnyUpdateAvailable: string = "Update of Dafny is available. Would you like to update it?";
    public static AskInstallDafny: string = "Would you like to install Dafny?";
    public static CompilationStarted: string = "Compilation started";
    public static CompilationFinished: string = "Compilation finished";
    public static CompilationStartRunner: string = "Running program...";
    public static CompilationFailed: string = "Compilation failed";
}
export class ServerStatus {
    public static Starting: string = "Starting";
}

export class Answer {
    public static Yes: string = "Yes";
    public static No: string = "No";
}

export class EnvironmentConfig {
    public static Dafny: string = "dafny";
    public static Mono: string = "mono";
    public static NewLine: string = "\n";
    public static Win32: string = "win32";
    public static OSX: string = "darwin";
    public static Ubuntu: string = "linux";
    public static DafnySuccess: string = "[SUCCESS]";
    public static DafnyFailure: string = "[FAILURE]";
}
export class StatusString {
    public static Crashed: string = "$(alert) Crashed";
    public static Verifying: string = "$(beaker) Verifying";
    public static Idle: string = "$(clock) Idle";
    public static Verified: string = "$(thumbsup) Verified";
    public static NotVerified: string = "$(thumbsdown) Not verified";
    public static TechnicalError: string = "$(x) Verification technical error";
    public static ServerUp: string = "$(up) Server up";
    public static ServerDown: string = "$(x) Server down";
    public static Queued: string = "$(watch) Queued";
    public static Pending: string = "$(issue-opened) Pending";
}

export class LanguageServerRequest {
    public static Reset: string = "reset";
    public static Compile: string = "compile";
    public static CounterExample: string = "counterExample";
    public static Install: string = "install";
    public static Uninstall: string = "uninstall";
}

export class LanguageServerNotification {
    public static Error: string = "ERROR";
    public static Warning: string = "WARNING";
    public static Info: string = "INFO";
    public static UpdateStatusbar: string = "updateStatusbar";
    public static ServerStarted: string = "serverStarted";
    public static ActiveVerifiyingDocument: string = "activeVerifiyingDocument";
    public static Verify: string = "verify";
    public static ChangeServerStatus: string = "changeServerStatus";
    public static Ready: string = "ready";
    public static Progress: string = "progress";
    public static CounterExample: string = "counterExample";
}
