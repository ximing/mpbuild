/**
 * Created by ximing on 2019-03-15.
 */
const chalk = require('chalk');
const fse = require('fs-extra');
const ejs = require('ejs');
const path = require('path');

const Asset = require('./asset');

module.exports = class JsPackageManager {
    constructor(mpb, globalPath, globalDestPath) {
        this.mpb = mpb;
        this.fileNum = 0;
        this.fileNumObj = {};
        this.mainPkgPathMap = new Map();
        this.subPkgPathMap = new Map();

        this.changePackages = [];

        this.bundlePath = {};
        this.bundleDistPath = {};

        this.bundleAsset = new Map();

        this.globalAsset = null;

        this.bundleTem = path.resolve(__dirname, './template/bundle.ejs');
        this.normalTem = path.resolve(__dirname, './template/normal.ejs');
        this.mpbGlobal = path.resolve(__dirname, './template/mpbGlobal.js');
        this.globalPath = globalPath || path.join(this.mpb.src, '_g.js');
        this.globalDestPath = globalDestPath || path.join(this.mpb.dest, '_g.js');
        const { router } = require(path.resolve(this.mpb.cwd, this.mpb.config.entry));
        for (let i = 0, l = router.length; i < l; i++) {
            let { root } = router[i];
            if (!root) {
                root = '';
            }
            this.bundlePath[root] = this.getBundlePath(root);
            this.bundleDistPath[root] = this.getBundleDestPath(root);
        }
    }

    getRelativePath(from, to) {
        const relativePath = path.relative(path.extname(from) ? path.dirname(from) : from, to);
        return relativePath[0] === '.' ? relativePath : `./${relativePath}`;
    }

    async addBundleAsset(root, source) {
        let asset;
        if (this.bundleAsset[root]) {
            asset = this.bundleAsset[root];
        } else {
            asset = new Asset(this.getBundlePath(root), this.getBundleDestPath(root), {
                virtual_file: true,
                bundle: true,
                root,
            });
        }

        const contents = source || `require('${this.getRelativeGlobalPath(asset.path)}')`;
        // console.log(this.getRelativeGlobalPath(asset.path))
        if (contents !== asset.contents) {
            // console.log( 'addBundleAsset', asset.path, {contents, oldcontents: asset.contents}  )
            asset = new Asset(this.getBundlePath(root), this.getBundleDestPath(root), {
                virtual_file: true,
                bundle: true,
                root,
            });
            asset.contents = contents;
            asset.mtime = Date.now();
            this.bundleAsset[root] = asset;
            await this.mpb.assetManager.addAsset(asset);
        }
    }

    async addGlobalAsset(source = 'function demo(){}') {
        if (this.globalAsset) {
            return;
        }
        this.globalAsset = new Asset(
            this.globalPath,
            this.globalPath.replace(this.mpb.src, this.mpb.dest),
            { virtual_file: true, bundle: true, root: '' }
        );

        this.globalAsset.contents = source;
        this.globalAsset.mtime = Date.now();
        await this.mpb.assetManager.addAsset(this.globalAsset);
    }

    async addChange(root = '', asset) {
        if (this.changePackages.indexOf(root) === -1) {
            this.changePackages.push(root);
            await this.addBundleAsset(root);
        }
        if (!root) {
            this.mainPkgPathMap.set(asset.outputFilePath, {
                num: this.fileNumObj[asset.outputFilePath],
                asset,
            });
        } else {
            if (!this.subPkgPathMap.get(root)) {
                this.subPkgPathMap.set(root, new Map());
            }
            this.subPkgPathMap.get(root).set(asset.outputFilePath, {
                num: this.fileNumObj[asset.outputFilePath],
                asset,
            });
        }
    }

    resolveJs({ libOutputPath, asset, root }) {
        if (Object.hasOwnProperty.call(this.fileNumObj, libOutputPath)) {
            return {
                outputFileName: this.fileNumObj[libOutputPath],
                outputFileNum: this.fileNumObj[libOutputPath],
                name: '_req',
            };
        }
        if (this.bundleDistPath[root] === libOutputPath || this.globalDestPath === libOutputPath) {
            return {
                outputFileName: this.getRelativePath(asset.outputFilePath, libOutputPath),
                name: 'require',
                noNum: true,
            };
        }
        this.fileNumObj[libOutputPath] = ++this.fileNum;
        return {
            outputFileName: this.fileNumObj[libOutputPath],
            outputFileNum: this.fileNumObj[libOutputPath],
            name: '_req',
        };
    }

    async renderBundle({ root, packageModule }) {
        const modules = {};
        const bundlePath = this.getBundlePath(root);
        packageModule.forEach((value) => {
            modules[value.num] = {
                content: value.asset.packContents,
                path: this.getRelativePath(this.mpb.dest, value.asset.outputFilePath),
            };
        });
        const source = await ejs.renderFile(this.bundleTem, {
            rootName: root,
            globalPath: this.getRelativeGlobalPath(bundlePath),
            path: bundlePath,
            modules,
        });

        await this.addBundleAsset(root, source);
    }

    getBundleDestPath(root) {
        return path.join(this.mpb.dest, this.getRelativeBundlePath(root));
    }

    getBundlePath(root) {
        return path.join(this.mpb.src, this.getRelativeBundlePath(root));
    }

    getSrcBundlePath(root) {
        return path.join(this.mpb.src, this.getRelativeBundlePath(root));
    }

    getRelativeBundlePath(root) {
        return path.join(root || '', './_b.js');
    }

    getRelativeGlobalPath(bundlePath) {
        return this.getRelativePath(bundlePath, this.globalPath);
    }

    async renderNormal({ asset, root, moduleId, needRequireBundle }) {
        const source = await ejs.renderFile(this.normalTem, {
            globalPath: this.getRelativePath(asset.outputFilePath, this.globalDestPath),
            bundlePath: this.getRelativePath(asset.outputFilePath, this.getBundleDestPath(root)),
            moduleId,
            needRequireBundle,
        });
        return source;
    }

    async renderGlobal() {
        const source = await ejs.renderFile(this.mpbGlobal);
        await this.addGlobalAsset(source);
    }
};
