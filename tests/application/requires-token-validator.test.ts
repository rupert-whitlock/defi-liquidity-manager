import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RequiresTokenValidator } from "../../src/application/ports/requires-token-validator.js";
import type { PositionIntent } from "../../src/domain/position-intent.js";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";
const OTHER_TOKEN = "0x0000000000000000000000000000000000000001";
const TARGET = "0x0000000000000000000000000000000000000002";

function createIntent(token0: `0x${string}`, token1: `0x${string}`) {
  return {
    positionPair: [{ token: token0 }, { token: token1 }],
    priceRange: { lower: "1800", upper: "1900" },
    targetAddress: TARGET,
    depositBudget: { amountUsd: "300" },
  } satisfies PositionIntent;
}

describe("RequiresTokenValidator", () => {
  const validator = new RequiresTokenValidator(USDC);

  it("accepts a pair when the required token is token0", () => {
    assert.doesNotThrow(() => validator.validate(createIntent(USDC, WETH)));
  });

  it("accepts a pair when the required token is token1", () => {
    assert.doesNotThrow(() => validator.validate(createIntent(WETH, USDC)));
  });

  it("rejects a pair without the required token", () => {
    assert.throws(
      () => validator.validate(createIntent(WETH, OTHER_TOKEN)),
      /Position pair must contain/,
    );
  });
});
