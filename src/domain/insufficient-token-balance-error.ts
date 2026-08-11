export interface TokenBalanceShortfall {
  token: `0x${string}`;
  available: bigint;
  required: bigint;
}

export class InsufficientTokenBalanceError extends Error {
  constructor(readonly shortfalls: readonly TokenBalanceShortfall[]) {
    const details = shortfalls
      .map(
        ({ token, available, required }) =>
          `${token}: required ${required} raw units, available ${available}`,
      )
      .join("; ");

    super(`Insufficient token balance: ${details}`);
    this.name = "InsufficientTokenBalanceError";
  }
}
