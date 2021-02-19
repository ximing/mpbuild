#!/usr/bin/env node
const path = require('path');
const { program } = require('commander');

const pkg = require('../package.json');
const mpbIns = require('../src/mpb');

program.version(pkg.version);

program
    .option('-c, --config <config>', '设置配置文件地址,默认 mpb.config.js')
    .option('-cwd, --cwd <cwd>', '设置 cwd')
    .option('-w, --watch', '开启 watch 模式')
    .action((optionValues) => {
        const config = optionValues.config || 'mpb.config.js';
        const cwd = optionValues.cwd || process.cwd();
        const mpb = mpbIns(path.resolve(cwd, config));
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
        console.log('暂时还没实现此命令');
    });

program.parse(process.argv);
