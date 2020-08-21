module.exports = class Player {
  constructor(id, nickname) {
    this.id = id;
    this.nickname = nickname;
  }

  getBasicData() {
    return { id: this.id, nickname: this.nickname };
  }
};
