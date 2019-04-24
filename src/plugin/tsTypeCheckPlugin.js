/**
 * Created by ximing on 2019-04-18.
 */
const TscWatchClient = require('tsc-watch/client');
const notifier = require('node-notifier');
const chalk = require('chalk');

module.exports = class TsTypeCheckPlugin {
    constructor(options) {
        this.options = Object.assign(
            {},
            {
                project: process.cwd(),
                kill: true
            },
            options
        );
    }

    apply(mpb) {
        const watch = new TscWatchClient();

        watch.on('first_success', () => {
            if (!mpb.isWatch) {
                watch.kill();
            }
        });

        watch.on('subsequent_success', () => {
            // Your code goes here...
        });

        watch.on('compile_errors', () => {
            if (mpb.isWatch) {
                notifier.notify({
                    title: 'typescript-error',
                    message: 'typescript类型校验出错！'
                });
            } else {
                // 如果编译报错，不是watch模式下就直接退出进程
                console.error('[TsTypeCheckPlugin]', chalk.red('ts编译报错'));
                if (this.options.kill) {
                    watch.kill();
                    process.exit(100);
                }
            }
        });

        watch.start('--noClear', '--project', this.options.project, '--watch', '--noEmit');
    }
};
