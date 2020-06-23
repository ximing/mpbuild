/**
 * Created by ximing on 2018/12/7.
 */
const glob = require('glob');
const mm = require('micromatch');
const { join, sep } = require('path');
const Asset = require('./asset');

module.exports.findFilesAsync = (patterns, options = {}) =>
    new Promise((reslove, reject) => {
        glob(patterns, options, (err, files) => {
            if (err) reject(err);
            else reslove(files);
        });
    });

module.exports.formatBuildTime = (time) => `${`${time / 1000}`.substr(0, 7)}s`;

module.exports.isNpmPkg = function (name) {
    if (/^(\.|\/)/.test(name)) {
        return false;
    }
    return true;
};

module.exports.alias = function () {};

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

    return function (id) {
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

module.exports.rewriteNpm = (filePath, root, dest) => {
    const npmPath = filePath.split('/node_modules/').slice(1).join('/npm/');
    return join(dest, `./${root || ''}`, 'npm', npmPath);
};

// const filter = createFilter(
//     [
//         'node_modules/@mtfe/mt-weapp*/**/*',
//         'node_modules/@mtfe/jsvm/**/*',
//         'node_modules/@tarojs/**/*'
//     ],
//     ['node_modules/**/*', '!node_modules/@mtfe/jsvm/**/*']
// );
// console.log(filter('node_modules/@mtfe/jsvm/a.tss'));

module.exports.emptyManifest = (path, outputPath, meta, isComponent) => {
    const asset = new Asset(path, outputPath, meta);
    asset.switchToVirtualFile();
    const contents = {
        usingComponents: {},
    };
    if (isComponent) {
        contents.component = true;
    }
    asset.contents = JSON.stringify(contents);
    return asset;
};
module.exports.emptyStyle = (path, outputPath, meta) => {
    const asset = new Asset(path, outputPath, meta);
    asset.switchToVirtualFile();
    asset.contents = '/* virtural file */';
    return asset;
};

module.exports.getMatcher = (exts) => {
    return new RegExp(`(${exts.map((i) => i.replace('.', '\\.')).join('|')})$`);
};
