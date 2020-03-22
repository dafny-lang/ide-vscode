export interface ICounterExample {
    line: number;
    col: number; 
    //2do was ist genau da drinne? 
    variables: any; 
}
export interface ICounterExamples {
    counterExamples: ICounterExample[];
    length: number; 
}