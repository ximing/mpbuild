/**
 * Created by ximing on 2020-12-25.
 */
const chalk = require('chalk');
const resolve = require('../resolve');

module.exports = class ResolvePlugin {
    apply(mpb) {
        mpb.hooks.resolve.tap('ResolvePlugin', (opt) => {
            const { lib, asset, exts } = opt;
            const resolveLib = resolve(lib, asset, exts, mpb.src, mpb.config.alias, true);
            if (!resolveLib || !resolveLib.startsWith(mpb.src)) {
                // 项目外部文件处理逻辑
                const outsideResolveRes = mpb.hooks.resolveOutside.call({
                    lib,
                    asset,
                    exts,
                    resolveLib,
                });
                if (outsideResolveRes && outsideResolveRes.resolveLib) {
                    opt.resolveLib = outsideResolveRes.resolveLib;
                    return opt;
                }
            }
            if (!resolveLib) {
                console.error(chalk.red('[mpbuild resolve plugin]'), asset, lib, exts);
            }
            opt.resolveLib = resolveLib;
            return opt;
        });
    }
};
