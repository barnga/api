const Player = require('./Player');
const Teacher = require('./Player');
const Room = require('./Room');
const generateId = require('../helpers/generateId');
const shuffleArray = require('../helpers/shuffleArray');
const chunkArray = require('../helpers/chunkArray');

module.exports = class Game {
  constructor(gameId, roomSize) {
    this.gameId = gameId;
    this.roomSize = roomSize;
    this.players = {};
    this.teachers = {};
    this.rooms = {};

    this.hasStarted = false;
    this.adminToken = generateId(10, true);
  }

  addTeacher(uid, socketId, nickname) {
    this.teachers[uid] = new Teacher(uid, socketId, nickname);
  }

  addPlayer(uid, socketId, nickname) {
    this.players[uid] = new Player(uid, socketId, nickname);
  }

  deletePlayer(id) {
    delete this.players[id];
  }

  getBasicPlayersData() {
    return Object.values(this.players).map((player) => player.getBasicData());
  }

  createRooms() {
    return new Promise((resolve) => {
      const playerIds = Object.values(this.players).map((player) => player.id);
      const roomCount = Math.floor(playerIds.length / this.roomSize);
      const parsedIds = chunkArray(shuffleArray(playerIds), this.roomSize);

      for (let i = 0; i < roomCount; i++) {
        const roomId = generateId(15);
        const roomNumber = i + 1;
        const startingPlayer = parsedIds[i][Math.floor(Math.random() * parsedIds[i].length)];
        const roomPlayers = {};
        const leaderboard = {};
        parsedIds[i].forEach((parsedId) => {
          roomPlayers[parsedId] = this.players[parsedId];
          leaderboard[parsedId] = {
            nickname: this.players[parsedId].nickname,
            score: 0,
          };
        });

        this.rooms[roomId] = new Room(roomId, roomNumber, roomPlayers, startingPlayer, leaderboard);
      }

      resolve();
    });
  }

  getBasicRoomsData() {
    return Object.keys(this.rooms).map((roomId) => this.rooms[roomId].getBasicData());
  }

  assignRulesheets(rulesheetCount) {
    return new Promise((resolve) => {
      const rooms = Object.keys(this.rooms);

      rooms.map((roomId, idx) => {
        if (rooms.length === 2 && !rooms[idx + 1]) {
          do {
            this.rooms[roomId].setRulesheet(Math.floor(Math.random() * rulesheetCount));
          } while (this.rooms[roomId].rulesheetId === this.rooms[rooms[0]].rulesheetId);
        } else {
          this.rooms[roomId].setRulesheet(Math.floor(Math.random() * rulesheetCount));
        }
      });

      resolve();
    });
  }

  async dealCardsToAllRooms(range) {
    const dealCardsPromises = Object.keys(this.rooms).map((roomId) => this.rooms[roomId].dealCards(range));
    await Promise.all(dealCardsPromises);
  };

  async resetRooms(isVotingRound) {
    const resetPromises = Object.keys(this.rooms).map((roomId) => this.rooms[roomId].resetRoom(isVotingRound));
    await Promise.all(resetPromises);
  };

  changeRooms() {
    return new Promise((resolve) => {
      const roomKeys = Object.keys(this.rooms);
      const emptyRooms = new Map(roomKeys.map((roomId) => [roomId, {}]));
      const updatedRooms = Object.fromEntries(emptyRooms);

      const getMiddlePlayers = (leaderboard) => {
        if (leaderboard.length > 4) {
          return leaderboard.slice(1, leaderboard.length - 2);
        }
        return leaderboard.slice(1, leaderboard.length - 1);
      };

      const getWinningPlayers = (leaderboard) => leaderboard.slice(leaderboard.length > 4 ? -2 : -1);

      Object.entries(this.rooms).forEach((room) => {
        const [roomId, roomData] = room;
        const sortedLeaderboard = Object.entries(roomData.leaderboard)
          .sort((playerA, playerB) => playerA[1].score - playerB[1].score);

        const [losingPlayer, middlePlayers, winningPlayers] = [
          sortedLeaderboard[0],
          getMiddlePlayers(sortedLeaderboard),
          getWinningPlayers(sortedLeaderboard),
        ];

        updatedRooms[roomKeys[(roomKeys.indexOf(roomId) + (roomKeys.length - 1)) % roomKeys.length]][losingPlayer[0]] = this.players[losingPlayer[0]];
        middlePlayers.forEach((middlePlayer) => {
          updatedRooms[roomId][middlePlayer[0]] = this.players[middlePlayer[0]];
        });
        winningPlayers.forEach((winningPlayer) => {
          updatedRooms[roomKeys[(roomKeys.indexOf(roomId) + 1) % roomKeys.length]][winningPlayer[0]] = this.players[winningPlayer[0]];
        });
      });

      resolve(updatedRooms);
    });
  }
};
