import type { SupportedChain } from "../chains/chain.js";
import type { SupportedDex } from "../dexs/main.js";
import type { PositionAdapter } from "../application/ports/position-adapter.js";
import { AerodromeAdapter } from "../dexs/aerodrome/aerodrome-adapter.js";
import { logger } from "../logging/logger.js";
import type { ChainReader } from "../application/ports/chain-reader.js";
import { AerodromePositionCalculator } from "../dexs/aerodrome/aerodrome-position-calculator.js";

export function createPositionAdapter(
  dex: SupportedDex,
  chain: SupportedChain,
  reader: ChainReader,
): PositionAdapter {
  if (dex === "aerodrome") {
    return new AerodromeAdapter(
      logger.child({ component: "AerodromeAdapter" }),
      reader,
      new AerodromePositionCalculator(),
    );
  } else {
    throw new Error("Unexpected error");
  }
}
