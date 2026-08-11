import type { DexPosition } from "./dex-position.js";
import type { PoolSnapshot } from "./pool-snapshot.js";

export interface PositionState {
  pool: PoolSnapshot;
  position: DexPosition | null;
}
