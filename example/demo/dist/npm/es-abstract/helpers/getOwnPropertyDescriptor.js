
var GetIntrinsic = require("../GetIntrinsic.js");

var $gOPD = GetIntrinsic('%Object.getOwnPropertyDescriptor%');
if ($gOPD) {
  try {
    $gOPD([], 'length');
  } catch (e) {
    // IE 8 has a broken gOPD
    $gOPD = null;
  }
}

module.exports = $gOPD;