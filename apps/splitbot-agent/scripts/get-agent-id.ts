/**
 * Prints ERC8004_AGENT_ID for AGENT_WALLET_PRIVATE_KEY on Celo Sepolia Identity Registry.
 * If the wallet has no NFT, says to run register-8004.ts first.
 */
import 'dotenv/config';
import { createPublicClient, http, parseAbi, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const IDENTITY = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const;
const RPC = process.env.CELO_SEPOLIA_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org';

const erc721Abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]);

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
);

async function main() {
  const pk = process.env.AGENT_WALLET_PRIVATE_KEY;
  if (!pk) throw new Error('Set AGENT_WALLET_PRIVATE_KEY in apps/splitbot-agent/.env');

  const account = privateKeyToAccount(pk as `0x${string}`);
  const client = createPublicClient({ transport: http(RPC) });

  const balance = await client.readContract({
    address: IDENTITY,
    abi: erc721Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });

  if (balance === 0n) {
    console.log(`No ERC-8004 identity NFT for ${account.address}`);
    console.log('Register first:  cd apps/splitbot-agent && npx tsx scripts/register-8004.ts');
    process.exit(1);
  }

  let agentId: bigint | null = null;

  try {
    agentId = await client.readContract({
      address: IDENTITY,
      abi: erc721Abi,
      functionName: 'tokenOfOwnerByIndex',
      args: [account.address, 0n],
    });
  } catch {
    const logs = await client.getLogs({
      address: IDENTITY,
      event: transferEvent,
      args: { to: account.address },
      fromBlock: 0n,
      toBlock: 'latest',
    });
    if (logs.length === 0) {
      console.log('Could not resolve token id (no Transfer logs to this wallet).');
      process.exit(1);
    }
    const latest = logs[logs.length - 1]!;
    agentId = latest.args.tokenId as bigint;
    const owner = await client.readContract({
      address: IDENTITY,
      abi: erc721Abi,
      functionName: 'ownerOf',
      args: [agentId],
    });
    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      console.warn(
        `Warning: latest Transfer token ${agentId} is now owned by ${owner} (wallet may have transferred the NFT).`
      );
    }
  }

  console.log('');
  console.log(`Wallet:           ${account.address}`);
  console.log(`ERC8004_AGENT_ID: ${agentId!.toString()}`);
  console.log('');
  console.log(`Add to .env: ERC8004_AGENT_ID=${agentId!.toString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
