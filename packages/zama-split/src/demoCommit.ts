/**
 * Local hash stand-in for split payloads (debug / logging). On Ethereum Sepolia production:
 * use Zama relayer + `ConfidentialSplitLedger.addEncryptedNet` per https://docs.zama.org/protocol
 */
import { createHash } from 'crypto';

function main() {
  const participants = ['alice', 'bob', 'charlie'];
  const owed = [10.5, -5, -5.5];
  const payload = JSON.stringify({ participants, owed, tripId: 'demo-trip' });
  const commitment = createHash('sha256').update(payload).digest('hex');
  console.log('Confidentiality stand-in commitment (use fhEVM euint in production):');
  console.log({ commitment, payload });
}

main();
