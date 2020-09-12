const chunkArray = require('../helpers/chunkArray');
const shuffleArray = require('../helpers/shuffleArray');
const getSuit = require('../helpers/getSuit');
const getCardNumber = require('../helpers/getCardNumber');

module.exports = class Room {
  constructor(roomId, roomNumber, players, turn, leaderboard) {
    this.roomId = roomId;
    this.roomNumber = roomNumber;
    this.players = players;
    this.playedCards = [];
    this.rulesheetId = null;
    this.turn = turn;
    this.leaderboard = leaderboard;
    this.roundSettings = {
      disablePlayCard: false,
      showWinner: false,
      winner: null,
    };
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
    return new Promise((resolve) => {
      if (!this.roundSettings.disablePlayCard) {
        this.playedCards.push({ playerId, playedCard });
        this.players[playerId].hand = this.players[playerId].hand.filter((card) => card !== playedCard);

        if (this.playedCards.length === Object.keys(this.players).length) {
          this.endRound().then(() => resolve(true));
        } else {
          this.setTurn(playerId);
          resolve();
        }
      } else {
        resolve();
      }
    });
  }

  clearPlayedCards() {
    this.playedCards = [];
  }

  endRound() {
    const getWinningPlayer = (cards) => {
      const highestPlay = cards.reduce((lastBestPlay, currentPlay) => {
        if (getCardNumber(lastBestPlay.playedCard) > getCardNumber(currentPlay.playedCard)) {
          return lastBestPlay;
        }
        return currentPlay;
      });
      const allHighestPlays = cards.filter((card) => card.playedCard === highestPlay.playedCard);
      return allHighestPlays[Math.floor(Math.random() * allHighestPlays.length)].playerId;
    };

    const setWinningPlayer = () => {
      const cardsOfFirstSuit = this.playedCards
        .filter((cardData) => getSuit(cardData.playedCard) === getSuit(this.playedCards[0].playedCard));
      const winningPlayer = getWinningPlayer(cardsOfFirstSuit);
      this.updatePlayerScore(winningPlayer);
      this.roundSettings = { ...this.roundSettings, winner: winningPlayer };
    };

    return new Promise((resolve) => {
      if (this.rulesheetId !== 2) {
        const trumpSuit = ['SPADE', 'DIAMOND'][this.rulesheetId];
        const trumpCards = this.playedCards
          .filter((cardData) => getSuit(cardData.playedCard) === trumpSuit);

        if (trumpCards.length > 0) {
          const winningPlayer = getWinningPlayer(trumpCards);
          this.updatePlayerScore(getWinningPlayer(trumpCards));
          this.roundSettings = { ...this.roundSettings, winner: winningPlayer };
        } else {
          setWinningPlayer();
        }
      } else {
        setWinningPlayer();
      }

      resolve();
    });
  }

  updatePlayerScore(playerId) {
    const leaderboardData = this.leaderboard[playerId];

    this.leaderboard[playerId] = {
      ...leaderboardData,
      score: leaderboardData.score + 1,
    };
  }

  getBasicData() {
    return {
      roomId: this.roomId,
      roomNumber: this.roomNumber,
      players: this.players,
      playedCards: this.playedCards,
      rulesheetId: this.rulesheetId,
      turn: this.turn,
      leaderboard: this.leaderboard,
      roundSettings: this.roundSettings,
    };
  }
};
