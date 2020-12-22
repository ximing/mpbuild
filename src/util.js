/**
 * Created by ximing on 2018/12/7.
 */
const glob = require('glob');
const mm = require('micromatch');
const { join, sep, relative } = require('path');

module.exports.findFilesAsync = (patterns, options = {}) =>
    new Promise((reslove, reject) => {
        glob(patterns, options, (err, files) => {
            if (err) reject(err);
            else reslove(files);
        });
    });

module.exports.formatBuildTime = (time) => `${`${time / 1000}`.substr(0, 7)}s`;

module.exports.isNpmPkg = function(name) {
    if (/^(\.|\/)/.test(name)) {
        return false;
    }
    return true;
};

module.exports.alias = function() {};

function ensureArray(thing) {
    if (Array.isArray(thing)) return thing;
    // eslint-disable-next-line
    if (thing == undefined) return [];
    return [thing];
}

function isRegexp(val) {
    return val instanceof RegExp;
}

function createFilter(include, exclude) {
    const getMatcher = (id) => (isRegexp(id) ? id : { test: mm.matcher(id) });
    include = ensureArray(include).map(getMatcher);
    exclude = ensureArray(exclude).map(getMatcher);

    return function(id) {
        if (typeof id !== 'string') return false;
        if (/\0/.test(id)) return false;

        id = id.split(sep).join('/');

        for (let i = 0; i < exclude.length; ++i) {
            const matcher = exclude[i];
            if (matcher.test(id)) return false;
        }

        for (let i = 0; i < include.length; ++i) {
            const matcher = include[i];
            if (matcher.test(id)) return true;
        }

        return !include.length;
    };
}

module.exports.createFilter = createFilter;
// const filter = createFilter(
//     [
//         'node_modules/@mtfe/mt-weapp*/**/*',
//         'node_modules/@mtfe/jsvm/**/*',
//         'node_modules/@tarojs/**/*'
//     ],
//     ['node_modules/**/*', '!node_modules/@mtfe/jsvm/**/*']
// );
// console.log(filter('node_modules/@mtfe/jsvm/a.tss'));

module.exports.rewriteNpm = (filePath, root, dest, npmDirName = 'npm') => {
    const npmPath = filePath
        .split('/node_modules/')
        .slice(1)
        .join('/npm/');
    return join(dest, `./${root || ''}`, npmDirName, npmPath);
};
