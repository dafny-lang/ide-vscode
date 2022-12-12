import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import { ExtensionContext, window } from 'vscode';

const existsAsync = promisify(fs.exists);
import * as path from 'path';
import { ConfigurationConstants } from '../constants';
import Configuration from '../configuration';

const mkdirAsync = promisify(fs.mkdir);

// We cache the cli path so that we don't need to copy it every time.
let cliPath: string | undefined | null = null;

export async function getCliPath(context: ExtensionContext): Promise<string | null> {
  if(cliPath != null) {
    return cliPath;
  }
  cliPath = await getCliPathUncached(context);
  return cliPath!;
}

async function getCliPathUncached(context: ExtensionContext): Promise<string> {
  let cliPathOverride = process.env['DAFNY_SERVER_OVERRIDE'] ?? '';
  if(cliPathOverride) {
    try {
      cliPathOverride = await copyNecessaryDllsToTempFolder(cliPathOverride);
    } catch(e: unknown) {
      // Ignore if copying fails. We'll run the original.
    }
    window.showInformationMessage(`Using $DAFNY_SERVER_OVERRIDE = ${cliPathOverride} for the CLI path`);
  }
  let cliPath = Configuration.get<string | null>(ConfigurationConstants.LanguageServer.CliPath) ?? '';
  if(!path.isAbsolute(cliPath)) {
    cliPath = path.join(context.extensionPath, cliPath);
  }
  return cliPathOverride || cliPath;
}

// We copy Dafny.dll and all its dependenciesto another location
// so that rebuilding Dafny will not fail because it's open in VSCode
async function copyNecessaryDllsToTempFolder(configuredPath: string): Promise<string> {
  const dlsName = 'Dafny';
  const dll = '.dll';
  const runtimeconfigjson = '.runtimeconfig.json';
  const depsjson = '.deps.json';
  const dls = dlsName + dll;
  if(!configuredPath.endsWith(dls)) {
    return configuredPath;
  }
  const installationDir = path.dirname(configuredPath);
  const vscodeDir = path.join(os.tmpdir(), await fs.promises.mkdtemp('vscode-dafny-dlls-'));
  console.log(`Copying all necessary dlls to ${vscodeDir}...`);
  const cleanup = function() {
    fs.rmdirSync(vscodeDir, { recursive: true });
  };
  await ensureDirExists(vscodeDir);
  process.on('exit', cleanup);
  const files = await fs.promises.readdir(installationDir);
  for(const file of files) {
    // eslint-disable-next-line max-depth
    if(!(file.endsWith(dll)
      || file.endsWith(runtimeconfigjson)
      || file.endsWith(depsjson)
      || file.endsWith('.pdb')
      || file === 'z3'
      || file === 'DafnyPrelude.bpl'
      || file === 'runtimes')) {
      continue;
    }
    // eslint-disable-next-line max-depth
    const srcFile = path.join(installationDir, file);
    const targetFile = path.join(vscodeDir, file);
    if((await fs.promises.stat(srcFile)).isDirectory()) {
      await copyDir(srcFile, targetFile);
    } else {
      await copyFile(srcFile, targetFile);
    }
  }

  const newPath = path.join(vscodeDir, dls);
  return newPath;
}

async function ensureDirExists(
  dirName: string) {
  const existed = await existsAsync(dirName);
  if(!existed) {
    await mkdirAsync(dirName);
  }
}

async function copyFile(srcPath: string, targetFile: string) {
  await fs.promises.copyFile(srcPath, targetFile);
}

async function copyDir(src: string, dest: string) {
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  await ensureDirExists(dest);
  for(const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if(entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}