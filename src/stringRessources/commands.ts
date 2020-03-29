// tslint:disable:max-classes-per-file

export class CommandStrings {
    public static RestartServer: string = "dafny.restartDafnyServer";
    public static EditText: string = "dafny.editText"; // 2do needed?? 
    public static ShowReferences: string = "dafny.showReferences";
    public static Compile: string = "dafny.compile";
    public static CompileCustomArgs: string = "dafny.compileCustomArgs";
    public static CompileAndRun: string = "dafny.compileAndRun";
    public static ShowCounterExample: string = "dafny.showCounterExample";
    public static HideCounterExample: string = "dafny.hideCounterExample";
}

export class Config {
    public static MonoPath: string = "monoPath"; // deprecated monoPath configuration option #40
    public static MonoExecutable: string = "monoExecutable";
    public static UseMono: string = "useMono";
    public static AutomaticShowCounterExample: string = "automaticShowCounterModel";
}

export class EnvironmentConfig {
    public static Dafny: string = "dafny";
    public static Mono: string = "mono"; // 2do could be used 
    public static NewLine: string = "\n"; // 2do could be used 
    public static Win32: string = "win32";
    public static OSX: string = "darwin";
    public static Ubuntu: string = "linux"; // 2do could be used 
}