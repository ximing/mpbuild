
var filter = require("../array-filter/index.js");

module.exports = function availableTypedArrays() {
  return filter([
  'BigInt64Array',
  'BigUint64Array',
  'Float32Array',
  'Float64Array',
  'Int16Array',
  'Int32Array',
  'Int8Array',
  'Uint16Array',
  'Uint32Array',
  'Uint8Array',
  'Uint8ClampedArray'],
  function (typedArray) {
    return typeof global[typedArray] === 'function';
  });
};