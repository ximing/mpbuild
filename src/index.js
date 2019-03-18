/**
 * Created by ximing on 2018/12/10.
 */
const path = require('path');
const fse = require('fs-extra');
const chalk = require('chalk');
const {
    AsyncParallelHook,
    AsyncSeriesWaterfallHook,
    AsyncSeriesHook,
    AsyncSeriesBailHook
} = require('tapable');

const LoaderManager = require('./loaderManager');
const AssetManager = require('./assetManager');
const log = require('./log');
const Scan = require('./scan');
const Watching = require('./watching');
const Helper = require('./helper');
const HandleJSDep = require('./plugin/handleJSDep');
const HandleJSONComponentDep = require('./plugin/handleJSONComponentDep');
const HandleWXSSDep = require('./plugin/handleWXSSDep');
const HandleWXMLDep = require('./plugin/handleWXMLDep');
const NpmRewrite = require('./plugin/npmRewrite');
const AppJSONPick = require('./plugin/appJSONPick');
const CopyImagePlugin = require('./plugin/copyImagePlugin');
const CopyPlugin = require('./plugin/copyPlugin');
const NodeEnvironmentPlugin = require('./node/NodeEnvironmentPlugin');

class Mpbuilder {
    constructor(config) {
        this.dest = config.output.path;
        this.src = path.resolve(process.cwd(), config.src);
        this.config = config;
        this.appEntry = {};
        this.cwd = process.cwd();
        this.hooks = {
            addAsset: new AsyncSeriesBailHook(['asset']),
            delAsset: new AsyncSeriesBailHook(['asset']),
            start: new AsyncParallelHook(['compiler']),
            beforeCompile: new AsyncParallelHook(['mpb']),
            afterCompile: new AsyncParallelHook(['mpb']),
            afterGenerateEntry: new AsyncSeriesBailHook(['afterGenerateEntry']),
            beforeEmitFile: new AsyncSeriesWaterfallHook(['asset']),
            watchRun: new AsyncSeriesHook(['compiler'])
        };
        this.watching = new Watching(this, async () => {
            await this.hooks.afterCompile.promise(this);
        });
        // 保证顺序
        this.helper = new Helper(this);
        this.loaderManager = new LoaderManager(this);
        this.scan = new Scan(this);
        this.initPlugin();
        this.assetManager = new AssetManager(this);
    }

    initPlugin() {
        if (!Array.isArray(this.config.plugins)) {
            this.config.plugins = [];
        }
        this.config.plugins = [].concat(
            [
                new NodeEnvironmentPlugin(),
                new HandleJSDep(),
                new HandleJSONComponentDep(),
                new HandleWXMLDep(),
                new HandleWXSSDep(),
                new NpmRewrite()
            ],
            this.config.plugins
        );
        this.config.plugins.forEach((p) => {
            p.apply(this);
        });
    }

    mountPlugin(plugin) {
        this.config.plugins.push(plugin);
        plugin.apply(this);
    }

    async watch() {
        await this.run();
        this.watching.watch();
    }

    async run() {
        await this.scan.run();
    }
}

module.exports = Mpbuilder;
module.exports.AppJSONPick = AppJSONPick;
module.exports.CopyPlugin = CopyPlugin;
module.exports.CopyImagePlugin = CopyImagePlugin;
