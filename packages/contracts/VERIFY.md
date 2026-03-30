# Contract verification (Celo Sepolia)

TripEscrow is deployed on **Celo Sepolia** (chain id `11142220`). Source verification is done through the **Etherscan API** (v2), which CeloScan uses—see [Verify with Foundry](https://docs.celo.org/tooling/contract-verification/foundry).

## Prerequisites

- [Foundry](https://book.getfoundry.sh/) (`forge`, `cast`)
- An **Etherscan API key** from [etherscan.io/apis](https://etherscan.io/apis) (same key works for Celo Sepolia verification via the unified API)

Set the key in your environment (do not commit it):

```bash
export ETHERSCAN_API_KEY=your_key_here
```

Optional: add `ETHERSCAN_API_KEY=...` to `packages/contracts/.env` (this file is gitignored at the repo root).

## TripEscrow (reference deployment)

| Field | Value |
|--------|--------|
| Address | `0x79cB34E300D37f3B65852338Ac1f3a0C1ED6Ca29` |
| USDC (Celo Sepolia) | `0x01C5C0122039549AD1493B8220cABEdD739BC44E` |
| SplitBot agent wallet | `0xaAf16AD8a1258A98ed77A5129dc6A8813924Ad3C` |
| Explorer | [Celo Sepolia — TripEscrow](https://sepolia.celoscan.io/address/0x79cB34E300D37f3B65852338Ac1f3a0C1ED6Ca29) |

## Verify

From `packages/contracts`:

```bash
forge build

forge verify-contract \
  0x79cB34E300D37f3B65852338Ac1f3a0C1ED6Ca29 \
  src/TripEscrow.sol:TripEscrow \
  --chain 11142220 \
  --verifier etherscan \
  --constructor-args "$(cast abi-encode "constructor(address,address)" \
    0x01C5C0122039549AD1493B8220cABEdD739BC44E \
    0xaAf16AD8a1258A98ed77A5129dc6A8813924Ad3C)" \
  --watch
```

Notes:

- Use `--verifier etherscan`; Foundry’s default verifier is not Etherscan.
- If you deploy a **new** TripEscrow, replace the address and constructor arguments (stablecoin + agent wallet) with the values from that deployment.
