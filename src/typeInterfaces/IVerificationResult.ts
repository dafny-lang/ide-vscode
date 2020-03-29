import { VerificationStatus } from "../types/verificationStatus";
import { ICounterExample } from "./ICounterExample";

// 2do das wird gar nie verwendet oder? 
export interface IVerificationResult {
    verificationStatus: VerificationStatus;
    proofObligations: number;
    errorCount: number;
    crashed: boolean;
    counterModel: ICounterExample;
}
