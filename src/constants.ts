export namespace LanguageConstants {
  export const Id = 'dafny';
}

export namespace ExtensionConstants {
  export const ChannelName = 'Dafny VSCode';
}

export namespace ConfigurationConstants {
  export const SectionName = 'dafny';

  export namespace Dotnet {
    export const ExecutablePath = 'dotnetExecutablePath';
  }

  export namespace LanguageServer {
    export const RuntimePath = 'languageServerRuntimePath';
    export const LaunchArgs = 'languageServerLaunchArgs';
    export const AutomaticVerification = 'automaticVerification';
    export const VerificationTimeLimit = 'verificationTimeLimit';
    export const VerificationVirtualCores = 'verificationVirtualCores';
    export const VerificationCachingPolicy = 'verificationCachingPolicy';
    export const MarkGhostStatements = 'markGhostStatements';
    export const DafnyPlugins = 'dafnyPlugins';
  }

  export namespace Compiler {
    export const RuntimePath = 'compilerRuntimePath';
    export const OutputDir = 'compilerOutputDir';
    export const Arguments = 'compilerArgs';
    export const CommandPrefix = 'terminalCommandPrefix';
  }

  export namespace CounterExamples {
    export const Color = 'colorCounterExamples';
  }
}

export namespace DotnetConstants {
  export const ExecutableName = 'dotnet';
  export const SupportedRuntimesPattern = /Microsoft\.AspNetCore\.App\s*[56]\.0/i;
}

export namespace LanguageServerConstants {
  export const ResourceFolder = [ 'out', 'resources' ];
  export const RequiredVersion = '3.3.0';
  export const UnknownVersion = 'unknown';
  export const DownloadBaseUri = 'https://github.com/dafny-lang/dafny/releases/download';
  export const DefaultPath = 'out/resources/dafny/DafnyLanguageServer.dll';
  export const DefaultCompilerPath = 'out/resources/dafny/Dafny.dll';
}
