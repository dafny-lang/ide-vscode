export interface ICounterExample {
  line: number;
  col: number;
  variables: {
    key: string;
    value: string;
  };
}

export interface ICounterExamples {
  counterExamples: ICounterExample[];
  length: number;
}
