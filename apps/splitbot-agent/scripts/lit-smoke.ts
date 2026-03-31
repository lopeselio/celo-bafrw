/**
 * Smoke test for Lit:
 * 1) Core API `POST /lit_action` (HTTPS — usually works even when validator IPs are blocked).
 * 2) LitNodeClient handshake to validator nodes (optional for Chipotle; needed for BLS + session sigs).
 *
 * Run: cd apps/splitbot-agent && npm run lit:smoke
 *
 * Core API: https://developer.litprotocol.com/management/api_direct#7-run-lit-action
 */
import 'dotenv/config';
import * as LitJsSdk from '@lit-protocol/lit-node-client';
import { getLitNetwork } from '../src/config.js';
import { runLitAction } from '../src/chipotleClient.js';

const INLINE_SMOKE_ACTION = `
async function main() {
  return { litSmoke: true, doc: 'https://developer.litprotocol.com/management/api_direct#7-run-lit-action' };
}
`.trim();

async function main() {
    console.log('=== Lit smoke (splitbot-agent) ===\n');

    const enableLit = process.env.ENABLE_LIT === 'true';
    const chipotleKey = process.env.LIT_CHIPOTLE_API_KEY?.trim();
    const cid = process.env.LIT_SETTLEMENT_IPFS_CID?.trim();
    const pkp = process.env.PKP_PUBLIC_KEY?.trim();

    console.log(`ENABLE_LIT:             ${enableLit}`);
    console.log(`LIT_NETWORK:              ${getLitNetwork()}`);
    console.log(`LIT_CHIPOTLE_API_KEY:    ${chipotleKey ? '(set)' : '(missing)'}`);
    console.log(`LIT_SETTLEMENT_IPFS_CID: ${cid || '(optional for this smoke)'}`);
    console.log(`PKP_PUBLIC_KEY:           ${pkp && pkp !== '0xPlaceholder' ? '(set)' : '(missing or placeholder)'}`);
    console.log('');

    if (!chipotleKey && !enableLit) {
        console.log('Set LIT_CHIPOTLE_API_KEY to test core API, and/or ENABLE_LIT=true to test node handshake.');
        process.exit(0);
    }

    let coreOk = false;
    if (chipotleKey) {
        console.log('[1/2] Core API POST /lit_action (api.dev.litprotocol.com)…');
        try {
            const out = await runLitAction(chipotleKey, {
                code: INLINE_SMOKE_ACTION,
                js_params: {},
            });
            console.log('      OK — response:', out.response);
            coreOk = true;
        } catch (e) {
            console.error('      FAILED:', e instanceof Error ? e.message : e);
            console.error('\nCheck usage API key and execute permission for lit_action.');
            process.exit(1);
        }
    } else {
        console.log('[1/2] Skip core API (set LIT_CHIPOTLE_API_KEY).');
    }

    if (enableLit) {
        console.log('\n[2/2] LitNodeClient.connect() (validator handshake, may hit raw IPs e.g. :7470)…');
        try {
            const client = new LitJsSdk.LitNodeClientNodeJs({
                litNetwork: getLitNetwork(),
                debug: false,
            });
            await client.connect();
            console.log('      OK — validators reachable.');
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : '';
            console.warn('      WARN —', msg);
            if (/ECONNREFUSED|fetch failed|ETIMEDOUT/i.test(msg + cause)) {
                console.warn(
                    '      → Common causes: firewall/VPN/ISP blocking Lit validator ports, or restrictive network.\n' +
                        '      → Core API [1/2] is independent — settlement and Chipotle vault Encrypt/Decrypt (POST /lit_action) work without this handshake.\n' +
                        '      → BLS encryptString/decryptToString and sessionSigs need a connected node; if you need those, try another network/VPN or contact Lit if validators should be up.',
                );
            }
            if (coreOk) {
                console.log('\n✅ Core API smoke passed. Node handshake failed — see warnings above.');
                process.exit(0);
            }
            process.exit(1);
        }
    } else {
        console.log('\n[2/2] Skip LitNodeClient (ENABLE_LIT=false).');
    }

    console.log('\nDone.');
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
