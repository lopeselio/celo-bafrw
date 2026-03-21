import 'dotenv/config';
import { ethers } from 'ethers';
import * as fs from 'fs';

async function deploy() {
    const USDC_ADDRESS = "0x01C5C0122039549AD1493B8220cABEdD739BC44E";
    
    let pk = process.env.AGENT_WALLET_PRIVATE_KEY || "";
    if (pk && !pk.startsWith('0x')) pk = '0x' + pk;

    if (!pk) throw new Error("Missing AGENT_WALLET_PRIVATE_KEY");

    // Load compiled Foundry Artifact directly
    const artifactPath = "../../packages/contracts/out/TripEscrow.sol/TripEscrow.json";
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    const provider = new ethers.providers.JsonRpcProvider("https://forno.celo-sepolia.celo-testnet.org");
    const wallet = new ethers.Wallet(pk, provider);
    
    console.log(`\n🚀 Deploying TripEscrow to Celo Sepolia using Agent Wallet: ${wallet.address}`);
    console.log(`🔗 Linking to USDC: ${USDC_ADDRESS}`);

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode || artifact.bytecode.object, wallet);
    
    const escrow = await factory.deploy(USDC_ADDRESS, wallet.address);
    console.log(`⏳ Waiting for block confirmation...`);
    
    await escrow.deployed();
    
    console.log(`\n✅ ESCROW DEPLOYED SUCCESSFULLY!`);
    console.log(`📍 Contract Address: ${escrow.address}\n`);
}

deploy().catch(console.error);
