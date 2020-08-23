module.exports = function chunk(array, len) {
  const temp = [];
  for (let i = 0; i < array.length; i += len) {
    if (array.slice(i).length / len < 2) {
      temp.push(array.slice(i));
      break;
    } else {
      temp.push(array.slice(i, i + len));
    }
  }
  return temp;
};
