import { expect } from "chai";
import { deployments, ethers, fhevm } from "hardhat";
import { EncryptedMapGame } from "../types";

describe("EncryptedMapGame (Sepolia)", function () {
  let encryptedMap: EncryptedMapGame;

  before(async function () {
    if (fhevm.isMock) {
      this.skip();
    }

    try {
      const deployment = await deployments.get("EncryptedMapGame");
      encryptedMap = (await ethers.getContractAt("EncryptedMapGame", deployment.address)) as EncryptedMapGame;
    } catch (error) {
      (error as Error).message += ". Deploy EncryptedMapGame before running this test.";
      throw error;
    }
  });

  it("returns the expected grid bounds", async function () {
    const [minCoord, maxCoord] = await encryptedMap.gridBounds();
    expect(minCoord).to.eq(1);
    expect(maxCoord).to.eq(10);
  });
});
