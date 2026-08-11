import type { ChainReader } from "../application/ports/chain-reader.js";
import type { ChainWriter } from "../application/ports/chain-writer.js";
import { BaseChainReader } from "../chains/base/base-chain-reader.js";
import { BaseChainWriter } from "../chains/base/base-chain-writer.js";
import type { CliConfig } from "./parse-argument.js";

interface ChainComponents {
  reader: ChainReader;
  writer: ChainWriter;
}

export function createChainComponents(config: CliConfig): ChainComponents {
  if (config.chain === "base") {
    return {
      reader: new BaseChainReader(config.rpcUrl),
      writer: new BaseChainWriter(config.privateKey, config.rpcUrl),
    };
  } else {
    throw new Error(`Unexpected error`);
  }
}
