// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SharkTournament is Ownable {
    IERC20 public immutable token;
    address public treasury;
    
    uint8 public constant MAX_PLAYERS = 15;
    uint8 public constant OWNER_FEE_PERCENTAGE = 10;
    
    struct PlayerStats {
        uint256 score;
        uint8 kills;
        uint256 timestamp;
    }

    struct PlayerView {
        address player;
        uint256 score;
        uint8 kills;
        uint256 timestamp;
    }

    struct Tournament {
        uint256 id;
        uint256 startAt;
        uint256 endAt;
        uint256 entryFee;
        uint256 prizePool;
        bool withdrawn;
        address[] players;
        mapping(address => PlayerStats) stats;
    }

    mapping(uint256 => Tournament) public tournaments;

    event TournamentCreated(uint256 id);
    event TournamentStarted(uint256 id);
    event TournamentEnded(uint256 id);
    event PlayerJoined(uint256 id, address player, uint256 amount);
    event PrizeWithdrawn(uint256 id, uint256 ownerFee, uint256 prizeAmount);

    error TournamentAlreadyExists(uint256 id);
    error TournamentDoesNotExist(uint256 id);
    error TournamentAlreadyStarted(uint256 id);
    error TournamentAlreadyEnded(uint256 id);
    error TournamentNotStarted(uint256 id);
    error PlayerAlreadyJoined(uint256 id);
    error MaxPlayersReached();
    error NotEnoughFunds(uint256 amount);
    error AlreadyWithdrawn();
    error NothingToWithdraw();

    constructor(address _token, address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        token = IERC20(_token);
        treasury = _treasury;
    }

    function createTournament(uint256 _id) external onlyOwner {
        if (tournaments[_id].id != 0) revert TournamentAlreadyExists(_id);

        Tournament storage t = tournaments[_id];
        t.id = _id;
        t.entryFee = 2 * 10 ** 6;

        emit TournamentCreated(_id);
    }

    function startTournament(uint256 _id) external onlyOwner {
        Tournament storage t = tournaments[_id];

        if (t.id == 0) revert TournamentDoesNotExist(_id);
        if (t.startAt != 0) revert TournamentAlreadyStarted(_id);

        t.startAt = block.timestamp;
        emit TournamentStarted(_id);
    }

    function endTournament(uint256 _id) external onlyOwner {
        Tournament storage t = tournaments[_id];
        
        if (t.id == 0) revert TournamentDoesNotExist(_id);
        if (t.endAt != 0) revert TournamentAlreadyEnded(_id);

        t.endAt = block.timestamp;
        emit TournamentEnded(_id);
    }

    function joinTournament(uint256 _id) external {
        Tournament storage t = tournaments[_id];
        
        if (t.id == 0) revert TournamentDoesNotExist(_id);
        if (t.startAt == 0) revert TournamentNotStarted(_id);
        if (t.endAt != 0) revert TournamentAlreadyEnded(_id);
        if (t.players.length >= MAX_PLAYERS) revert MaxPlayersReached();
        if (t.stats[msg.sender].timestamp != 0) revert PlayerAlreadyJoined(_id);

        _collectFee(msg.sender, t.entryFee);

        t.prizePool += t.entryFee;
        t.players.push(msg.sender);
        t.stats[msg.sender].timestamp = block.timestamp;
        
        emit PlayerJoined(_id, msg.sender, t.entryFee);
    }

    function updatePlayerStats(uint256 _id, address player, uint256 score, uint8 kills) external onlyOwner {
        Tournament storage t = tournaments[_id];
        
        if (t.id == 0) revert TournamentDoesNotExist(_id);
        if (t.stats[player].timestamp == 0) revert TournamentNotStarted(_id);
        if (t.endAt != 0) revert TournamentAlreadyEnded(_id);

        t.stats[player].score = score;
        t.stats[player].kills = kills;
    }

    function withdrawPrizePool(uint256 _id) external onlyOwner {
        Tournament storage t = tournaments[_id];

        if (t.id == 0) revert TournamentDoesNotExist(_id);
        if (t.endAt == 0) revert TournamentNotStarted(_id);
        if (t.withdrawn) revert AlreadyWithdrawn();
        if (t.prizePool == 0) revert NothingToWithdraw();

        t.withdrawn = true;

        uint256 total = t.prizePool;
        uint256 ownerCut = (total * OWNER_FEE_PERCENTAGE) / 100;
        uint256 remainingPool = total - ownerCut;

        token.transfer(owner(), ownerCut);

        uint256 playerCount = t.players.length;

        if (playerCount == 0) {
            emit PrizeWithdrawn(_id, ownerCut, 0);
            return;
        }

        PlayerView[] memory arr = new PlayerView[](playerCount);

        for (uint256 i = 0; i < playerCount; i++) {
            address p = t.players[i];
            PlayerStats storage s = t.stats[p];
            arr[i] = PlayerView({
                player: p,
                score: s.score,
                kills: s.kills,
                timestamp: s.timestamp
            });
        }

        // Bubble sort
        for (uint256 i = 0; i < playerCount; i++) {
            for (uint256 j = i + 1; j < playerCount; j++) {
                bool swapNeeded = false;

                if (arr[j].score > arr[i].score) {
                    swapNeeded = true;
                } else if (arr[j].score == arr[i].score && arr[j].kills > arr[i].kills) {
                    swapNeeded = true;
                } else if (
                    arr[j].score == arr[i].score &&
                    arr[j].kills == arr[i].kills &&
                    arr[j].timestamp < arr[i].timestamp
                ) {
                    swapNeeded = true;
                }

                if (swapNeeded) {
                    PlayerView memory tmp = arr[i];
                    arr[i] = arr[j];
                    arr[j] = tmp;
                }
            }
        }

        uint256 p1 = 0;
        uint256 p2 = 0;
        uint256 p3 = 0;
        uint256 othersTotal = 0;

        if (playerCount >= 1) p1 = (remainingPool * 30) / 100;
        if (playerCount >= 2) p2 = (remainingPool * 20) / 100;
        if (playerCount >= 3) p3 = (remainingPool * 10) / 100;

        uint256 taken = p1 + p2 + p3;
        if (remainingPool > taken) {
            othersTotal = remainingPool - taken;
        }

        if (playerCount >= 1) token.transfer(arr[0].player, p1);
        if (playerCount >= 2) token.transfer(arr[1].player, p2);
        if (playerCount >= 3) token.transfer(arr[2].player, p3);

        if (playerCount > 3) {
            uint256 othersCount = playerCount - 3;
            uint256 per = othersTotal / othersCount;
            uint256 dust = othersTotal - (per * othersCount);

            for (uint256 i = 3; i < playerCount; i++) {
                token.transfer(arr[i].player, per);
            }

            if (dust > 0) {
                token.transfer(arr[0].player, dust);
            }
        }

        emit PrizeWithdrawn(_id, ownerCut, remainingPool);
    }
    
    function _collectFee(address player, uint256 amount) internal {
        bool success = token.transferFrom(player, address(this), amount);
        if (!success) revert NotEnoughFunds(amount);
    }
}
