"use strict";
import * as vscode from "vscode";

import { ICodeLensProvider } from "./ICodeLensProvider";
import { VSCodeCommandStrings } from "../../stringResources/_StringResourcesModule";
import {
  ICodeLensReferences,
  ICodeLensLocation,
  ICodeLensRange,
  ICodeLensPosition,
} from "../../typeInterfaces/_TypeInterfacesModule";

export class CodeLensProvider implements ICodeLensProvider {
  private parsePosition(p: ICodeLensPosition): vscode.Position {
    return new vscode.Position(p.Line, p.Character);
  }
  private parseRange(r: ICodeLensRange): vscode.Range {
    return new vscode.Range(
      this.parsePosition(r.Start),
      this.parsePosition(r.End)
    );
  }
  private parseLocation(l: ICodeLensLocation): vscode.Location {
    return new vscode.Location(this.parseUri(l.Uri), this.parseRange(l.Range));
  }
  private parseUri(u: string): vscode.Uri {
    return vscode.Uri.parse(u);
  }

  public showReferences(jsonArgs: string): void {
    let obj: ICodeLensReferences = JSON.parse(jsonArgs);

    const parsedUri: vscode.Uri = this.parseUri(obj.Uri);
    const parsedPosition: vscode.Position = this.parsePosition(obj.Position);
    const parsedLocations: Array<vscode.Location> = [];

    for (const location of obj.Locations) {
      parsedLocations.push(this.parseLocation(location));
    }

    vscode.commands.executeCommand(
      VSCodeCommandStrings.ShowReferences,
      parsedUri,
      parsedPosition,
      parsedLocations
    );
  }
}
