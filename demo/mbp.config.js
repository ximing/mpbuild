/**
 * Created by ximing on 2019-03-14.
 */
const path = require('path');

const MPB = require('../src');

module.exports = (entry) => {
    return {
        // 入口配置文件
        entry,
        // 源码对应目录
        src: path.join(__dirname, 'src'),
        alias: {},
        output: {
            path: path.join(__dirname, 'dist'),
            npm: 'npm'
        },
        platform: 'wx',
        resolve: {
            extensions: {
                js: ['.js', '.ts', '.jsx', '.tsx'],
                wxml: ['.wxml'],
                wxss: ['.wxss'],
                wxs: ['.wxs'],
                config: ['.json']
            }
        },
        optimization: {
            // 如果需要压缩，配置 JS 固话需要过滤的 comment
            minimize: {
                // js: needUglify ? { output: { comments: /javascript-obfuscator:disable|javascript-obfuscator:enable/} } : false,
                js: true,
                wxml: true,
                json: true
            }
        },
        module: {
            rules: [
                {
                    test: /\.wxss$/,
                    use: []
                },
                {
                    test: /\.js$/,
                    include: [],
                    exclude: ['**/node_modules/**'],
                    use: [
                        {
                            loader: 'babel-loader',
                            options: { comments: true }
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
                    test: /\.wxs$/,
                    use: []
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
                projectname: 'test',
                appId: 'test',
                setting: {
                    minified: true
                }
            })
        ]
    };
};
