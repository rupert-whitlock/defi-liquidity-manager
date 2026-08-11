export interface Position {
  token: `0x${string}`;
}

type PositionPair = [Position, Position];

export interface PriceRange {
  lower: string;
  upper: string;
}

export interface DepositBudget {
  amountUsd: string;
}

export interface PositionIntent {
  positionPair: PositionPair;
  priceRange: PriceRange;
  targetAddress: `0x${string}`;
  depositBudget: DepositBudget;
}

export interface PositionIntentValidator {
  validate(intent: PositionIntent): void;
}
