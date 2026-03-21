import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { GoogleGenerativeAI } from '@google/generative-ai';
// @ts-ignore
import { AgentVault } from './AgentVault';

// Validations
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const geminiKey = process.env.GEMINI_API_KEY;
if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN missing!");
if (!geminiKey) throw new Error("GEMINI_API_KEY missing!");

// Initializations
const bot = new Telegraf(botToken);
const genAI = new GoogleGenerativeAI(geminiKey);
const vault = new AgentVault('0x1A2B3c4D5e6F7g8H9I0J1K2L3M4N5O6P');

// In-Memory state buffer before batching to IPFS
let tripTransactions: any[] = [];

// A mock address book for the demo (since Telegram users don't have wallets natively attached yet)
const walletBook: Record<string, string> = {
    "alice": "0x2e06EB9984920BAde2A3A69C2f84E8F80bb2913A",
    "bob": "0x81B2B6eDb6ACbd6203D002B4EbCdA1ED1e909aab",
    "charlie": "0x91Fdf1D1f0458bCc84C1C4a754b2cfb6f91ED1e9"
};

/**
 * Parses conversational text into structured JSON using Google Gemini
 */
async function parseExpenseWithGemini(user: string, text: string) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
    You are an AI Agent managing a group trip. 
    The user ${user} just sent this message: "${text}"
    Extract the financial expense. They might use different currencies, but assume USDC if not specified.
    Return strictly a raw JSON object (No markdown formatting) with these exact keys:
    {
        "payer": "name of who paid",
        "amount": numeric_amount,
        "description": "what it was for"
    }
    If it's not a financial message, return {"error": "not an expense"}.
    `;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(responseText);
}

/**
 * Asks Gemini to do the complex math to net out all debts for the group
 */
async function calculateSettlementsWithGemini(transactions: any[]) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
    Analyze this list of group trip transactions:
    ${JSON.stringify(transactions)}
    
    Calculate exactly who owes whom to settle all debts optimally (fewest transactions).
    Assume expenses are split evenly among everyone who has been mentioned so far.
    Return strictly a raw JSON array (No markdown formatting) structured like this:
    [
        { "debtor": "name", "creditor": "name", "amount": numeric }
    ]
    `;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(responseText);
}

// ----------------------------------------------------
// HUMAN-TO-AGENT: Telegram Interface 
// ----------------------------------------------------

bot.command('start', (ctx) => {
    ctx.reply("👋 I am your Celo AI Agent powered by Gemini! Tell me what you spend, and I'll settle the debts using MiniPay deep links.");
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text.toLowerCase();
    
    // Ignore commands for the LLM
    if (text.startsWith('/')) {
        if (text === "/settle") {
            await ctx.reply(`🧮 Agent is crunching the numbers using Gemini AI...`);
            
            try {
                // 1. Ask Gemini to solve the debt matrix
                const settlements = await calculateSettlementsWithGemini(tripTransactions);
                
                if (settlements.length === 0) {
                    return ctx.reply("Everyone is completely settled up!");
                }

                // 2. Dynamically build Celo Deep Links for each debt!
                for (const debt of settlements) {
                    const creditorName = debt.creditor.toLowerCase();
                    const debtorName = debt.debtor.toLowerCase();
                    const amount = debt.amount;
                    
                    // Fallback to a zero-address if name isn't in our mock book
                    const address = walletBook[creditorName] || "0x0000000000000000000000000000000000000000";
                    
                    const minipayLink = `https://minipay.xyz/pay?address=${address}&currency=USDC&amount=${amount}`;
                    const valoraLink = `celo://wallet/pay?address=${address}&amount=${amount}&currencyCode=USDC`;

                    await ctx.reply(
                        `💰 **Settlement:**\n\n` +
                        `${debt.debtor}, you owe ${debt.creditor} ${amount} USDC.\n` +
                        `Tap below to execute a zero-gas Agent transfer:\n\n` +
                        `➡️ [Pay via MiniPay](${minipayLink})\n` +
                        `➡️ [Pay via Valora](${valoraLink})`, 
                        { parse_mode: 'Markdown' }
                    );
                }
            } catch (e: any) {
                await ctx.reply(`❌ Agent Math Error: ${e.message}`);
            }
        }
        return;
    }

    // Pass every other text to Gemini to sniff out expenses
    await ctx.reply(`🎙️ AI Agent reading message...`);
    
    try {
        const expense = await parseExpenseWithGemini(ctx.message.from.first_name, text);
        
        if (expense.error) {
            await ctx.reply("Agent: That didn't look like an expense. Ignoring.");
            return;
        }

        // Add to our running buffer
        tripTransactions.push(expense);
        
        // Save the updated state strictly to the Celo AgentVault (Mocked x402 + IPFS)
        const memoryCid = await vault.saveState({
            eventName: "Live Telegram Splitting",
            transactions: tripTransactions
        });
        
        await ctx.reply(`✅ *Agent logged:* ${expense.payer} paid ${expense.amount} for ${expense.description}.\n🔒 Secured on AgentVault IPFS: \`${memoryCid.substring(0,12)}...\``, { parse_mode: 'Markdown' });

    } catch (e: any) {
        await ctx.reply(`❌ Agent Parsing Error: ${e.message}`);
    }
});

async function boot() {
    await vault.setup();
    bot.launch();
    console.log('\n🤖 [Telegram] End-to-End Gemini SplitBot is LIVE!');
}

boot().catch(console.error);
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
