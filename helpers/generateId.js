module.exports = function generateId(length, alphaNumeric = false) {
  let text = '';
  const alphaCharset = 'abcdefghijklmnopqrstuvwxyz';
  const charset = alphaNumeric ? alphaCharset + '1234567890' : alphaCharset;
  for (let i = 0; i < length; i++) {
    text += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return text;
};
