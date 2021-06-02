const { join } = require('path');

const { resolveAlias } = require('../resolve');

module.exports = class SubProjectPlugin {
    constructor(opt = {}) {
        /*
         * {
         *   name: "",
         *   src: "",
         *   alias: {}
         * }
         * */
        this.subProjects = opt.subProjects || [];
    }

    error() {}

    apply(mpb) {
        mpb.hooks.resolveOutside.tap('rewriteOutputPath', (opt) => {
            const { lib, asset, exts, resolveLib } = opt;
            if (resolveLib) {
                // 使用 / 这种情况，或者使用 ./ 或者子仓库的 npm包 这种情况触发子仓库的解析可以被解析到
                const subProject = this.subProjects.find((sub) => resolveLib.startsWith(sub.src));
                if (subProject) {
                    if (lib[0] === '/') {
                        delete opt.resolveLib;
                        const errorMsg = `子仓库${subProject.name}中不允许存在路径为/的写法，请使用alias的方式,报错文件: ${asset.path} ,报错引用${lib}`;
                        if (!mpb.isWatch) {
                            console.log(errorMsg);
                            process.exit(1011);
                        }
                        throw new Error(errorMsg);
                    }
                }
            } else {
                // 没有解析到resolveLib 就需要进一步的去看 子仓库alias是否能寻找到文件
                for (let i = 0, l = this.subProjects.length; i < l; i++) {
                    const { alias } = this.subProjects[i];
                    const outSideResolveLib = resolveAlias(lib, exts, alias, opt);
                    opt.resolveLib = outSideResolveLib;
                    return opt;
                }
                console.log(`子仓库和主仓库都没有索引到文件: ${asset.path} 引用的${lib}`);
            }
            return opt;
        });

        mpb.hooks.rewriteOutsideOutputPath.tap('rewriteOutputPath', (item) => {
            const { libPath, root, src, dest, filePath, outputFilePath } = item;
            const subProject = this.subProjects.find((sub) => libPath.startsWith(sub.src));
            if (subProject) {
                const { name, src, alias } = subProject;
                const aliasKeys = Object.keys(alias);
                for (let i = 0; i < aliasKeys.length; i++) {
                    const path = alias[aliasKeys[i]];
                    if (libPath.startsWith(path)) {
                        item.opfp = join(dest, `./${root || ''}`, name, libPath.replace(path, ''));
                        return item;
                    }
                }
                const errorMsg = `仓库${subProject.name}的${filePath}无法找到输出文件: ${libPath} 前置输出: ${outputFilePath}`;
                throw new Error(errorMsg);
            }
            return item;
        });
    }
};
