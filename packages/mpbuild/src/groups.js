/* eslint-disable max-classes-per-file */
const path = require('path');

class Group {
    constructor(groupSrc, groupDist, type, mpb) {
        this.groupSrc = groupSrc;
        this.groupDist = groupDist;
        this.type = type;
        this.assets = new Map();
        this.mpb = mpb;
        this.typeMap = {};
    }

    addExecingAsset(asset) {
        this.assets.set(asset, false);
        
        const { outputFilePath } = asset;
        this.typeMap[path.extname(outputFilePath).slice(1)] = asset;
    }

    async setAssetShouldEmit(asset) {
        this.assets.set(asset, true);
        await this.checkGroupShouldEmit();
    }

    async checkGroupShouldEmit() {
        const shouldEmit = Array.from(this.assets.values()).every(i => i);

        if(shouldEmit) {
            await this.mpb.hooks.beforeRenderGroup.promise(this);
            Array.from(this.assets.keys()).forEach(asset => asset.render(this.mpb).catch((err) => {
                console.error(err);
            }));
        }
    }

    getTypeAsset(type) {
        return this.typeMap[type];
    }
}

module.exports = class Groups { 
    constructor(mpb) {
        this.mpb = mpb;
        this.groupsMap = {};
    }

    createGroup(groupSrc, groupDist, type) {
        const group = new Group(groupSrc, groupDist, type, this.mpb);
        this.groupsMap[groupDist] = group;
        return group;
    }
}