/**
 * Filecoin-backed storage via [Storacha](https://docs.storacha.network/) (IPFS + Filecoin).
 * Agent persistent memory uses Storacha first when configured; Pinata is fallback in AgentVault.
 * This module also archives settlement JSON as a second CID for audit trails.
 *
 * Storacha is loaded with **dynamic import** only when `STORACHA_AGENT_KEY` + `STORACHA_PROOF`
 * are set, so the bot does not pull `@storacha/client` (and `multiformats/link`) at startup.
 *
 * Server / CI setup (see "Bring Your Own Delegations" in the upload docs):
 * 1. `npm i -g @storacha/cli` — create a Space, `storacha space use <space-did>`
 * 2. `storacha key create` → put the **private** key (`Mg...`) in STORACHA_AGENT_KEY
 *    (the matching `did:key:...` is only for delegation; you cannot upload with DID alone)
 * 3. `storacha delegation create <did_from_step_2> --base64` → STORACHA_PROOF
 */
import type { Client as StorachaClient } from '@storacha/client';

const ARCHIVE_FILENAME = 'archive.json';

/** Fixed name for AgentVault JSON so gateway URLs are stable (see AgentVault). */
export const AGENT_MEMORY_FILENAME = 'splitbot-agent-memory.json';

let storachaReady: Promise<StorachaClient> | null = null;

/** Shared Storacha client for uploads + upload/list (agent memory + settlement archive). */
export async function getStorachaClient(): Promise<StorachaClient | null> {
  const key = process.env.STORACHA_AGENT_KEY?.trim();
  const proofB64 = process.env.STORACHA_PROOF?.trim();
  if (!key || !proofB64) {
    return null;
  }
  if (!storachaReady) {
    storachaReady = (async () => {
      const [{ create }, Proof, { Signer }, { StoreMemory }] = await Promise.all([
        import('@storacha/client'),
        import('@storacha/client/proof'),
        import('@storacha/client/principal/ed25519'),
        import('@storacha/client/stores/memory'),
      ]);
      const principal = Signer.parse(key);
      const store = new StoreMemory();
      const client = await create({ principal, store });
      const proof = await Proof.parse(proofB64);
      const space = await client.addSpace(proof);
      await client.setCurrentSpace(space.did());
      return client;
    })();
  }
  try {
    return await storachaReady;
  } catch (e) {
    storachaReady = null;
    const cause = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Storacha client init failed: ${cause}. Check STORACHA_AGENT_KEY + STORACHA_PROOF (storacha space use + delegation create), or unset to use Pinata only.`,
    );
  }
}

function gatewayUrlForCid(cidStr: string): string {
  const host = process.env.STORACHA_GATEWAY_HOST?.trim() || 'storacha.link';
  return `https://${cidStr}.ipfs.${host}/${ARCHIVE_FILENAME}`;
}

/** Gateway URL for agent-memory JSON pinned via Storacha (`uploadFile` + fixed filename). */
export function storachaAgentMemoryUrl(cidStr: string): string {
  const host = process.env.STORACHA_GATEWAY_HOST?.trim() || 'storacha.link';
  return `https://${cidStr}.ipfs.${host}/${AGENT_MEMORY_FILENAME}`;
}

export async function archiveJsonToFilecoinBacked(body: Record<string, unknown>): Promise<{
  cid: string;
  url?: string;
} | null> {
  const client = await getStorachaClient();
  if (!client) {
    return null;
  }
  try {
    const json = JSON.stringify(body);
    const file = new File([json], ARCHIVE_FILENAME, { type: 'application/json' });
    const root = await client.uploadFile(file);
    const cidStr = root.toString();
    return { cid: cidStr, url: gatewayUrlForCid(cidStr) };
  } catch (e) {
    console.warn('[filecoin-archive] Storacha upload failed', e);
    return null;
  }
}
