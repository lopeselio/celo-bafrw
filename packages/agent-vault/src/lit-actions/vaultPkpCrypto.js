/**
 * Agent memory encrypt/decrypt using Chipotle PKP symmetric crypto (TEE).
 * Uses Lit.Actions.Encrypt / Lit.Actions.Decrypt — not the deprecated Naga Lit.Actions.encrypt (BLS).
 *
 * @see https://developer.litprotocol.com/lit-actions/migration/changes
 * @see https://developer.litprotocol.com/lit-actions/migration/encryption
 *
 * Run via Core API POST /lit_action (HTTPS) — no LitNodeClient handshake required.
 * js_params: { pkpId, mode: "encrypt" | "decrypt", payload: string }
 */
async function main({ pkpId, mode, payload }) {
  if (!pkpId) {
    throw new Error('vaultPkpCrypto: pkpId is required in js_params');
  }
  const actions = typeof LitActions !== 'undefined' ? LitActions : Lit.Actions;
  if (mode === 'encrypt') {
    const ciphertext = await actions.Encrypt({ pkpId, message: payload });
    return { ciphertext, kind: 'lit_action_pkp_v1' };
  }
  if (mode === 'decrypt') {
    const plaintext = await actions.Decrypt({ pkpId, ciphertext: payload });
    return { plaintext };
  }
  throw new Error('vaultPkpCrypto: mode must be "encrypt" or "decrypt"');
}
