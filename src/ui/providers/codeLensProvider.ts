"use strict";
import { commands, Uri, Position, Location, Range } from "../../ideApi/_IdeApi";
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
  private parsePosition(p: ICodeLensPosition): Position {
    return new Position(p.Line, p.Character);
  }
  private parseRange(r: ICodeLensRange): Range {
    return new Range(this.parsePosition(r.Start), this.parsePosition(r.End));
  }
  private parseLocation(l: ICodeLensLocation): Location {
    return new Location(this.parseUri(l.Uri), this.parseRange(l.Range));
  }
  private parseUri(u: string): Uri {
    return Uri.parse(u);
  }

  public showReferences(jsonArgs: string): void {
    let obj: ICodeLensReferences = JSON.parse(jsonArgs);

    const parsedUri: Uri = this.parseUri(obj.Uri);
    const parsedPosition: Position = this.parsePosition(obj.Position);
    const parsedLocations: Array<Location> = [];

    for (const location of obj.Locations) {
      parsedLocations.push(this.parseLocation(location));
    }

    commands.executeCommand(
      VSCodeCommandStrings.ShowReferences,
      parsedUri,
      parsedPosition,
      parsedLocations
    );
  }
}
