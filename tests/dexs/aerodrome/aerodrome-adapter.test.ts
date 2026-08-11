import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContractQuery } from "../../../src/application/models/contract-query.js";
import type { TransactionReceipt } from "../../../src/application/models/transaction-receipt.js";
import type { ChainReader } from "../../../src/application/ports/chain-reader.js";
import type { PoolSnapshot } from "../../../src/domain/pool-snapshot.js";
import type { PositionIntent } from "../../../src/domain/position-intent.js";
import { InsufficientTokenBalanceError } from "../../../src/domain/insufficient-token-balance-error.js";
import { AerodromeAdapter } from "../../../src/dexs/aerodrome/aerodrome-adapter.js";
import { AerodromePositionCalculator } from "../../../src/dexs/aerodrome/aerodrome-position-calculator.js";
import { createLogger } from "../../../src/logging/logger.js";

const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TARGET = "0x0000000000000000000000000000000000000001";
const POOL = "0x0000000000000000000000000000000000000002";
const POSITION_MANAGER = "0x0000000000000000000000000000000000000003";
const SQRT_PRICE_X96 = 3_409_506_834_601_043_914_958_341n;

const intent: PositionIntent = {
  positionPair: [{ token: WETH }, { token: USDC }],
  priceRange: { lower: "1800", upper: "1900" },
  targetAddress: TARGET,
  depositBudget: { amountUsd: "300" },
};

const poolSnapshot: PoolSnapshot = {
  poolAddress: POOL,
  positionManager: POSITION_MANAGER,
  token0: { address: WETH, decimals: 18 },
  token1: { address: USDC, decimals: 6 },
  tickSpacing: 50,
  sqrtPriceX96: SQRT_PRICE_X96,
  currentTick: -201_000,
};

function createAdapter(reader: ChainReader): AerodromeAdapter {
  return new AerodromeAdapter(
    createLogger({ format: "json", level: "silent" }),
    reader,
    new AerodromePositionCalculator(),
  );
}

function unexpectedReceipt(): Promise<TransactionReceipt> {
  throw new Error("waitForReceipt should not be called");
}

function createRepositionReader(
  balances: ReadonlyMap<`0x${string}`, bigint>,
): ChainReader {
  return {
    readContract<T>(query: ContractQuery): Promise<T> {
      let result: unknown;

      switch (query.functionName) {
        case "estimateAmount1":
          result = 1_000_000_000n;
          break;
        case "balanceOf":
          result = balances.get(query.address as `0x${string}`) ?? 0n;
          break;
        case "allowance":
          result = (1n << 256n) - 1n;
          break;
        default:
          throw new Error(`Unexpected contract read: ${query.functionName}`);
      }

      return Promise.resolve(result as T);
    },
    waitForReceipt: unexpectedReceipt,
  };
}

describe("AerodromeAdapter", () => {
  it("loads canonical pool metadata from the pool and token contracts", async () => {
    const reader: ChainReader = {
      readContract<T>(query: ContractQuery): Promise<T> {
        let result: unknown;

        switch (query.functionName) {
          case "getPool":
            result = POOL;
            break;
          case "token0":
            result = WETH;
            break;
          case "token1":
            result = USDC;
            break;
          case "tickSpacing":
            result = 50;
            break;
          case "slot0":
            result = [SQRT_PRICE_X96, -201_000, 0, 0, 0, true] as const;
            break;
          case "nft":
            result = POSITION_MANAGER;
            break;
          case "decimals":
            result = query.address === WETH ? 18 : 6;
            break;
          default:
            throw new Error(`Unexpected contract read: ${query.functionName}`);
        }

        return Promise.resolve(result as T);
      },
      waitForReceipt: unexpectedReceipt,
    };

    const result = await createAdapter(reader).getPoolSnapshot(intent);

    assert.deepEqual(result, poolSnapshot);
  });

  it("preserves pool metadata and returns no position for a wallet with no NFTs", async () => {
    const reader: ChainReader = {
      readContract<T>(query: ContractQuery): Promise<T> {
        assert.equal(query.functionName, "balanceOf");
        assert.equal(query.address, POSITION_MANAGER);
        assert.deepEqual(query.args, [TARGET]);
        return Promise.resolve(0n as T);
      },
      waitForReceipt: unexpectedReceipt,
    };

    const result = await createAdapter(reader).getPositionState(
      intent,
      poolSnapshot,
    );

    assert.equal(result.pool, poolSnapshot);
    assert.equal(result.position, null);
    assert.equal(result.pool.token0.decimals, 18);
    assert.equal(result.pool.token1.decimals, 6);
  });

  it("prepares the mint when both token balances cover the desired amounts", async () => {
    const balances = new Map<`0x${string}`, bigint>([
      [WETH, 1_000_000_000_000_000_000n],
      [USDC, 1_000_000_000n],
    ]);

    const transactions = await createAdapter(
      createRepositionReader(balances),
    ).prepareReposition(intent, {
      pool: poolSnapshot,
      position: null,
    });

    assert.equal(transactions.length, 1);
    assert.equal(
      transactions[0]?.description,
      "Mint Aerodrome WETH/USDC position",
    );
  });

  it("reports every token balance below its desired amount", async () => {
    const balances = new Map<`0x${string}`, bigint>([
      [WETH, 0n],
      [USDC, 0n],
    ]);

    await assert.rejects(
      createAdapter(createRepositionReader(balances)).prepareReposition(
        intent,
        {
          pool: poolSnapshot,
          position: null,
        },
      ),
      (error: unknown) => {
        assert.ok(error instanceof InsufficientTokenBalanceError);
        assert.deepEqual(
          error.shortfalls.map(({ token }) => token),
          [WETH, USDC],
        );
        assert.ok(error.shortfalls.every(({ required }) => required > 0n));
        return true;
      },
    );
  });
});
