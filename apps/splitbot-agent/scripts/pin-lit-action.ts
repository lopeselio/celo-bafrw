/**
 * Upload Lit Actions (`settleTrip.js`, `vaultPkpCrypto.js`) to IPFS via **Storacha** only.
 *
 * Requires: STORACHA_AGENT_KEY + STORACHA_PROOF (same as the bot / filecoinArchive).
 *
 * Run: cd apps/splitbot-agent && npx tsx scripts/pin-lit-action.ts
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStorachaClient } from '../src/filecoinArchive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Must match the uploaded filename so gateways resolve consistently. */
const LIT_ACTION_FILENAME = 'settleTrip.js';
const VAULT_CRYPTO_FILENAME = 'vaultPkpCrypto.js';

async function pinLitAction() {
    const filePath = path.join(__dirname, '../../../packages/agent-vault/src/lit-actions/settleTrip.js');
    console.log(`[IPFS] Reading Lit Action from: ${filePath}`);

    const scriptContent = fs.readFileSync(filePath, 'utf8');
    const vaultPath = path.join(__dirname, '../../../packages/agent-vault/src/lit-actions/vaultPkpCrypto.js');
    const vaultContent = fs.readFileSync(vaultPath, 'utf8');

    const client = await getStorachaClient();
    if (!client) {
        throw new Error(
            'Storacha is required for pin-lit-action. Set STORACHA_AGENT_KEY and STORACHA_PROOF in .env (see filecoinArchive / bot Storacha setup).',
        );
    }

    console.log('[IPFS] Uploading to Storacha (Filecoin-backed)…');
    const file = new File([scriptContent], LIT_ACTION_FILENAME, {
        type: 'application/javascript',
    });
    const root = await client.uploadFile(file);
    const cid = root.toString();
    const host = process.env.STORACHA_GATEWAY_HOST?.trim() || 'storacha.link';
    console.log(`\n✅ LIT ACTION SECURED (Storacha)`);
    console.log(`CID: ${cid}`);
    console.log(`Try: https://w3s.link/ipfs/${cid}`);
    console.log(`     https://${cid}.ipfs.${host}/${LIT_ACTION_FILENAME}`);
    console.log(`\nNext: set LIT_SETTLEMENT_IPFS_CID=${cid} in apps/splitbot-agent/.env`);
    console.log('Then register this CID with your Lit group (add_action_to_group) if required.');

    const vaultFile = new File([vaultContent], VAULT_CRYPTO_FILENAME, {
        type: 'application/javascript',
    });
    const vaultRoot = await client.uploadFile(vaultFile);
    const vaultCid = vaultRoot.toString();
    console.log(`\n✅ VAULT CRYPTO (Storacha) CID: ${vaultCid}`);
    console.log(`Optional: LIT_VAULT_CRYPTO_IPFS_CID=${vaultCid} (or leave unset to use bundled vaultPkpCrypto.js)\n`);

    return cid;
}

pinLitAction().catch((e) => {
    console.error(e);
    process.exit(1);
});
