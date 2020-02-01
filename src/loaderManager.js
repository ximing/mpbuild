/**
 * Created by ximing on 2018/11/24.
 */
const mm = require('micromatch');

const babelLoader = require('./loader/babel-loader');
const fileLoader = require('./loader/file-loader');
const replaceLoader = require('./loader/replace-loader');
const tsLoader = require('./loader/ts-loader');
const tsLoaderNext = require('./loader/ts-loader-next');
const postcssLoader = require('./loader/postcss-loader');
const jsonLoader = require('./loader/json-loader');
const renameLoader = require('./loader/rename-loader');

const map = {
    'babel-loader': babelLoader,
    'file-loader': fileLoader,
    'replace-loader': replaceLoader,
    'ts-loader': tsLoader,
    'json-loader': jsonLoader,
    'ts-loader-next': tsLoaderNext,
    'postcss-loader': postcssLoader,
    'rename-loader': renameLoader
};

module.exports = class LoaderManager {
    constructor(mpb) {
        this.mpb = mpb;
        // 通过loader处理文件
        this.mpb.hooks.addAsset.tapPromise('LoaderManager', async (asset) => {
            for (let i = this.rules.length - 1; i >= 0; i--) {
                const rule = this.rules[i];
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
                            const { loaderInstance } = use[j];
                            try {
                                await loaderInstance.call(this.mpb, asset);
                            } catch (e) {
                                console.error(e);
                                asset.contents = null;
                                asset.shouldOutput = false;
                                break;
                            }
                        }
                    }
                }
            }
            return Promise.resolve();
        });
        this.mpb.breakLoaderPipeline = () => {
            if (!this.mpb.isWatch) {
                process.exit(1);
            }
            throw new Error();
        };
    }

    async initRules() {
        this.rules = [];
        for (let i = this.mpb.config.module.rules.length - 1; i >= 0; i--) {
            const rule = this.mpb.config.module.rules[i];
            const { use, test, exclude, include } = rule;
            for (let j = use.length - 1; j >= 0; j--) {
                const { loader, options } = use[j];
                if (!use[j].loaderInstance) {
                    if (typeof loader === 'string') {
                        if (map[loader]) {
                            // eslint-disable-next-line no-await-in-loop
                            use[j].loaderInstance = await map[loader].call(this.mpb, options);
                        } else {
                            throw new Error(`not found ${loader}`);
                        }
                    } else if (typeof loader === 'function') {
                        // eslint-disable-next-line no-await-in-loop
                        use[j].loaderInstance = await loader.call(this.mpb, options);
                    } else {
                        throw new Error('not support this loader type');
                    }
                }
            }
            this.rules.push({ use, test, exclude, include });
        }
    }
};
