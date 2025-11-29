# ZeroSight Grid

ZeroSight Grid is a 10x10 on-chain map game where every coordinate is encrypted end-to-end with Zama's FHE stack. Players join to receive random encrypted coordinates, move across the grid without exposing their path, and decrypt their exact location locally through the relayer-based flow.

## Why it matters
- Preserves location privacy on-chain by keeping all positions encrypted at rest and in transit.
- Ensures fairness with on-chain random spawning and clamped movements that respect the 1-10 grid bounds.
- Gives users full control of decryption via user-signed requests to the Zama relayer with no server-side secrets or mock data.
- Demonstrates a practical pattern for building reactive FHE applications with a Hardhat + React toolchain.

## Key advantages
- **Fully homomorphic positions**: Coordinates are stored as `euint8` values; reads never expose plaintext, and the contract never branches on public data.
- **Randomized onboarding**: New players call `joinGame` to mint a random encrypted `(x, y)` produced on-chain with `FHE.randEuint8`, bounded to the 10x10 grid.
- **Bounded encrypted moves**: Players submit encrypted inputs; the contract clamps out-of-range values to maintain invariant limits.
- **Self-service decryption**: Users sign an EIP-712 message and request decryption from the relayer, revealing only their own coordinates.
- **Production-ready frontend**: React + Vite UI with RainbowKit for wallet connect, viem for reads, ethers for writes, and Zama relayer SDK for encryption/decryption (no environment variables or localhost networks in the UI).
- **Automation and tests**: Hardhat tasks cover join/move/decrypt flows; unit tests validate random spawn, bounds clamping, and duplicate join prevention on the FHEVM mock.

## Tech stack
- **On-chain**: Solidity 0.8.27, `@fhevm/solidity`, Hardhat + hardhat-deploy, TypeChain, Chai.
- **Encryption**: Zama FHEVM, encrypted types (`euint8`, `externalEuint8`), `FHE.randEuint8`, relayer-based user decryption.
- **Frontend**: React + Vite, wagmi/viem (reads), ethers (writes), RainbowKit, Zama relayer SDK.
- **Tooling**: TypeScript, ESLint, Prettier, Solidity coverage, gas reporter.

## Repository layout
- `contracts/EncryptedMapGame.sol` - core game logic with encrypted coordinates, random spawn, and clamped moves.
- `deploy/deploy.ts` - deployment entrypoint for hardhat-deploy.
- `tasks/encryptedMap.ts` - CLI tasks for joining, moving, and decrypting positions.
- `test/EncryptedMapGame.ts` - unit tests on the FHEVM mock network.
- `deployments/` - deployment artifacts and the canonical ABI to mirror into the frontend.
- `app/` - React client (no Tailwind, no env vars) that reads via viem and writes via ethers.
- `docs/zama_llm.md`, `docs/zama_doc_relayer.md` - reference material for Zama contracts and relayer usage.

## Getting started (contracts/backend)
### Prerequisites
- Node.js 20+ and npm.
- A funded Sepolia account for live deployments.
- `.env` in the repo root with Infura and a private key (mnemonics are intentionally unsupported):
  ```
  PRIVATE_KEY=0xabc...            # single hex private key, no MNEMONIC
  INFURA_API_KEY=your_infura_key
  ETHERSCAN_API_KEY=optional_for_verification
  ```

### Install
```bash
npm install                  # root (contracts and tasks)
cd app && npm install        # frontend
```

### Common commands
- Compile contracts: `npm run compile`
- Run tests on the FHEVM mock: `npm test`
- Lint Solidity/TS: `npm run lint`
- Coverage: `npm run coverage`
- Start a local node: `npm run chain`

### Local development loop
1. Start the Hardhat node: `npm run chain`.
2. Deploy locally: `npm run deploy:localhost`.
3. (Optional) Interact through tasks:
   - Print address: `npx hardhat task:map-address --network localhost`
   - Join: `npx hardhat task:join-map --network localhost`
   - Move: `npx hardhat task:move-player --x 4 --y 6 --network localhost`
   - Decrypt: `npx hardhat task:decrypt-position --network localhost`

### Deploy to Sepolia
1. Ensure `.env` is populated with `PRIVATE_KEY` and `INFURA_API_KEY`.
2. Deploy: `npm run deploy:sepolia`.
3. (Optional) Verify: `npm run verify:sepolia -- <contract_address>`.
4. Copy the freshly generated address and ABI from `deployments/sepolia/EncryptedMapGame.json` into the frontend config (see next section).

## Frontend (app/)
1. Install deps: `cd app && npm install` (only once).
2. Configure the contract:
   - Update `app/src/config/contracts.ts` with the Sepolia `CONTRACT_ADDRESS`.
   - Replace `CONTRACT_ABI` with the ABI array from `deployments/sepolia/EncryptedMapGame.json`. Do not import the JSON file directly.
3. Run the UI: `npm run dev` (the client is wired to Sepolia via wagmi; no localhost network or env vars are used).
4. User flow:
   - Connect a Sepolia wallet with RainbowKit.
   - **Join**: calls `joinGame`, minting random encrypted coordinates.
   - **Move**: encrypts `(x, y)` locally with the relayer SDK, submits to `move`, and refreshes handles.
   - **Decrypt**: signs an EIP-712 request, fetches plaintext coordinates from the relayer, and highlights your cell on the grid.

## How the encrypted game works
- **Join**: `_randomPosition()` uses `FHE.randEuint8` to generate encrypted values, clamps them to 1-10, stores them, and grants decrypt access to the contract and player.
- **Move**: Users send `externalEuint8` handles plus an `inputProof`; the contract validates, clamps to bounds, stores, and refreshes access control.
- **Read**: `getPlayerPosition(address)` returns encrypted handles without referencing `msg.sender` inside the view, keeping reads permissionless but private.
- **Decrypt**: The frontend pairs handles with the contract address and uses `userDecrypt` to reveal only the caller's coordinates.

## Problems solved
- Hides player positions on-chain, eliminating data leakage from events or storage.
- Prevents coordinate spam and off-grid writes by clamping encrypted inputs server-side.
- Removes trust in off-chain randomness; spawning happens fully on-chain with FHE randomness.
- Provides a reproducible pattern for mixing viem (reads) and ethers (writes) with encrypted payloads.

## Roadmap ideas
- Expand grid size and introduce multi-map support driven by configurable bounds.
- Add turn-based actions (e.g., pickups or encounters) processed on encrypted state.
- Integrate zk-proofed scoreboards without revealing locations.
- Improve observability with structured events for off-chain indexing while keeping payloads encrypted.
- Add UI refinements: history of your decrypted positions and confirmations for relayer responses.

## Resources
- Contract docs: `docs/zama_llm.md`
- Relayer docs: `docs/zama_doc_relayer.md`
- Hardhat FHEVM plugin: https://docs.zama.ai/protocol/solidity-guides/development-guide/hardhat

## License
BSD-3-Clause-Clear. See `LICENSE`.
