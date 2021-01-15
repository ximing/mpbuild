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
const ResolveOutputJsPack = require('./plugin/resolveOutputJsPack');
const NodeEnvironmentPlugin = require('./node/NodeEnvironmentPlugin');
const JsPackageManager = require('./jsPackageManager');

class Mpbuilder {
    constructor(config) {
        this.dest = path.resolve(process.cwd(), config.output.path);
        this.src = path.resolve(process.cwd(), config.src);
        this.config = config;
        this.appEntry = {};
        this.cwd = process.cwd();
        this.hooks = {
            addAsset: new AsyncSeriesBailHook(['asset']),
            delAsset: new AsyncSeriesBailHook(['asset']),
            start: new AsyncParallelHook(['mpb']),
            beforeCompile: new AsyncParallelHook(['mpb']),
            afterCompile: new AsyncParallelHook(['mpb']),
            afterGenerateEntry: new AsyncSeriesBailHook(['afterGenerateEntry']),
            beforeEmitFile: new AsyncSeriesWaterfallHook(['asset']),
            watchRun: new AsyncSeriesHook(['compiler']),
            resolveJS: new SyncBailHook(['libName']),
            resolveAppEntryJS: new SyncBailHook(['entryPath']),
            beforeOutputAppJSON: new SyncWaterfallHook(['entryPath']),
            extension: new SyncWaterfallHook(['ext']),
            rewriteOutputPath: new SyncWaterfallHook(['opt']),
            resolveOutputJsPack: new SyncWaterfallHook(['mpb']),
            resolve: new SyncWaterfallHook(['opt']),
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
        this.jsPackageManager = new JsPackageManager(this);
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
                new PolymorphismPlugin(),
                new ResolvePlugin(),
                new RewriteOutputPathPlugin(),
                new HandleJSDep(),
                new ResolveOutputJsPack(),
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

module.exports = Mpbuilder;
module.exports.AppJSONPick = AppJSONPick;
module.exports.CopyPlugin = CopyPlugin;
module.exports.CopyImagePlugin = CopyImagePlugin;
module.exports.ProjectConfigPlugin = ProjectConfigPlugin;
module.exports.CleanMbpPlugin = CleanMbpPlugin;
module.exports.TsTypeCheckPlugin = TsTypeCheckPlugin;
