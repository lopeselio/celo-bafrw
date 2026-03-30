/**
 * Smoke test: Celo Sepolia RPC + TripEscrow agent alignment (no Telegram / Gemini).
 * Run: cd apps/splitbot-agent && npx tsx scripts/celo-smoke.ts
 */
import 'dotenv/config';
import { createPublicClient, http, formatUnits, parseAbi } from 'viem';
import { celoAlfajores } from 'viem/chains';
import {
  RPC_URL,
  ESCROW_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  getAgentAccount,
  getLitNetwork,
} from '../src/config.js';

const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)']);
const escrowAbi = parseAbi([
  'function splitBotAgent() view returns (address)',
  'function totalPool() view returns (uint256)',
]);

async function main() {
  const client = createPublicClient({
    chain: {
      ...celoAlfajores,
      id: 11142220,
      name: 'Celo Sepolia',
      rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } },
    },
    transport: http(RPC_URL),
  });

  const block = await client.getBlockNumber();
  console.log('[ok] RPC connected — latest block:', block.toString());

  const agent = getAgentAccount();
  console.log('[ok] Agent wallet (from AGENT_WALLET_PRIVATE_KEY):', agent.address);

  const splitBotAgent = await client.readContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'splitBotAgent',
  });
  const pool = await client.readContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'totalPool',
  });

  const match = splitBotAgent.toLowerCase() === agent.address.toLowerCase();
  console.log('[escrow] TripEscrow:', ESCROW_ADDRESS);
  console.log('[escrow] splitBotAgent on-chain:', splitBotAgent);
  console.log(match ? '[ok] Operator matches escrow splitBotAgent' : '[FAIL] Operator wallet != escrow splitBotAgent — settlement will revert');

  console.log('[escrow] totalPool USDC:', formatUnits(pool, USDC_DECIMALS));

  const usdcBal = await client.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [agent.address],
  });
  console.log('[agent] USDC balance:', formatUnits(usdcBal, USDC_DECIMALS));

  const celoBal = await client.getBalance({ address: agent.address });
  console.log('[agent] CELO balance (wei):', celoBal.toString());

  const lit = process.env.ENABLE_LIT === 'true' && process.env.LIT_SETTLEMENT_IPFS_CID;
  console.log('[config] SETTLEMENT_MODE:', process.env.SETTLEMENT_MODE || '(default escrow)');
  console.log('[config] LIT_NETWORK:', getLitNetwork());
  console.log('[config] Escrow path uses Lit:', Boolean(lit));

  if (!match) process.exit(1);
}

main().catch((e) => {
  console.error('[FAIL]', e);
  process.exit(1);
});
