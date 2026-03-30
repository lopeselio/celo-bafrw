import axios from 'axios';

/** Hosted Chipotle API ([docs](https://docs.dev.litprotocol.com/management/api_direct)); use `http://localhost:8000/core/v1` only for a local dev node. */
const CHIPOTLE_CORE_V1 = 'https://api.dev.litprotocol.com/core/v1';

export type ChipotleLitActionRequest = {
  /**
   * Either inline Lit Action JS (cURL examples) **or** the raw IPFS CID (`Qm…`) after you
   * `add_action_to_group` / register the action — creation endpoints take raw CID; some
   * update/delete endpoints take `hashed_cid` (`0x…` keccak) instead — see Chipotle API docs.
   */
  code: string;
  js_params?: Record<string, unknown>;
};

export type ChipotleLitActionResponse = {
  has_error: boolean;
  logs: string;
  response: unknown;
};

/**
 * Run a Lit Action via [Lit Chipotle API](https://docs.dev.litprotocol.com/) (`POST /lit_action`).
 * Use a **usage** API key scoped to the group that contains this CID + PKP (not the master account key in production).
 */
export async function runChipotleLitAction(
  apiKey: string,
  body: ChipotleLitActionRequest
): Promise<ChipotleLitActionResponse> {
  const res = await axios.post<ChipotleLitActionResponse | { err?: string }>(
    `${CHIPOTLE_CORE_V1}/lit_action`,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      validateStatus: () => true,
    }
  );
  const data = res.data;
  if (res.status >= 400) {
    throw new Error(`Chipotle HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  if (typeof data === 'object' && data && 'has_error' in data && data.has_error) {
    throw new Error(`Chipotle lit_action: ${(data as ChipotleLitActionResponse).logs || 'unknown error'}`);
  }
  if (typeof data === 'object' && data && 'response' in data) {
    return data as ChipotleLitActionResponse;
  }
  throw new Error(`Chipotle lit_action: unexpected response ${JSON.stringify(data)}`);
}
