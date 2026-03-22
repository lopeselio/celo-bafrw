import axios from 'axios';
import 'dotenv/config';

async function wipeMemory() {
  const pinataKey = process.env.PINATA_API_KEY!;
  const pinataSecret = process.env.PINATA_SECRET_API_KEY!;
  const agentId = 'SplitBot_v2_Production';

  console.log(`🧨 [Wipe] Searching for all memory pins for ${agentId}...`);
  
  try {
    const res = await axios.get(`https://api.pinata.cloud/data/pinList?status=pinned&metadata[name]=AgentMemory_${agentId}_&pageLimit=100`, {
      headers: { 'pinata_api_key': pinataKey, 'pinata_secret_api_key': pinataSecret }
    });
    
    if (res.data.rows?.length === 0) {
        console.log("ℹ️ No pins found for this agent.");
        return;
    }

    console.log(`💣 Found ${res.data.rows.length} pins to delete.`);
    
    for (const row of res.data.rows) {
      console.log(`🔥 [Unpinning] CID: ${row.ipfs_pin_hash}`);
      try {
        await axios.delete(`https://api.pinata.cloud/pinning/unpin/${row.ipfs_pin_hash}`, {
            headers: { 'pinata_api_key': pinataKey, 'pinata_secret_api_key': pinataSecret }
        });
      } catch (e: any) {
        console.warn(`⚠️ Failed to unpin ${row.ipfs_pin_hash}`);
      }
    }
    
    console.log(`\n✅ [RESET COMPLETE] Agent memory is now empty.`);
    console.log(`🚀 Your next bot launch will start from 0 transactions.`);
    
  } catch (err: any) {
    console.error(`❌ [Wipe] Critical Error: ${err.message}`);
  }
}

wipeMemory();
