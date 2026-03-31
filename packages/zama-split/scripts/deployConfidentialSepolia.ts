/**
 * Deploy ConfidentialSplitLedger to Ethereum Sepolia (Zama fhEVM).
 * Usage: DEPLOYER_PRIVATE_KEY=0x... npx hardhat run scripts/deployConfidentialSepolia.ts --network sepolia
 */
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const Factory = await ethers.getContractFactory("ConfidentialSplitLedger");
  const ledger = await Factory.deploy();
  await ledger.waitForDeployment();
  const addr = await ledger.getAddress();
  console.log("ConfidentialSplitLedger:", addr);
  console.log("Set ZAMA_CONFIDENTIAL_LEDGER_ADDRESS=" + addr + " (e.g. in apps/splitbot-agent/.env when wiring the bot).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
