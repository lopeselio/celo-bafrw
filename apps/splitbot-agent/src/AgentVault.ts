import axios from 'axios';
import * as LitJsSdk from '@lit-protocol/lit-node-client';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { LIT_ABILITY } from '@lit-protocol/constants';
import { EthWalletProvider } from '@lit-protocol/lit-auth-client';
import { ethers } from 'ethers';
import { createThirdwebClient, sendTransaction, getContract } from "thirdweb";
import { transfer } from "thirdweb/extensions/erc20";
import { privateKeyToAccount } from "thirdweb/wallets";
import { defineChain } from "thirdweb";

export class AgentVault {
    private agentId: string;
    private pinataApiKey: string;
    private pinataSecretApiKey: string;
    private useRealLit: boolean;
    private usePayments: boolean;
    private twebClient: any;
    private agentAccount: any;
    private vaultDepositAddress = "0x79cB34E300D37f3B65852338Ac1f3a0C1ED6Ca29";
    private usdcTokenAddress = "0x01C5C0122039549AD1493B8220cABEdD739BC44E";

    private litNodeClient: any;
    private sessionSigs: any;

    constructor(agentId: string) {
        this.agentId = agentId;
        this.pinataApiKey = process.env.PINATA_API_KEY || '';
        this.pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY || '';
        this.useRealLit = process.env.ENABLE_LIT === 'true';
        this.usePayments = process.env.ENABLE_PAYMENTS === 'true';
        console.log(`[AgentVault] Initialized Persistent Memory for Agent: ${this.agentId}`);
    }

    async setup() {
        if (this.usePayments) {
            this.twebClient = createThirdwebClient({ clientId: process.env.THIRDWEB_CLIENT_ID as string });
            const privateKey = process.env.AGENT_WALLET_PRIVATE_KEY as string;
            this.agentAccount = privateKeyToAccount({ client: this.twebClient, privateKey });
        }
        if (this.useRealLit) {
            console.log("🔒 [Lit] Connecting to datil-dev...");
            this.litNodeClient = new LitJsSdk.LitNodeClientNodeJs({ litNetwork: "datil-dev" as any, debug: false });
            await this.litNodeClient.connect();
            await this.refreshSessionSigs();
        }
    }

    public async getAgentAddress(): Promise<string> {
        return "0xaAf16AD8a1258A98ed77A5129dc6A8813924Ad3C";
    }

    async refreshSessionSigs() {
        const privateKey = process.env.AGENT_WALLET_PRIVATE_KEY as string;
        const wallet = new ethers.Wallet(privateKey);
        // @ts-ignore
        this.sessionSigs = await this.litNodeClient.getPkpSessionSigs({
            chain: "celo",
            publicKey: process.env.PKP_PUBLIC_KEY || "0xPlaceholder",
            authMethods: [{
                authMethodType: 1,
                accessToken: JSON.stringify({
                    sig: await wallet.signMessage("Authenticate with Lit"),
                    derivedVia: "web3.eth.personal.sign",
                    signedMessage: "Authenticate with Lit",
                    address: await wallet.getAddress(),
                }),
            }],
            resourceAbilityRequests: [
                { resource: new LitActionResource("*"), ability: LIT_ABILITY.LitActionExecution },
                { resource: new LitActionResource("*"), ability: LIT_ABILITY.AccessControlConditionDecryption },
            ],
        });
    }

    async executeSettlementAction(params: any) {
        if (!this.useRealLit) return { success: true, txHash: "mock-tx-hash" };
        try {
            const results = await this.litNodeClient.executeJs({
                ipfsId: params.ipfsId,
                sessionSigs: this.sessionSigs,
                jsParams: {
                    escrowAddress: params.escrowAddress,
                    payee: params.payee,
                    amount: params.amount,
                    description: params.description
                }
            });
            return JSON.parse(results.response);
        } catch (error: any) { throw error; }
    }

    private async executeMicropayment(amount: number) {
        if (!this.usePayments) return;
        try {
            const tokenContract = getContract({ client: this.twebClient, chain: defineChain(11142220), address: this.usdcTokenAddress });
            const tx = transfer({ contract: tokenContract, to: this.vaultDepositAddress, amount: amount.toString() });
            await sendTransaction({ transaction: tx, account: this.agentAccount });
        } catch (error: any) {
            console.warn(`⚠️ [Thirdweb x402] Payment failed: ${error.message || error}. Proceeding for Demo.`);
        }
    }

    private getCeloAccessControlCondition() {
        return [{
            contractAddress: '',
            standardContractType: '',
            chain: 'celo',
            method: '',
            parameters: [':userAddress'],
            returnValueTest: { comparator: '=', value: this.agentId }
        }];
    }

    async saveState(state: Record<string, any>): Promise<string> {
        await this.executeMicropayment(0.05);
        
        let encryptedPayload: string;
        let dataToEncryptHash: string;

        if (this.useRealLit && this.litNodeClient) {
            console.log("🔒 [Lit] Encrypting state via TEE...");
            try {
                // @ts-ignore
                const { ciphertext, dataToEncryptHash: hash } = await LitJsSdk.encryptString(
                    {
                        accessControlConditions: this.getCeloAccessControlCondition(),
                        dataToEncrypt: JSON.stringify(state),
                    },
                    this.litNodeClient
                );
                encryptedPayload = ciphertext;
                dataToEncryptHash = hash;
            } catch (e: any) {
                console.error(`❌ [Lit] Encryption failed: ${e.message}. Falling back to Base64.`);
                encryptedPayload = Buffer.from(JSON.stringify(state)).toString('base64');
                dataToEncryptHash = "mockHash";
            }
        } else {
            encryptedPayload = Buffer.from(JSON.stringify(state)).toString('base64');
            dataToEncryptHash = "mockHash";
        }

        if (this.pinataApiKey && this.pinataSecretApiKey) {
            const payload = { 
                pinataMetadata: { name: `AgentMemory_${this.agentId}_${Date.now()}` },
                pinataContent: { encryptedData: encryptedPayload, litHash: dataToEncryptHash } 
            };
            const res = await axios.post(`https://api.pinata.cloud/pinning/pinJSONToIPFS`, payload, {
                headers: { 'pinata_api_key': this.pinataApiKey, 'pinata_secret_api_key': this.pinataSecretApiKey }
            });
            console.log(`🌐 [IPFS] State Pinned. CID: ${res.data.IpfsHash}`);
            return res.data.IpfsHash;
        }
        return `QmMock${Date.now()}`;
    }

    async loadState(cid: string): Promise<Record<string, any>> {
        if (!this.pinataApiKey) return { status: "no-pinata", data: {} };
        
        try {
            const gatewayUrl = 'https://bronze-disabled-tyrannosaurus-480.mypinata.cloud/ipfs';
            const res = await axios.get(`${gatewayUrl}/${cid}`);
            const { encryptedData, litHash } = res.data;

            if (this.useRealLit && this.litNodeClient && litHash !== "mockHash") {
                console.log("🔓 [Lit] Decrypting state via TEE...");
                // @ts-ignore
                const decryptedString = await LitJsSdk.decryptToString(
                    {
                        accessControlConditions: this.getCeloAccessControlCondition(),
                        ciphertext: encryptedData,
                        dataToEncryptHash: litHash,
                        sessionSigs: this.sessionSigs,
                        chain: 'celo'
                    },
                    this.litNodeClient
                );
                return JSON.parse(decryptedString);
            }

            const decrypted = Buffer.from(encryptedData, 'base64').toString();
            return JSON.parse(decrypted);
        } catch (e: any) {
            console.error(`❌ [AgentVault] Load failed: ${e.message}`);
            return { status: "error", error: e.message };
        }
    }

    async getLatestState(): Promise<Record<string, any> | null> {
        if (!this.pinataApiKey || !this.pinataSecretApiKey) return null;
        try {
            const res = await axios.get(`https://api.pinata.cloud/data/pinList?status=pinned&metadata[name]=AgentMemory_${this.agentId}_&pageLimit=1&sort=DESC`, {
                headers: { 'pinata_api_key': this.pinataApiKey, 'pinata_secret_api_key': this.pinataSecretApiKey }
            });
            if (res.data.rows?.length > 0) {
                const latest = res.data.rows[0];
                console.log(`📡 [AgentVault] Found persistent memory at CID: ${latest.ipfs_pin_hash}`);
                return await this.loadState(latest.ipfs_pin_hash);
            }
        } catch (e) {
            console.warn("⚠️ [AgentVault] Could not fetch latest state from Pinata.");
        }
        return null;
    }
}
