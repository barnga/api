const Player = require('./Player');
const Teacher = require('./Player');
const Room = require('./Room');
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
        const roomNumber = i + 1;
        const randomPlayers = {};
        parsedIds[i].forEach((parsedId) => randomPlayers[parsedId] = this.players[parsedId]);
        this.rooms[roomId] = new Room(roomId, roomNumber, randomPlayers);
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
};
