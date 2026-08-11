import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { HttpTransport, WalletClient, Hex } from "viem";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";
import type { ChainWriter } from "../../application/ports/chain-writer.js";
import type { PreparedTransaction } from "../../application/models/prepared-transaction.js";

export class BaseChainWriter implements ChainWriter {
  readonly walletClient: WalletClient<
    HttpTransport<undefined, false>,
    typeof base,
    PrivateKeyAccount
  >;

  constructor(privateKey: string, rpcUrl: string) {
    const account = privateKeyToAccount(privateKey as Hex);

    this.walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(rpcUrl),
    });
  }

  submit(transaction: PreparedTransaction): Promise<`0x${string}`> {
    return this.walletClient.sendTransaction({
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
      gas: transaction.gas,
    });
  }
}
