import type { PreparedTransaction } from "../models/prepared-transaction.js";

export interface ChainWriter {
  submit(transaction: PreparedTransaction): Promise<`0x${string}`>;
}
