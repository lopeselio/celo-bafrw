import 'dotenv/config';
import { ethers } from 'ethers';

async function checkBalance() {
    const pk = process.env.AGENT_WALLET_PRIVATE_KEY;
    if (!pk) {
        console.error("❌ No AGENT_WALLET_PRIVATE_KEY found in .env");
        return;
    }

    try {
        // Connect to Celo Sepolia Testnet
        const provider = new ethers.providers.JsonRpcProvider("https://forno.celo-sepolia.celo-testnet.org");
        const wallet = new ethers.Wallet(pk, provider);

        console.log(`\n🔍 Checking balances for Agent Wallet: ${wallet.address}\n`);

        // Check Native CELO Balance
        const balanceWei = await provider.getBalance(wallet.address);
        const balanceCelo = ethers.utils.formatEther(balanceWei);
        
        console.log(`💰 CELO Balance: ${balanceCelo} CELO`);
        
        if (parseFloat(balanceCelo) === 0) {
            console.log(`\n⚠️  WARNING: Your Agent wallet is empty!`);
            console.log(`👉 Head to the Celo Faucet to fund it: https://faucet.celo.org/sepolia`);
        } else {
            console.log(`\n✅ Ready to execute x402 Agent Payments!`);
        }

    } catch (error: any) {
        console.error("Failed to fetch balance:", error.message);
    }
}

checkBalance();
