/**
 * Created by ximing on 2019-03-14.
 */
const path = require('path');

const MPB = require('mpbuild');
const TestPlugin = require('./plugins/testPlugin');
const IncludeExtension = require('./plugins/includeExtension');

const minimize_path = !!process.env.minimize_path;
const dist = minimize_path ? 'minimize_path_dist' : 'dist';
const projectNames = [
    path.join(__dirname, '../projects/one'),
    path.join(__dirname, '../projects/two'),
];
module.exports = {
    // 入口配置文件
    entry: './entry.js',
    // 源码对应目录
    src: path.join(__dirname, 'src'),
    alias: {
        '@one': path.join(__dirname, '../projects/one'),
        '@two': path.join(__dirname, '../projects/two'),
        '@utils': path.join(__dirname, 'src/utils'),
        '@root': path.join(__dirname, 'src'),
        '@components': path.join(__dirname, 'src/components'),
        '@/': function (asset, opt) {
            const { filePath } = asset;
            return projectNames.reduce((projectPath) => {
                if (filePath.includes(projectPath)) return projectPath;
            });
        },
    },
    output: {
        path: path.join(__dirname, dist),
        npm: 'npm',
    },
    optimization: {
        // 如果需要压缩，配置 JS 固话需要过滤的 comment
        minimize: {
            // js: needUglify ? { output: { comments: /javascript-obfuscator:disable|javascript-obfuscator:enable/} } : false,
            js: false,
            wxml: true,
            json: false,
            path: minimize_path,
        },
    },
    module: {
        rules: [
            {
                test: /\.wxss$/,
                use: [
                    {
                        loader: 'postcss-loader',
                        options: {
                            parser: require('postcss-scss'),
                            plugins: [
                                require('@yeanzhi/postcss-advanced-variables')({
                                    variables: {},
                                    importResolve: async (id, cwd, opts) => {
                                        const file = require('path').resolve(cwd, id);
                                        if (file.includes('mixin')) {
                                            return {
                                                file,
                                                contents: require('fs').readFileSync(file, 'UTF-8'),
                                            };
                                        }
                                    },
                                    importFilter: (id) => {
                                        return id.includes('mixin');
                                    },
                                }),
                                require('postcss-nested')({ bubble: ['keyframes'] }),
                            ],
                        },
                    },
                ],
            },
            {
                test: /\.js$/,
                include: [],
                exclude: ['**/node_modules/**'],
                use: [
                    {
                        loader: 'babel-loader',
                        options: { comments: true },
                    },
                ],
            },
            {
                test: /\.json$/,
                use: [
                    {
                        loader: 'json-loader',
                    },
                ],
            },
            {
                test: /\.wxs$/,
                use: [],
            },
            {
                test: /\.wxml$/,
                use: [],
            },
        ],
    },
    plugins: [
        new IncludeExtension(),
        new MPB.PolymorphismPlugin({ platform: 'wx', blockcode: true }),
        new MPB.CleanMbpPlugin({
            path: [`${dist}/**/*`, `!${dist}/project.config.json`],
        }),
        // new MPB.TsTypeCheckPlugin({
        //     project: __dirname
        // }),
        new MPB.ProjectConfigPlugin({
            projectname: 'test',
            appId: 'test',
            setting: {
                minified: true,
            },
        }),
        new MPB.SubProjectPlugin({
            subProjects: [
                {
                    name: '@one',
                    alias: {
                        '@two-b': path.join(__dirname, '../projects/two/utils/b.js'),
                        '@one': path.join(__dirname, '../projects/one'),
                    },
                    src: path.join(__dirname, '../projects/one'),
                },
                {
                    name: '@two',
                    alias: {
                        '@two': path.join(__dirname, '../projects/two'),
                    },
                    src: path.join(__dirname, '../projects/two'),
                },
            ],
        }),
        new TestPlugin(),
    ],
};
