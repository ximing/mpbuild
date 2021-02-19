/**
 * Created by ximing on 2018/12/7.
 */
const glob = require('glob');
const chalk = require('chalk');
const mm = require('micromatch');
const { join, sep, relative, dirname } = require('path');

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
    const npmPath = filePath.split('/node_modules/').slice(1).join('/npm/');
    return join(dest, `./${root || ''}`, npmDirName, npmPath);
};

const subPkgPathMap = new Map();
module.exports.subPkgPathMap = subPkgPathMap;
module.exports.setSubPkgPathMap = (root, libPath, opfp) => {
    if (!subPkgPathMap.has(root)) {
        subPkgPathMap.set(root, new Map());
    }
    subPkgPathMap.get(root).set(libPath, opfp);
};
module.exports.rewriteOutput = (libPath, root, src, dest, filePath, outputFilePath, alias) => {
    if (!subPkgPathMap.has(root)) {
        subPkgPathMap.set(root, new Map());
    }
    let opfp = subPkgPathMap.get(root).get(libPath);
    if (opfp) {
        return opfp;
    }
    if (libPath.includes(src)) {
        // 处理文件在src中的场景
        opfp = join(dest, `./${root || ''}`, relative(src, libPath));
    } else if (libPath.includes(dirname(filePath))) {
        // 如果是相对当前文件的，优先保持文件路径不变
        opfp = join(outputFilePath, relative(filePath, libPath));
    } else {
        if (alias.keys.length) {
            // 防止两个不同 git 仓库的文件，出现同名的情况，所以用alias做一次隔离
            const aliasKeys = alias.keys;
            for (let i = 0; i < aliasKeys.length; i++) {
                const path = alias.aliasMap[aliasKeys[i]];
                if (libPath.startsWith(path)) {
                    opfp = join(
                        dest,
                        `./${root || ''}`,
                        aliasKeys[i],
                        libPath.replace(path, '')
                        // relative(filePath, libPath).replace(/\.\.\//g, '')
                    );
                    subPkgPathMap.get(root).set(libPath, opfp);
                    return opfp;
                }
            }
        }
        console.log(chalk.red('可能存在异常,联系 @ximing 排查'), root, filePath, libPath);
        opfp = join(dest, `./${root || ''}`, relative(filePath, libPath).replace(/\.\.\//g, ''));
    }
    subPkgPathMap.get(root).set(libPath, opfp);
    return opfp;
};
