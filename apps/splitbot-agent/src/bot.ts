import 'dotenv/config';
import axios from 'axios';
import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createPublicClient, http, formatEther, formatUnits, parseAbi } from 'viem';
import { celoAlfajores } from 'viem/chains';
// @ts-ignore
import { AgentVault } from './AgentVault.js';

// Configuration
const USDC_ADDRESS = "0x01C5C0122039549AD1493B8220cABEdD739BC44E";
const ESCROW_ADDRESS = "0x79cB34E300D37f3B65852338Ac1f3a0C1ED6Ca29";
const RPC_URL = "https://forno.celo-sepolia.celo-testnet.org";
const APP_URL = process.env.APP_URL || "http://localhost:3000"; // Should be an Ngrok URL

// Express Setup for MiniPay MiniApp
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

app.get('/pay', (req: express.Request, res: express.Response) => {
    res.sendFile(join(__dirname, '../public/pay.html'));
});

app.post('/api/payment-success', async (req: express.Request, res: express.Response) => {
    try {
        const { chatId, debtor, creditor, amount, hash } = req.body;
        
        // Log settlement transaction
        tripTransactions.push({ payer: debtor, amount: amount, description: `Settled debt with ${creditor}` });
        
        // Pin new state to IPFS
        const cid = await vault.saveState({ transactions: tripTransactions, registry: userRegistry });
        console.log(`✅ [Settlement Logged] CID: ${cid}`);

        // Notify Telegram Chat
        if (chatId) {
            await bot.telegram.sendMessage(
                chatId, 
                `🎉 **Settlement Complete!**\n\n💸 **${debtor}** successfully paid **${creditor}** **${amount} USDC**!\n🔗 [View on CeloScan](https://sepolia.celoscan.io/tx/${hash})\n\n*(State securely updated in AgentVault)*`, 
                { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } }
            );
            
            // Re-run AI to get remaining ledger
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            const prompt = `Transactions Log: ${JSON.stringify(tripTransactions)}. Calculate the net settlements remaining to balance the trip. Return ONLY A RAW JSON ARRAY. Format: [{"debtor": "name", "creditor": "name", "amount": number}]`;
            const result = await model.generateContent(prompt);
            const rawText = result.response.text();
            
            const jsonMatch = rawText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const settlements = JSON.parse(jsonMatch[0]);
                if (settlements.length === 0) {
                    await bot.telegram.sendMessage(chatId, `🎊 **The Group Ledger is now perfectly balanced!** 0.00 USDC owed by anyone.`, { parse_mode: 'Markdown' });
                } else {
                    let summary = "🔄 **Remaining Balances:**\n";
                    for (const debt of settlements) summary += `• ${debt.debtor} still owes ${debt.creditor} ${debt.amount} USDC\n`;
                    await bot.telegram.sendMessage(chatId, summary, { parse_mode: 'Markdown' });
                }
            }
        }
        res.json({ success: true });
    } catch (e: any) {
        console.error(`❌ Webhook Error: ${e.message}`);
        res.status(500).json({ error: "Webhook failed" });
    }
});

app.listen(3000, () => {
    console.log(`🌍 [MiniApp] Payment Portal running. Expose via: ngrok http 3000`);
});

// Client Setup
const client = createPublicClient({ 
    chain: { ...celoAlfajores, id: 11142220, rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } } }, 
    transport: http() 
});
const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)', 'event Transfer(address indexed from, address indexed to, uint256 value)']);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const vault = new AgentVault('SplitBot_LIVE_DEMO');

let tripTransactions: any[] = [];
let userRegistry: Record<string, string> = {}; 

async function getBalances(address: string) {
    try {
        const celoBalance = await client.getBalance({ address: address as `0x${string}` });
        const usdcBalance = await client.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] });
        return { celo: formatEther(celoBalance), usdc: formatUnits(usdcBalance, 6) };
    } catch (e) { return { celo: "N/A", usdc: "N/A" }; }
}

bot.command('start', (ctx) => {
    ctx.reply("🤖 **Celo SplitBot v2 Ready!**\n\nCommands:\n/register <wallet> - Link your Celo ID\n/agent - Check Agent Balance\n/history - View logged expenses\n/settle - Finalize Trip Expenses", { parse_mode: 'Markdown' });
});

bot.command('agent', async (ctx) => {
    const addr = await vault.getAgentAddress();
    const bal = await getBalances(addr);
    ctx.reply(`🤖 **Agent Status**\nWallet: \`${addr}\`\nUSDC: ${bal.usdc}\nCELO: ${bal.celo}`, { parse_mode: 'Markdown' });
});

bot.command('register', async (ctx) => {
    const address = ctx.message.text.split(' ')[1];
    if (!address) return ctx.reply("❌ Usage: `/register <0xAddress>`");
    
    userRegistry[ctx.from.first_name.toLowerCase()] = address;
    const bal = await getBalances(address);
    
    const cid = await vault.saveState({ transactions: tripTransactions, registry: userRegistry });
    console.log(`✅ [User Registered] State Pinned: ${cid}`);
    await ctx.reply(`✅ **Registered: ${ctx.from.first_name}**\n🏦 Wallet: \`${address}\`\n💰 Balance:\n💵 USDC: ${bal.usdc}\n💎 CELO: ${bal.celo}`, { parse_mode: 'Markdown' });
});

bot.command('settle', async (ctx) => {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    if (tripTransactions.length === 0) return ctx.reply("ℹ️ No expenses logged yet. Send a message like 'I paid $50 for dinner' to start!");
    await ctx.reply("🧮 Calculating final settlements with AI...");
    const prompt = `Transactions Log: ${JSON.stringify(tripTransactions)}. 
    
    Calculate the net settlements to balance the trip. 
    Deduplicate: Each person should either pay or receive ONCE in total if possible.
    
    RETURN ONLY A RAW JSON ARRAY. NO TEXT BEFORE OR AFTER.
    Format: [{"debtor": "name", "creditor": "name", "amount": number}]`;

    try {
        const result = await model.generateContent(prompt);
        const rawText = result.response.text();
        console.log(`🤖 [AI Settlement] Raw Response: ${rawText}`);

        // Robust JSON extraction
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("No JSON array found");
        
        const settlements = JSON.parse(jsonMatch[0]);
        
        for (const debt of settlements) {
            const addr = userRegistry[debt.creditor.toLowerCase()];
            if (addr) {
                const miniAppUrl = `${APP_URL}/pay?address=${addr}&amount=${debt.amount}&debtor=${encodeURIComponent(debt.debtor)}&creditor=${encodeURIComponent(debt.creditor)}&chatId=${ctx.chat.id}`;
                await ctx.reply(
                    `💰 **${debt.debtor}** owes **${debt.creditor}** ${debt.amount} USDC\n\n📱 **Settle in MiniPay (Developer Mode):**\nCopy the link below and paste it into MiniPay's "Load Test Page" input:\n\n\`${miniAppUrl}\``,
                    { 
                        parse_mode: 'Markdown',
                        link_preview_options: { is_disabled: true }
                    }
                );
            }
        }
    } catch (e: any) { 
        console.error(`❌ AI Settlement Error: ${e.message}`);
        ctx.reply("❌ AI calculation failed. Please try again."); 
    }
});

bot.command('history', async (ctx) => {
    if (tripTransactions.length === 0) return ctx.reply("ℹ️ No expenses logged yet.");
    
    let summary = "📋 **Trip Expense History**\n\n";
    let total = 0;
    
    tripTransactions.forEach((t, i) => {
        const isSettlement = t.description && t.description.toLowerCase().includes('settled debt');
        const icon = isSettlement ? '💸' : '🛒';
        summary += `${i + 1}. ${icon} **${t.payer}**: ${t.amount} USDC for ${t.description}\n`;
        if (!isSettlement) {
            total += Number(t.amount || 0);
        }
    });
    
    summary += `\n💰 **Actual Total Spent**: ${total.toFixed(2)} USDC`;
    
    const statusMsg = await ctx.reply(summary + "\n\n📊 *Analyzing current balances...*", { parse_mode: 'Markdown' });

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const analysisPrompt = `Transactions Log: ${JSON.stringify(tripTransactions)}. Give a very brief, friendly conversational summary of the current group balances. Who is owed money? Who still owes money? Ignore settled debts. Format with clean spacing and emojis. No extra intro/outro text.`;
        const result = await model.generateContent(analysisPrompt);
        
        await ctx.telegram.editMessageText(
            ctx.chat.id, 
            statusMsg.message_id, 
            undefined, 
            summary + `\n\n📊 **Live Balance Tracker:**\n${result.response.text()}`, 
            { parse_mode: 'Markdown' }
        );
    } catch(e) {
        // Fallback if AI fails
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, summary, { parse_mode: 'Markdown' });
    }
});

bot.on(['text', 'voice'], async (ctx: any) => {
    const text = ctx.message.text || '';
    if (text.startsWith('/')) return;
    
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const res = await model.generateContent(`Extract expense from: "${text || 'Audio message'}". Return raw JSON: {"payer": "${ctx.from.first_name}", "amount": num, "description": "text"}. If no expense found, return NULL.`);
        const content = res.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        if (content === 'NULL') return;
        
        const expense = JSON.parse(content);
        if (!expense.amount) return;
        
        tripTransactions.push(expense);
        const cid = await vault.saveState({ transactions: tripTransactions, registry: userRegistry });
        console.log(`✅ [State Saved] IPFS Hash: ${cid}`);
        await ctx.reply(`✅ Logged: ${expense.payer} paid ${expense.amount} for ${expense.description}.`);
    } catch (e) {}
});

async function boot() {
    await vault.setup();
    
    // Auto-Recovery of Persistent Memory
    const lastState = await vault.getLatestState();
    if (lastState) {
        tripTransactions = lastState.transactions || [];
        userRegistry = lastState.registry || {};
        console.log(`📡 [Persistence] Recovered ${tripTransactions.length} transactions and ${Object.keys(userRegistry).length} users from AgentVault.`);
    }

    bot.launch();
    console.log('🌟 SplitBot ONLINE');
}
boot().catch(console.error);
