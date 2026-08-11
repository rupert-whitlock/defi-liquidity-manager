import type { PoolSnapshot } from "../../domain/pool-snapshot.js";
import type { PositionIntent } from "../../domain/position-intent.js";
import type { PositionState } from "../../domain/position-state.js";
import type { PreparedTransaction } from "../models/prepared-transaction.js";

export interface PositionAdapter {
  getPoolSnapshot(intent: PositionIntent): Promise<PoolSnapshot>;
  getPositionState(
    intent: PositionIntent,
    poolSnapshot: PoolSnapshot,
  ): Promise<PositionState>;
  prepareReposition(
    intent: PositionIntent,
    state: PositionState,
  ): Promise<PreparedTransaction[]>;
}
