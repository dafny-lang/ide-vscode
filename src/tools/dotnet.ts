import * as which from "which";
import { workspace, WorkspaceConfiguration } from "../ideApi/_IdeApi";
import {
  Config,
  EnvironmentConfig,
} from "../stringResources/_StringResourcesModule";

export function getDotnetExecutablePath(): string {
  const config: WorkspaceConfiguration = workspace.getConfiguration(
    EnvironmentConfig.Dafny
  );
  let dotnetExecutablePath: string | undefined = config.get<string>(
    Config.DotnetExecutablePath
  );
  // TODO Somehow and empty string is returned if this setting is not configured?
  if (
    dotnetExecutablePath !== undefined &&
    dotnetExecutablePath.trim().length > 0
  ) {
    return dotnetExecutablePath;
  }
  const resolvedDotnetPath = which.sync("dotnet", { nothrow: true });
  console.log("Resolved dotnet at: " + resolvedDotnetPath);
  return resolvedDotnetPath || "dotnet";
}
