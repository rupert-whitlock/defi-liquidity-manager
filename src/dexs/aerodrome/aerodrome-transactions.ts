import { encodeFunctionData, parseAbi } from "viem";
import type { DexPosition } from "../../domain/dex-position.js";
import type { PreparedTransaction } from "../../application/models/prepared-transaction.js";

const positionManagerAbi = parseAbi([
  "function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) payable returns (uint256 amount0, uint256 amount1)",
  "function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) payable returns (uint256 amount0, uint256 amount1)",
  "function burn(uint256 tokenId) payable",
  "function multicall(bytes[] data) payable returns (bytes[] results)",
  "function mint((address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline, uint160 sqrtPriceX96) params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
]);

export function prepareBurnData(position: DexPosition): `0x${string}` {
  return encodeFunctionData({
    abi: positionManagerAbi,
    functionName: "burn",
    args: [position.tokenId],
  });
}

interface DecreaseLiquidityOptions {
  liquidity: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
  deadline: bigint;
}

export function prepareDecreaseLiquidityData(
  position: DexPosition,
  options: DecreaseLiquidityOptions,
): `0x${string}` {
  return encodeFunctionData({
    abi: positionManagerAbi,
    functionName: "decreaseLiquidity",
    args: [
      {
        tokenId: position.tokenId,
        liquidity: options.liquidity,
        amount0Min: options.amount0Min,
        amount1Min: options.amount1Min,
        deadline: options.deadline,
      },
    ],
  });
}

const maxUint128 = (1n << 128n) - 1n;

export function prepareCollectData(
  position: DexPosition,
  recipient: `0x${string}`,
): `0x${string}` {
  return encodeFunctionData({
    abi: positionManagerAbi,
    functionName: "collect",
    args: [
      {
        tokenId: position.tokenId,
        recipient,
        amount0Max: maxUint128,
        amount1Max: maxUint128,
      },
    ],
  });
}

export function prepareMulticall(
  position: DexPosition,
  positionManagerAddress: `0x${string}`,
  preparedTransactions: `0x${string}`[],
): PreparedTransaction {
  return {
    description: `Close Aerodrome position ${position.tokenId}`,
    to: positionManagerAddress,
    data: encodeFunctionData({
      abi: positionManagerAbi,
      functionName: "multicall",
      args: [[...preparedTransactions.map((tx) => tx)]],
    }),
    value: 0n,
    gas: 400_000n,
  };
}

const approveAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export function prepareApprove(
  tokenAddress: `0x${string}`,
  positionManagerAddress: `0x${string}`,
  amount: bigint,
): PreparedTransaction {
  return {
    description: `Approve ${tokenAddress}`,
    to: tokenAddress,
    data: encodeFunctionData({
      abi: approveAbi,
      functionName: "approve",
      args: [positionManagerAddress, amount],
    }),
    value: 0n,
  };
}

interface MintPosition {
  tickSpacing: number;
  tickLower: number;
  tickUpper: number;
  token0: `0x${string}`;
  token1: `0x${string}`;
  amount0Desired: bigint;
  amount1Desired: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
  recipient: `0x${string}`;
  deadline: bigint;
}

export function prepareMintPosition(
  mint: MintPosition,
  positionManagerAddress: `0x${string}`,
): PreparedTransaction {
  return {
    description: "Mint Aerodrome WETH/USDC position",
    to: positionManagerAddress,
    data: encodeFunctionData({
      abi: positionManagerAbi,
      functionName: "mint",
      args: [
        {
          token0: mint.token0,
          token1: mint.token1,
          tickSpacing: mint.tickSpacing,
          tickLower: mint.tickLower,
          tickUpper: mint.tickUpper,
          amount0Desired: mint.amount0Desired,
          amount1Desired: mint.amount1Desired,
          amount0Min: mint.amount0Min,
          amount1Min: mint.amount1Min,
          recipient: mint.recipient,
          deadline: mint.deadline,
          sqrtPriceX96: 0n,
        },
      ],
    }),
    value: 0n,
    gas: 500_000n,
  };
}
