const Player = require('./Player');
const Teacher = require('./Player');
const generateId = require('../helpers/generateId');
const shuffleArray = require('../helpers/shuffleArray');
const chunkArray = require('../helpers/chunkArray');

module.exports = class Game {
  constructor(gameId) {
    this.gameId = gameId;
    this.players = {};
    this.teachers = {};
    this.rooms = {};
  }

  addTeacher(uid, socketId) {
    this.teachers[uid] = new Teacher(uid, socketId);
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

  createRooms(size) {
    return new Promise((resolve) => {
      const playerIds = Object.values(this.players).map((player) => player.id);
      const roomCount = Math.floor(playerIds.length / size);
      const parsedIds = chunkArray(shuffleArray(playerIds), size);

      for (let i = 0; i < roomCount; i++) {
        const roomId = generateId(15);
        this.rooms[roomId] = parsedIds[i];
      }

      resolve();
    });
  }
};
