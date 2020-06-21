/**
 * Created by ximing on 2019-03-14.
 */
const path = require('path');

const MPB = require('../src');

module.exports = (entry, { needUglify, replaceMap } = { needUglify: true, replaceMap: {} }) => {
    const jsReplaceLoaderOptions = {
        search: /\$NODE_ENV|\$VERSION/g,
        replacement(match) {
            console.log(match, replaceMap[match]);
            if (replaceMap[match] != null) {
                return replaceMap[match];
            }
            if (replaceMap[match] == null) console.error('jsReplaceLoaderOptions', match);
            return match;
        }
    };
    return {
        // 入口配置文件
        entry,
        // 源码对应目录
        src: path.join(__dirname, 'wechat'),
        output: {
            path: path.join(__dirname, 'dist'),
            npm: 'npm'
        },
        resolve: {
            extensions: {
                es: ['.tsx', '.ts', '.js', '.json'],
                tpl: ['.wxml'],
                style: ['.wxss'],
                manifest: ['.json']
            },
            alias: {
                '@utils': path.join(__dirname, './wechat/utils'),
                '@': path.join(__dirname, './wechat')
            }
        },
        optimization: {
            minimize: {
                js: needUglify,
                wxml: true,
                json: true
            }
        },
        alias: {},
        resources: './res',
        module: {
            rules: [
                {
                    test: /\.wxss$/,
                    use: []
                },
                {
                    test: /\.js$/,
                    include: [
                        '**/node_modules/@mtfe/**/*',
                        '**/node_modules/@tarojs/**/*',
                        '**/node_modules/@lsfe/**/*'
                    ],
                    exclude: ['**/node_modules/**'],
                    use: [
                        {
                            loader: 'replace-loader',
                            options: jsReplaceLoaderOptions
                        },
                        {
                            loader: 'babel-loader'
                        }
                    ]
                },
                {
                    test: /\.json$/,
                    use: [
                        {
                            loader: 'json-loader'
                        }
                    ]
                },
                {
                    test: /\.wxml$/,
                    use: []
                }
            ]
        },
        plugins: [
            new MPB.CleanMbpPlugin({
                path: ['dist/**/*', '!dist/project.config.json']
            }),
            // new MPB.TsTypeCheckPlugin({
            //     project: __dirname
            // }),
            new MPB.ProjectConfigPlugin({
                projectname: 'logo-demo',
                appId: 'wx92916b3adca84096'
            })
        ]
    };
};
