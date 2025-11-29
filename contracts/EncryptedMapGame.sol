// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title EncryptedMapGame
/// @notice Multiplayer map where every position is stored and updated with FHE-encrypted coordinates.
contract EncryptedMapGame is ZamaEthereumConfig {
    uint8 private constant MIN_COORDINATE = 1;
    uint8 private constant MAX_COORDINATE = 10;

    struct PlayerPosition {
        euint8 x;
        euint8 y;
        bool active;
    }

    mapping(address => PlayerPosition) private _players;

    error PlayerAlreadyJoined();
    error PlayerNotRegistered();

    event PlayerJoined(address indexed player);
    event PlayerMoved(address indexed player);

    /// @notice Returns whether the player already joined the encrypted map.
    /// @param player player address to inspect
    function hasJoined(address player) external view returns (bool) {
        return _players[player].active;
    }

    /// @notice Joins the game and assigns a random encrypted position between 1 and 10 on each axis.
    function joinGame() external {
        PlayerPosition storage player = _players[msg.sender];
        if (player.active) {
            revert PlayerAlreadyJoined();
        }

        (player.x, player.y) = _randomPosition();
        player.active = true;

        _grantAccess(player, msg.sender);
        emit PlayerJoined(msg.sender);
    }

    /// @notice Moves the caller to a new encrypted position.
    /// @param encryptedX encrypted x coordinate
    /// @param encryptedY encrypted y coordinate
    /// @param inputProof proof validating the encrypted payload
    function move(externalEuint8 encryptedX, externalEuint8 encryptedY, bytes calldata inputProof) external {
        PlayerPosition storage player = _players[msg.sender];
        if (!player.active) {
            revert PlayerNotRegistered();
        }

        euint8 nextX = _clampCoordinate(FHE.fromExternal(encryptedX, inputProof));
        euint8 nextY = _clampCoordinate(FHE.fromExternal(encryptedY, inputProof));

        player.x = nextX;
        player.y = nextY;

        _grantAccess(player, msg.sender);
        emit PlayerMoved(msg.sender);
    }

    /// @notice Returns the encrypted coordinates of a specific player.
    /// @dev msg.sender is intentionally not used inside this view method.
    /// @param player address of the player to query
    function getPlayerPosition(address player) external view returns (euint8, euint8) {
        PlayerPosition storage storedPlayer = _players[player];
        if (!storedPlayer.active) {
            revert PlayerNotRegistered();
        }

        return (storedPlayer.x, storedPlayer.y);
    }

    /// @notice Provides the allowed bounds of the grid.
    /// @return minCoordinate minimum coordinate value (inclusive)
    /// @return maxCoordinate maximum coordinate value (inclusive)
    function gridBounds() external pure returns (uint8 minCoordinate, uint8 maxCoordinate) {
        return (MIN_COORDINATE, MAX_COORDINATE);
    }

    function _randomPosition() private returns (euint8, euint8) {
        return (_randomCoordinate(), _randomCoordinate());
    }

    function _randomCoordinate() private returns (euint8) {
        euint8 randomValue = FHE.randEuint8();
        euint32 randomAs32 = FHE.asEuint32(randomValue);
        euint32 bounded = FHE.rem(randomAs32, MAX_COORDINATE);
        euint32 shifted = FHE.add(bounded, FHE.asEuint32(MIN_COORDINATE));
        return FHE.asEuint8(shifted);
    }

    function _grantAccess(PlayerPosition storage player, address owner) private {
        FHE.allowThis(player.x);
        FHE.allowThis(player.y);
        FHE.allow(player.x, owner);
        FHE.allow(player.y, owner);
    }

    function _clampCoordinate(euint8 coordinate) private returns (euint8) {
        euint8 minValue = FHE.asEuint8(MIN_COORDINATE);
        euint8 maxValue = FHE.asEuint8(MAX_COORDINATE);

        ebool belowMinimum = FHE.lt(coordinate, minValue);
        euint8 boundedMin = FHE.select(belowMinimum, minValue, coordinate);

        ebool aboveMaximum = FHE.gt(boundedMin, maxValue);
        return FHE.select(aboveMaximum, maxValue, boundedMin);
    }
}
