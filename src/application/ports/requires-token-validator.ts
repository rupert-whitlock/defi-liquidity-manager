import type {
  PositionIntent,
  PositionIntentValidator,
} from "../../domain/position-intent.js";

export class RequiresTokenValidator implements PositionIntentValidator {
  constructor(private readonly requiredToken: `0x${string}`) {}

  validate(intent: PositionIntent): void {
    const containsRequiredToken = intent.positionPair.some(
      ({ token }) => token === this.requiredToken,
    );

    if (!containsRequiredToken) {
      throw new Error(`Position pair must contain ${this.requiredToken}`);
    }
  }
}
