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
const { getMatcher } = require('./util');

const map = {
    'babel-loader': babelLoader,
    'file-loader': fileLoader,
    'replace-loader': replaceLoader,
    'ts-loader': tsLoader,
    'json-loader': jsonLoader,
    'ts-loader-next': tsLoaderNext,
    'postcss-loader': postcssLoader,
    'rename-loader': renameLoader,
};

module.exports = class LoaderManager {
    constructor(mpb) {
        this.mpb = mpb;
        const manifestMatcher = getMatcher(mpb.extensions.manifest);
        const esMatcher = getMatcher(mpb.extensions.es);
        const styleMatcher = getMatcher(mpb.extensions.style);
        const tplMatcher = getMatcher(mpb.extensions.tpl);
        this.loader = {};
        this.mpb.moduleComposition.forEach((key) => {
            this.loader[key] = {};
        });
        // 通过loader处理文件
        this.mpb.hooks.addAsset.tapPromise('LoaderManager', async (asset) => {
            if (manifestMatcher.test(asset.path)) {
                const { use, exclude, include } = this.loader.manifest;
                await this.runLoader(asset, exclude, include, use);
            } else if (esMatcher.test(asset.path)) {
                const { use, exclude, include } = this.loader.es;
                await this.runLoader(asset, exclude, include, use);
            } else if (styleMatcher.test(asset.path)) {
                const { use, exclude, include } = this.loader.style;
                await this.runLoader(asset, exclude, include, use);
            } else if (tplMatcher.test(asset.path)) {
                const { use, exclude, include } = this.loader.tpl;
                await this.runLoader(asset, exclude, include, use);
            } else {
                console.error(`不识别的文件格式:${asset.path}`);
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

    async runLoader(asset, exclude, include, use) {
        if (!use) {
            return;
        }
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

    async initRules() {
        const { module } = this.mpb.config;
        const keys = Object.keys(module);
        for (let i = 0, l = keys.length; i < l; i++) {
            const key = keys[i];
            const { use, exclude, include } = module[key];
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
            this.loader[key] = {
                use,
                exclude,
                include,
            };
        }
    }
};
