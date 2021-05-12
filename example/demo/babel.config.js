module.exports = function (api) {
    api.cache(false);
    return {
        presets: [
            [
                '@babel/preset-env',
                {
                    targets: {
                        browsers: ['safari >= 10', 'android >= 5.0']
                    },
                    modules: 'commonjs',
                    loose: true,
                },
            ],
            // [
            //     '@babel/preset-env',
            //     {
            //         targets: {
            //             esmodules:true
            //         },
            //         modules: false,
            //         loose: true,
            //     },
            // ],
        ],
        ignore: [],
        comments: false,
        plugins: [
            [
                '@babel/plugin-transform-runtime',
                {
                    corejs: false,
                    helpers: true,
                    regenerator: true,
                    useESModules: false,
                },
            ],
            [
                'transform-define',
                {
                    'process.env.NODE_ENV': 'production',
                },
            ],
        ],
    };
};
