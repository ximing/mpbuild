/**
 * Created by ximing on 2020-12-25.
 */
const { join, relative, dirname } = require('path');
const chalk = require('chalk');

const { rewriteNpm, subPkgPathMap } = require('../util');

const NPM_PATH_NAME = 'node_modules';

module.exports = class RewriteOutputPathPlugin {
    constructor() {
        this.mainPkgPathMap = {
            json: {},
            js: {},
            wxml: {},
            wxss: {},
        };
    }

    rewriteOutput(libPath, root, src, dest, filePath, outputFilePath, alias) {
        if (!subPkgPathMap.has(root)) {
            subPkgPathMap.set(root, new Map());
        }
        let opfp = subPkgPathMap.get(root).get(libPath);
        if (opfp) {
            return opfp;
        }
        // 主仓库下
        if (libPath.includes(src)) {
            // 处理文件在src中的场景
            opfp = join(dest, `./${root || ''}`, relative(src, libPath));
        } else if (libPath.includes(dirname(filePath))) {
            // 不管是主仓库还是子仓库 都先走这个逻辑
            // 如果是相对当前文件的，优先保持文件路径不变
            opfp = join(outputFilePath, relative(filePath, libPath));
        } else {
            // 页面外部的文件，可能要经过插件进行处理
            const rewriteOutsideOutputPathResult = this.mpb.hooks.rewriteOutsideOutputPath.call({
                libPath,
                root,
                src,
                dest,
                filePath,
                outputFilePath,
                alias,
            });
            if (rewriteOutsideOutputPathResult && rewriteOutsideOutputPathResult.opfp) {
                opfp = rewriteOutsideOutputPathResult.opfp;
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
                opfp = join(
                    dest,
                    `./${root || ''}`,
                    relative(filePath, libPath).replace(/\.\.\//g, '')
                );
            }
        }
        subPkgPathMap.get(root).set(libPath, opfp);
        return opfp;
    }

    apply(mpb) {
        this.mpb = mpb;
        const keys = Object.keys(mpb.config.alias || {});
        const alias = { keys, aliasMap: mpb.config.alias };
        mpb.hooks.rewriteOutputPath.tap('rewriteOutputPath', (opt) => {
            const { filePath, asset, depType } = opt;
            const nmPathIndex = filePath.indexOf(NPM_PATH_NAME);
            const root = asset.getMeta('root');
            let outputPath = this.mainPkgPathMap[depType][filePath];
            if (!outputPath) {
                if (~nmPathIndex) {
                    outputPath = rewriteNpm(filePath, root, mpb.dest, mpb.config.output.npm);
                } else {
                    outputPath = this.rewriteOutput(
                        filePath,
                        root,
                        mpb.src,
                        mpb.dest,
                        asset.path,
                        asset.outputFilePath,
                        alias
                    );
                }
                if (!root) {
                    this.mainPkgPathMap[depType][filePath] = outputPath;
                }
                opt.outputPath = outputPath;
            }
            opt.outputPath = outputPath;
            return opt;
        });
    }
};
