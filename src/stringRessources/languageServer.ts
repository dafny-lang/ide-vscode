// tslint:disable:max-classes-per-file

export class LanguageServerRequest {
    public static Compile: string = "compile";
    public static CounterExample: string = "counterExample";
}

export class LanguageServerNotification {
    public static Error: string = "ERROR";
    public static Warning: string = "WARNING";
    public static Info: string = "INFO";
    public static UpdateStatusbar: string = "updateStatusbar";
    public static ServerStarted: string = "serverStarted";
    public static ActiveVerifiyingDocument: string = "activeVerifiyingDocument";
    public static Verify: string = "verify";
    public static Ready: string = "ready";
    public static CounterExample: string = "counterExample";
}