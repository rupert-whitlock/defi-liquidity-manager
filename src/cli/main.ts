#!/usr/bin/env node

import { RepositionWorkflow } from "../application/reposition-workflow.js";
import { parseArguments } from "./parse-argument.js";
import { logger } from "../logging/logger.js";
import { RequiresTokenValidator } from "../application/ports/requires-token-validator.js";
import { createChainComponents } from "./create-chain-component.js";
import { createPositionAdapter } from "./create-position-adapter.js";

async function main(): Promise<void> {
  const config = parseArguments(process.argv.slice(2));

  const chain = createChainComponents(config);
  const positionAdapter = createPositionAdapter(
    config.dex,
    config.chain,
    chain.reader,
  );

  const validator = new RequiresTokenValidator(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  );

  const workflow = new RepositionWorkflow(
    logger.child({
      component: "RebalancingWorkflow",
    }),
    positionAdapter,
    chain.reader,
    chain.writer,
    validator,
  );

  await workflow.execute(config.intent);
}

try {
  await main();
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
