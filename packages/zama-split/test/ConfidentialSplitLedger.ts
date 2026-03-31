import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

describe("ConfidentialSplitLedger", function () {
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let ledger: Awaited<ReturnType<typeof deploy>>;

  async function deploy() {
    const Factory = await ethers.getContractFactory("ConfidentialSplitLedger");
    const c = await Factory.deploy();
    await c.waitForDeployment();
    return c;
  }

  before(async function () {
    [deployer, alice] = await ethers.getSigners();
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }
    ledger = await deploy();
  });

  it("adds encrypted net and decrypts sum", async function () {
    const tripId = ethers.id("trip-demo");
    const addr = await ledger.getAddress();

    const delta = 100;
    const enc = await fhevm
      .createEncryptedInput(addr, alice.address)
      .add32(delta)
      .encrypt();

    const tx = await ledger.connect(alice).addEncryptedNet(tripId, enc.handles[0], enc.inputProof);
    await tx.wait();

    const encSum = await ledger.getTripNet(tripId);
    const clear = await fhevm.userDecryptEuint(FhevmType.euint32, encSum, addr, alice);
    expect(clear).to.eq(BigInt(delta));
  });
});
