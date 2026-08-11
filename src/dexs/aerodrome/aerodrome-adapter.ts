import type { PositionAdapter } from "../../application/ports/position-adapter.js";
import type { PositionIntent } from "../../domain/position-intent.js";
import type { PositionState } from "../../domain/position-state.js";
import {
  prepareApprove,
  prepareBurnData,
  prepareCollectData,
  prepareDecreaseLiquidityData,
  prepareMintPosition,
  prepareMulticall,
} from "./aerodrome-transactions.js";
import type { Logger } from "pino";
import { TokenAmount } from "../../domain/token-amount.js";
import type { DexPositionCalculator } from "../../application/ports/dex-position-calculator.js";
import type { PoolSnapshot } from "../../domain/pool-snapshot.js";
import type { ChainReader } from "../../application/ports/chain-reader.js";
import type { PreparedTransaction } from "../../application/models/prepared-transaction.js";
import {
  InsufficientTokenBalanceError,
  type TokenBalanceShortfall,
} from "../../domain/insufficient-token-balance-error.js";

type AerodromePositionResponse = readonly [
  nonce: bigint,
  operator: `0x${string}`,
  token0: `0x${string}`,
  token1: `0x${string}`,
  tickSpacing: number,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
  feeGrowthInside0LastX128: bigint,
  feeGrowthInside1LastX128: bigint,
  tokensOwed0: bigint,
  tokensOwed1: bigint,
];

type Slot0Response = readonly [
  sqrtPriceX96: bigint,
  tick: number,
  observationIndex: number,
  observationCardinality: number,
  observationCardinalityNext: number,
  unlocked: boolean,
];

const slot0Abi = [
  "function slot0() view returns (",
  "uint160 sqrtPriceX96, int24 tick, uint16 observationIndex,",
  "uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked",
  ")",
].join(" ");

const positionsAbi = [
  "function positions(uint256 tokenId) view returns (",
  "uint96 nonce, address operator, address token0, address token1,",
  "int24 tickSpacing, int24 tickLower, int24 tickUpper, uint128 liquidity,",
  "uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128,",
  "uint128 tokensOwed0, uint128 tokensOwed1",
  ")",
].join(" ");

const sugarHelperAbi = [
  "function estimateAmount1(uint256 amount0, address pool, uint160 sqrtRatioX96, int24 tickLow, int24 tickHigh) external view returns (",
  "uint256 amount1",
  ")",
].join(" ");

const slipstreamFactoryAbi =
  "function getPool(address tokenA, address tokenB, int24 tickSpacing) view returns (address pool)";

export class AerodromeAdapter implements PositionAdapter {
  private readonly factoryAddress: `0x${string}` =
    "0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef";
  private readonly sugarHelperAddress: `0x${string}` =
    "0x0AD09A66af0154a84e86F761313d02d0abB6edd5";

  constructor(
    private readonly log: Logger,
    private readonly reader: ChainReader,
    private readonly calculator: DexPositionCalculator,
  ) {}

  async getPositionState(
    intent: PositionIntent,
    poolSnapshot: PoolSnapshot,
  ): Promise<PositionState> {
    const positionCount = await this.reader.readContract<bigint>({
      abi: "function balanceOf(address owner) view returns (uint256)",
      address: poolSnapshot.positionManager,
      functionName: "balanceOf",
      args: [intent.targetAddress],
    });

    if (positionCount === 0n) {
      return {
        pool: poolSnapshot,
        position: null,
      };
    }

    const positionId = await this.reader.readContract<bigint>({
      abi: "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
      address: poolSnapshot.positionManager,
      functionName: "tokenOfOwnerByIndex",
      args: [intent.targetAddress, 0],
    });

    const position = await this.reader.readContract<AerodromePositionResponse>({
      abi: positionsAbi,
      address: poolSnapshot.positionManager,
      functionName: "positions",
      args: [positionId],
    });

    const [
      ,
      ,
      ,
      ,
      ,
      tickLower,
      tickUpper,
      liquidity,
      ,
      ,
      tokensOwed0,
      tokensOwed1,
    ] = position;

    return {
      pool: poolSnapshot,
      position: {
        tokenId: positionId,
        tickLower,
        tickUpper,
        liquidity,
        tokensOwed0,
        tokensOwed1,
      },
    };
  }

  async prepareReposition(
    intent: PositionIntent,
    state: PositionState,
  ): Promise<PreparedTransaction[]> {
    const transactions: PreparedTransaction[] = [];

    if (state.position != null && state.position.liquidity > 0n) {
      transactions.push(
        prepareMulticall(state.position, state.pool.positionManager, [
          prepareDecreaseLiquidityData(state.position, {
            amount0Min: 0n,
            amount1Min: 0n,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 20 * 60),
            liquidity: state.position.liquidity,
          }),
          prepareCollectData(state.position, intent.targetAddress),
          prepareBurnData(state.position),
        ]),
      );
    }

    const { tickLower: newPositionTickLower, tickUpper: newPositionTickUpper } =
      this.calculator.getTicksForPriceRange(
        {
          upper: intent.priceRange.upper,
          lower: intent.priceRange.lower,
        },
        state.pool,
      );

    const { amount0Desired, amount1Desired } =
      await this.calculcateUsdBudgetLiquidityAmounts(
        state,
        newPositionTickLower,
        newPositionTickUpper,
        intent,
      );

    this.log.info(
      { weth: amount0Desired, usd: amount1Desired },
      "Calculating positions",
    );

    await this.assertSufficientTokenBalances(
      intent,
      state.pool,
      amount0Desired,
      amount1Desired,
    );

    const [allowance0, allowance1] = await Promise.all([
      this.reader.readContract<bigint>({
        address: state.pool.token0.address,
        abi: "function allowance(address owner, address spender) view returns (uint256)",
        functionName: "allowance",
        args: [intent.targetAddress, state.pool.positionManager],
      }),
      this.reader.readContract<bigint>({
        address: state.pool.token1.address,
        abi: "function allowance(address owner, address spender) view returns (uint256)",
        functionName: "allowance",
        args: [intent.targetAddress, state.pool.positionManager],
      }),
    ]);

    if (allowance0 < amount0Desired.toRaw()) {
      transactions.push(
        prepareApprove(
          state.pool.token0.address,
          state.pool.positionManager,
          amount0Desired.toRaw(),
        ),
      );
    }

    if (allowance1 < amount1Desired.toRaw()) {
      transactions.push(
        prepareApprove(
          state.pool.token1.address,
          state.pool.positionManager,
          amount1Desired.toRaw(),
        ),
      );
    }

    transactions.push(
      prepareMintPosition(
        {
          token0: state.pool.token0.address,
          token1: state.pool.token1.address,
          tickSpacing: state.pool.tickSpacing,
          tickLower: newPositionTickLower,
          tickUpper: newPositionTickUpper,
          amount0Desired: amount0Desired.toRaw(),
          amount1Desired: amount1Desired.toRaw(),
          amount0Min: 0n,
          amount1Min: 0n,
          recipient: intent.targetAddress,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 20 * 60),
        },
        state.pool.positionManager,
      ),
    );

    return transactions;
  }

  private async assertSufficientTokenBalances(
    intent: PositionIntent,
    pool: PoolSnapshot,
    amount0Desired: TokenAmount,
    amount1Desired: TokenAmount,
  ): Promise<void> {
    const [balance0, balance1] = await Promise.all([
      this.reader.readContract<bigint>({
        address: pool.token0.address,
        abi: "function balanceOf(address owner) view returns (uint256)",
        functionName: "balanceOf",
        args: [intent.targetAddress],
      }),
      this.reader.readContract<bigint>({
        address: pool.token1.address,
        abi: "function balanceOf(address owner) view returns (uint256)",
        functionName: "balanceOf",
        args: [intent.targetAddress],
      }),
    ]);

    const required0 = amount0Desired.toRaw();
    const required1 = amount1Desired.toRaw();
    const shortfalls: TokenBalanceShortfall[] = [];

    if (balance0 < required0) {
      shortfalls.push({
        token: pool.token0.address,
        available: balance0,
        required: required0,
      });
    }

    if (balance1 < required1) {
      shortfalls.push({
        token: pool.token1.address,
        available: balance1,
        required: required1,
      });
    }

    if (shortfalls.length > 0) {
      throw new InsufficientTokenBalanceError(shortfalls);
    }
  }

  async getPoolSnapshot(intent: PositionIntent): Promise<PoolSnapshot> {
    const poolAddress = await this.reader.readContract<`0x${string}`>({
      abi: slipstreamFactoryAbi,
      address: this.factoryAddress,
      functionName: "getPool",
      args: [intent.positionPair[0].token, intent.positionPair[1].token, 50],
    });

    const [token0, token1, tickSpacing, slot0, positionManager] =
      await Promise.all([
        this.reader.readContract<`0x${string}`>({
          address: poolAddress,
          abi: "function token0() view returns (address)",
          functionName: "token0",
          args: [],
        }),
        this.reader.readContract<`0x${string}`>({
          address: poolAddress,
          abi: "function token1() view returns (address)",
          functionName: "token1",
          args: [],
        }),
        this.reader.readContract<number>({
          address: poolAddress,
          abi: "function tickSpacing() view returns (int24)",
          functionName: "tickSpacing",
          args: [],
        }),
        this.reader.readContract<Slot0Response>({
          address: poolAddress,
          abi: slot0Abi,
          functionName: "slot0",
          args: [],
        }),
        this.reader.readContract<`0x${string}`>({
          address: poolAddress,
          abi: "function nft() view returns (address)",
          functionName: "nft",
          args: [],
        }),
      ]);

    const [token0Decimals, token1Decimals] = await Promise.all([
      this.reader.readContract<number>({
        address: token0,
        abi: "function decimals() view returns (uint8)",
        functionName: "decimals",
        args: [],
      }),
      this.reader.readContract<number>({
        address: token1,
        abi: "function decimals() view returns (uint8)",
        functionName: "decimals",
        args: [],
      }),
    ]);

    const [sqrtPriceX96, currentTick] = slot0;

    return {
      token0: { address: token0, decimals: token0Decimals },
      token1: { address: token1, decimals: token1Decimals },
      tickSpacing,
      sqrtPriceX96,
      currentTick,
      positionManager,
      poolAddress,
    };
  }

  private async calculcateUsdBudgetLiquidityAmounts(
    state: PositionState,
    newPositionTickLower: number,
    newPositionTickUpper: number,
    intent: PositionIntent,
  ): Promise<{ amount0Desired: TokenAmount; amount1Desired: TokenAmount }> {
    const oneToken0 = TokenAmount.fromMain(1, state.pool.token0.decimals);

    const estimateAmount1 = await this.reader.readContract<bigint>({
      address: this.sugarHelperAddress,
      abi: sugarHelperAbi,
      functionName: "estimateAmount1",
      args: [
        oneToken0.toRaw(),
        state.pool.poolAddress,
        0n,
        newPositionTickLower,
        newPositionTickUpper,
      ],
    });

    const amountToken1 = TokenAmount.fromRaw(
      estimateAmount1,
      state.pool.token1.decimals,
    );

    const token1AmountOfOneToken0 = this.calculator.getCurrentPrice(state.pool);

    const scale =
      Number(intent.depositBudget.amountUsd) /
      (token1AmountOfOneToken0 + amountToken1.toMain());

    const scaledToken0 = TokenAmount.fromMain(
      scale,
      state.pool.token0.decimals,
    );
    const scaledToken1 = amountToken1.multiplyByDecimal(scale);

    return { amount0Desired: scaledToken0, amount1Desired: scaledToken1 };
  }
}
