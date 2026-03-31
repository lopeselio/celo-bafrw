// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ConfidentialSplitLedger
 * @notice Homomorphic running net per trip (e.g. fixed-point cents). Encrypt deltas off-chain with Zama relayer SDK.
 * @dev Deploy to Ethereum Sepolia for Zama fhEVM (coprocessor addresses in Zama docs). Inherits `ZamaEthereumConfig`.
 */
contract ConfidentialSplitLedger is ZamaEthereumConfig {
    mapping(bytes32 => euint32) private _tripNet;

    function getTripNet(bytes32 tripId) external view returns (euint32) {
        return _tripNet[tripId];
    }

    /// @notice Add an encrypted delta to the trip's running net (e.g. owed amount change).
    function addEncryptedNet(bytes32 tripId, externalEuint32 delta, bytes calldata inputProof) external {
        euint32 d = FHE.fromExternal(delta, inputProof);
        _tripNet[tripId] = FHE.add(_tripNet[tripId], d);
        FHE.allowThis(_tripNet[tripId]);
        FHE.allow(_tripNet[tripId], msg.sender);
    }
}
