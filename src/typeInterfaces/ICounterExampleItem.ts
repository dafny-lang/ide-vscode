"use strict";
export interface ICounterExampleItem {
  line: number;
  col: number;
  variables: {
    key: string;
    value: string;
  };
}
