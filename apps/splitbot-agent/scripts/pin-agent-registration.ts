/**
 * Pins assets/splitbot-logo.png then the root agent.json (with image ipfs://…),
 * prints CIDs, writes agent.json, and prints AGENT_REGISTRATION_URI for register-8004.ts.
 *
 * Optional: AGENT_WALLET_ADDRESS=0x… in .env to set operator.wallet in agent.json.
 *
 * Requires PINATA_API_KEY + PINATA_SECRET_API_KEY in apps/splitbot-agent/.env
 */
import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { privateKeyToAccount } from 'viem/accounts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = path.join(__dirname, '../../..');
const LOGO_PATH = path.join(REPO_ROOT, 'assets/splitbot-logo.png');
const AGENT_JSON_PATH = path.join(REPO_ROOT, 'agent.json');

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

async function pinFileToPinata(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'image/png' }), path.basename(filePath));

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      pinata_api_key: PINATA_API_KEY!,
      pinata_secret_api_key: PINATA_SECRET_API_KEY!,
    },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`pinFileToIPFS ${res.status}: ${t}`);
  }
  const data = (await res.json()) as { IpfsHash: string };
  return data.IpfsHash;
}

async function pinJsonToPinata(obj: Record<string, unknown>, metadataName: string): Promise<string> {
  const res = await axios.post<{ IpfsHash: string }>('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    pinataMetadata: { name: metadataName },
    pinataContent: obj,
  }, {
    headers: {
      pinata_api_key: PINATA_API_KEY!,
      pinata_secret_api_key: PINATA_SECRET_API_KEY!,
    },
  });
  return res.data.IpfsHash;
}

async function main() {
  if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
    throw new Error('PINATA_API_KEY and PINATA_SECRET_API_KEY required in .env');
  }
  if (!fs.existsSync(LOGO_PATH)) {
    throw new Error(`Missing logo at ${LOGO_PATH}`);
  }

  console.log('[IPFS] Pinning logo image...');
  const imageCid = await pinFileToPinata(LOGO_PATH);
  const imageUri = `ipfs://${imageCid}`;
  console.log(`  image CID: ${imageCid}`);
  console.log(`  image URI: ${imageUri}`);

  const raw = fs.readFileSync(AGENT_JSON_PATH, 'utf8');
  const agent = JSON.parse(raw) as Record<string, unknown>;
  agent.image = imageUri;

  let opWallet = process.env.AGENT_WALLET_ADDRESS?.trim();
  if (!opWallet && process.env.AGENT_WALLET_PRIVATE_KEY) {
    opWallet = privateKeyToAccount(process.env.AGENT_WALLET_PRIVATE_KEY as `0x${string}`).address;
    console.log(`  operator.wallet derived from AGENT_WALLET_PRIVATE_KEY`);
  }
  if (opWallet && opWallet.startsWith('0x')) {
    const op = (agent.operator as Record<string, unknown>) || {};
    agent.operator = { ...op, wallet: opWallet };
  }

  fs.writeFileSync(AGENT_JSON_PATH, JSON.stringify(agent, null, 2) + '\n', 'utf8');
  console.log(`  wrote ${AGENT_JSON_PATH}`);

  console.log('[IPFS] Pinning agent registration JSON...');
  const regCid = await pinJsonToPinata(agent as Record<string, unknown>, 'SplitBot-ERC8004-agent.json');
  const registrationUri = `ipfs://${regCid}`;
  console.log(`\n✅ Registration CID: ${regCid}`);
  console.log(`   AGENT_REGISTRATION_URI=${registrationUri}`);
  console.log('\nSet agentMetadataUri in register-8004.ts to this URI (new registrations only).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
