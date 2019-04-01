/**
 * Created by ximing on 2019-03-14.
 */
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const { assetType } = require('./consts');

module.exports = class Asset {
    constructor(filePath, outputFilePath, meta) {
        const parse = path.parse(filePath);
        this.name = parse.base;
        this.ext = parse.ext;
        this.parentDir = parse.dir;
        this.dir = parse.dir;
        this.path = filePath;
        this.filePath = filePath;
        this.__content = null;
        this.__meta = meta || {
            type: assetType.normal
        };
        this.shouldOutput = true;
        this.outputFilePath = outputFilePath;
    }

    setMeta(key, value) {
        this.__meta[key] = value;
        return this.__meta;
    }

    getMeta(key) {
        return this.__meta[key];
    }

    get stats() {
        if (!this.__stats) {
            this.__stats = fs.statSync(this.filePath);
        }
        return this.__stats;
    }

    set mtime(value) {
        this.__mtime = value;
    }

    get mtime() {
        try {
            if (this.__mtime) {
                return this.__mtime;
            }
            return this.stats.mtime.getTime();
        } catch (err) {
            return 0;
        }
    }

    get contents() {
        if (!this.__content) {
            try {
                if (/\.(ts|tsx|js|jsx|wxml|wxss|css|less|scss|text|txt|json)$/.test(this.name)) {
                    this.__content = fs.readFileSync(this.filePath, 'utf-8');
                } else {
                    this.__content = fs.readFileSync(this.filePath);
                }
                this.__stats = fs.statSync(this.filePath);
            } catch (e) {
                this.__content = null;
            }
        }
        return this.__content;
    }

    set contents(__content) {
        this.__content = __content;
    }

    get size() {
        return this.content ? this.content.length : 0;
    }

    exists() {
        return this.getMeta('virtual_file') || fs.existsSync(this.filePath);
    }

    beChanged(asset) {
        return this.mtime !== asset.mtime;
    }

    render(targetPath) {
        if (targetPath || this.outputFilePath) {
            if (this.__content != null) {
                // TODO 做一个
                // if (this.outputFilePath.includes('/mnt/d/project/mall-wxapp/dist')) {
                //     return fse.outputFile(targetPath || this.outputFilePath, this.contents);
                // }
                // return Promise.reject(new Error('dist not in project: ' + this.outputFilePath));
                return fse.outputFile(targetPath || this.outputFilePath, this.contents);
            }
            return Promise.resolve(this);
        }
        return Promise.reject(
            new Error(`[asset.js] emit ${this.path} must have targetPath or outputFilePath`)
        );
    }

    del() {
        return fse.remove(this.outputFilePath);
    }
};
