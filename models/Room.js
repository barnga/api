const chunkArray = require('../helpers/chunkArray');
const shuffleArray = require('../helpers/shuffleArray');
const getSuit = require('../helpers/getSuit');
const getCardNumber = require('../helpers/getCardNumber');

module.exports = class Room {
  constructor(roomId, roomNumber, players, turn, leaderboard) {
    this.roomId = roomId;
    this.roomNumber = roomNumber;
    this.players = players;
    this.rulesheetId = null;

    this.playedCards = [];
    this.turn = turn;
    this.leaderboard = leaderboard;
    this.voteForWinner = false;
    this.showVoting = false;

    this.disableRules = false;
    this.disableChat = false;

    this.roundSettings = {
      disablePlayCard: false,
      showWinner: false,
      winner: null,
      playersWithCards: null,
      votes: []
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

      this.setPlayersWithCards();

      resolve();
    });
  }

  setPlayersWithCards() {
    this.roundSettings.playersWithCards = Object.keys(this.players)
      .filter((playerId) => this.players[playerId].hand.length > 0);
  }

  setTurn(playerId) {
    const playerKeys = Object.keys(this.players).filter((key) => this.players[key].hand.length > 0);
    const newIndex = (playerKeys.indexOf(playerId) + 1) % playerKeys.length;
    this.turn = playerKeys[newIndex];
  }

  playCard(playerId, playedCard) {
    return new Promise((resolve) => {
      if (!this.roundSettings.disablePlayCard) {
        this.playedCards.push({ playerId, playedCard });
        this.players[playerId].hand = this.players[playerId].hand.filter((card) => card !== playedCard);

        if (this.playedCards.length === this.roundSettings.playersWithCards.length) {
          if (this.voteForWinner) {
            this.showVoting = true;
            this.roundSettings.disablePlayCard = true;
            resolve();
          } else {
            this.endRound().then(() => {
              this.setTurn(playerId);
              resolve(true);
            });
          }
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

  castVote(voterId, playerId) {
    return new Promise((resolve) => {
      this.roundSettings.votes.push({ voterId, playerId });

      if (this.roundSettings.votes.length === Object.keys(this.players).length) {
        const votesPerPlayer = this.roundSettings.votes.map((vote) => vote.playerId)
          .reduce((allVotes, vote) => {
            if (vote in allVotes) {
              allVotes[vote]++;
            } else {
              allVotes[vote] = 1;
            }

            return allVotes;
          }, {});
        const winningScore = Math.max(...Object.values(votesPerPlayer));
        const winners = Object.entries(votesPerPlayer).filter((player) => {
          const [playerId, score] = player;
          return score === winningScore;
        });
        const randomWinner = winners[Math.floor(Math.random() * winners.length)][0];

        this.updatePlayerScore(randomWinner);
        this.roundSettings.winner = randomWinner;
        this.showVoting = false;

        resolve(true);
      } else {
        resolve();
      }
    });
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
      this.roundSettings.winner = winningPlayer;
    };

    return new Promise((resolve) => {
      if (this.rulesheetId !== 2) {
        const trumpSuit = ['SPADE', 'DIAMOND'][this.rulesheetId];
        const trumpCards = this.playedCards
          .filter((cardData) => getSuit(cardData.playedCard) === trumpSuit);

        if (trumpCards.length > 0) {
          const winningPlayer = getWinningPlayer(trumpCards);
          this.updatePlayerScore(getWinningPlayer(trumpCards));
          this.roundSettings.winner = winningPlayer;
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
    this.leaderboard[playerId].score += 1;
  }

  resetRoom(isVotingRound) {
    return new Promise((resolve) => {
      const playerKeys = Object.keys(this.players);
      playerKeys.forEach((playerId) => this.players[playerId].hand = []);

      this.leaderboard = Object.fromEntries(playerKeys.map((playerId) => {
        return [playerId, { nickname: this.players[playerId].nickname, score: 0 }];
      }));
      this.turn = playerKeys[Math.floor(Math.random() * playerKeys.length)];

      this.playedCards = [];
      this.voteForWinner = isVotingRound;
      this.showVoting = false;

      this.disableRules = isVotingRound;
      this.disableChat = isVotingRound;

      this.roundSettings = {
        disablePlayCard: false,
        showWinner: false,
        winner: null,
        playersWithCards: null,
        votes: [],
      };

      resolve();
    });
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
      showVoting: this.showVoting,
      disableRules: this.disableRules,
      disableChat: this.disableChat,
    };
  }
};
