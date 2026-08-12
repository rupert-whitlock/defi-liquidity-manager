# DeFi Liquidity Manager

This CLI command provides the ability to create a new liquidity position on aerodrome on the base blockchain.

The command needs the following arguments:
- `--target` The wallet address that will own the liquidity position,
- `--token0` The token address of the token in the zero position,
- `--token1` The token address of the token in the first position,
- `--lower` The lower price boundary of the liquidity position,
- `--upper` The upper price boundary of the liquidity position,
- `--amount-usd` The total USD amount of the liquidity position,
- `--chain` The chain name (only supportes `base`),
- `--dex` The DEX name (only supports `aerodrome`)

`token0` or `token1` must be USDC.

The command will automatically calculate the ratios of `token0` and `token1` for the liquidity position, which will sum to `amount-usd`.

## Run the CLI

Requires Node.js 22+ and Yarn.

For example, this will create a 300 USD liquidity position on the WETH/USDC pool in the range 1800-1900. 

```bash
yarn install

export PRIVATE_KEY="0x..."
export RPC_URL="https://base-mainnet.g.alchemy.com/v2/..."

yarn dev -- \
  --chain base \
  --dex aerodrome \
  --target 0xYourWalletAddress \
  --token0 0x4200000000000000000000000000000000000006 \
  --token1 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --lower 1800 \
  --upper 1900 \
  --amount-usd 300
```

`--target` should be the wallet controlled by `PRIVATE_KEY`. Keep the private key and RPC URL out of source control.

To run the compiled CLI:

```bash
yarn build
yarn start -- <arguments>
```
