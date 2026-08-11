import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { priceRangeToTicks, priceToRawTick } from "../../src/dexs/math.js";
import { tickToPrice } from "../../src/dexs/aerodrome/aerodrome-position-calculator.js";

describe("concentrated-liquidity price math", () => {
  it("converts a WETH/USDC display range to correctly aligned raw ticks", () => {
    const ticks = priceRangeToTicks({
      priceLower: 1_800,
      priceUpper: 1_900,
      token0Decimals: 18,
      token1Decimals: 6,
      tickSpacing: 50,
    });

    assert.deepEqual(ticks, {
      tickLower: -201_400,
      tickUpper: -200_800,
    });
    assert.ok(ticks.tickLower % 50 === 0);
    assert.ok(ticks.tickUpper % 50 === 0);
    assert.ok(tickToPrice(ticks.tickLower, 18, 6) <= 1_800);
    assert.ok(tickToPrice(ticks.tickUpper, 18, 6) >= 1_900);
  });

  it("round-trips a display price through a raw tick approximately", () => {
    const tick = priceToRawTick(1_850, 18, 6);
    const reconstructedPrice = tickToPrice(Math.round(tick), 18, 6);

    assert.ok(Math.abs(reconstructedPrice - 1_850) / 1_850 < 0.0001);
  });

  it("rejects an inverted price range", () => {
    assert.throws(
      () =>
        priceRangeToTicks({
          priceLower: 1_900,
          priceUpper: 1_800,
          token0Decimals: 18,
          token1Decimals: 6,
          tickSpacing: 50,
        }),
      /priceLower must be less than priceUpper/,
    );
  });

  it("rejects invalid prices and tick spacing", () => {
    assert.throws(() => priceToRawTick(0, 18, 6), /positive finite number/);
    assert.throws(
      () =>
        priceRangeToTicks({
          priceLower: 1_800,
          priceUpper: 1_900,
          token0Decimals: 18,
          token1Decimals: 6,
          tickSpacing: 0,
        }),
      /tickSpacing must be greater than zero/,
    );
  });
});
