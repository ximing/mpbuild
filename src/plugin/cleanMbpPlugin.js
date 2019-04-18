/**
 * Created by ximing on 2019-04-08.
 */
const del = require('del');
const chalk = require('chalk');

module.exports = class CleanMbpPlugin {
    constructor(options) {
        this.options = Object.assign(
            {},
            {
                path: []
            },
            options
        );
    }

    apply(mpb) {
        mpb.hooks.start.tapPromise('CleanMbpPlugin', async () => {
            if (Array.isArray(this.options.path) && this.options.path.length > 0) {
                console.log(
                    chalk.gray('[CleanMbpPlugin]: '),
                    chalk.blue('删除文件:'),
                    this.options.path
                );
                await del(this.options.path);
            }
            return Promise.resolve();
        });
    }
};
