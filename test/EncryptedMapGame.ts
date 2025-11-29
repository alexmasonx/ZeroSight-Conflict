import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { EncryptedMapGame, EncryptedMapGame__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EncryptedMapGame")) as EncryptedMapGame__factory;
  const encryptedMap = (await factory.deploy()) as EncryptedMapGame;
  const address = await encryptedMap.getAddress();

  return { encryptedMap, address };
}

describe("EncryptedMapGame", function () {
  let signers: Signers;
  let encryptedMap: EncryptedMapGame;
  let contractAddress: string;

  before(async function () {
    const ethSigners = (await ethers.getSigners()) as HardhatEthersSigner[];
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs only on the FHEVM mock network");
      this.skip();
    }

    ({ encryptedMap, address: contractAddress } = await deployFixture());
  });

  it("blocks queries for non-registered players", async function () {
    await expect(encryptedMap.getPlayerPosition(signers.alice.address)).to.be.revertedWithCustomError(
      encryptedMap,
      "PlayerNotRegistered",
    );
  });

  it("assigns random coordinates within bounds when joining", async function () {
    await encryptedMap.connect(signers.alice).joinGame();
    expect(await encryptedMap.hasJoined(signers.alice.address)).to.eq(true);

    const position = await encryptedMap.getPlayerPosition(signers.alice.address);
    const decryptedX = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      position[0],
      contractAddress,
      signers.alice,
    );
    const decryptedY = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      position[1],
      contractAddress,
      signers.alice,
    );

    expect(decryptedX).to.be.gte(1);
    expect(decryptedX).to.be.lte(10);
    expect(decryptedY).to.be.gte(1);
    expect(decryptedY).to.be.lte(10);
  });

  it("prevents the same wallet from joining twice", async function () {
    await encryptedMap.connect(signers.alice).joinGame();
    await expect(encryptedMap.connect(signers.alice).joinGame()).to.be.revertedWithCustomError(
      encryptedMap,
      "PlayerAlreadyJoined",
    );
  });

  it("moves the player to custom coordinates using encrypted inputs", async function () {
    await encryptedMap.connect(signers.alice).joinGame();

    const encryptedPayload = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(7n)
      .add8(8n)
      .encrypt();

    await encryptedMap
      .connect(signers.alice)
      .move(encryptedPayload.handles[0], encryptedPayload.handles[1], encryptedPayload.inputProof);

    const position = await encryptedMap.getPlayerPosition(signers.alice.address);
    const decryptedX = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      position[0],
      contractAddress,
      signers.alice,
    );
    const decryptedY = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      position[1],
      contractAddress,
      signers.alice,
    );

    expect(decryptedX).to.eq(7);
    expect(decryptedY).to.eq(8);
  });

  it("clamps out-of-range coordinates to the grid bounds", async function () {
    await encryptedMap.connect(signers.alice).joinGame();

    const encryptedPayload = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(0n)
      .add8(42n)
      .encrypt();

    await encryptedMap
      .connect(signers.alice)
      .move(encryptedPayload.handles[0], encryptedPayload.handles[1], encryptedPayload.inputProof);

    const position = await encryptedMap.getPlayerPosition(signers.alice.address);

    const decryptedX = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      position[0],
      contractAddress,
      signers.alice,
    );
    const decryptedY = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      position[1],
      contractAddress,
      signers.alice,
    );

    expect(decryptedX).to.eq(1);
    expect(decryptedY).to.eq(10);
  });
});
