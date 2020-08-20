module.exports = class GameManager {
  constructor() {
    this.games = [];
  };

  addGame(game) {
    this.games[game.gameId] = game;
  }

  deleteGame(game) {
    delete this.games[game.gameId];
  }
};
