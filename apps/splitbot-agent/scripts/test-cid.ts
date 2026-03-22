import axios from 'axios';

async function test() {
  const cid = 'QmYR84tAHveR1MFubCcYLQMvxhoHeXiVzcGFANptBbwasd';
  const res = await axios.get(`https://gateway.pinata.cloud/ipfs/${cid}`);
  console.log(JSON.stringify(res.data, null, 2));
  
  if (res.data.encryptedData) {
    const decrypted = Buffer.from(res.data.encryptedData, 'base64').toString();
    console.log('Decrypted:', decrypted);
  }
}

test();
