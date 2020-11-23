"use strict";
export interface ICounterExampleItem {
  position: {
    line: number;
    character: number;
  },
  variables: {
    key: string;
    value: string;
  };
}
