"use strict";

export class LocalQueue {

    private list: string[] = [];

    public add(uri: string): void {
        this.list.push(uri);
    }

    public remove(uri: string): void {
        this.list = this.list.filter((el) => el !== uri);
    }

    public contains(uri: string): boolean {
        return this.list.indexOf(uri) !== -1;
    }
}
