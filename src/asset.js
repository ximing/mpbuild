/**
 * Created by ximing on 2019-03-14.
 */
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const chalk = require('chalk');
const { assetType, virtual_file } = require('./consts');

module.exports = class Asset {
    constructor(filePath, outputFilePath, meta) {
        const parse = path.parse(filePath);
        this.name = parse.base;
        this.fileName = parse.name;
        this.ext = parse.ext;
        this.parentDir = parse.dir;
        this.dir = parse.dir;
        this.path = filePath;
        this.filePath = filePath;
        this.__content = null;
        this.__meta = meta || {
            type: assetType.normal,
        };
        this.shouldOutput = true;
        this.outputFilePath = outputFilePath;
    }

    setMeta(key, value) {
        this.__meta[key] = value;
        return this.__meta;
    }

    getMeta(key) {
        if (key === undefined) return this.__meta;
        return this.__meta[key];
    }

    switchToVirtualFile() {
        this.setMeta(virtual_file, virtual_file);
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
        if (typeof this.__content !== 'string') {
            try {
                if (
                    /\.(ts|tsx|js|jsx|wxml|wxss|css|less|scss|text|txt|json|wxs)$/.test(this.name)
                ) {
                    this.__content = fs.readFileSync(this.filePath, 'utf-8');
                } else {
                    this.__content = fs.readFileSync(this.filePath);
                }
                this.__stats = fs.statSync(this.filePath);
            } catch (e) {
                console.log('读取文件失败', this.filePath);
                console.error(e);
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
        return this.getMeta(virtual_file) || fs.existsSync(this.filePath);
    }

    beChanged(asset) {
        return this.mtime !== asset.mtime;
    }

    async render(mpb) {
        if (this.outputFilePath) {
            if (this.__content != null) {
                if (mpb.hasInit && mpb.isWatch) {
                    console.log(chalk.cyan('[watching-output]'), this.outputFilePath);
                }
                // TODO 做一个安全监测
                // if (this.outputFilePath.includes('/mnt/d/project/mall-wxapp/dist')) {
                //     return fse.outputFile(this.outputFilePath, this.contents);
                // }
                // return Promise.reject(new Error('dist not in project: ' + this.outputFilePath));
                const { contents, outputFilePath } = await mpb.hooks.renderTemplate.promise({
                    path: this.path,
                    name: this.name,
                    ext: this.ext,
                    meta: this.__meta,
                    outputFilePath: this.outputFilePath,
                    contents: this.contents,
                });
                return fse.outputFile(outputFilePath, contents);
            }
            if (mpb.hasInit && mpb.isWatch) {
                console.log('[watch]:文件内容为空，不输出', this.outputFilePath);
            }
            return Promise.resolve(this);
        }
        return Promise.reject(new Error(`[asset.js] emit ${this.path} must have outputFilePath`));
    }

    del() {
        return fse.remove(this.outputFilePath);
    }
};
