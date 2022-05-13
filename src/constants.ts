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
  export const Latest = 'latest';
  export const LatestVersion = '3.5.0';
  export const UnknownVersion = 'unknown';
  export const DafnyGitUrl = 'https://github.com/dafny-lang/dafny.git';
  export const DownloadBaseUri = 'https://github.com/dafny-lang/dafny/releases/download';
  export const Z3VersionForCustomInstallation = '4.8.5';
  export function GetZ3FileNameOSX(): string {
    const z3v = LanguageServerConstants.Z3VersionForCustomInstallation;
    return `z3-${z3v}-x64-osx-10.14.2`;
  }
  export function GetZ3DownloadUrlOSX(): string {
    const z3v = LanguageServerConstants.Z3VersionForCustomInstallation;
    const z3filenameOsx = GetZ3FileNameOSX();
    return `https://github.com/Z3Prover/z3/releases/download/Z3-${z3v}/${z3filenameOsx}.zip`;
  }

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
