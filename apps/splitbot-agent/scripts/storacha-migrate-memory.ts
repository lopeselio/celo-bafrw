/**
 * Load latest AgentVault snapshot (Pinata or Storacha) and save again so Storacha receives an agent-memory blob.
 * Run: cd apps/splitbot-agent && npm run storacha:ping
 *
 * Forces ENABLE_LIT=false and ENABLE_PAYMENTS=false for this process (no Lit session, no x402 transfer).
 * Uses AGENT_VAULT_ID from env (see src/config.ts; default splitbot-demo).
 */
import 'dotenv/config';
import { AGENT_VAULT_ID } from '../src/config.js';
import { AgentVault } from '../src/AgentVault.js';

async function main() {
    process.env.ENABLE_LIT = 'false';
    process.env.ENABLE_PAYMENTS = 'false';

    const vault = new AgentVault(AGENT_VAULT_ID);
    await vault.setup();

    const last = await vault.getLatestState();
    let transactions: unknown[] = [];
    let registry: Record<string, unknown> = {};

    if (
        last &&
        typeof last === 'object' &&
        !('status' in last && (last as { status: string }).status === 'error')
    ) {
        const data = last as { transactions?: unknown[]; registry?: Record<string, unknown> };
        if (Array.isArray(data.transactions)) transactions = data.transactions;
        if (data.registry && typeof data.registry === 'object') registry = data.registry;
    }

    console.log(
        `[storacha:ping] agent=${AGENT_VAULT_ID} — re-saving ${transactions.length} tx, ${Object.keys(registry).length} users (Storacha first, then Pinata fallback)…`
    );
    const cid = await vault.saveState({ transactions, registry });
    console.log(`[storacha:ping] OK — CID: ${cid}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
