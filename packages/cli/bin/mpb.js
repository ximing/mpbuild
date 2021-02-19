#!/usr/bin/env node
const path = require('path');
const chalk = require('chalk');
const { program } = require('commander');

const pkg = require('../package.json');
const mpbIns = require('../src/mpb');

program.version(pkg.version);

program
    .option('-c, --config <config>', '设置配置文件地址,默认 mpb.config.js')
    .option('-cwd, --cwd <cwd>', '设置 cwd')
    .option('-w, --watch', '开启 watch 模式')
    .option('-subPackages, --subPackages <subPackages>', '构建指定子包')
    .action((optionValues) => {
        const config = optionValues.config || 'mpb.config.js';
        const cwd = optionValues.cwd || process.cwd();
        const mpb = mpbIns(path.resolve(cwd, config));
        if (optionValues.subPackages) {
            mpb.__subPackages = optionValues.subPackages;
        }
        if (optionValues.watch) {
            mpb.watch();
        } else {
            mpb.run();
        }
    });

program
    .command('analyze <path>')
    .description('使用 https://github.com/ximing/mp-analyzer 分析包体积')
    .action((path, options) => {
        try {
            // eslint-disable-next-line
            const { default: ANA } = require('mp-analyzer');
            const ana = new ANA(path.join(process.cwd(), path));
            ana.run();
        } catch (err) {
            if (err.message.includes(`Cannot find module 'mp-analyzer'`)) {
                console.log(chalk.red('请先安装 mp-analyzer:  npm i -D mp-analyzer'));
            } else {
                throw err;
            }
        }
    });

program.parse(process.argv);
