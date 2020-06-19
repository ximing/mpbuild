const program = require('commander');
const chalk = require('chalk');
const path = require('path');
const perf = require('execution-time')();
const pkg = require('../package.json');
const mbpConfig = require('./mbp.config');
const MPB = require('../src');

const { NODE_ENV } = process.env;

perf.start('build');
program
    .version('0.0.1')
    .option('-u, --uglify', 'uglify js code')
    .option('-w, --watch', 'watch.')
    .parse(process.argv);
const needUglify = !!program.uglify;
const mbp = new MPB(
    mbpConfig(path.join(__dirname, './entry.js'), {
        needUglify,
        replaceMap: {
            $VERSION: pkg.version,
            $NODE_ENV: NODE_ENV
        }
    })
);
if (program.watch) {
    mbp.watch();
} else {
    mbp.run().then(() => {
        console.log(chalk.blue('构建完成,耗时:', perf.stop('build').time));
    });
}
