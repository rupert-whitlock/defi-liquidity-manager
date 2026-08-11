# DeFi Liquidity Rebalancer

## Run the CLI

Requires Node.js 22+ and Yarn.

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
