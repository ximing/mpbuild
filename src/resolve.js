const path = require('path');
const bresolve = require('browser-resolve');
const resolve = require('resolve');

function resolveSync(lib, base, exts) {
    try {
        return resolve.sync(lib, {
            basedir: base,
            extensions: exts
        });
    } catch (e) {}
}

const shims = {
    util: path.join(__dirname, '../node_modules/util/util.js')
};

module.exports = (lib, asset, exts = [], src = '', alias = {}) => {
    const aliasArr = Object.keys(alias);
    for (let i = 0; i < aliasArr.length; i++) {
        if (lib.startsWith(aliasArr[i])) {
            return path.join(alias[aliasArr[i]], lib.replace(aliasArr[i], ''));
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
            libPath = lib;
        }
    } else {
        // 尝试寻找当前项目node_modules文件夹下是否存在
        try {
            libPath = bresolve.sync(lib, {
                basedir: asset.dir,
                filename: asset.path,
                extensions: exts,
                modules: shims
            });
        } catch (e) {
        } finally {
            try {
                // libPath = resolveSync(lib, asset.dir, exts);
                // 先找相对路径
                libPath = resolve.sync(path.join(asset.dir, lib), { extensions: exts });
                if (lib === 'util') {
                    console.log('2', lib, libPath);
                }
            } catch (e) {}
            // 如果不存在就去从当前npm包位置开始向上查找
            if (!(libPath && libPath.startsWith(process.cwd()))) {
                libPath = bresolve.sync(lib, {
                    basedir: asset.dir,
                    filename: asset.path,
                    modules: shims
                });
            }
        }
    }
    if (!libPath) {
        console.error('[mpbuild resolve]', lib, exts, src, alias);
    }
    return libPath;
};
