import type {
  PositionIntent,
  PositionIntentValidator,
} from "../domain/position-intent.js";
import type { Logger } from "pino";
import type { PositionAdapter } from "./ports/position-adapter.js";
import type { ChainReader } from "./ports/chain-reader.js";
import type { ChainWriter } from "./ports/chain-writer.js";

export class RepositionWorkflow {
  constructor(
    private readonly log: Logger,
    private readonly positionAdapter: PositionAdapter,
    private readonly chainReader: ChainReader,
    private readonly chainWriter: ChainWriter,
    private readonly validator: PositionIntentValidator,
  ) {}

  async execute(intent: PositionIntent) {
    this.validator.validate(intent);

    const poolSnapshot = await this.positionAdapter.getPoolSnapshot(intent);
    const currentState = await this.positionAdapter.getPositionState(
      intent,
      poolSnapshot,
    );
    const transactions = await this.positionAdapter.prepareReposition(
      intent,
      currentState,
    );

    for (const transaction of transactions) {
      const hash = await this.chainWriter.submit(transaction);
      const receipt = await this.chainReader.waitForReceipt(hash);

      this.log.info({ receipt }, "Transaction receipt");
    }
  }
}
