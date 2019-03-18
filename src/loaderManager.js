/**
 * Created by ximing on 2018/11/24.
 */
const mm = require('micromatch');

const babelLoader = require('./loader/babel-loader');
const fileLoader = require('./loader/file-loader');
const replaceLoader = require('./loader/replace-loader');
const taroJSLoader = require('./loader/taro-js-loader');
const tsLoader = require('./loader/ts-loader');
const postcssLoader = require('./loader/postcss-loader');

const map = {
    'babel-loader': babelLoader,
    'file-loader': fileLoader,
    'replace-loader': replaceLoader,
    'taro-js-loader': taroJSLoader,
    'ts-loader': tsLoader,
    'postcss-loader': postcssLoader
};

module.exports = class LoaderManager {
    constructor(mpb) {
        this.mpb = mpb;
        // 通过loader处理文件
        this.mpb.hooks.addAsset.tapPromise('LoaderManager', async (asset) => {
            for (let i = this.mpb.config.module.rules.length - 1; i >= 0; i--) {
                const rule = this.mpb.config.module.rules[i];
                const { use, test, exclude, include } = rule;
                if (test.test(asset.name)) {
                    let shouleRunLoder = true;
                    if (Array.isArray(exclude)) {
                        const shouldExclude = mm.any(asset.path, exclude);
                        if (shouldExclude && Array.isArray(include)) {
                            shouleRunLoder = mm.any(asset.path, include);
                        }
                    }
                    if (shouleRunLoder) {
                        for (let j = use.length - 1; j >= 0; j--) {
                            const { loader, options } = use[j];
                            if (typeof loader === 'string') {
                                if (map[loader]) {
                                    // eslint-disable-next-line no-await-in-loop
                                    await map[loader].call(this.mpb, asset, options);
                                } else {
                                    throw new Error(`not found ${loader}`);
                                }
                            } else if (typeof loader === 'function') {
                                // eslint-disable-next-line no-await-in-loop
                                await loader.call(this, asset, options);
                            } else {
                                throw new Error('not support this loader type');
                            }
                        }
                    }
                }
            }
            return Promise.resolve();
        });
    }
};
