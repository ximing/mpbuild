"use strict";

var app = getApp();
Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo') },

  bindViewTap: function bindViewTap() {
    wx.navigateTo({
      url: '../logs/logs' });

  },
  onLoad: function onLoad() {
    var _this = this;

    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true });

    } else if (this.data.canIUse) {
      app.userInfoReadyCallback = function (res) {
        _this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true });

      };
    } else {
      wx.getUserInfo({
        success: function success(res) {
          app.globalData.userInfo = res.userInfo;

          _this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true });

        } });

    }
  },
  getUserInfo: function getUserInfo(e) {
    console.log(e);
    app.globalData.userInfo = e.detail.userInfo;
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true });

  } });