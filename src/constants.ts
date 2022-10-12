export namespace LanguageConstants {
  export const Id = 'dafny';
}

export namespace ExtensionConstants {
  export const ChannelName = 'Dafny VSCode';
}

export namespace ConfigurationConstants {
  export const SectionName = 'dafny';

  export const PreferredVersion = 'preferredVersion';

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
    export const DisplayGutterStatus = 'displayGutterStatus';
    export const DisplayVerificationAsTests = 'displayVerificationAsTests';
  }

  export namespace Compiler {
    export const RuntimePath = 'compilerRuntimePath';
    export const OutputDir = 'compilerOutputDir';
    export const Arguments = 'compilerArgs';
    export const CommandPrefix = 'terminalCommandPrefix';
  }

  export namespace Counterexamples {
    export const Color = 'colorCounterexamples';
  }
}

export namespace DotnetConstants {
  export const ExecutableName = 'dotnet';
  export const SupportedRuntimesPattern = /Microsoft\.AspNetCore\.App\s*[56]\.0/i;
}

export namespace LanguageServerConstants {
  export const LatestStable = 'latest';
  export const LatestNightly = 'latest nightly';
  export const LatestVersion = '3.9.0';
  export const UnknownVersion = 'unknown';
  export const DafnyGitUrl = 'https://github.com/dafny-lang/dafny.git';
  export const DownloadBaseUri = 'https://github.com/dafny-lang/dafny/releases/download';
  export const Z3VersionForCustomInstallation = '4.8.5';

  export function GetResourceFolder(version: string): string[] {
    return [ 'out', 'resources', version ];
  }

  export function GetDefaultPath(version: string): string {
    return `out/resources/${version}/dafny/DafnyLanguageServer.dll`;
  }

  export function GetDefaultCompilerPath(version: string): string {
    return `out/resources/${version}/dafny/Dafny.dll`;
  }
}
