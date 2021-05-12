import es, { es1 } from '../../utils/es';

const { inspect } = require('util');
// eslint-disable-next-line import/no-unresolved
const util = require('@utils/util');

const a = require('./a.json');

Page({
    onShow() {
        // @ifdef wx
        console.log('wx platform');
        // @endif
        // @ifdef mt
        console.log('mt platform');
        // @endif
        // @ifndef mt
        console.log('not mt platform');
        // @endif
    },
});
