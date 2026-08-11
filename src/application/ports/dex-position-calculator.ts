import type { PriceRange } from "../../domain/position-intent.js";
import type { DexPosition } from "../../domain/dex-position.js";
import type { PoolSnapshot } from "../../domain/pool-snapshot.js";

export interface DexPositionCalculator {
  getCurrentPrice(pool: PoolSnapshot): number;

  getPositionPriceRange(
    position: DexPosition,
    pool: PoolSnapshot,
  ): {
    lower: number;
    upper: number;
  };

  getPositionAmounts(
    position: DexPosition,
    pool: PoolSnapshot,
  ): {
    amount0: bigint;
    amount1: bigint;
  };

  getTicksForPriceRange(
    range: PriceRange,
    pool: PoolSnapshot,
  ): { tickLower: number; tickUpper: number };
}
