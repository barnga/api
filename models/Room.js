const chunkArray = require('../helpers/chunkArray');
const shuffleArray = require('../helpers/shuffleArray');

module.exports = class Room {
  constructor(roomId, roomNumber, players, turn) {
    this.roomId = roomId;
    this.roomNumber = roomNumber;
    this.players = players;
    this.playedCards = [];
    this.rulesheetId = null;
    this.turn = turn;
  }

  setRulesheet(rulesheetId) {
    this.rulesheetId = rulesheetId;
  }

  dealCards(range) {
    return new Promise((resolve) => {
      const deck = ['CLUB', 'HEART', 'DIAMOND', 'SPADE'].map((suit) => {
        const fullSuit = [];
        for (let i = 1; i < range + 1; i++) {
          fullSuit.push(`${suit}-${i}`);
        }
        return fullSuit;
      });
      const chunkedDeck = chunkArray(shuffleArray(deck.flat()), Math.floor(deck.flat().length / Object.keys(this.players).length));

      Object.keys(this.players).forEach((sessionId, idx) => {
        this.players[sessionId].assignHand(chunkedDeck[idx]);
      });

      resolve();
    });
  }

  setTurn(playerId) {
    const playerKeys = Object.keys(this.players);
    const newIndex = (playerKeys.indexOf(playerId) + 1) % playerKeys.length;
    this.turn = playerKeys[newIndex];
  }

  playCard(playerId, playedCard) {
    this.playedCards.push({ playerId, playedCard });
    this.players[playerId].hand = this.players[playerId].hand.filter((card) => card !== playedCard);
    this.setTurn(playerId);
  }

  clearPlayedCards() {
    this.playedCards = [];
  }

  getBasicData() {
    return {
      roomId: this.roomId,
      roomNumber: this.roomNumber,
      players: this.players,
      playedCards: this.playedCards,
      rulesheetId: this.rulesheetId,
      turn: this.turn,
    };
  }
};
