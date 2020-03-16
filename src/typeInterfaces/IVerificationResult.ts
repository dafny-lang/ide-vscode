import { VerificationStatus } from "../types/verificationResult";
export interface IVerificationResult {
    verificationStatus: VerificationStatus;
    proofObligations: number;
    errorCount: number;
    crashed: boolean;
    counterModel: any;
}
