/**
 * Update ERC-8004 Identity Registry token URI for an existing agent (Celo Sepolia).
 * Uses setAgentURI on IdentityRegistryUpgradeable — no new NFT minted.
 *
 * @see https://docs.celo.org/build-on-celo/build-with-ai/8004
 * @see erc-8004-contracts IdentityRegistryUpgradeable.setAgentURI
 *
 * Env: AGENT_WALLET_PRIVATE_KEY (owner of the NFT)
 * Optional: ERC8004_AGENT_ID (default from env or 222), AGENT_REGISTRATION_URI (default matches pin-agent-registration.ts output)
 */
import 'dotenv/config';
import { ethers } from 'ethers';

const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e';
const RPC = process.env.CELO_SEPOLIA_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org';

const ABI = [
  'function setAgentURI(uint256 agentId, string newURI) external',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

async function main() {
  const pk = process.env.AGENT_WALLET_PRIVATE_KEY;
  if (!pk) throw new Error('AGENT_WALLET_PRIVATE_KEY required');

  const agentIdStr = process.env.ERC8004_AGENT_ID?.trim() || '222';
  const agentId = ethers.BigNumber.from(agentIdStr);
  const newUri =
    process.env.AGENT_REGISTRATION_URI?.trim() ||
    'ipfs://QmSqzFzem9qihPgGBxp1ZytiC57ptvakvtsFPyo7mzg46S';

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(pk, provider);
  const registry = new ethers.Contract(IDENTITY_REGISTRY, ABI, wallet);

  const owner = await registry.ownerOf(agentId);
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(
      `Wallet ${wallet.address} is not owner of agent ${agentIdStr} (owner: ${owner})`
    );
  }

  const before = await registry.tokenURI(agentId);
  console.log(`Agent #${agentIdStr}`);
  console.log(`  owner:   ${owner}`);
  console.log(`  URI was: ${before}`);
  console.log(`  URI →:   ${newUri}`);

  console.log('\nSending setAgentURI...');
  const tx = await registry.setAgentURI(agentId, newUri);
  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  confirmed in block ${receipt.blockNumber}`);

  const after = await registry.tokenURI(agentId);
  console.log(`\n✅ tokenURI is now: ${after}`);
  console.log(`   Explorer: https://sepolia.celoscan.io/tx/${tx.hash}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
