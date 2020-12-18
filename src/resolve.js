const path = require('path');
const bresolve = require('browser-resolve');
const resolve = require('resolve');

function resolveSync(lib, base, exts) {
    for (let i = 0; i < exts.length; i++) {
        try {
            return resolve.sync(path.join(base, `${lib}${exts[i]}`));
        } catch (e) {}
    }
}

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
            libPath = resolveSync(lib, src, exts);
        }
        if (!libPath) {
            libPath = lib;
        }
    } else {
        try {
            // 先找相对路径
            libPath = resolve.sync(path.join(asset.dir, lib), { extensions: exts });
        } catch (e) {
            // 尝试寻找当前项目node_modules文件夹下是否存在
            try {
                libPath = bresolve.sync(lib, {
                    basedir: process.cwd()
                });
            } catch (e) {
            } finally {
                // 如果不存在就去从当前npm包位置开始向上查找
                if (!(libPath && libPath.startsWith(process.cwd()))) {
                    libPath = bresolve.sync(lib, {
                        basedir: asset.dir,
                        filename: asset.path
                    });
                }
            }
        }
    }
    return libPath;
};
