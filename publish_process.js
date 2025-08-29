#!/usr/bin/env node

/**
Perform the next step to publish the extension.
 i. Verifies that it's on the master branch. If not so, terminate. Otherwise, pulls the latest master version.
ii. If the last message on master indicates Version X.Y.Z and it does not have a tag.
    it means that steps iii. to vii. were executed correctly.
    Ask whether it's ready to publish (ENTER or y)
    - if so, create and publish the tag
    - Otherwise, cancel.

iii. Fetches all tags, and verify that there is no version tag.
 iv. Asks to bump the patch version (ENTER or p), the minor version (m) or the major version (M)
  v. Populates the CHANGELOG.md with the most recent commit messages.
 vi. If a newest version of Dafny is found, ask whether to refer to it as the latest (ENTER or y), or no (n)
vii. Follows the steps of CONTRIBUTING.
     Ask to revise the CHANGELOG.md as needed
     (n or anything else) : Abruptly stop.
     (ENTER or y) : Creates a branch named "version-X.Y.Z"
                    Commits the files to this branch with message "Version X.Y.Z"
                    Push the branch.
     Indicate that the PR should be merge without changing the commit message.
     Indicate that the script just needs to be relaunched once the PR is approved and merged.
*/

const fs = require("fs");
const { promisify, getSystemErrorMap } = require('util');
const exec = require('child_process').exec;
const execAsync = promisify(exec);
const readline = require('readline');
const fetch = require('cross-fetch');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const question = function(input) {
  return new Promise((resolve, reject) => {
    rl.question(input, resolve);
  });
}
const changeLogFile = "CHANGELOG.md";
const dafnyReleasesURL = 'https://api.github.com/repos/dafny-lang/dafny/releases';
const constantsFile = "src/constants.ts";
const packageFile = "package.json";
const packageLockFile = "package-lock.json";
const ABORTED = "ABORTED";
const ACCEPT_HINT = "(ENTER)";

function ok(answer) {
  return answer.toLowerCase() == "y" || answer == "";
}

async function getCurrentBranch() {
  return (await execAsync("git branch --show-current")).stdout.trim();
}

// Ensures that the working directory is clean
async function ensureWorkingDirectoryClean() {
  var unstagedChanges = (await execAsync("git diff")).stdout.trim() + (await execAsync("git diff --cached")).stdout.trim();
  if(unstagedChanges != "") {
    console.log("Please commit your changes before launching this script.");
    //throw ABORTED;
  }
}

async function ensureMaster() {
  await ensureWorkingDirectoryClean();
  var currentBranch = await getCurrentBranch();
  if(currentBranch != "master") {
    console.log(`You need to be on the 'master' branch to release a new version.`);
    if(!ok(await question(`Switch from '${currentBranch}' to 'master'? ${ACCEPT_HINT}`))) {
      console.log("Publishing script aborted.");
      throw ABORTED;
    }
    console.log("switched to master branch");
    console.log((await execAsync("git checkout master")).stdout);
    currentBranch = await getCurrentBranch();
    if(currentBranch != "master") {
      console.log("Failed to checkout master");
      throw ABORTED;
    }
  }
  await execAsync("git pull");
  console.log("Latest master checked out")
}

async function getCurrentTag() {
  var tagList = (await execAsync("git show-ref --tags")).stdout.trim();
  // recovers the last commit hash
  var lastCommitHash = (await execAsync("git log -1 --pretty=%H")).stdout.trim();
  // checks if the last commit hash is in the tag list:
  var tagListRegex = new RegExp(`^${lastCommitHash}\\s*refs/tags/(v\\d+\\.\\d+\\.\\d+)`, 'm');
  var match = tagListRegex.exec(tagList);
  if(match == null) {
    return null;
  }
  return match[1];
}

async function changeLogAndVersion() {
  let changeLog = await fs.promises.readFile(changeLogFile, "utf8");
  const currentDocumentVersionRegex = /^#\s*Release Notes\s*##\s*(\d+.\d+.\d+)/;
  const match = currentDocumentVersionRegex.exec(changeLog);
  if(match == null) {
    console.log(`Could not find ${currentDocumentVersionRegex} in ${changeLogFile}`);
    throw ABORTED;
  }
  const currentChangeLogVersion = match[1];
  const updateChangeLogWith = ((changeLog, oldVersion) => async function(newVersion, messages, mostRecentDafnyRelease = undefined) {
    const newChangeLog = changeLog.replace(currentDocumentVersionRegex, match => 
      `# Release Notes\n\n## ${newVersion}\n${messages}\n\n## ${oldVersion}`);
    await fs.promises.writeFile(changeLogFile, newChangeLog);
    return true;
  })(changeLog, currentChangeLogVersion);
  return {updateChangeLogWith, currentChangeLogVersion};
}

async function getMostRecentDafnyRelease() {
  let mostRecentDafnyRelease = null;
  const dafnyReleases = await (await fetch(dafnyReleasesURL)).json();
  for(var i = 0; i < dafnyReleases.length && mostRecentDafnyRelease == null; i++) {
    if(dafnyReleases[i].tag_name != "nightly") {
      mostRecentDafnyRelease = dafnyReleases[i].tag_name;
      break;
    }
  }
  if(mostRecentDafnyRelease == null) {
    console.log(`Could not fetch the latest Dafny release version from ${dafnyReleasesURL}`);
    throw ABORTED;
  }
  return mostRecentDafnyRelease;
}


async function readPackageJson() {
  const packageContent = await fs.promises.readFile(packageFile);
  const packageObj = JSON.parse(packageContent);
  return packageObj;
}

async function writePackage(packageObj) {
  await fs.promises.writeFile(packageFile, JSON.stringify(packageObj, null, 2));
}

// returns the new version number
async function nextVersion(currentVersion) {
  const currentVersionRegex = /(\d+)\.(\d+)\.(\d+)/;
  const match = currentVersionRegex.exec(currentVersion);
  if(match == null) {
    console.log(`Could not parse version ${currentVersion}`);
    throw ABORTED;
  }
  var bumpedPatch = `${match[1]}.${match[2]}.${parseInt(match[3]) + 1}`;
  var bumpedMinor = `${match[1]}.${parseInt(match[2]) + 1}.0`;
  var bumpedMajor = `${parseInt(match[1]) + 1}.0.0`;
  console.log("Should the next version be:");
  console.log(`${currentVersion} => ${bumpedPatch}? ${ACCEPT_HINT}`);
  console.log(`${currentVersion} => ${bumpedMinor}? (m)`);
  var answer = await question(`${currentVersion} => ${bumpedMajor}? (M)\n`);
  var finalVersion = bumpedPatch;
  if(ok(answer)) {
  } else if(answer == "m") {
    finalVersion = bumpedMinor;
  } else if(answer == "M") {
    finalVersion = bumpedMajor;
  } else {
    console.log("Publishing script aborted.");
    throw ABORTED;
  }
  console.log(`You chose version ${finalVersion}`);
  return finalVersion;
}

async function getLastPreparedTag() {
  const lastCommitMessage = (await execAsync("git log -1 --pretty=%B | head -n 1")).stdout.trim();
  const lastCommitMessageRegex = /(v\d+\.\d+\.\d+)/;
  const match = lastCommitMessageRegex.exec(lastCommitMessage);
  if(match == null) {
    return false;
  }
  return match[1];
}

function getCommandLine() {
  switch (process.platform) { 
     case 'darwin' : return 'open';
     case 'win32' : return 'start';
     case 'win64' : return 'start';
     default : return 'xdg-open';
  }
}

async function getAllRecentCommitMessagesFormatted(currentChangeLogVersion) {
  // Query git for all the commit messages from currentChangeLogVersion (excluded) to the latest commit (included)
  var raw = (await execAsync(`git log --pretty=%B v${currentChangeLogVersion}..HEAD`)).stdout.trim();
  raw = "- " + raw.trim().replace(/\n\s*/g, "\n- ");
  raw = raw.replace(/\(#(\d+)\)/g, "(https://github.com/dafny-lang/ide-vscode/pull/$1)");
  raw = raw.trim();
  raw = raw.replace(/\n.*$/, ""); // Removes the last one, because it's the last release commit.
  return raw.trim();
}

function close() {
  rl.close();
  return false;
}

async function isNewer(packageObj, mostRecentDafnyRelease) {
  var versionList = packageObj["contributes"]["configuration"]["properties"]["dafny.version"]["enum"];
  var previousDafnyVersion = versionList[1];
  return previousDafnyVersion != mostRecentDafnyRelease;
}

async function updatePackageJson(packageObj, newVersion, mostRecentDafnyRelease) {
  packageObj["version"] = newVersion;
  var versionList = packageObj["contributes"]["configuration"]["properties"]["dafny.version"]["enum"];
  // versionList starts with "latest", and then the last version
  var previousDafnyVersion = versionList[1];
  var updatedDafny = false;
  if (mostRecentDafnyRelease !== undefined) {
    var previousDafnyVersionListHead = versionList[1];
    // If the previous dafny version is just different from mostRecentDafnyRelease by the patch number, replace it, otherwise insert it using splice
    // We need to do pruning manually later, so that one could revert to a previous patch of Dafny immediately.
    //if (previousDafnyVersionListHead == mostRecentDafnyRelease.substring(0, mostRecentDafnyRelease.lastIndexOf("."))) {
    //  versionList[1] = mostRecentDafnyRelease;
    //} else {
      versionList.splice(1, 0, mostRecentDafnyRelease);
    //}

    console.log("Updated Dafny version to " + mostRecentDafnyRelease);
    var constantsContent = await fs.promises.readFile(constantsFile, { encoding: "utf8" });
    var constantsContentRegex = /const\s*LatestVersion\s*=\s*'\d+.\d+.\d+';/;
    constantsContent = constantsContent.replace(constantsContentRegex, `const LatestVersion = '${mostRecentDafnyRelease}';`);
    await fs.promises.writeFile(constantsFile, constantsContent, { encoding: "utf8" });
    updatedDafny = true;
  } else {
    console.log("The current Dafny version is still detected to be " + previousDafnyVersion);
  }
  await writePackage(packageObj);
  return updatedDafny;
}

async function UpdateChangeLog(currentChangeLogVersion, packageObj, updateChangeLogWith, newVersion, mostRecentDafnyRelease) {
  var allRecentCommitMessages = await getAllRecentCommitMessagesFormatted(currentChangeLogVersion);
  if (packageObj["version"] == currentChangeLogVersion) {
    if(mostRecentDafnyRelease !== undefined) {
      allRecentCommitMessages = "- Added Dafny " + mostRecentDafnyRelease + "\n" + allRecentCommitMessages;
    }
    await updateChangeLogWith(newVersion, allRecentCommitMessages, mostRecentDafnyRelease);
    console.log("I changed " + changeLogFile + " to reflect the new version.\nPlease make edits as needed and close the editing window.");
    await execAsync(getCommandLine() + ' ' + changeLogFile);
    if (!ok(await question(`Ready to continue? ${ACCEPT_HINT}`))) {
      console.log("Aborting.");
      throw ABORTED;
    }
    currentChangeLogVersionCheck = (await changeLogAndVersion()).currentChangeLogVersion;
    if (currentChangeLogVersionCheck != newVersion) {
      console.log(`The last version was supposed to be ${newVersion}, but the changelog was updated to ${currentChangeLogVersionCheck}. Aborting publishing.`);
      throw ABORTED;
    }
  } else {
    console.log("ChangeLog.md already up-to-date");
  }
}

async function HandleFinalPublishingProcess(currentChangeLogVersion, lastPreparedTag) {
  if ("v" + currentChangeLogVersion == lastPreparedTag) {
    // Tag the current commit
    console.log(`The changelog already mentions version ${currentChangeLogVersion}.\nYou now need to create the tag ${lastPreparedTag} and publish it to release this new version.`);
    // ask for confirmation, and publish the tag.
    if (ok(await question(`Create and publish the tag ${lastPreparedTag}? ${ACCEPT_HINT}`))) {
      console.log(`Creating tag ${lastPreparedTag}...`);
      await execAsync(`git tag ${lastPreparedTag}`);
      console.log(`Publishing tag ${lastPreparedTag}...`);
      await execAsync(`git push origin ${lastPreparedTag}`);
      console.log(`${lastPreparedTag} published. The CI will take care of releasing the new VSCode extension.`);
    } else {
      console.log("Just run the script again when you are ready to publish the version. Aborting.");
      throw ABORTED;
    }
  } else {
    console.log("Something went wrong. I found " + lastPreparedTag + " in the last commit message, and this tag is not published yet.");
    console.log("However, the changelog mentions a different version:" + currentChangeLogVersion);
    console.log("Please fix the current state");
    throw ABORTED;
  }
}

async function isTagExists(tagName) {
  var result = await execAsync(`git tag -l ${tagName}`);
  return result.length > 0;
}

async function Main() {
  try {
    // verify that we are on the master branch.
    await ensureMaster();
    let tag = await getCurrentTag();
    if(tag){
      console.log(`The current master already has the tag ${tag}. Nothing needs to be done.\nIf you want to push the tag again, run 'git push --tags'`);
      if(!ok(await question(`Do you want to publish a new version regardless? ${ACCEPT_HINT}`))){
        throw ABORTED;
      }
    }
    let {updateChangeLogWith, currentChangeLogVersion} = await changeLogAndVersion();

    // Check if the last commit contains a message containing "vX.Y.Z", which indicates
    // that we want to publish a new version of the extension
    const lastPreparedTag = tag ? null : await getLastPreparedTag();
    if(lastPreparedTag) {
      // Check if the tag with the name lastPreparedTag does not exist yet
      // If it exists locally, it means that the version is already published
      // or that the tag was not pushed.
      var tagExists = await isTagExists(lastPreparedTag);
      // Here we assume that if it exists, it was already pushed.
      if(!tagExists) {
        await HandleFinalPublishingProcess(currentChangeLogVersion, lastPreparedTag);
        return;
      }
    }

    let newVersion = await nextVersion(currentChangeLogVersion);
    let mostRecentDafnyRelease = (await getMostRecentDafnyRelease()).substring(1);
    let packageObj = await readPackageJson();
    
    console.log(`Going to proceed to publish ${newVersion}`);
    var useNewVersion = false;
    if(await isNewer(packageObj, mostRecentDafnyRelease)) {
      if (ok(await question(`There is a new Dafny version available: (${mostRecentDafnyRelease}). Do you want to update it? ${ACCEPT_HINT}`))) {
        console.log(`Updating latest version of Dafny to ${mostRecentDafnyRelease}`);
      } else {
        console.log("Ignoring new Dafny version.");
        mostRecentDafnyRelease = undefined;
      }
    } else {
      mostRecentDafnyRelease = undefined;
    }
    // Get all the commit messages since the last published tag
    await UpdateChangeLog(currentChangeLogVersion, packageObj, updateChangeLogWith, newVersion, mostRecentDafnyRelease);
    // All clear, we can modify constants.ts and package.json.

    var updatedDafny = await updatePackageJson(packageObj, newVersion, mostRecentDafnyRelease);
    // Execute npm install to ensure the package lock is up to date
    console.log("Executing `npm install`...");
    await execAsync("npm install");

    // Create the new branch and git add all the files modified above
    console.log("Creating new branch...");
    const newBranch = `release-${newVersion}`;
    await execAsync(`git checkout -b ${newBranch}`);
    await execAsync(`git add ${changeLogFile} ${packageFile} ${constantsFile} ${packageLockFile}`);
    if(ok(await question(`I made all the necessary edits. Push the changes to the remote repository? ${ACCEPT_HINT}`))) {
      await execAsync(`git commit -m "Release v${newVersion}${ updatedDafny ? ` (updated Dafny to ${mostRecentDafnyRelease})` : "" }"`);
      await execAsync(`git push origin --set-upstream ${newBranch}`);
      console.log("Now, create the pull request by clicking the link below:");
      console.log(`https://github.com/dafny-lang/ide-vscode/compare/${newBranch}?expand=1`);
      console.log("When this PR is approved and merged, launch this script again to finish publishing the release.");
    } else {
      console.log("Aborting publishing.");
      return close();
    }

  } catch(e) {
    if(e != ABORTED) {
      throw e;
    }
  } finally {
    close();
  }
}
Main();

