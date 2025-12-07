import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hre from "hardhat";

describe("SharkTournament", async function () {

  const { viem, networkHelpers } = await hre.network.connect();
  const { loadFixture } = networkHelpers;
  async function deployTournamentFixture() {
    const publicClient = await viem.getPublicClient();
    const [owner, otherAccount] = await viem.getWalletClients();

    const sharkTournament = await viem.deployContract("SharkTournament");

    return {
      sharkTournament,
      publicClient,
      owner,
      otherAccount
    };
  }

  describe("Deployment", function () {
    it("Should start with no tournaments", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);
      const tournament = await sharkTournament.read.tournaments([1n]);
      assert.equal(tournament[0], 0n);
    });
  });

  describe("Events & Flow", function () {
    it("Should emit TournamentCreated", async function () {
      const { sharkTournament, publicClient } = await loadFixture(deployTournamentFixture);

      const hash = await sharkTournament.write.createTournament([1n]);

      await publicClient.waitForTransactionReceipt({ hash });

      const events = await sharkTournament.getEvents.TournamentCreated();


      assert.equal(events.length, 1);
      assert.equal(events[0].args.id, 1n);
    });

    it("Should emit TournamentStarted", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);

      const events = await sharkTournament.getEvents.TournamentStarted();
      assert.equal(events.length, 1);
      assert.equal(events[0].args.id, 1n);
    });

    it("Should emit TournamentEnded", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);
      await sharkTournament.write.endTournament([1n]);

      const events = await sharkTournament.getEvents.TournamentEnded();
      assert.equal(events.length, 1);
      assert.equal(events[0].args.id, 1n);
    });
  });

  describe("Validations (Reverts)", function () {
    it("Should revert if creating a duplicate ID", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);

      await assert.rejects(async () => {
        await sharkTournament.write.createTournament([1n]);
      }, (err) => {
        assert.match((err as Error).message, /TournamentAlreadyExists/);
        return true;
      });
    });

    it("Should revert if starting a non-existent tournament", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await assert.rejects(async () => {
        await sharkTournament.write.startTournament([99n]);
      }, (err) => {
        assert.match((err as Error).message, /TournamentDoesNotExist/);
        return true;
      });
    });

    it("Should revert if starting an already started tournament", async function () {
      const { sharkTournament } = await loadFixture(deployTournamentFixture);

      await sharkTournament.write.createTournament([1n]);
      await sharkTournament.write.startTournament([1n]);

      await assert.rejects(async () => {
        await sharkTournament.write.startTournament([1n]);
      }, (err) => {
        assert.match((err as Error).message, /TournamentAlreadyStarted/);
        return true;
      });
    });
  });
});
