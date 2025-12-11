import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hre from "hardhat";
import { parseUnits } from "viem";

describe("SharkTournament", async function () {
  const { viem, networkHelpers } = await hre.network.connect();
  const { loadFixture } = networkHelpers;

  async function deployTournamentFixture() {
    const publicClient = await viem.getPublicClient();
    const [owner, treasury, player1, player2, player3, player4] = await viem.getWalletClients();

    const mockToken = await viem.deployContract("MockERC20", ["MockToken", "MTK"]);

    const sharkTournament = await viem.deployContract("SharkTournament", [
      mockToken.address,
      treasury.account.address
    ]);

    const mintAmount = parseUnits("1000", 6);
    await mockToken.write.mint([player1.account.address, mintAmount]);
    await mockToken.write.mint([player2.account.address, mintAmount]);
    await mockToken.write.mint([player3.account.address, mintAmount]);
    await mockToken.write.mint([player4.account.address, mintAmount]);

    return {
      sharkTournament,
      mockToken,
      publicClient,
      owner,
      treasury,
      player1,
      player2,
      player3,
      player4
    };
  }

  describe("Deployment", function () {
    it("Should set the correct token and treasury", async function () {
      const { sharkTournament, mockToken, treasury } = await loadFixture(deployTournamentFixture);

      const tokenAddress = await sharkTournament.read.token();
      const treasuryAddress = await sharkTournament.read.treasury();

      assert.equal(tokenAddress.toLowerCase(), mockToken.address.toLowerCase());
      assert.equal(treasuryAddress.toLowerCase(), treasury.account.address.toLowerCase());
    });

    it("Should start with no tournaments", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);
      const tournament = await sharkTournament.read.tournaments([1n]);
      assert.equal(tournament[0], 0n);
    });

    it("Should set the correct owner", async function () {
      const { sharkTournament, owner } = await loadFixture(deployTournamentFixture);
      const contractOwner = await sharkTournament.read.owner();
      assert.equal(contractOwner.toLowerCase(), owner.account.address.toLowerCase());
    });
  });

  describe("Tournament Creation", function () {
    it("Should emit TournamentCreated event", async function () {
      const { sharkTournament, publicClient } = await loadFixture(deployTournamentFixture);

      const hash = await sharkTournament.write.createTournament([1n]);
      await publicClient.waitForTransactionReceipt({ hash });

      const events = await sharkTournament.getEvents.TournamentCreated();
      assert.equal(events.length, 1);
      assert.equal(events[0].args.id, 1n);
    });

    it("Should set correct tournament properties", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      const tournament = await sharkTournament.read.tournaments([1n]);

      assert.equal(tournament[0], 1n);
      assert.equal(tournament[1], 0n);
      assert.equal(tournament[2], 0n);
      assert.equal(tournament[3], 2000000n);
      assert.equal(tournament[4], 0n);
      assert.equal(tournament[5], false);
    });

    it("Should revert if creating a duplicate ID", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);

      await assert.rejects(
        async () => await sharkTournament.write.createTournament([1n]),
        (err) => {
          assert.match((err as Error).message, /TournamentAlreadyExists/);
          return true;
        }
      );
    });

    it("Should allow creating multiple tournaments with different IDs", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.createTournament([2n]);
      await sharkTournament.write.createTournament([3n]);

      const t1 = await sharkTournament.read.tournaments([1n]);
      const t2 = await sharkTournament.read.tournaments([2n]);
      const t3 = await sharkTournament.read.tournaments([3n]);

      assert.equal(t1[0], 1n);
      assert.equal(t2[0], 2n);
      assert.equal(t3[0], 3n);
    });
  });

  describe("Tournament Start", function () {
    it("Should emit TournamentStarted event", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);

      const events = await sharkTournament.getEvents.TournamentStarted();
      assert.equal(events.length, 1);
      assert.equal(events[0].args.id, 1n);
    });

    it("Should set startAt timestamp", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);

      const tournament = await sharkTournament.read.tournaments([1n]);
      assert.notEqual(tournament[1], 0n);
    });

    it("Should revert if starting a non-existent tournament", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await assert.rejects(
        async () => await sharkTournament.write.startTournament([99n]),
        (err) => {
          assert.match((err as Error).message, /TournamentDoesNotExist/);
          return true;
        }
      );
    });

    it("Should revert if starting an already started tournament", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);

      await assert.rejects(
        async () => await sharkTournament.write.startTournament([1n]),
        (err) => {
          assert.match((err as Error).message, /TournamentAlreadyStarted/);
          return true;
        }
      );
    });
  });

  describe("Tournament End", function () {
    it("Should emit TournamentEnded event", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);
      await sharkTournament.write.endTournament([1n]);

      const events = await sharkTournament.getEvents.TournamentEnded();
      assert.equal(events.length, 1);
      assert.equal(events[0].args.id, 1n);
    });

    it("Should set endAt timestamp", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);
      await sharkTournament.write.endTournament([1n]);

      const tournament = await sharkTournament.read.tournaments([1n]);
      assert.notEqual(tournament[2], 0n);
    });

    it("Should revert if ending a non-existent tournament", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await assert.rejects(
        async () => await sharkTournament.write.endTournament([99n]),
        (err) => {
          assert.match((err as Error).message, /TournamentDoesNotExist/);
          return true;
        }
      );
    });

    it("Should revert if ending an already ended tournament", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);
      await sharkTournament.write.endTournament([1n]);

      await assert.rejects(
        async () => await sharkTournament.write.endTournament([1n]),
        (err) => {
          assert.match((err as Error).message, /TournamentAlreadyEnded/);
          return true;
        }
      );
    });
  });

  describe("Player Joining", function () {
    it("Should allow player to join tournament", async function () {
      const { sharkTournament, mockToken, player1 } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);

      const entryFee = 2000000n;
      await mockToken.write.approve([sharkTournament.address, entryFee], { account: player1.account });
      await sharkTournament.write.joinTournament([1n], { account: player1.account });

      const tournament = await sharkTournament.read.tournaments([1n]);
      assert.equal(tournament[4], entryFee);
    });

    it("Should emit PlayerJoined event", async function () {
      const { sharkTournament, mockToken, player1 } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);

      const entryFee = 2000000n;
      await mockToken.write.approve([sharkTournament.address, entryFee], { account: player1.account });
      await sharkTournament.write.joinTournament([1n], { account: player1.account });

      const events = await sharkTournament.getEvents.PlayerJoined();
      assert.equal(events.length, 1);
      assert.equal(events[0].args.id, 1n);
      assert.equal(events[0].args.player!.toLowerCase(), player1.account.address.toLowerCase());
      assert.equal(events[0].args.amount, entryFee);
    });

    it("Should revert if joining non-existent tournament", async function () {
      const { sharkTournament, player1 } = await loadFixture(deployTournamentFixture);

      await assert.rejects(
        async () => await sharkTournament.write.joinTournament([99n], { account: player1.account }),
        (err) => {
          assert.match((err as Error).message, /TournamentDoesNotExist/);
          return true;
        }
      );
    });

    it("Should revert if joining before tournament starts", async function () {
      const { sharkTournament, player1 } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);

      await assert.rejects(
        async () => await sharkTournament.write.joinTournament([1n], { account: player1.account }),
        (err) => {
          assert.match((err as Error).message, /TournamentNotStarted/);
          return true;
        }
      );
    });

    it("Should revert if joining after tournament ends", async function () {
      const { sharkTournament, player1 } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);
      await sharkTournament.write.endTournament([1n]);

      await assert.rejects(
        async () => await sharkTournament.write.joinTournament([1n], { account: player1.account }),
        (err) => {
          assert.match((err as Error).message, /TournamentAlreadyEnded/);
          return true;
        }
      );
    });

    it("Should revert if player joins twice", async function () {
      const { sharkTournament, mockToken, player1 } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);

      const entryFee = 2000000n;
      await mockToken.write.approve([sharkTournament.address, entryFee * 2n], { account: player1.account });
      await sharkTournament.write.joinTournament([1n], { account: player1.account });

      await assert.rejects(
        async () => await sharkTournament.write.joinTournament([1n], { account: player1.account }),
        (err) => {
          assert.match((err as Error).message, /PlayerAlreadyJoined/);
          return true;
        }
      );
    });
  });

  describe("Player Stats Update", function () {
    it("Should allow owner to update player stats", async function () {
      const { sharkTournament, mockToken, player1 } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);

      const entryFee = 2000000n;
      await mockToken.write.approve([sharkTournament.address, entryFee], { account: player1.account });
      await sharkTournament.write.joinTournament([1n], { account: player1.account });

      await sharkTournament.write.updatePlayerStats([1n, player1.account.address, 1000n, 5]);

    });

    it("Should revert if updating stats for non-existent tournament", async function () {
      const { sharkTournament, player1 } = await loadFixture(deployTournamentFixture);

      await assert.rejects(
        async () => await sharkTournament.write.updatePlayerStats([99n, player1.account.address, 1000n, 5]),
        (err) => {
          assert.match((err as Error).message, /TournamentDoesNotExist/);
          return true;
        }
      );
    });

    it("Should revert if updating stats after tournament ends", async function () {
      const { sharkTournament, mockToken, player1 } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);

      const entryFee = 2000000n;
      await mockToken.write.approve([sharkTournament.address, entryFee], { account: player1.account });
      await sharkTournament.write.joinTournament([1n], { account: player1.account });

      await sharkTournament.write.endTournament([1n]);

      await assert.rejects(
        async () => await sharkTournament.write.updatePlayerStats([1n, player1.account.address, 1000n, 5]),
        (err) => {
          assert.match((err as Error).message, /TournamentAlreadyEnded/);
          return true;
        }
      );
    });
  });

  describe("Access Control", function () {
    it("Should revert if non-owner tries to create tournament", async function () {
      const { sharkTournament, player1 } = await loadFixture(deployTournamentFixture);

      await assert.rejects(
        async () => await sharkTournament.write.createTournament([1n], { account: player1.account }),
        (err) => {
          assert.match((err as Error).message, /OwnableUnauthorizedAccount/);
          return true;
        }
      );
    });

    it("Should revert if non-owner tries to start tournament", async function () {
      const { sharkTournament, player1 } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);

      await assert.rejects(
        async () => await sharkTournament.write.startTournament([1n], { account: player1.account }),
        (err) => {
          assert.match((err as Error).message, /OwnableUnauthorizedAccount/);
          return true;
        }
      );
    });

    it("Should revert if non-owner tries to end tournament", async function () {
      const { sharkTournament, player1 } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);

      await assert.rejects(
        async () => await sharkTournament.write.endTournament([1n], { account: player1.account }),
        (err) => {
          assert.match((err as Error).message, /OwnableUnauthorizedAccount/);
          return true;
        }
      );
    });
  });
});
