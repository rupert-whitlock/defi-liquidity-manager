import { parseArgs } from "node:util";
import { getAddress, isAddress } from "viem";
import type { PositionIntent } from "../domain/position-intent.js";
import type { SupportedChain } from "../chains/chain.js";
import { supportedChains } from "../chains/chain.js";
import type { SupportedDex } from "../dexs/main.js";
import { supportedDexs } from "../dexs/main.js";

export interface CliConfig {
  intent: PositionIntent;
  privateKey: `0x${string}`;
  rpcUrl: string;
  chain: SupportedChain;
  dex: SupportedDex;
}

export function parseArguments(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): CliConfig {
  const { values } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: {
      target: { type: "string" },
      token0: { type: "string" },
      token1: { type: "string" },
      lower: { type: "string" },
      upper: { type: "string" },
      "amount-usd": { type: "string" },
      "rpc-url": { type: "string" },
      chain: { type: "string" },
      dex: { type: "string" },
    },
  });

  const lower = requirePositiveDecimal(values.lower, "--lower");
  const upper = requirePositiveDecimal(values.upper, "--upper");

  if (Number(lower) >= Number(upper)) {
    throw new Error("--lower must be less than --upper");
  }

  const privateKey = requirePrivateKey(env.PRIVATE_KEY);

  const rpcUrl = values["rpc-url"] ?? env.RPC_URL;

  if (!rpcUrl) {
    throw new Error("RPC URL must be provided through RPC_URL or --rpc-url");
  }

  return {
    chain: requireChoice(values.chain, "--chain", supportedChains),
    dex: requireChoice(values.dex, "--dex", supportedDexs),
    privateKey,
    rpcUrl,
    intent: {
      targetAddress: requireAddress(values.target, "--target"),
      positionPair: [
        { token: requireAddress(values.token0, "--token0") },
        { token: requireAddress(values.token1, "--token1") },
      ],
      priceRange: {
        lower,
        upper,
      },
      depositBudget: {
        amountUsd: requirePositiveDecimal(values["amount-usd"], "--amount-usd"),
      },
    },
  };
}

function requirePositiveDecimal(
  value: string | undefined,
  option: string,
): string {
  if (
    !value ||
    !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) ||
    Number(value) <= 0
  ) {
    throw new Error(`${option} must be a positive decimal number`);
  }

  return value;
}

function requireAddress(
  value: string | undefined,
  option: string,
): `0x${string}` {
  if (!value || !isAddress(value)) {
    throw new Error(`${option} must be a valid Ethereum address`);
  }

  return getAddress(value);
}

function requirePrivateKey(value: string | undefined): `0x${string}` {
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex private key");
  }

  return value as `0x${string}`;
}

function requireChoice<const T extends readonly string[]>(
  value: string | undefined,
  option: string,
  choices: T,
): T[number] {
  if (!value || !choices.includes(value)) {
    throw new Error(`${option} must be one of: ${choices.join(", ")}`);
  }

  return value;
}
