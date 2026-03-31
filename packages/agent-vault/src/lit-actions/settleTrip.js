/**
 * TripEscrow.settleExpense on Celo Sepolia — Lit Action using the documented entrypoint pattern.
 *
 * Docs:
 * - Run action (HTTP / Core SDK): https://developer.litprotocol.com/management/api_direct#7-run-lit-action
 * - Action examples (`main` + js_params): https://developer.litprotocol.com/lit-actions/examples
 *
 * js_params (must match keys below; API body uses snake_case `js_params`):
 * - pkpId — PKP identifier (see Lit dashboard; often the PKP wallet address as 0x…)
 * - escrowAddress — TripEscrow contract
 * - payee — creditor address
 * - amount — uint256 string in wei (USDC uses 6 decimals; must match settlement.ts)
 * - description — string passed to settleExpense
 */

async function main({ pkpId, escrowAddress, payee, amount, description }) {
  if (!pkpId) {
    throw new Error('Lit Action settleTrip: pkpId is required in js_params');
  }

  const MAX_SAFE_SETTLE = ethers.utils.parseUnits('500', 6);
  if (ethers.BigNumber.from(amount).gt(MAX_SAFE_SETTLE)) {
    throw new Error('Lit Action: amount exceeds safe automated limit (500 USDC).');
  }

  const rpcUrl = 'https://forno.celo-sepolia.celo-testnet.org';
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const pk = await Lit.Actions.getPrivateKey({ pkpId });
  const wallet = new ethers.Wallet(pk, provider);

  const iface = new ethers.utils.Interface([
    'function settleExpense(address payee, uint256 amount, string calldata description)',
  ]);
  const data = iface.encodeFunctionData('settleExpense', [payee, amount, description]);

  const tx = await wallet.sendTransaction({
    to: escrowAddress,
    data,
    chainId: 11142220,
  });

  const receipt = await tx.wait();
  return {
    txHash: receipt.transactionHash,
    chainId: 11142220,
  };
}
