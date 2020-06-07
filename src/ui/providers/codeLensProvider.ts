"use strict";
import { ide } from "../../ideApi/_IdeApi";
import { ICodeLensProvider } from "./ICodeLensProvider";
import { VSCodeCommandStrings } from "../../stringResources/_StringResourcesModule";
import {
  ICodeLensReferences,
  ICodeLensLocation,
  ICodeLensRange,
  ICodeLensPosition,
} from "../../typeInterfaces/_TypeInterfacesModule";

/**
 * This component redirects the data obtained from the language server CodeLens provider
 * to the local IDE api to open CodeLens Popups.
 */
export class CodeLensProvider implements ICodeLensProvider {
  private parsePosition(p: ICodeLensPosition): ide.Position {
    return new ide.Position(p.Line, p.Character);
  }
  private parseRange(r: ICodeLensRange): ide.Range {
    return new ide.Range(
      this.parsePosition(r.Start),
      this.parsePosition(r.End)
    );
  }
  private parseLocation(l: ICodeLensLocation): ide.Location {
    return new ide.Location(this.parseUri(l.Uri), this.parseRange(l.Range));
  }
  private parseUri(u: string): ide.Uri {
    return ide.Uri.parse(u);
  }

  public showReferences(jsonArgs: string): void {
    let obj: ICodeLensReferences = JSON.parse(jsonArgs);

    const parsedUri: ide.Uri = this.parseUri(obj.Uri);
    const parsedPosition: ide.Position = this.parsePosition(obj.Position);
    const parsedLocations: Array<ide.Location> = [];

    for (const location of obj.Locations) {
      parsedLocations.push(this.parseLocation(location));
    }

    ide.commands.executeCommand(
      VSCodeCommandStrings.ShowReferences,
      parsedUri,
      parsedPosition,
      parsedLocations
    );
  }
}
