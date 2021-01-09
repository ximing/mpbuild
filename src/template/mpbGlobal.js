const installedChunks = {},
    modules = {};
const installedModules = {};
function _require(moduleId, needRequire) {
    if (installedModules[moduleId] && !needRequire) {
        return installedModules[moduleId].exports;
    }
    const module = (installedModules[moduleId] = {
        i: moduleId,
        l: false,
        exports: {},
    });
    modules[moduleId].call(module.exports, module, module.exports, _require);
    module.l = true;
    return module.exports;
}

const push = function (chunkId, moreModules) {
    if (Object.prototype.hasOwnProperty.call(installedChunks, chunkId)) {
        return;
    }
    installedChunks[chunkId] = 0;
    for (const moduleId in moreModules) {
        if (Object.prototype.hasOwnProperty.call(moreModules, moduleId)) {
            modules[moduleId] = moreModules[moduleId];
        }
    }
};
module.exports = {
    _require,
    push,
    modules,
};
