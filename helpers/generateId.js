module.exports = function generateId(length) {
  let text = "";
  const charset = "abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i < length; i++) {
    text += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return text;
};
