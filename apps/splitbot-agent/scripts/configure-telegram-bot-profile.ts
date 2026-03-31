/**
 * Apply bot profile via Telegram Bot API — copy matches SplitBot in this repo (Celo TripEscrow, agent, /commands).
 *
 * Run: cd apps/splitbot-agent && npm run telegram:profile
 * Requires: TELEGRAM_BOT_TOKEN in .env
 *
 * Images / Mini App privacy: still in @BotFather if needed.
 */
import 'dotenv/config';

/** Display name (BotFather / API). */
const BOT_NAME = 'SplitBot';

/**
 * Shown on the bot profile when shared (max 120 chars).
 * https://core.telegram.org/bots/api#setmyshortdescription
 */
const SHORT_DESCRIPTION =
  'AI trip-expense agent on Celo — pool USDC in TripEscrow, split fairly, settle on-chain (ERC-8004).';

/**
 * Shown in the chat when there are no messages yet (max 512 chars).
 * https://core.telegram.org/bots/api#setmydescription
 */
const LONG_DESCRIPTION = `SplitBot is an autonomous agent for group trip expenses: parse costs with Gemini, track who owes whom, and settle in USDC on Celo Sepolia via TripEscrow (MiniPay or direct escrow). Link your wallet, use voice or text, then /settle when the group is ready. On-chain identity follows ERC-8004 on Celo.`;

/** Menu commands exposed to Telegram (see bot.ts handlers). */
const BOT_COMMANDS = [
  { command: 'start', description: 'Welcome, link help, and command list' },
  { command: 'register', description: 'Link your Celo wallet to this trip group' },
  { command: 'agent', description: 'Check SplitBot agent balances (USDC / CELO)' },
  { command: 'pool', description: 'Show USDC in TripEscrow pool (on-chain)' },
  { command: 'history', description: 'View logged trip expenses and transactions' },
  { command: 'settle', description: 'Finalize trip and settle on-chain (TripEscrow)' },
] as const;

async function call(method: string, params: Record<string, string>): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');

  const body = new URLSearchParams(params);
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    throw new Error(`${method} failed: ${JSON.stringify(data)}`);
  }
}

async function main() {
  if (SHORT_DESCRIPTION.length > 120) {
    throw new Error(`short_description must be ≤120 chars (got ${SHORT_DESCRIPTION.length})`);
  }
  if (LONG_DESCRIPTION.length > 512) {
    throw new Error(`description must be ≤512 chars (got ${LONG_DESCRIPTION.length})`);
  }

  await call('setMyName', { name: BOT_NAME });
  console.log('[ok] setMyName:', BOT_NAME);

  await call('setMyDescription', { description: LONG_DESCRIPTION });
  console.log('[ok] setMyDescription:', LONG_DESCRIPTION.length, 'chars');

  await call('setMyShortDescription', { short_description: SHORT_DESCRIPTION });
  console.log('[ok] setMyShortDescription:', SHORT_DESCRIPTION.length, 'chars');

  await call('setMyCommands', { commands: JSON.stringify(BOT_COMMANDS) });
  console.log('[ok] setMyCommands:', BOT_COMMANDS.map((c) => `/${c.command}`).join(', '));

  console.log('\nDone. Optional: remove default bot avatar in @BotFather → Edit Bot → Bot Picture.');
}

main().catch((e) => {
  console.error('[FAIL]', e);
  process.exit(1);
});
