/**
 * Set TripEscrow.splitBotAgent (required for Lit: must equal PKP wallet; wallet-only mode uses operator EOA).
 *
 * Only the contract **owner** can call `updateAgent`. Use the deployer / multisig key.
 *
 *   TRIPESCROW_OWNER_PRIVATE_KEY=0x… \
 *   npx tsx scripts/update-escrow-agent.ts
 *
 * New agent defaults to `LIT_CHIPOTLE_PKP_ID` / `LIT_PKP_ID` if `NEW_SPLITBOT_AGENT` is unset.
 *
 * Env: CELO_SEPOLIA_RPC_URL, ESCROW_ADDRESS (optional), TRIPESCROW_OWNER_PRIVATE_KEY, optional NEW_SPLITBOT_AGENT
 */
import 'dotenv/config';
import { createPublicClient, createWalletClient, getAddress, http, isAddress, parseAbi } from 'viem';
import { celoAlfajores } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { RPC_URL, ESCROW_ADDRESS, getLitPkpWalletAddress } from '../src/config.js';

const escrowAbi = parseAbi([
  'function owner() view returns (address)',
  'function splitBotAgent() view returns (address)',
  'function updateAgent(address newAgent) external',
]);

const chain = {
  ...celoAlfajores,
  id: 11142220,
  name: 'Celo Sepolia',
  rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } },
} as const;

async function main() {
  const pk = process.env.TRIPESCROW_OWNER_PRIVATE_KEY?.trim();
  if (!pk) {
    console.error(
      'Set TRIPESCROW_OWNER_PRIVATE_KEY to the TripEscrow owner (deployer) private key.\n' +
        'Then re-run, or call updateAgent on CeloScan → Write as owner.',
    );
    process.exit(1);
  }

  const rawNew = process.env.NEW_SPLITBOT_AGENT?.trim();
  const fromEnv = rawNew && isAddress(rawNew) ? getAddress(rawNew) : null;
  const fromPkp = getLitPkpWalletAddress();
  const newAgent = fromEnv ?? fromPkp;
  if (!newAgent) {
    console.error(
      'Set NEW_SPLITBOT_AGENT=0x… or LIT_CHIPOTLE_PKP_ID / LIT_PKP_ID (PKP wallet) for the new splitBotAgent.',
    );
    process.exit(1);
  }
  if (rawNew && !fromEnv) {
    console.error('[FAIL] NEW_SPLITBOT_AGENT is not a valid 0x address');
    process.exit(1);
  }

  const account = privateKeyToAccount(pk as `0x${string}`);
  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
  const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) });

  const [onOwner, currentAgent] = await Promise.all([
    publicClient.readContract({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: 'owner',
    }),
    publicClient.readContract({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: 'splitBotAgent',
    }),
  ]);

  if (onOwner.toLowerCase() !== account.address.toLowerCase()) {
    console.error(
      `[FAIL] TRIPESCROW_OWNER_PRIVATE_KEY derives ${account.address} but TripEscrow.owner() is ${onOwner}`,
    );
    process.exit(1);
  }

  console.log('[escrow]', ESCROW_ADDRESS);
  console.log('[escrow] owner:', onOwner);
  console.log('[escrow] splitBotAgent (current):', currentAgent);
  console.log('[escrow] splitBotAgent (new):     ', newAgent);

  if (currentAgent.toLowerCase() === newAgent.toLowerCase()) {
    console.log('[ok] Already set — nothing to do.');
    return;
  }

  const hash = await wallet.writeContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'updateAgent',
    args: [newAgent],
    chain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log('[ok] updateAgent mined:', hash);
  console.log(`       https://sepolia.celoscan.io/tx/${hash}`);
}

main().catch((e) => {
  console.error('[FAIL]', e);
  process.exit(1);
});
