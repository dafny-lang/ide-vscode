"use strict";
import * as vscode from "vscode";

import { ICodeLensProvider } from "./ICodeLensProvider";

export class CodeLensProvider implements ICodeLensProvider {
  // todo rm any

  private parsePosition(p: any): vscode.Position {
    return new vscode.Position(p.Line, p.Character);
  }
  private parseRange(r: any): vscode.Range {
    return new vscode.Range(
      this.parsePosition(r.Start),
      this.parsePosition(r.End)
    );
  }
  private parseLocation(l: any): vscode.Location {
    return new vscode.Location(this.parseUri(l.Uri), this.parseRange(l.Range));
  }
  private parseUri(u: any): vscode.Uri {
    return vscode.Uri.parse(u);
  }

  public showReferences(jsonArgs: string): void {
    let obj;
    try {
      obj = JSON.parse(jsonArgs);
    } catch (e) {
      // todo show error msg
    }

    const parsedUri: vscode.Uri = this.parseUri(obj.Uri);
    const parsedPosition: vscode.Position = this.parsePosition(obj.Position);
    const parsedLocations: Array<vscode.Location> = [];

    for (const location of obj.Locations) {
      parsedLocations.push(this.parseLocation(location));
    }

    vscode.commands.executeCommand(
      "editor.action.showReferences",
      parsedUri,
      parsedPosition,
      parsedLocations
    );
  }
}
