# Mnemonic to private key

`mnemonic-to-private-key.ts` converts a BIP-39 recovery phrase into the
`0x`-prefixed private key for MetaMask's first Ethereum account.

It uses MetaMask's default derivation path:

```text
m/44'/60'/0'/0/0
```

The resulting string can be passed to viem's `privateKeyToAccount` function.

## Usage

Run the following commands from the project root in zsh:

```zsh
read -s "MNEMONIC?Recovery phrase: "; echo
print -rn -- "$MNEMONIC" | yarn -s mnemonic-to-private-key
unset MNEMONIC
```

The script prints the private key as a `0x`-prefixed string.

### What the commands do

```zsh
read -s "MNEMONIC?Recovery phrase: "; echo
```

- `read` asks for the recovery phrase.
- `-s` prevents the phrase from appearing on screen while it is entered.
- The phrase is stored temporarily in a shell variable named `MNEMONIC`.
- `echo` moves the prompt to a new line afterward.

```zsh
print -rn -- "$MNEMONIC" | yarn -s mnemonic-to-private-key
```

- `print -rn` sends the exact phrase without adding a newline.
- `|` passes it to the script through standard input.
- `yarn -s` runs the package script while suppressing Yarn's extra output.
- The script validates the BIP-39 phrase and derives the first MetaMask account.

```zsh
unset MNEMONIC
```

This removes the recovery phrase from the current shell variable.

## Using the result with viem

```ts
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

const privateKey = process.env.PRIVATE_KEY as Hex;
const account = privateKeyToAccount(privateKey);
```

## Security

- Run the conversion only on a trusted computer, preferably while offline.
- Never paste a recovery phrase or private key into chat, source code, logs, or
  shell command arguments.
- The private key is printed to the terminal and may remain in terminal
  scrollback.
- Anyone with the recovery phrase or derived private key can control the wallet
  and its funds.
- Use a public test mnemonic when testing the script. Never test with a wallet
  that holds real assets.
