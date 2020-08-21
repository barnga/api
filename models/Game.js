const Player = require('./Player');

module.exports = class Game {
  constructor(gameId) {
    this.gameId = gameId;
    this.players = {};
    this.rooms = {};
  }

  addPlayer(uid, nickname) {
    this.players[uid] = new Player(uid, nickname);
  }

  deletePlayer(id) {
    delete this.players[id];
  }

  getBasicPlayersData() {
    return Object.values(this.players).map((player) => player.getBasicData());
  }
};
