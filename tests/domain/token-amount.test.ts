import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TokenAmount } from "../../src/domain/token-amount.js";

describe("TokenAmount", () => {
  it("converts a raw USDC amount to its main-unit value", () => {
    const amount = TokenAmount.fromRaw(325_660_756n, 6);

    assert.equal(amount.toMain(), 325.660756);
  });

  it("converts main-unit token values to raw units", () => {
    assert.equal(TokenAmount.fromMain(325.660756, 6).toRaw(), 325_660_756n);
    assert.equal(
      TokenAmount.fromMain(0.0385, 18).toRaw(),
      38_500_000_000_000_000n,
    );
  });

  it("multiplies a raw amount without converting the amount to a number", () => {
    const amount = TokenAmount.fromRaw(100_000_000n, 6);

    const result = amount.multiplyByDecimal(1.25);

    assert.equal(result.toRaw(), 125_000_000n);
    assert.equal(result.toMain(), 125);
  });

  it("rounds down when the result is smaller than one raw unit", () => {
    const amount = TokenAmount.fromRaw(1n, 6);

    assert.equal(amount.multiplyByDecimal(0.5).toRaw(), 0n);
  });
});
