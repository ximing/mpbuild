/**
 * Created by ximing on 2019-03-14.
 */
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const fse = require('fs-extra');
const notifier = require('node-notifier');
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
                if (
                    /\.(ts|tsx|js|jsx|wxml|wxss|css|less|scss|text|txt|json|wxs)$/.test(this.name)
                ) {
                    this.__content = fs.readFileSync(this.filePath, 'utf-8');
                } else {
                    this.__content = fs.readFileSync(this.filePath);
                }
                this.__stats = fs.statSync(this.filePath);
            } catch (e) {
                console.log(chalk.red('[asset] 读取文件失败'));
                console.log(chalk.red(this.filePath));
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
        return this.getMeta('virtual_file') || fs.existsSync(this.filePath);
    }

    beChanged(asset) {
        return this.mtime !== asset.mtime;
    }

    render(mpb) {
        if (this.outputFilePath) {
            if (this.__content != null) {
                if (mpb.hasInit && mpb.isWatch) {
                    console.log(chalk.cyan('[watching-output]'), this.outputFilePath);
                }
                
                return mpb.hooks.beforeRenderFile.promise(this).then(() => fse.outputFile(this.outputFilePath, this.contents)).catch(err => {
                    if (mpb.isWatch) {
                        notifier.notify({
                            title: 'beforeRenderFile hooks error',
                            message: '输出文件失败，具体错误请查看命令行',
                        });
                        console.log(chalk.red('[beforeRenderFile hooks error]'), this.path);
                        console.error(err);
                    } else {
                        console.error(err);
                        process.exit(1);
                    }
                })
                // TODO 做一个
                // if (this.outputFilePath.includes('/mnt/d/project/mall-wxapp/dist')) {
                //     return fse.outputFile(this.outputFilePath, this.contents);
                // }
                // return Promise.reject(new Error('dist not in project: ' + this.outputFilePath));
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
