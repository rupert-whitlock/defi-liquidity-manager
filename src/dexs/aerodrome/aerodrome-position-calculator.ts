import type { DexPositionCalculator } from "../../application/ports/dex-position-calculator.js";
import type { DexPosition } from "../../domain/dex-position.js";
import type { PoolSnapshot } from "../../domain/pool-snapshot.js";
import type { PriceRange } from "../../domain/position-intent.js";
import { priceRangeToTicks } from "../math.js";
import { createRequire } from "node:module";

interface JsbiValue {
  toString(radix?: number): string;
}

const require = createRequire(import.meta.url);
const JSBI = require("jsbi") as {
  BigInt(value: string): JsbiValue;
};
const { SqrtPriceMath, TickMath } = require("@uniswap/v3-sdk") as {
  SqrtPriceMath: {
    getAmount0Delta(
      sqrtRatioAX96: JsbiValue,
      sqrtRatioBX96: JsbiValue,
      liquidity: JsbiValue,
      roundUp: boolean,
    ): JsbiValue;
    getAmount1Delta(
      sqrtRatioAX96: JsbiValue,
      sqrtRatioBX96: JsbiValue,
      liquidity: JsbiValue,
      roundUp: boolean,
    ): JsbiValue;
  };
  TickMath: {
    getSqrtRatioAtTick(tick: number): JsbiValue;
  };
};

function toJsbi(value: bigint): JsbiValue {
  return JSBI.BigInt(value.toString());
}

function toBigInt(value: JsbiValue): bigint {
  return BigInt(value.toString());
}

function assertInteger(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer`);
  }
}

function assertTokenDecimals(
  token0Decimals: number,
  token1Decimals: number,
): void {
  assertInteger(token0Decimals, "token0Decimals");
  assertInteger(token1Decimals, "token1Decimals");

  if (token0Decimals < 0 || token1Decimals < 0) {
    throw new RangeError("Token decimals cannot be negative");
  }
}

export function tickToPrice(
  tick: number,
  token0Decimals: number,
  token1Decimals: number,
): number {
  assertInteger(tick, "tick");
  assertTokenDecimals(token0Decimals, token1Decimals);

  return 1.0001 ** tick * 10 ** (token0Decimals - token1Decimals);
}

export class AerodromePositionCalculator implements DexPositionCalculator {
  getCurrentPrice(pool: PoolSnapshot): number {
    return tickToPrice(
      pool.currentTick,
      pool.token0.decimals,
      pool.token1.decimals,
    );
  }

  getPositionPriceRange(position: DexPosition, pool: PoolSnapshot) {
    return {
      lower: tickToPrice(
        position.tickLower,
        pool.token0.decimals,
        pool.token1.decimals,
      ),
      upper: tickToPrice(
        position.tickUpper,
        pool.token0.decimals,
        pool.token1.decimals,
      ),
    };
  }

  getTicksForPriceRange(range: PriceRange, pool: PoolSnapshot) {
    return priceRangeToTicks({
      priceLower: Number(range.lower),
      priceUpper: Number(range.upper),
      token0Decimals: pool.token0.decimals,
      token1Decimals: pool.token1.decimals,
      tickSpacing: pool.tickSpacing,
    });
  }

  getPositionAmounts(position: DexPosition, pool: PoolSnapshot) {
    if (position.liquidity === 0n) {
      return {
        amount0: 0n,
        amount1: 0n,
      };
    }
    const currentSqrt = toJsbi(pool.sqrtPriceX96);
    const sqrtLower = TickMath.getSqrtRatioAtTick(position.tickLower);
    const sqrtUpper = TickMath.getSqrtRatioAtTick(position.tickUpper);
    const positionLiquidity = toJsbi(position.liquidity);

    if (pool.sqrtPriceX96 <= BigInt(sqrtLower.toString())) {
      return {
        amount0: toBigInt(
          SqrtPriceMath.getAmount0Delta(
            sqrtLower,
            sqrtUpper,
            positionLiquidity,
            false,
          ),
        ),
        amount1: 0n,
      };
    }

    if (pool.sqrtPriceX96 < BigInt(sqrtUpper.toString())) {
      return {
        amount0: toBigInt(
          SqrtPriceMath.getAmount0Delta(
            currentSqrt,
            sqrtUpper,
            positionLiquidity,
            false,
          ),
        ),
        amount1: toBigInt(
          SqrtPriceMath.getAmount1Delta(
            sqrtLower,
            currentSqrt,
            positionLiquidity,
            false,
          ),
        ),
      };
    }

    return {
      amount0: 0n,
      amount1: toBigInt(
        SqrtPriceMath.getAmount1Delta(
          sqrtLower,
          sqrtUpper,
          positionLiquidity,
          false,
        ),
      ),
    };
  }
}
