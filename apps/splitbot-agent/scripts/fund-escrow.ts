/**
 * Approve USDC and deposit into TripEscrow on Celo Sepolia.
 *
 * Funder wallet (first match):
 *   - ESCROW_FUNDER_PRIVATE_KEY — treasury / demo depositor (optional)
 *   - else AGENT_WALLET_PRIVATE_KEY
 *
 * Also: CELO_SEPOLIA_RPC_URL (optional), USDC_ADDRESS / ESCROW_ADDRESS (optional).
 *
 * Usage:
 *   npx tsx scripts/fund-escrow.ts           # 15 USDC (default)
 *   npx tsx scripts/fund-escrow.ts 20        # 20 USDC
 *   ESCROW_FUND_USDC=10 npx tsx scripts/fund-escrow.ts
 */
import 'dotenv/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseAbi,
  parseUnits,
} from 'viem';
import { celoAlfajores } from 'viem/chains';
import {
  RPC_URL,
  ESCROW_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  getEscrowFunderAccount,
} from '../src/config.js';

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
]);
const escrowAbi = parseAbi([
  'function deposit(uint256 amount) external',
  'function totalPool() view returns (uint256)',
  'function deposits(address) view returns (uint256)',
]);

const chain = {
  ...celoAlfajores,
  id: 11142220,
  name: 'Celo Sepolia',
  rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } },
} as const;

function parseAmountUsdc(): bigint {
  const fromEnv = process.env.ESCROW_FUND_USDC;
  const arg = process.argv[2];
  const raw = arg ?? fromEnv ?? '15';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid USDC amount: ${raw}`);
  }
  return parseUnits(String(n), USDC_DECIMALS);
}

async function main() {
  const amount = parseAmountUsdc();
  const account = getEscrowFunderAccount();
  const usingDedicatedFunder = Boolean(process.env.ESCROW_FUNDER_PRIVATE_KEY);
  console.log(
    usingDedicatedFunder
      ? `[ok] Funder (ESCROW_FUNDER_PRIVATE_KEY): ${account.address}`
      : `[ok] Funder (AGENT_WALLET_PRIVATE_KEY): ${account.address}`,
  );

  const transport = http(RPC_URL);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({
    account,
    chain,
    transport,
  });

  const usdcBal = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });
  if (usdcBal < amount) {
    console.error(
      `[FAIL] Need at least ${formatUnits(amount, USDC_DECIMALS)} USDC; wallet has ${formatUnits(usdcBal, USDC_DECIMALS)}`,
    );
    process.exit(1);
  }

  const allowance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account.address, ESCROW_ADDRESS],
  });

  if (allowance < amount) {
    console.log('[tx] approve USDC for TripEscrow…');
    const approveHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [ESCROW_ADDRESS, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log('[ok] approve:', approveHash);
  } else {
    console.log('[ok] allowance already sufficient');
  }

  console.log(`[tx] deposit ${formatUnits(amount, USDC_DECIMALS)} USDC…`);
  const depositHash = await walletClient.writeContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'deposit',
    args: [amount],
  });
  const depositReceipt = await publicClient.waitForTransactionReceipt({
    hash: depositHash,
  });
  if (depositReceipt.status !== 'success') {
    throw new Error(`deposit reverted: ${depositHash}`);
  }
  console.log('[ok] deposit:', depositHash);

  const pool = await publicClient.readContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'totalPool',
  });
  const credited = await publicClient.readContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'deposits',
    args: [account.address],
  });

  console.log('[escrow] totalPool:', formatUnits(pool, USDC_DECIMALS), 'USDC');
  console.log(
    '[escrow] deposits[funder]:',
    formatUnits(credited, USDC_DECIMALS),
    'USDC',
  );
}

main().catch((e) => {
  console.error('[FAIL]', e);
  process.exit(1);
});
