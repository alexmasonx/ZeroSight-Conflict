import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/GameHeader.css';

export function GameHeader() {
  return (
    <header className="game-header">
      <div className="game-header__content">
        <div>
          <p className="game-header__eyebrow">Fully Homomorphic Multiplayer</p>
          <h1 className="game-header__title">ZeroSight Grid</h1>
          <p className="game-header__description">
            Explore a 10×10 encrypted world where every coordinate lives on-chain. Join to receive a random position,
            decrypt it locally, and move without revealing anything publicly.
          </p>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
