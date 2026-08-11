import type { TokenMetadata } from "./token-metadata.js";

export interface PoolSnapshot {
  poolAddress: `0x${string}`;
  positionManager: `0x${string}`;

  token0: TokenMetadata;
  token1: TokenMetadata;

  tickSpacing: number;
  sqrtPriceX96: bigint;
  currentTick: number;
}
