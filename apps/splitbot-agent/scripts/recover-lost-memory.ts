import axios from 'axios';
import 'dotenv/config';

async function recoverAndMerge() {
  const pinataKey = process.env.PINATA_API_KEY!;
  const pinataSecret = process.env.PINATA_SECRET_API_KEY!;
  const agentId = 'SplitBot_v2_Production';
  const dedicatedGateway = 'https://bronze-disabled-tyrannosaurus-480.mypinata.cloud';

  console.log(`🔍 [Recovery] Scanning Pinata and Merging State...`);
  
  try {
    const res = await axios.get(`https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=20&sort=DESC`, {
      headers: { 'pinata_api_key': pinataKey, 'pinata_secret_api_key': pinataSecret }
    });
    
    let allTransactions: any[] = [];
    let mergedRegistry: any = {};
    
    for (const row of res.data.rows) {
      const cid = row.ipfs_pin_hash;
      console.log(`📥 [Checking] ${cid} (${row.metadata.name || 'Unnamed'})`);
      
      try {
        // Use Dedicated Gateway to avoid 429
        const pinRes = await axios.get(`${dedicatedGateway}/ipfs/${cid}?key=${pinataKey}`, { timeout: 5000 });
        const data = pinRes.data;
        
        let state: any = null;
        if (data.encryptedData) {
          const decrypted = Buffer.from(data.encryptedData, 'base64').toString();
          state = JSON.parse(decrypted);
        } else if (data.transactions) {
          state = data;
        }

        if (state && state.transactions) {
          state.transactions.forEach((tx: any) => {
            const txKey = `${tx.payer}-${tx.amount}-${tx.description}`;
            if (!allTransactions.some(t => `${t.payer}-${t.amount}-${t.description}` === txKey)) {
              allTransactions.push(tx);
              console.log(` ✨ Found: ${tx.payer} - ${tx.amount}`);
            }
          });
          mergedRegistry = { ...state.registry, ...mergedRegistry };
        }
      } catch (e: any) {
        console.warn(` ⚠️ Skip ${cid} (Rate limited or not a state file)`);
      }
    }
    
    if (allTransactions.length > 0) {
      const finalState = { transactions: allTransactions, registry: mergedRegistry };
      const payload = { 
        pinataMetadata: { name: `AgentMemory_${agentId}_RECOVERED_${Date.now()}` },
        pinataContent: { 
            encryptedData: Buffer.from(JSON.stringify(finalState)).toString('base64'),
            litHash: "mockHash" 
        } 
      };
      
      const uploadRes = await axios.post(`https://api.pinata.cloud/pinning/pinJSONToIPFS`, payload, {
        headers: { 'pinata_api_key': pinataKey, 'pinata_secret_api_key': pinataSecret }
      });
      
      console.log(`\n✅ [RECOVERED] ${allTransactions.length} transactions merged!`);
      console.log(`🆔 New Master CID: ${uploadRes.data.IpfsHash}`);
      console.log(`🚀 RESTART npm run dev now.`);
    } else {
        console.log("❌ No transactions found to recover.");
    }
    
  } catch (err: any) {
    console.error(`❌ [Recovery] Critical Error: ${err.message}`);
  }
}

recoverAndMerge();
