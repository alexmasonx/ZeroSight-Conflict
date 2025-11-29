import { useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, useReadContract } from 'wagmi';
import { GameHeader } from './GameHeader';
import { MapGrid } from './MapGrid';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import '../styles/GridGameApp.css';

type DecryptedPosition = {
  x: number;
  y: number;
};

export function GridGameApp() {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [selectedX, setSelectedX] = useState(1);
  const [selectedY, setSelectedY] = useState(1);
  const [isJoining, setIsJoining] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [txError, setTxError] = useState<string | null>(null);
  const [decryptedPosition, setDecryptedPosition] = useState<DecryptedPosition | null>(null);
  const isContractConfigured = CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';

  const { data: joined, refetch: refetchJoined, isFetching: checkingJoin } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'hasJoined',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && isContractConfigured),
    },
  });

  const { data: encryptedPosition, refetch: refetchPosition } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getPlayerPosition',
    args: address && joined ? [address] : undefined,
    query: {
      enabled: Boolean(address && joined && isContractConfigured),
    },
  });

  const contractHandles = useMemo(
    () => ({
      x: encryptedPosition?.[0] as string | undefined,
      y: encryptedPosition?.[1] as string | undefined,
    }),
    [encryptedPosition]
  );

  const playerJoined = Boolean(joined);

  const handleJoin = async () => {
    if (!address) {
      setTxError('Connect your wallet to start playing.');
      return;
    }
    if (!signerPromise) {
      setTxError('Wallet signer is unavailable.');
      return;
    }
    if (!isContractConfigured) {
      setTxError('Deploy EncryptedMapGame to Sepolia and update CONTRACT_ADDRESS.');
      return;
    }

    try {
      setTxError(null);
      setStatusMessage('Waiting for wallet confirmation...');
      setIsJoining(true);

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer is missing');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.joinGame();
      setStatusMessage('Confirming transaction...');
      await tx.wait();
      setStatusMessage('Player joined. Fetching map data...');
      await refetchJoined();
      await refetchPosition();
      setStatusMessage('');
    } catch (error) {
      console.error('Failed to join game', error);
      setTxError(error instanceof Error ? error.message : 'Join request failed');
      setStatusMessage('');
    } finally {
      setIsJoining(false);
    }
  };

  const handleMove = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!address) {
      setTxError('Connect your wallet to move.');
      return;
    }
    if (!playerJoined) {
      setTxError('Join the grid before moving.');
      return;
    }
    if (!instance) {
      setTxError('Encryption service is still starting.');
      return;
    }
    if (!signerPromise) {
      setTxError('Wallet signer is unavailable.');
      return;
    }
    if (!isContractConfigured) {
      setTxError('Deploy EncryptedMapGame to Sepolia and update CONTRACT_ADDRESS.');
      return;
    }

    try {
      setTxError(null);
      setStatusMessage('Encrypting coordinates...');
      setIsMoving(true);

      const payload = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      payload.add8(BigInt(selectedX));
      payload.add8(BigInt(selectedY));
      const encryptedInput = await payload.encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer is missing');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.move(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      setStatusMessage('Confirming move transaction...');
      await tx.wait();
      setStatusMessage('Position updated. Refreshing data...');
      setDecryptedPosition(null);
      await refetchPosition();
      setStatusMessage('');
    } catch (error) {
      console.error('Failed to move player', error);
      setTxError(error instanceof Error ? error.message : 'Move request failed');
      setStatusMessage('');
    } finally {
      setIsMoving(false);
    }
  };

  const handleDecrypt = async () => {
    if (!instance || !address || !contractHandles.x || !contractHandles.y || !signerPromise) {
      setTxError('Missing encryption context for decryption.');
      return;
    }
    if (!isContractConfigured) {
      setTxError('Deploy EncryptedMapGame to Sepolia and update CONTRACT_ADDRESS.');
      return;
    }

    try {
      setIsDecrypting(true);
      setTxError(null);
      setStatusMessage('Preparing secure channel...');

      const keypair = instance.generateKeypair();
      const contractAddresses = [CONTRACT_ADDRESS];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const eip712 = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays
      );

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer is missing');
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message
      );

      const handleContractPairs = [
        { handle: contractHandles.x, contractAddress: CONTRACT_ADDRESS },
        { handle: contractHandles.y, contractAddress: CONTRACT_ADDRESS },
      ];

      setStatusMessage('Requesting decryption from relayer...');
      const decrypted = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      const plainX = Number(decrypted[contractHandles.x]);
      const plainY = Number(decrypted[contractHandles.y]);
      setDecryptedPosition({ x: plainX, y: plainY });
      setStatusMessage('');
    } catch (error) {
      console.error('Failed to decrypt position', error);
      setTxError(error instanceof Error ? error.message : 'Decryption failed');
      setStatusMessage('');
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="grid-game">
      <GameHeader />
      <main className="grid-game__layout">
        <section className="grid-game__left">
          <MapGrid size={10} highlight={decryptedPosition} />
          <div className="grid-game__info">
            <div>
              <p className="info-label">Grid size</p>
              <p className="info-value">10 × 10</p>
            </div>
            <div>
              <p className="info-label">Status</p>
              <p className={`info-value ${playerJoined ? 'info-value--active' : ''}`}>
                {checkingJoin ? 'Checking...' : playerJoined ? 'On-chain' : 'Waiting'}
              </p>
            </div>
            <div>
              <p className="info-label">Zama SDK</p>
              <p className={`info-value ${!zamaLoading && !zamaError ? 'info-value--active' : ''}`}>
                {zamaLoading ? 'Initializing...' : zamaError ? 'Unavailable' : 'Ready'}
              </p>
            </div>
          </div>
        </section>

        <section className="grid-game__right">
          <div className="control-card">
            <h2>Join the encrypted world</h2>
            <p>
              Once connected, mint your random location directly on-chain. Only you can decrypt your coordinates.
            </p>
            <button
              onClick={handleJoin}
              disabled={!address || isJoining || playerJoined}
              className="primary-button"
            >
              {isJoining ? 'Joining...' : playerJoined ? 'Already joined' : 'Join with randomness'}
            </button>
          </div>

          <form className="control-card" onSubmit={handleMove}>
            <div className="control-card__header">
              <div>
                <h2>Move across the map</h2>
                <p>Coordinates are encrypted locally before they ever touch the blockchain.</p>
              </div>
            </div>
            <div className="coordinate-inputs">
              <label>
                X Position
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={selectedX}
                  onChange={(event) => setSelectedX(Number(event.target.value))}
                />
              </label>
              <label>
                Y Position
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={selectedY}
                  onChange={(event) => setSelectedY(Number(event.target.value))}
                />
              </label>
            </div>
            <button
              type="submit"
              className="primary-button"
              disabled={!playerJoined || isMoving || !instance}
            >
              {isMoving ? 'Encrypting...' : 'Submit encrypted move'}
            </button>
          </form>

          <div className="control-card">
            <h2>Decrypt your location</h2>
            <p>
              Use Zama&apos;s relayer to decrypt the encrypted handles that live in the contract and reveal your exact
              coordinates locally.
            </p>
            <button
              onClick={handleDecrypt}
              disabled={!contractHandles.x || !contractHandles.y || isDecrypting || !instance}
              className="secondary-button"
            >
              {isDecrypting ? 'Decrypting...' : 'Decrypt my position'}
            </button>
            {decryptedPosition && (
              <div className="decrypted-result">
                <p>Your coordinates</p>
                <strong>
                  X: {decryptedPosition.x}, Y: {decryptedPosition.y}
                </strong>
              </div>
            )}
          </div>

          <div className="control-card">
            <h3>Encrypted handles</h3>
            <div className="handles">
              <div>
                <p>X Handle</p>
                <code>{contractHandles.x ? `${contractHandles.x.slice(0, 18)}…` : '—'}</code>
              </div>
              <div>
                <p>Y Handle</p>
                <code>{contractHandles.y ? `${contractHandles.y.slice(0, 18)}…` : '—'}</code>
              </div>
            </div>
          </div>

          {(!isContractConfigured || statusMessage || txError || zamaError) && (
            <div className="system-messages">
              {!isContractConfigured && (
                <p className="error-text">
                  Contract address is not configured. Deploy to Sepolia and update <code>CONTRACT_ADDRESS</code>.
                </p>
              )}
              {statusMessage && <p>{statusMessage}</p>}
              {txError && <p className="error-text">{txError}</p>}
              {zamaError && <p className="error-text">{zamaError}</p>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
