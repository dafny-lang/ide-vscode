"use strict";
export interface ICounterExample {
  getCounterExample(callback: Function, isAutoTriggered: boolean): void;
}
