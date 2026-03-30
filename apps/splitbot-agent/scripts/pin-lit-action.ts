import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
    throw new Error('Pinata API Keys missing in .env');
}

async function pinLitAction() {
    const filePath = path.join(__dirname, '../../../packages/agent-vault/src/lit-actions/settleTrip.js');
    console.log(`[IPFS] Reading secure Lit Action from: ${filePath}`);

    const scriptContent = fs.readFileSync(filePath, 'utf8');

    const payload = {
        pinataMetadata: { name: 'SplitBot_Settle_LitAction' },
        pinataContent: scriptContent
    };

    try {
        console.log('[IPFS] Pinning to Pinata...');
        const res = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', payload, {
            headers: {
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_SECRET_API_KEY,
            }
        });

        const cid = res.data.IpfsHash;
        console.log(`\n✅ LIT ACTION SECURED!`);
        console.log(`CID: ${cid}`);
        console.log(`\nNext: set LIT_SETTLEMENT_IPFS_CID=${cid} in apps/splitbot-agent/.env`);
        
        return cid;
    } catch (error: any) {
        console.error(`[IPFS] Pinning failed: ${error.message}`);
        process.exit(1);
    }
}

pinLitAction();
