import { Position, Range } from "vscode";

export function clonePoint(pos: Position): Position {
    return new Position(pos.line, pos.character);
}

export function cloneRange(range: Range): Range {
    return new Range(clonePoint(range.start), clonePoint(range.end));
}
