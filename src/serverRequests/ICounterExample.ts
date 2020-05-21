"use strict";
export interface ICounterExample {
  getCounterExample(callback: Function, isAutoTriggered: Boolean): void;
}
