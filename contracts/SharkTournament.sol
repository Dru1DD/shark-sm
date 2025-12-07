// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract SharkTournament {

    struct PlayerStats {
        uint256 score;
        uint8 kills;
        uint256 timestamp;
    }

    struct Tournament {
        uint256 id;
        uint256 startAt;
        uint256 endAt;
        uint256 entryFee;
        address[] players;
        mapping(address => PlayerStats) stats;
    }

    mapping(uint256 => Tournament) public tournaments;

    event TournamentCreated(uint256 id);
    event TournamentStarted(uint256 id);
    event TournamentEnded(uint256 id);

    error TournamentAlreadyExists(uint256 id);
    error TournamentDoesNotExist(uint256 id);
    error TournamentAlreadyStarted(uint256 id);
    error TournamentAlreadyEnded(uint256 id);

    function createTournament(uint256 _id) public {
        if (tournaments[_id].id != 0) revert TournamentAlreadyExists(_id);

        Tournament storage t = tournaments[_id];
        t.id = _id;
        t.entryFee = 2;

        emit TournamentCreated(_id);
    }

    function startTournament(uint256 _id) public {
        Tournament storage t = tournaments[_id];

        if (t.id == 0) revert TournamentDoesNotExist(_id);
        if (t.startAt != 0) revert TournamentAlreadyStarted(_id);

        t.startAt = block.timestamp;
        emit TournamentStarted(_id);
    }

    function endTournament(uint256 _id) public {
        Tournament storage t = tournaments[_id];
        
        if (t.id == 0) revert TournamentDoesNotExist(_id);
        if (t.endAt != 0) revert TournamentAlreadyEnded(_id);

        t.endAt = block.timestamp;
        emit TournamentEnded(_id);
    }
}
