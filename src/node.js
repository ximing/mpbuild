const _ = require('lodash');
const path = require('path');
const { assetType } = require('./consts');

module.exports = class Node {
    constructor(path, mpb) {
        this.path = path;
        this.mpb = mpb;
        this.parents = new WeakSet();
        this.childs = new WeakSet();
    }

    addChild(path) {
        this.childs.add(path);
    }

    removeChild(path) {
        this.childs.delete(path);
    }

    addParent(path) {
        this.parents.add(path);
    }

    removeParent(path) {
        this.parents.delete(path);
    }

    getEndpoints() {
        const endpoints = [];
        for (const p of this.parents) {
            const assets = this.mpb.assetManager.getAssets(p.path);
            if (assets && assets[0]) {
                if (
                    assets[0].getMeta('type') === assetType.page ||
                    assets[0].getMeta('type') === assetType.app
                ) {
                    endpoints.push({
                        endpoind: path.join(assets[0].dir, assets[0].name, '.js'),
                        assetType: assets[0].getMeta('type'),
                    });
                }
            } else {
                console.warn(`没找到对应的资源${p.path}`);
            }
        }
        return _.unionBy(endpoints, 'endpoind');
    }

    getNearestModules() {
        const modules = [];
        for (const p of this.parents) {
            const assets = this.mpb.assetManager.getAssets(p.path);
            if (assets && assets[0]) {
                if (
                    assets[0].getMeta('type') === assetType.page ||
                    assets[0].getMeta('type') === assetType.component ||
                    assets[0].getMeta('type') === assetType.app
                ) {
                    modules.push({
                        endpoind: path.join(assets[0].dir, assets[0].name, '.js'),
                        assetType: assets[0].getMeta('type'),
                    });
                }
            } else {
                console.warn(`没找到对应的资源${p.path}`);
            }
        }
        return _.unionBy(modules, 'endpoind');
    }

    remove() {
        for (const p of this.parents) {
            p.removeChild(this);
        }
        for (const c of this.childs) {
            c.removeParent(this);
        }
    }
};
