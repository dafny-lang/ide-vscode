import { VerificationStatus } from "../types/verificationStatus";
import { ICounterModel } from "./ICounterModel";

// 2do das wird gar nie verwendet oder? 
export interface IVerificationResult {
    verificationStatus: VerificationStatus;
    proofObligations: number;
    errorCount: number;
    crashed: boolean;
    counterModel: ICounterModel; //nicht einfach counterexample? 
}
