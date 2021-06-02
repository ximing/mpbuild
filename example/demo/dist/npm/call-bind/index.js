
var bind = require("../function-bind/index.js");
var GetIntrinsic = require("../get-intrinsic/index.js");

var $apply = GetIntrinsic('%Function.prototype.apply%');
var $call = GetIntrinsic('%Function.prototype.call%');
var $reflectApply = GetIntrinsic('%Reflect.apply%', true) || bind.call($call, $apply);

var $defineProperty = GetIntrinsic('%Object.defineProperty%', true);

if ($defineProperty) {
  try {
    $defineProperty({}, 'a', { value: 1 });
  } catch (e) {
    // IE 8 has a broken defineProperty
    $defineProperty = null;
  }
}

module.exports = function callBind() {
  return $reflectApply(bind, $call, arguments);
};

var applyBind = function applyBind() {
  return $reflectApply(bind, $apply, arguments);
};

if ($defineProperty) {
  $defineProperty(module.exports, 'apply', { value: applyBind });
} else {
  module.exports.apply = applyBind;
}