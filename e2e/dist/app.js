"use strict";

var _interopRequireDefault = require("./npm/@babel/runtime/helpers/interopRequireDefault.js");

var _lodash = _interopRequireDefault(require("./npm/lodash/lodash.js"));

App({
  onLaunch: function onLaunch() {
    var _this = this;

    var logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);
    wx.login({
      success: function success(res) {} });

    wx.getSetting({
      success: function success(res) {
        if (res.authSetting['scope.userInfo']) {
          wx.getUserInfo({
            success: function success(res) {
              _this.globalData.userInfo = res.userInfo;

              if (_this.userInfoReadyCallback) {
                _this.userInfoReadyCallback(res);
              }
            } });

        }
      } });

  },
  globalData: {
    userInfo: null } });