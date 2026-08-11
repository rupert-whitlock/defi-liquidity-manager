import { readFileSync } from "node:fs";
import { validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { bytesToHex } from "viem";
import { mnemonicToAccount } from "viem/accounts";

const mnemonic = readFileSync(0, "utf8").trim().replace(/\s+/g, " ");

if (!validateMnemonic(mnemonic, wordlist)) {
  console.error("Invalid BIP-39 recovery phrase.");
  process.exitCode = 1;
} else {
  // MetaMask's default first Ethereum account: m/44'/60'/0'/0/0
  const account = mnemonicToAccount(mnemonic, { addressIndex: 0 });
  const privateKey = account.getHdKey().privateKey;

  if (privateKey === null) {
    throw new Error("Unable to derive a private key.");
  }

  process.stdout.write(`${bytesToHex(privateKey)}\n`);
}
