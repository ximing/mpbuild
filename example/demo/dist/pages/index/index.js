"use strict";

var _interopRequireWildcard = require("../../npm/@babel/runtime/helpers/interopRequireWildcard.js");

var _es = _interopRequireWildcard(require("../../utils/es.js"));

var _require = require("../../npm/util/util.js"),
inspect = _require.inspect; // eslint-disable-next-line import/no-unresolved


var util = require("../../utils/util.js");

var a = ({ "a": "123" });;

Page({
  onShow: function onShow() {
    console.log('wx platform');
    console.log('not mt platform');
  } });