import 'dotenv/config';
import { ethers } from 'ethers';

/**
 * Mints the ERC-8004 Celo Agent Identity NFT for the SplitBot on MAINNET!
 * This ensures Agent #22} is live on Celo Mainnet and discoverable on AgentScan.
 */
async function registerAgentMainnet() {
    const pk = process.env.AGENT_WALLET_PRIVATE_KEY;
    if (!pk) throw new Error("Missing AGENT_WALLET_PRIVATE_KEY");

    console.log(`\n🤖 Connecting SplitBot to the ERC-8004 Celo Mainnet Agent Registry...`);

    const provider = new ethers.providers.JsonRpcProvider("https://forno.celo.org");
    const wallet = new ethers.Wallet(pk, provider);
    
    // Official Celo Mainnet Address for Identity Registry
    const IDENTITY_REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
    const ABI = [
        "function register(string memory agentURI) external returns (uint256)",
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
    ];

    const registry = new ethers.Contract(IDENTITY_REGISTRY_ADDRESS, ABI, wallet);
    /** Mainnet: pin an agent.json with chainId 42220 / mainnet contracts, then set AGENT_REGISTRATION_URI_MAINNET. */
    const agentMetadataURI =
        process.env.AGENT_REGISTRATION_URI_MAINNET || 'ipfs://QmSplitBotGenAIIdentityDefinition001';

    try {
        console.log(`\n⏳ Minting ERC-721 Agent Identity on Mainnet...`);
        const tx = await registry.register(agentMetadataURI, {
            gasLimit: 500000,
            type: 0 // Legacy tx for Celo compatibility
        });
        
        console.log(`✅ Transaction sent! Hash: ${tx.hash}`);
        console.log(`Waiting for confirmation...`);
        const receipt = await tx.wait();

        const agentId = receipt.events?.[0]?.args?.tokenId?.toString() || "[Pending Scanner ID]";
        
        console.log(`\n🎉 SplitBot is officially registered on MAINNET!`);
        console.log(`💳 Agent ID (ERC-8004): ${agentId}`);
        console.log(`🌍 The AI is now globally discoverable on AgentScan!`);
    } catch (e: any) {
        console.error("\n❌ Registration failed: Ensure your wallet has enough CELO for gas!");
        console.error("Error Details:", e.message);
    }
}

registerAgentMainnet().catch(console.error);
