/**
 * Created by ximing on 2018/12/10.
 */
const path = require('path');

const {
    AsyncParallelHook,
    AsyncSeriesWaterfallHook,
    AsyncSeriesHook,
    AsyncSeriesBailHook
} = require('tapable');

const LoaderManager = require('./loaderManager');
const AssetManager = require('./assetManager');
const log = require('./log');
const Asset = require('./asset');
const Scan = require('./scan');
const Watching = require('./watching');
const Helper = require('./helper');
const HandleJSDep = require('./plugin/handleJSDep');
const WatchEntry = require('./plugin/watchEntry');
const HandleJSONComponentDep = require('./plugin/handleJSONComponentDep');
const HandleWXSSDep = require('./plugin/handleWXSSDep');
const HandleWXMLDep = require('./plugin/handleWXMLDep');
const NpmRewrite = require('./plugin/npmRewrite');
const MinifyPlugin = require('./plugin/minifyPlugin');
const AppJSONPick = require('./plugin/appJSONPick');
const CopyImagePlugin = require('./plugin/copyImagePlugin');
const ProjectConfigPlugin = require('./plugin/projectConfigPlugin.js');
const CopyPlugin = require('./plugin/copyPlugin');
const CleanMbpPlugin = require('./plugin/cleanMbpPlugin.js');
const TsTypeCheckPlugin = require('./plugin/tsTypeCheckPlugin');
const NodeEnvironmentPlugin = require('./node/NodeEnvironmentPlugin');

class Mpbuilder {
    constructor(config) {
        this.dest = path.resolve(process.cwd(), config.output.path);
        this.src = path.resolve(process.cwd(), config.src);
        this.config = config;
        this.appEntry = {};
        this.cwd = process.cwd();
        this.hooks = {
            delAsset: new AsyncSeriesBailHook(['asset']),
            start: new AsyncParallelHook(['mpb']),
            beforeCompile: new AsyncParallelHook(['mpb']),
            beforeAddAsset: new AsyncSeriesBailHook(['asset']),
            addAsset: new AsyncSeriesBailHook(['asset']),
            afterGenerateEntry: new AsyncSeriesBailHook(['afterGenerateEntry']),
            beforeEmitFile: new AsyncSeriesWaterfallHook(['asset']),
            afterEmitFile: new AsyncSeriesWaterfallHook(['asset']),
            afterCompile: new AsyncParallelHook(['mpb']),
            watchRun: new AsyncSeriesHook(['compiler'])
        };
        this.optimization = Object.assign(
            {
                minimize: true
            },
            config.optimization
        );
        this.watching = new Watching(this, async () => {
            await this.hooks.afterCompile.promise(this);
        });
        // 保证顺序
        this.helper = new Helper(this);
        this.loaderManager = new LoaderManager(this);
        this.scan = new Scan(this);
        this.initPlugin();
        this.assetManager = new AssetManager(this);
        this.hasInit = false;
        this.isWatch = false;
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
                new NpmRewrite(),
                new MinifyPlugin(),
                new WatchEntry()
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
        this.isWatch = true;
        await this.run();
        log.info('开启watching');
        this.watching.watch();
        this.watching.watchEntry();
    }

    async run() {
        await this.loaderManager.initRules();
        await this.hooks.start.promise(this.mpb);
        await this.scan.run();
        this.hasInit = true;
    }
}

module.exports = Mpbuilder;
module.exports.Asset = Asset;
module.exports.AppJSONPick = AppJSONPick;
module.exports.CopyPlugin = CopyPlugin;
module.exports.CopyImagePlugin = CopyImagePlugin;
module.exports.ProjectConfigPlugin = ProjectConfigPlugin;
module.exports.CleanMbpPlugin = CleanMbpPlugin;
module.exports.TsTypeCheckPlugin = TsTypeCheckPlugin;
