module.exports = class Player {
  constructor(id, socketId, nickname) {
    this.id = id;
    this.socketId = socketId;
    this.nickname = nickname;
  }

  getBasicData() {
    return { id: this.id, nickname: this.nickname };
  }
};
