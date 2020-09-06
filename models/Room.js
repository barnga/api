const chunkArray = require('../helpers/chunkArray');
const shuffleArray = require('../helpers/shuffleArray');

module.exports = class Room {
  constructor(roomId, roomNumber, players) {
    this.roomId = roomId;
    this.roomNumber = roomNumber;
    this.players = players;
    this.playedCards = [];
    this.rulesheetId = null;
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

  playCard(playerId, playedCard) {
    this.playedCards.push(playedCard);
    this.players[playerId].hand = this.players[playerId].hand.filter((card) => card !== playedCard);
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
    };
  }
};
