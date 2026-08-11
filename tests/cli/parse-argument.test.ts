import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress } from "viem";
import { parseArguments } from "../../src/cli/parse-argument.js";

const TARGET = "0x49c1BD1a412CbE38C3f3D01Cf24DCbeC7dFCCD01";
const WETH = "0x4200000000000000000000000000000000000006";
const USDC_LOWERCASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const PRIVATE_KEY = `0x${"1".repeat(64)}`;

function validArguments(): string[] {
  return [
    "--chain",
    "base",
    "--dex",
    "aerodrome",
    "--target",
    TARGET,
    "--token0",
    WETH,
    "--token1",
    USDC_LOWERCASE,
    "--lower",
    "1800",
    "--upper",
    "1900",
    "--amount-usd",
    "300",
  ];
}

describe("parseArguments", () => {
  it("parses and normalizes a valid CLI configuration", () => {
    const config = parseArguments(validArguments(), {
      PRIVATE_KEY,
      RPC_URL: "https://base.example",
    });

    assert.equal(config.chain, "base");
    assert.equal(config.dex, "aerodrome");
    assert.equal(config.rpcUrl, "https://base.example");
    assert.equal(config.privateKey, PRIVATE_KEY);
    assert.equal(config.intent.positionPair[0].token, WETH);
    assert.equal(
      config.intent.positionPair[1].token,
      getAddress(USDC_LOWERCASE),
    );
    assert.deepEqual(config.intent.priceRange, {
      lower: "1800",
      upper: "1900",
    });
    assert.equal(config.intent.depositBudget.amountUsd, "300");
  });

  it("allows --rpc-url to override RPC_URL", () => {
    const config = parseArguments(
      [...validArguments(), "--rpc-url", "https://override.example"],
      { PRIVATE_KEY, RPC_URL: "https://environment.example" },
    );

    assert.equal(config.rpcUrl, "https://override.example");
  });

  it("rejects a lower bound that is not below the upper bound", () => {
    const args = validArguments();
    args[args.indexOf("1800")] = "1900";

    assert.throws(
      () =>
        parseArguments(args, {
          PRIVATE_KEY,
          RPC_URL: "https://base.example",
        }),
      /--lower must be less than --upper/,
    );
  });

  it("rejects unsupported chains", () => {
    const args = validArguments();
    args[args.indexOf("base")] = "ethereum";

    assert.throws(
      () =>
        parseArguments(args, {
          PRIVATE_KEY,
          RPC_URL: "https://base.example",
        }),
      /--chain must be one of: base/,
    );
  });

  it("requires the private key and RPC URL", () => {
    assert.throws(
      () => parseArguments(validArguments(), {}),
      /PRIVATE_KEY must be a 32-byte hex private key/,
    );

    assert.throws(
      () => parseArguments(validArguments(), { PRIVATE_KEY }),
      /RPC URL must be provided/,
    );
  });
});
