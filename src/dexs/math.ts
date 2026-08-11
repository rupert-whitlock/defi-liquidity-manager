interface PositionTickRangeInput {
  priceLower: number;
  priceUpper: number;
  token0Decimals: number;
  token1Decimals: number;
  tickSpacing: number;
}

const MIN_TICK = -887272;
const MAX_TICK = 887272;

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

/**
 * Converts a human-readable token1-per-token0 price to its fractional tick.
 * The result must be aligned to the pool's tick spacing before it is used
 * on-chain; use priceRangeToTicks when converting a complete range.
 */
export function priceToRawTick(
  priceToken1PerToken0: number,
  token0Decimals: number,
  token1Decimals: number,
): number {
  assertTokenDecimals(token0Decimals, token1Decimals);

  if (!Number.isFinite(priceToken1PerToken0) || priceToken1PerToken0 <= 0) {
    throw new RangeError(
      "priceToken1PerToken0 must be a positive finite number",
    );
  }

  const decimalAdjustment = 10 ** (token0Decimals - token1Decimals);
  const tick =
    Math.log(priceToken1PerToken0 / decimalAdjustment) / Math.log(1.0001);

  if (tick < MIN_TICK || tick > MAX_TICK) {
    throw new RangeError(
      `Price produces a tick outside the supported range ${MIN_TICK} to ${MAX_TICK}`,
    );
  }

  return tick;
}

/**
 * Converts a human-readable token1-per-token0 price range to valid ticks.
 * Boundaries are rounded outwards so the aligned ticks contain the requested
 * price range rather than narrowing it.
 */
export function priceRangeToTicks({
  priceLower,
  priceUpper,
  token0Decimals,
  token1Decimals,
  tickSpacing,
}: PositionTickRangeInput) {
  if (priceLower >= priceUpper) {
    throw new RangeError("priceLower must be less than priceUpper");
  }

  assertInteger(tickSpacing, "tickSpacing");
  if (tickSpacing <= 0) {
    throw new RangeError("tickSpacing must be greater than zero");
  }

  const rawLower = priceToRawTick(priceLower, token0Decimals, token1Decimals);
  const rawUpper = priceToRawTick(priceUpper, token0Decimals, token1Decimals);
  const tickLower = Math.floor(rawLower / tickSpacing) * tickSpacing;
  const tickUpper = Math.ceil(rawUpper / tickSpacing) * tickSpacing;

  if (tickLower < MIN_TICK || tickUpper > MAX_TICK) {
    throw new RangeError(
      `Aligned ticks must be within the supported range ${MIN_TICK} to ${MAX_TICK}`,
    );
  }

  return {
    tickLower,
    tickUpper,
  };
}
