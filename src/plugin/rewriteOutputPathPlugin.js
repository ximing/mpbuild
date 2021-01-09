/**
 * Created by ximing on 2020-12-25.
 */
const path = require('path');

const { rewriteOutput } = require('../util');
const { rewriteNpm } = require('../util');

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

    apply(mpb) {
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
                    outputPath = rewriteOutput(
                        filePath,
                        root,
                        mpb.src,
                        mpb.dest,
                        asset.path,
                        asset.outputFilePath,
                        alias
                    );
                }
                const bundleSrc = mpb.jsPackageManager.bundlePath[root];
                const bundleDist = mpb.jsPackageManager.bundleDistPath[root];
                if (bundleSrc === filePath) {
                    outputPath = bundleDist;
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
