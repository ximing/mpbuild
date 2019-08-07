/**
 * Created by ximing on 2019-03-15.
 */
const path = require('path');
const fs = require('fs');
const resolve = require('resolve');
const { assetType } = require('../consts');

const NPM_PATH_NAME = 'node_modules';

module.exports = class HandleJSONComponentDep {
    constructor() {
        this.mainPkgPathMap = {};
    }

    apply(mpb) {
        mpb.hooks.beforeEmitFile.tapPromise('HandleJSONComponentDep', async (asset) => {
            // const key = asset.getMeta('mbp-scan-json-dep');
            // TODO 并不是所有JSON都要进行这个判定的，先通过usingComponents这个key来判定是否是依赖，但是有点硬核，后面想下有没有更好的办法，上面通过 meta的方式也不行，主要是在watch的时候如何对新的asset设置meta
            if (/\.json$/.test(asset.outputFilePath) && asset.contents) {
                const code = JSON.parse(asset.contents);
                if (code.usingComponents) {
                    const componets = code.usingComponents;
                    if (componets) {
                        // TODO 这里需要支持 alias
                        await Promise.all(
                            Object.keys(componets).map((componentName) => {
                                let filePath = '',
                                    src = componets[componentName];
                                if (src[0] === '/') {
                                    filePath = path.resolve(mpb.src, `.${src}`);
                                } else if (src[0] === '.') {
                                    filePath = path.resolve(asset.dir, src);
                                } else {
                                    filePath = path.resolve(asset.dir, `./${src}`);

                                    if (!fs.existsSync(`${filePath}.json`)) {
                                        filePath = resolve.sync(src, { basedir: mpb.cwd });
                                        filePath = filePath.replace(path.parse(filePath).ext, '');
                                    }
                                }

                                const nmPathIndex = filePath.indexOf(NPM_PATH_NAME);
                                const root = asset.getMeta('root');
                                if (~nmPathIndex) {
                                    let usePath = this.mainPkgPathMap[filePath];
                                    if (usePath) {
                                        componets[componentName] = usePath;
                                        asset.contents = JSON.stringify(code);
                                        return;
                                    }
                                    usePath = path.resolve(
                                        `/${root}`,
                                        `./${mpb.config.output.npm}`,
                                        `${filePath.substr(nmPathIndex + NPM_PATH_NAME.length + 1)}`
                                    );
                                    if (!root) {
                                        this.mainPkgPathMap[filePath] = usePath;
                                    }
                                    componets[componentName] = usePath;
                                    asset.contents = JSON.stringify(code);

                                    mpb.scan.addAssetByEXT(
                                        filePath,
                                        path.resolve(mpb.dest, `.${usePath}`),
                                        assetType.component,
                                        undefined,
                                        root,
                                        asset.filePath
                                    );
                                } else {
                                    mpb.scan.addAssetByEXT(
                                        filePath.replace(mpb.src, ''),
                                        path.resolve(mpb.dest, path.relative(mpb.src, filePath)),
                                        assetType.component,
                                        undefined,
                                        root,
                                        asset.filePath
                                    );
                                }
                            })
                        );
                    }
                }
            }
            return asset;
        });
    }
};
