const _ = require('lodash');
const path = require('path');
const { assetType } = require('./consts');

module.exports = class Node {
    constructor(path, mpb) {
        this.path = path;
        this.mpb = mpb;
        this.parents = new Set();
        this.childs = new Set();
    }

    addChild(node) {
        this.childs.add(node);
    }

    removeChild(node) {
        this.childs.delete(node);
    }

    addParent(node) {
        this.parents.add(node);
    }

    removeParent(node) {
        this.parents.delete(node);
    }

    getEndpoints() {
        const endpoints = [];
        const stack = new WeakSet();
        const _getEndpoints = (parents) => {
            for (const p of parents) {
                if (!stack.has(p)) {
                    stack.add(p);
                    const assets = this.mpb.assetManager.getAssets(p.path);
                    if (assets && assets[0]) {
                        if (
                            assets[0].getMeta('type') === assetType.page ||
                            assets[0].getMeta('type') === assetType.app
                        ) {
                            const modulePath = path.join(assets[0].dir, assets[0].fileName);
                            endpoints.push({
                                modulePath,
                                entryPath: assets[0].path,
                                endpoind: this.mpb.scan.moduleMap.get(modulePath),
                                assetType: assets[0].getMeta('type'),
                            });
                        } else {
                            _getEndpoints(p.parents);
                        }
                    } else {
                        console.warn(`没找到对应的资源${p.path}`);
                    }
                }
            }
        };
        _getEndpoints([this]);
        return _.unionBy(endpoints, 'endpoind');
    }

    getNearestModules() {
        const modules = [];
        const stack = new WeakSet();
        const _getNearestModules = (parents) => {
            for (const p of parents) {
                if (!stack.has(p)) {
                    stack.add(p);
                    const assets = this.mpb.assetManager.getAssets(p.path);
                    if (assets && assets[0]) {
                        if (
                            assets[0].getMeta('type') === assetType.page ||
                            assets[0].getMeta('type') === assetType.component ||
                            assets[0].getMeta('type') === assetType.app
                        ) {
                            const modulePath = path.join(assets[0].dir, assets[0].fileName);
                            modules.push({
                                modulePath,
                                endpoind: this.mpb.scan.moduleMap.get(modulePath),
                                assetType: assets[0].getMeta('type'),
                            });
                        } else {
                            _getNearestModules(p.parents);
                        }
                    } else {
                        console.warn(`没找到对应的资源${p.path}`);
                    }
                }
            }
        };
        _getNearestModules([this]);
        return _.unionBy(modules, 'endpoind');
    }

    getAllChildrens() {
        const childs = new Set();
        const stack = new WeakSet();
        const _getChildrens = (_childs) => {
            for (const p of _childs) {
                if (!stack.has(p)) {
                    stack.add(p);
                    const assets = this.mpb.assetManager.getAssets(p.path);
                    if (assets && assets[0]) {
                        // const modulePath = path.join(assets[0].dir, assets[0].fileName);
                        childs.add(p.path);
                    } else {
                        console.warn(`没找到对应的资源${p.path}`);
                    }
                    _getChildrens(p.childs);
                }
            }
        };
        _getChildrens(this.childs);
        return Array.from(childs);
        // return _.unionBy(childs, 'path');
    }

    remove() {
        for (const p of this.parents) {
            p.removeChild(this);
        }
        for (const c of this.childs) {
            c.removeParent(this);
        }
        this.parents.clear();
        this.childs.clear();
        this.mpb = null;
        this.parents = null;
        this.childs = null;
    }
};
