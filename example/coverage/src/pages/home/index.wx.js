import('./dyn')

const aliasMod = require('@utils/alias-mod')
const platformA = require('/utils/a')
const coverageMark = require('./coverage-mark')
const covId = require('cov-id')

Page({
  onShow() {
    // @ifdef wx
    console.log('wx-on')
    // @endif
    // @ifdef mt
    console.log('mt-on')
    // @endif
    return { aliasMod, platformA, coverageMark, covId }
  },
})
