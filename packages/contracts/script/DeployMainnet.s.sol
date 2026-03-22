// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/TripEscrow.sol";

contract DeployTripEscrow is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address usdc = 0x765DE816845861e75A25fCA122bb6898B8B1282a;
        address agent = 0xaAf16AD8a1258A98ed77A5129dc6A8813924Ad3C;

        vm.startBroadcast(deployerPrivateKey);
        new TripEscrow(usdc, agent);
        vm.stopBroadcast();
    }
}
