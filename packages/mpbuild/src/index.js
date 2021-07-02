/**
 * Created by ximing on 2018/12/10.
 */
const path = require('path');

const {
    SyncBailHook,
    SyncWaterfallHook,
    AsyncParallelHook,
    AsyncSeriesWaterfallHook,
    AsyncSeriesHook,
    AsyncSeriesBailHook,
} = require('tapable');

const pkg = require('../package.json');
const LoaderManager = require('./loaderManager');
const AssetManager = require('./assetManager');
const log = require('./log');
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
const PolymorphismPlugin = require('./plugin/polymorphismPlugin');
const ResolvePlugin = require('./plugin/resolvePlugin');
const RewriteOutputPathPlugin = require('./plugin/rewriteOutputPathPlugin');
const SubPackagesPlugin = require('./plugin/subPackagesPlugin');
const SubProjectPlugin = require('./plugin/subProjectPlugin');
const NodeEnvironmentPlugin = require('./node/NodeEnvironmentPlugin');
const Asset = require('./asset');
const resolve = require('./resolve');
const { assetType } = require('./consts');

class MpBuilder {
    constructor(config) {
        this.dest = path.resolve(process.cwd(), config.output.path);
        this.src = path.resolve(process.cwd(), config.src);
        this.config = config;
        this.appEntry = {};
        this.cwd = process.cwd();
        this.hooks = {
            configProcess: new SyncWaterfallHook(['opt']),
            beforeAddAsset: new AsyncSeriesWaterfallHook(['asset']),
            addAsset: new AsyncSeriesBailHook(['asset']),
            delAsset: new AsyncSeriesBailHook(['asset']),
            start: new AsyncParallelHook(['mpb']),
            beforeCompile: new AsyncParallelHook(['mpb']),
            afterCompile: new AsyncParallelHook(['mpb']),
            afterGenerateEntry: new AsyncSeriesBailHook(['afterGenerateEntry']),
            beforeEmitFile: new AsyncSeriesWaterfallHook(['asset']),
            beforeRender: new SyncWaterfallHook(['opt']),
            watchRun: new AsyncSeriesHook(['compiler']),
            resolveJS: new SyncBailHook(['libName']),
            resolveAppEntryJS: new SyncBailHook(['entryPath']),
            beforeOutputAppJSON: new SyncWaterfallHook(['entryPath']),
            extension: new SyncWaterfallHook(['ext']),
            rewriteOutputPath: new SyncWaterfallHook(['opt']),
            rewriteOutsideOutputPath: new SyncWaterfallHook(['opt']),
            resolve: new SyncWaterfallHook(['opt']),
            resolveOutside: new SyncWaterfallHook(['opt']),
        };
        this.optimization = {
            minimize: true,
            ...config.optimization,
        };
        this.watching = new Watching(this, async () => {
            await this.hooks.afterCompile.promise(this);
        });
        // 保证顺序
        this.helper = new Helper(this);
        this.loaderManager = new LoaderManager(this);
        this.scan = new Scan(this);
        this.exts = {
            js: ['.js', '.ts', '.jsx', '.tsx'],
            wxml: ['.wxml'],
            wxss: ['.wxss'],
            wxs: ['.wxs'],
            json: ['.json', '.config.js'],
        };
        this.initPlugin();
        this.initHooks();
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
                new ResolvePlugin(),
                new RewriteOutputPathPlugin(),
                new HandleJSDep(),
                new HandleJSONComponentDep(),
                new HandleWXMLDep(),
                new HandleWXSSDep(),
                new NpmRewrite(),
                new MinifyPlugin(),
                new WatchEntry(),
            ],
            this.config.plugins
        );
        this.config.plugins.forEach((p) => {
            p.apply(this);
        });
    }

    initHooks() {
        this.hooks.configProcess.tap('config_process', (item) => item);
        this.config = this.hooks.configProcess.call(this.config);
        this.exts = this.hooks.extension.call(this.exts);
        this.hooks.resolveJS.tap('resolveJS_MP', (item) => item);
        this.hooks.resolveAppEntryJS.tap('resolveAppEntryJS', (item) => item);
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
        log.info(`version: ${pkg.version}`);
        await this.loaderManager.initRules();
        await this.hooks.start.promise(this.mpb);
        await this.scan.run();
        this.hasInit = true;
    }
}

module.exports = MpBuilder;
module.exports.assetType = assetType;
module.exports.resolve = resolve;
module.exports.Asset = Asset;
module.exports.AppJSONPick = AppJSONPick;
module.exports.CopyPlugin = CopyPlugin;
module.exports.CopyImagePlugin = CopyImagePlugin;
module.exports.ProjectConfigPlugin = ProjectConfigPlugin;
module.exports.CleanMbpPlugin = CleanMbpPlugin;
module.exports.TsTypeCheckPlugin = TsTypeCheckPlugin;
module.exports.PolymorphismPlugin = PolymorphismPlugin;
module.exports.SubPackagesPlugin = SubPackagesPlugin;
module.exports.SubProjectPlugin = SubProjectPlugin;
module.exports.version = require('../package.json').version;
