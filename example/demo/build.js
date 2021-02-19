const MPB = require('mpbuild');
const mbpConfig = require('./mbp.config');

const mbp = new MPB(mbpConfig('./entry'));
(async () => {
    await mbp.run();
})();
