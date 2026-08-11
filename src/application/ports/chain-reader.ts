import type { ContractQuery } from "../models/contract-query.js";
import type { TransactionReceipt } from "../models/transaction-receipt.js";

export interface ChainReader {
  readContract<T>(query: ContractQuery): Promise<T>;
  waitForReceipt(transactionHash: string): Promise<TransactionReceipt>;
}
