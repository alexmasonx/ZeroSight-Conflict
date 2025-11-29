import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:map-address", "Prints the EncryptedMapGame address").setAction(async (_taskArguments: TaskArguments, hre) => {
  const { deployments } = hre;

  const encryptedMap = await deployments.get("EncryptedMapGame");
  console.log("EncryptedMapGame address:", encryptedMap.address);
});

task("task:join-map", "Joins the encrypted grid with a random position").setAction(async (_taskArguments, hre) => {
  const { ethers, deployments } = hre;

  const encryptedMapDeployment = await deployments.get("EncryptedMapGame");
  const contract = await ethers.getContractAt("EncryptedMapGame", encryptedMapDeployment.address);
  const [signer] = await ethers.getSigners();

  const tx = await contract.connect(signer).joinGame();
  console.log(`Sent joinGame transaction: ${tx.hash}`);
  await tx.wait();
  console.log("Joined encrypted map with random coordinates");
});

task("task:move-player", "Moves the caller to a new encrypted coordinate")
  .addParam("x", "X coordinate between 1 and 10")
  .addParam("y", "Y coordinate between 1 and 10")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    const encryptedMapDeployment = await deployments.get("EncryptedMapGame");
    const contract = await ethers.getContractAt("EncryptedMapGame", encryptedMapDeployment.address);
    const [signer] = await ethers.getSigners();

    const x = Number(taskArguments.x);
    const y = Number(taskArguments.y);

    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new Error("Both coordinates must be integers");
    }

    await fhevm.initializeCLIApi();

    const encryptedPayload = await fhevm
      .createEncryptedInput(encryptedMapDeployment.address, signer.address)
      .add8(BigInt(x))
      .add8(BigInt(y))
      .encrypt();

    const tx = await contract
      .connect(signer)
      .move(encryptedPayload.handles[0], encryptedPayload.handles[1], encryptedPayload.inputProof);
    console.log(`Sent move transaction: ${tx.hash}`);
    await tx.wait();
    console.log("Player position updated");
  });

task("task:decrypt-position", "Decrypts the caller's stored position")
  .addOptionalParam("player", "Player address. Defaults to first signer")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    const encryptedMapDeployment = await deployments.get("EncryptedMapGame");
    const contract = await ethers.getContractAt("EncryptedMapGame", encryptedMapDeployment.address);
    const [signer] = await ethers.getSigners();

    const playerAddress = (taskArguments.player as string | undefined) ?? (await signer.getAddress());

    const position = await contract.getPlayerPosition(playerAddress);

    await fhevm.initializeCLIApi();
    const decryptedX = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      position[0],
      encryptedMapDeployment.address,
      signer,
    );
    const decryptedY = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      position[1],
      encryptedMapDeployment.address,
      signer,
    );

    console.log(`Decrypted position for ${playerAddress}: (${decryptedX}, ${decryptedY})`);
  });
