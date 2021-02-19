/**
 * Created by ximing on 2018/12/7.
 */
const log = require('webpack-log');

const logger = log({ name: 'mpb' });
module.exports = logger;
module.exports.log = log;
