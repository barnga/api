module.exports = function getCardNumber(cardName) {
  return cardName.split('-')[1];
};
