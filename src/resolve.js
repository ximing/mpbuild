const path = require('path');
const fs = require('fs');
const bresolve = require('browser-resolve');
const resolve = require('resolve');
const chalk = require('chalk');

function resolveSync(lib, base, exts) {
    try {
        return resolve.sync(lib, {
            basedir: base,
            extensions: exts,
        });
    } catch (e) {}
}

const fileMap = new Map();
function exists(file) {
    if (fileMap.has(file)) return file;
    if (fs.existsSync(file)) {
        fileMap.set(file, file);
        return file;
    }
    return false;
}

module.exports = (lib, asset, exts = [], src = '', alias = {}, ignoreNotFound = false) => {
    const aliasArr = Object.keys(alias);
    for (let i = 0; i < aliasArr.length; i++) {
        if (lib.startsWith(aliasArr[i])) {
            const re = lib.replace(aliasArr[i], '');
            for (let j = 0; j < exts.length; j++) {
                let filePath =
                    path.join(alias[aliasArr[i]], re) + (re.endsWith(exts[j]) ? '' : exts[j]);
                if (exists(filePath)) {
                    return filePath;
                }
                filePath =
                    path.join(alias[aliasArr[i]], re, 'index') +
                    (re.endsWith(exts[j]) ? '' : exts[j]);
                if (exists(filePath)) {
                    return filePath;
                }
            }
        }
    }
    let libPath;
    if (lib[0] === '.') {
        libPath = resolveSync(lib, asset.dir, exts);
    } else if (lib[0] === '/') {
        if (src) {
            libPath = resolveSync(`.${lib}`, src, exts);
        }
        if (!libPath) {
            for (let j = 0; j < exts.length; j++) {
                const _libPath = lib.endsWith(exts[j]) ? lib : lib + exts[j];
                if (exists(_libPath)) {
                    libPath = _libPath;
                    break;
                }
            }
        }
    } else {
        try {
            // libPath = resolveSync(lib, asset.dir, exts);
            // 先找相对路径
            libPath = resolve.sync(path.join(asset.dir, lib), { extensions: exts });
        } catch (e) {
            // 尝试寻找当前项目node_modules文件夹下是否存在
            try {
                libPath = bresolve.sync(lib, {
                    basedir: asset.dir,
                    filename: asset.path,
                    extensions: exts,
                    includeCoreModules: false,
                });
            } catch (e) {
            } finally {
                // 如果不存在就去从当前npm包位置开始向上查找
                if (!(libPath && libPath.startsWith(process.cwd()))) {
                    libPath = bresolve.sync(lib, {
                        basedir: asset.dir,
                        filename: asset.path,
                        includeCoreModules: false,
                    });
                }
            }
        }
    }
    if (!libPath && !ignoreNotFound) {
        console.error(chalk.red('[mpbuild resolve]'), lib, exts, src, alias);
    }
    return libPath;
};
