import { formatUnits, parseUnits } from "viem";

export class TokenAmount {
  private readonly multiplierPrecision: number = 18;

  constructor(
    private readonly rawValue: bigint,
    private readonly decimals: number,
  ) {}

  static fromRaw(value: bigint, decimals: number): TokenAmount {
    return new this(value, decimals);
  }

  static fromMain(value: number, decimals: number): TokenAmount {
    const raw = parseUnits(value.toString(), decimals);

    return new this(raw, decimals);
  }

  toMain(): number {
    return Number(formatUnits(this.rawValue, this.decimals));
  }

  toRaw(): bigint {
    return this.rawValue;
  }

  multiplyByDecimal(multiplier: number): TokenAmount {
    const scale = 10n ** BigInt(this.multiplierPrecision);
    const rawMultiplier = parseUnits(
      multiplier.toString(),
      this.multiplierPrecision,
    );
    const newRawAmount = (this.rawValue * rawMultiplier) / scale;

    return new TokenAmount(newRawAmount, this.decimals);
  }
}
