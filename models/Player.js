module.exports = class Player {
  constructor(id, socketId, nickname) {
    this.id = id;
    this.socketId = socketId;
    this.nickname = nickname;
    this.room = '';
    this.hand = [];
  }

  getBasicData() {
    return { id: this.id, nickname: this.nickname };
  }

  joinRoom(roomId) {
    this.room = roomId;
  }

  assignHand(hand) {
    this.hand = hand;
  }
};
