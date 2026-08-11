import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChainReader } from "../../src/application/ports/chain-reader.js";
import type { ChainWriter } from "../../src/application/ports/chain-writer.js";
import type { PositionAdapter } from "../../src/application/ports/position-adapter.js";
import type { ContractQuery } from "../../src/application/models/contract-query.js";
import type { PreparedTransaction } from "../../src/application/models/prepared-transaction.js";
import type { TransactionReceipt } from "../../src/application/models/transaction-receipt.js";
import { RepositionWorkflow } from "../../src/application/reposition-workflow.js";
import type {
  PositionIntent,
  PositionIntentValidator,
} from "../../src/domain/position-intent.js";
import type { PoolSnapshot } from "../../src/domain/pool-snapshot.js";
import type { PositionState } from "../../src/domain/position-state.js";
import { createLogger } from "../../src/logging/logger.js";

const ADDRESS_A = "0x0000000000000000000000000000000000000001";
const ADDRESS_B = "0x0000000000000000000000000000000000000002";
const ADDRESS_C = "0x0000000000000000000000000000000000000003";
const ADDRESS_D = "0x0000000000000000000000000000000000000004";
const HASH_A: `0x${string}` = `0x${"1".repeat(64)}`;
const HASH_B: `0x${string}` = `0x${"2".repeat(64)}`;

const intent: PositionIntent = {
  positionPair: [{ token: ADDRESS_A }, { token: ADDRESS_B }],
  priceRange: { lower: "1800", upper: "1900" },
  targetAddress: ADDRESS_C,
  depositBudget: { amountUsd: "300" },
};

const pool: PoolSnapshot = {
  poolAddress: ADDRESS_D,
  positionManager: ADDRESS_C,
  token0: { address: ADDRESS_A, decimals: 18 },
  token1: { address: ADDRESS_B, decimals: 6 },
  tickSpacing: 50,
  sqrtPriceX96: 2n ** 96n,
  currentTick: 0,
};

const state: PositionState = { pool, position: null };

const transactions: PreparedTransaction[] = [
  {
    description: "first",
    to: ADDRESS_A,
    data: "0x01",
    value: 0n,
  },
  {
    description: "second",
    to: ADDRESS_B,
    data: "0x02",
    value: 0n,
  },
];

describe("RebalancingWorkflow", () => {
  it("validates, prepares, submits, and confirms transactions sequentially", async () => {
    const calls: string[] = [];
    let nextHash = 0;

    const validator: PositionIntentValidator = {
      validate(receivedIntent) {
        assert.equal(receivedIntent, intent);
        calls.push("validate");
      },
    };

    const adapter: PositionAdapter = {
      async getPoolSnapshot(receivedIntent) {
        assert.equal(receivedIntent, intent);
        calls.push("getPoolSnapshot");
        return pool;
      },
      async getPositionState(receivedIntent, receivedPool) {
        assert.equal(receivedIntent, intent);
        assert.equal(receivedPool, pool);
        calls.push("getPositionState");
        return state;
      },
      async prepareReposition(receivedIntent, receivedState) {
        assert.equal(receivedIntent, intent);
        assert.equal(receivedState, state);
        calls.push("prepareRebalance");
        return transactions;
      },
    };

    const writer: ChainWriter = {
      async submit(transaction) {
        calls.push(`submit:${transaction.description}`);
        return [HASH_A, HASH_B][nextHash++];
      },
    };

    const reader: ChainReader = {
      async readContract<T>(_query: ContractQuery): Promise<T> {
        throw new Error("readContract should not be called by the workflow");
      },
      async waitForReceipt(transactionHash): Promise<TransactionReceipt> {
        calls.push(`wait:${transactionHash}`);
        return {
          blockHash: HASH_A,
          transactionHash: transactionHash as `0x${string}`,
          status: "success",
        };
      },
    };

    const workflow = new RepositionWorkflow(
      createLogger({ format: "json", level: "silent" }),
      adapter,
      reader,
      writer,
      validator,
    );

    await workflow.execute(intent);

    assert.deepEqual(calls, [
      "validate",
      "getPoolSnapshot",
      "getPositionState",
      "prepareRebalance",
      "submit:first",
      `wait:${HASH_A}`,
      "submit:second",
      `wait:${HASH_B}`,
    ]);
  });

  it("does not access adapters or chains when validation fails", async () => {
    const error = new Error("invalid intent");
    let adapterCalled = false;

    const validator: PositionIntentValidator = {
      validate() {
        throw error;
      },
    };

    const adapter: PositionAdapter = {
      async getPoolSnapshot() {
        adapterCalled = true;
        return pool;
      },
      async getPositionState() {
        adapterCalled = true;
        return state;
      },
      async prepareReposition() {
        adapterCalled = true;
        return [];
      },
    };

    const reader: ChainReader = {
      async readContract<T>(_query: ContractQuery): Promise<T> {
        throw new Error("unexpected read");
      },
      async waitForReceipt(): Promise<TransactionReceipt> {
        throw new Error("unexpected receipt wait");
      },
    };

    const writer: ChainWriter = {
      async submit(): Promise<`0x${string}`> {
        throw new Error("unexpected submission");
      },
    };

    const workflow = new RepositionWorkflow(
      createLogger({ format: "json", level: "silent" }),
      adapter,
      reader,
      writer,
      validator,
    );

    await assert.rejects(workflow.execute(intent), error);
    assert.equal(adapterCalled, false);
  });

  it("does not submit transactions when reposition preparation fails", async () => {
    const error = new Error("insufficient token balance");
    let writerCalled = false;

    const validator: PositionIntentValidator = {
      validate() {},
    };

    const adapter: PositionAdapter = {
      async getPoolSnapshot() {
        return pool;
      },
      async getPositionState() {
        return state;
      },
      async prepareReposition() {
        throw error;
      },
    };

    const reader: ChainReader = {
      async readContract<T>(_query: ContractQuery): Promise<T> {
        throw new Error("unexpected read");
      },
      async waitForReceipt(): Promise<TransactionReceipt> {
        throw new Error("unexpected receipt wait");
      },
    };

    const writer: ChainWriter = {
      async submit(): Promise<`0x${string}`> {
        writerCalled = true;
        return HASH_A;
      },
    };

    const workflow = new RepositionWorkflow(
      createLogger({ format: "json", level: "silent" }),
      adapter,
      reader,
      writer,
      validator,
    );

    await assert.rejects(workflow.execute(intent), error);
    assert.equal(writerCalled, false);
  });
});
