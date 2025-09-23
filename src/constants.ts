export namespace LanguageConstants {
  export const Id = 'dafny';
}

export namespace ExtensionConstants {
  export const ChannelName = 'Dafny VSCode';
}

export namespace ConfigurationConstants {
  export const SectionName = 'dafny';

  export const Version = 'version';

  export namespace Dotnet {
    export const ExecutablePath = 'dotnetExecutablePath';
  }

  export namespace LanguageServer {
    export const CliPath = 'cliPath';
    export const LaunchArgs = 'dafnyServerArguments';
    export const AutomaticVerification = 'automaticVerification';
    export const VerificationTimeLimit = 'verificationTimeLimit';
    export const VerificationVirtualCores = 'verificationVirtualCores';
    export const VerificationCachingPolicy = 'verificationCachingPolicy';
    export const MarkGhostStatements = 'markGhostStatements';
    export const DafnyPlugins = 'dafnyPlugins';
    export const DisplayGutterStatus = 'displayGutterStatus';
    export const DisplayVerificationAsTests = 'displayVerificationAsTests';
  }

  export namespace Compiler {
    export const OutputDir = 'compilerOutputDir';
    export const Arguments = 'dafnyRunArguments';
    export const CommandPrefix = 'terminalCommandPrefix';
  }

  export namespace VerificationTrace {
    export const Color = 'colorVerificationTrace';
  }
}

export namespace DotnetConstants {
  export const ExecutableName = 'dotnet';
  export const SupportedRuntimesPattern = /Microsoft\.NETCore\.App\s*((\d+)\.\d+\.\d+)/ig;
  export const SupportedRuntimesMinVersion = 5;
}

export namespace LanguageServerConstants {
  export const LatestStable = 'latest stable release';
  export const LatestNightly = 'latest nightly';
  export const Custom = 'custom';
  export const LatestVersion = '4.11.0';
  export const UnknownVersion = 'unknown';
  export const DafnyGitUrl = 'https://github.com/dafny-lang/dafny.git';
  export const DownloadBaseUri = 'https://github.com/dafny-lang/dafny/releases/download';
  export const Z3VersionForCustomInstallation = '4.8.5';

  export function GetResourceFolder(version: string): string[] {
    return [ 'out', 'resources', version ];
  }
}
