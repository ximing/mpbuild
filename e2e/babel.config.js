module.exports = function(api) {
    api.cache(false);
    return {
        presets: [
            [
                '@babel/preset-env',
                {
                    targets: {
                        browsers: ['safari >= 9', 'android >= 4.0']
                    },
                    modules: 'commonjs'
                }
            ]
        ],
        ignore: [
            'src/login/authrize/**/*',
            'src/login/npm/**/*',
            'src/login/subpages/**/*',
            'src/login_mmp/index.js',
            'src/login/index.js',
            'src/login/urls.js'
        ],
        comments: false,
        env: {
        },
        plugins: [
            [
                '@babel/plugin-proposal-decorators',
                {
                    legacy: true
                }
            ],
            '@babel/plugin-syntax-dynamic-import',
            '@babel/plugin-syntax-import-meta',
            '@babel/plugin-proposal-class-properties',
            '@babel/plugin-proposal-json-strings',
            '@babel/plugin-proposal-function-sent',
            '@babel/plugin-proposal-export-namespace-from',
            '@babel/plugin-proposal-numeric-separator',
            '@babel/plugin-proposal-throw-expressions',
            '@babel/plugin-proposal-export-default-from',
            '@babel/plugin-proposal-logical-assignment-operators',
            '@babel/plugin-proposal-optional-chaining',
            [
                '@babel/plugin-proposal-pipeline-operator',
                {
                    proposal: 'minimal'
                }
            ],
            '@babel/plugin-proposal-nullish-coalescing-operator',
            '@babel/plugin-proposal-do-expressions',
            '@babel/plugin-proposal-function-bind',
            [
                '@babel/plugin-transform-runtime',
                {
                    corejs: false,
                    helpers: true,
                    regenerator: true,
                    useESModules: false
                }
            ],
            [
                'transform-define',
                {
                    'process.env.NODE_ENV': 'production'
                }
            ]
        ]
    };
};
