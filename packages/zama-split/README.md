# Confidential split ledger (Zama fhEVM) — Ethereum Sepolia only

This package deploys **`ConfidentialSplitLedger`** on **Ethereum Sepolia** (`11155111`) using [Zama fhEVM](https://docs.zama.ai/fhevm/) (`euint32` per trip, homomorphic `addEncryptedNet`).

## Requirements

- Node.js **20 LTS** (recommended for Hardhat)
- Sepolia ETH for deploy + relayer usage
- [Zama contract addresses](https://docs.zama.org/protocol/solidity-guides/smart-contract/configure/contract_addresses) apply to this network

## Setup

```bash
cd packages/zama-split
npm install
cp .env.example .env
# DEPLOYER_PRIVATE_KEY=0x...
npm run compile
npm test
```

## Deploy

```bash
npm run deploy:sepolia
```

Set `ZAMA_CONFIDENTIAL_LEDGER_ADDRESS` (or add to `agent.json` → `confidentialSplitLedgerEthereumSepolia`) to the deployed address.

## Client

Encrypt inputs and decrypt with [`@zama-fhe/relayer-sdk`](https://docs.zama.ai/protocol/relayer-sdk-guides/fhevm-relayer/initialization). Use `ZAMA_FHEVM_API_KEY` on live networks per Zama docs.

## Demo (hash stand-in for local debugging)

```bash
npm run demo
```

## References

- [Zama — Quick start](https://docs.zama.org/protocol/solidity-guides/getting-started/quick-start-tutorial)
- [FHEVM Hardhat template](https://github.com/zama-ai/fhevm-hardhat-template)
