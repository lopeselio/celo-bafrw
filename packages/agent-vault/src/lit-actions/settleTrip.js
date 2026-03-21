/**
 * settleTrip.js
 * 
 * A Lit Action that executes in a Trusted Execution Environment (TEE).
 * It calculates and signs a settlement transaction for the TripEscrow.sol contract on Celo.
 * 
 * Parameters (passed via jsParams):
 * - escrowAddress: The Celo address of the TripEscrow contract.
 * - payee: The wallet address of the person being reimbursed.
 * - amount: The numeric amount to settle (in wei).
 * - description: A short string explaining the expense.
 * - chain: 'celo'
 */

const go = async () => {
  // 1. Verify the state (Optional: Fetch IPFS ledger here to verify amount vs history)
  // For this prototype, we'll demonstrate the conditional signing.
  // We check if the amount is within a 'safe' range for an automated agent action.
  const MAX_SAFE_SETTLE = ethers.utils.parseUnits("500", 18); // 500 USDC
  
  if (ethers.BigNumber.from(amount).gt(MAX_SAFE_SETTLE)) {
    throw new Error("Lit Action: Security limit exceeded. Manual organizer approval required.");
  }

  // 2. Prepare the transaction for TripEscrow.settleExpense(payee, amount, description)
  const iface = new ethers.utils.Interface([
    "function settleExpense(address payee, uint256 amount, string calldata description)"
  ]);
  
  const txData = iface.encodeFunctionData("settleExpense", [
    payee,
    amount,
    description
  ]);

  // 3. Request the network to sign the transaction hash
  // This uses a decentralized Threshold Signature Scheme (TSS)
  const sigShare = await Lit.Actions.signEthers({
    toAddress: escrowAddress,
    data: txData,
    chainId: 44787, // Celo Alfajores Testnet (or 42220 for Mainnet)
    requestSerializer: true
  });

  // 4. Return the signature results to the client
  Lit.Actions.setResponse({ response: JSON.stringify({ sigShare, txData }) });
};

go();
