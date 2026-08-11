import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DexPosition } from "../../../src/domain/dex-position.js";
import type { PoolSnapshot } from "../../../src/domain/pool-snapshot.js";
import { AerodromePositionCalculator } from "../../../src/dexs/aerodrome/aerodrome-position-calculator.js";

const TOKEN0 = "0x0000000000000000000000000000000000000001";
const TOKEN1 = "0x0000000000000000000000000000000000000002";
const POSITION_MANAGER = "0x0000000000000000000000000000000000000003";
const POOL_ADDRESS = "0x0000000000000000000000000000000000000004";
const Q96 = 2n ** 96n;

function createPool(overrides: Partial<PoolSnapshot> = {}): PoolSnapshot {
  return {
    poolAddress: POOL_ADDRESS,
    positionManager: POSITION_MANAGER,
    token0: { address: TOKEN0, decimals: 18 },
    token1: { address: TOKEN1, decimals: 18 },
    tickSpacing: 50,
    sqrtPriceX96: Q96,
    currentTick: 0,
    ...overrides,
  };
}

function createPosition(overrides: Partial<DexPosition> = {}): DexPosition {
  return {
    tokenId: 1n,
    tickLower: -100,
    tickUpper: 100,
    liquidity: 1_000_000_000_000_000_000n,
    tokensOwed0: 0n,
    tokensOwed1: 0n,
    ...overrides,
  };
}

describe("AerodromePositionCalculator", () => {
  const calculator = new AerodromePositionCalculator();

  it("calculates the current token1-per-token0 price", () => {
    assert.equal(calculator.getCurrentPrice(createPool()), 1);
  });

  it("uses pool decimals and spacing when converting a target range", () => {
    const pool = createPool({
      token0: { address: TOKEN0, decimals: 18 },
      token1: { address: TOKEN1, decimals: 6 },
    });

    assert.deepEqual(
      calculator.getTicksForPriceRange({ lower: "1800", upper: "1900" }, pool),
      { tickLower: -201_400, tickUpper: -200_800 },
    );
  });

  it("calculates both token amounts while the price is inside the range", () => {
    const amounts = calculator.getPositionAmounts(
      createPosition(),
      createPool(),
    );

    assert.ok(amounts.amount0 > 0n);
    assert.ok(amounts.amount1 > 0n);
  });

  it("calculates a token0-only position below the range", () => {
    const amounts = calculator.getPositionAmounts(
      createPosition(),
      createPool({ sqrtPriceX96: 1n, currentTick: -200 }),
    );

    assert.ok(amounts.amount0 > 0n);
    assert.equal(amounts.amount1, 0n);
  });

  it("calculates a token1-only position above the range", () => {
    const amounts = calculator.getPositionAmounts(
      createPosition(),
      createPool({ sqrtPriceX96: (1n << 160n) - 1n, currentTick: 200 }),
    );

    assert.equal(amounts.amount0, 0n);
    assert.ok(amounts.amount1 > 0n);
  });

  it("returns zero amounts for a position with no liquidity", () => {
    assert.deepEqual(
      calculator.getPositionAmounts(
        createPosition({ liquidity: 0n }),
        createPool(),
      ),
      { amount0: 0n, amount1: 0n },
    );
  });
});
