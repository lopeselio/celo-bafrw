import 'dotenv/config';
import { ethers } from 'ethers';

/**
 * Mints the ERC-8004 Celo Agent Identity NFT for the SplitBot natively!
 * Bypasses the bugged NPM SDK exports and interacts purely with the Celo blockchain.
 */
async function registerAgent() {
    const pk = process.env.AGENT_WALLET_PRIVATE_KEY;
    if (!pk) throw new Error("Missing AGENT_WALLET_PRIVATE_KEY");

    console.log(`\n🤖 Connecting SplitBot directly to the ERC-8004 Celo Sepolia Agent Registry...`);

    const provider = new ethers.providers.JsonRpcProvider("https://forno.celo-sepolia.celo-testnet.org");
    const wallet = new ethers.Wallet(pk, provider);
    
    // The exact Celo Testnet Address for Identity Registry extracted from their README!
    const IDENTITY_REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
    const ABI = [
        "function register(string memory agentURI) external returns (uint256)",
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
    ];

    const registry = new ethers.Contract(IDENTITY_REGISTRY_ADDRESS, ABI, wallet);
    const agentMetadataURI = "ipfs://QmSplitBotGenAIIdentityDefinition001";

    try {
        console.log(`\n⏳ Minting ERC-721 Agent Identity via Native Transport...`);
        const tx = await registry.register(agentMetadataURI);
        
        console.log(`✅ Transaction sent! Waiting for Celo confirmation...`);
        const receipt = await tx.wait();

        const agentId = receipt.events?.[0]?.args?.tokenId?.toString() || "[Pending Scanner ID]";
        
        console.log(`\n🎉 SplitBot is officially registered!`);
        console.log(`💳 Agent ID (ERC-8004): ${agentId}`);
        console.log(`🌍 The AI is now globally discoverable by other bots and ready for x402 business!`);
    } catch (e: any) {
        console.error("\n❌ Registration failed: Ensure your wallet has enough testnet CELO for gas!");
        console.error("Error Details:", e.message);
    }
}

registerAgent().catch(console.error);
