import { createPublicClient, http, parseAbi } from "viem";
import type { HttpTransport, PublicClient, TransactionReceipt } from "viem";
import { base } from "viem/chains";
import type { Logger } from "pino";
import { logger } from "../../logging/logger.js";
import type { ContractQuery } from "../../application/models/contract-query.js";
import type { ChainReader } from "../../application/ports/chain-reader.js";

export class BaseChainReader implements ChainReader {
  readonly client: PublicClient<HttpTransport<undefined, false>, typeof base>;

  constructor(
    private readonly rpcUrl: string,
    private readonly log: Logger = logger.child({
      component: "BaseChainReader",
    }),
  ) {
    this.client = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    });
  }

  async readContract<T>(query: ContractQuery): Promise<T> {
    this.log.debug(
      { contractAddress: query.address, functionName: query.functionName },
      "Reading contract",
    );
    const normalizedAbi = query.abi.replace(/\s+/g, " ").trim();
    const parsedAbi = parseAbi([normalizedAbi]);

    try {
      const response = await this.client.readContract({
        abi: parsedAbi,
        address: query.address as `0x${string}`,
        functionName: query.functionName,
        args: query.args,
      });

      this.log.debug(
        { contractAddress: query.address, functionName: query.functionName },
        "Contract read completed",
      );

      return response;
    } catch (err) {
      this.log.error(
        {
          err,
          contractAddress: query.address,
          functionName: query.functionName,
        },
        "Contract read failed",
      );
      throw err;
    }
  }

  async waitForReceipt(
    transactionHash: `0x${string}`,
  ): Promise<TransactionReceipt> {
    return this.client.waitForTransactionReceipt({
      hash: transactionHash,
      confirmations: 10,
    });
  }
}
