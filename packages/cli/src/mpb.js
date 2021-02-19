const MPB = require('mpbuild');

module.exports = (config) => {
    const mbpConfig = require(config);
    const mpb = new MPB(mbpConfig);
    return mpb;
};
