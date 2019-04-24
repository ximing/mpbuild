/**
 * Created by ximing on 2019-04-08.
 */
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const chalk = require('chalk');

// const Asset = require('../mpb/asset.js');

module.exports = class ProjectConfigPlugin {
    constructor(options) {
        this.options = Object.assign(
            {},
            {
                projectname: '',
                appId: ''
            },
            options
        );
    }

    apply(mpb) {
        mpb.hooks.start.tapPromise('ProjectConfigPlugin', async () => {
            // 模拟一个文件出来
            const distDir = path.resolve(process.cwd(), mpb.dest);
            const projectConfigFile = path.join(distDir, 'project.config.json');
            const isExist = fs.existsSync(projectConfigFile);
            if (!isExist) {
                console.log(chalk.gray('[ProjectConfigPlugin]: '), chalk.blue('project.config.json 不存在，重新生成'));
                await fse.outputJson(projectConfigFile, {
                    description: '项目配置文件',
                    packOptions: {
                        ignore: []
                    },
                    setting: {
                        urlCheck: false,
                        es6: false,
                        postcss: true,
                        minified: false,
                        newFeature: true
                    },
                    compileType: 'miniprogram',
                    libVersion: '2.0.3',
                    appid: this.options.appId,
                    projectname: this.options.projectname,
                    scripts: {
                        beforeCompile: '',
                        beforePreview: '',
                        beforeUpload: ''
                    },
                    condition: {
                        search: {
                            current: -1,
                            list: []
                        },
                        conversation: {
                            current: -1,
                            list: []
                        },
                        plugin: {
                            current: -1,
                            list: []
                        },
                        game: {
                            list: []
                        },
                        miniprogram: {
                            current: 31,
                            list: []
                        }
                    }
                });
            }else{
                console.log(chalk.gray('[ProjectConfigPlugin]: '), chalk.blue('project.config.json 存在，不需要重新生成'));
            }
            return Promise.resolve();
        });
    }
};
