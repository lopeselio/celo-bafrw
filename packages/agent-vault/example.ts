import 'dotenv/config';
import { AgentVault } from './src/AgentVault';

async function run() {
  console.log("=== AgentVault Demo: Saving expenses from SplitBot ===");
  
  // Initialize the AgentVault with SplitBot's ERC-8004 Identity
  const splitBotIdentity = '0x1A2B3c4D5e6F7g8H9I0J1K2L3M4N5O6P'; // Typical Celo wallet hex
  const vault = new AgentVault(splitBotIdentity);
  await vault.setup();
  
  // 1. You say: "I paid 150 euros for dinner"
  const newMemoryState = {
    eventName: "Spain Trip 2026",
    transactions: [
      { payer: "You", amount: 150, description: "Dinner", splitAmong: ["Bob", "Charlie", "You"] }
    ]
  };
  
  // The agent explicitly pays the x402 barrier and saves to IPFS
  const cidKey = await vault.saveState(newMemoryState);
  
  console.log("\n=== Two Days Later: Retrieving memory to settle ===");
  
  // 2. Someone says: "Who owes what?"
  // The agent pays the read x402 fee, passes the CID, and Lit decrypts it
  await vault.loadState(cidKey);
}

run().catch(console.error);
