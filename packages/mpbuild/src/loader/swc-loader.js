const swc = require('@swc/core');
const _ = require('lodash');

module.exports = function (opts = {}) {
    return function (file) {
        if (file.contents) {
            const fileOpts = _.merge(
                {
                    jsc: {
                        parser: {
                            syntax: 'ecmascript',
                            jsx: false,
                            dynamicImport: false,
                            privateMethod: false,
                            functionBind: false,
                            exportDefaultFrom: false,
                            exportNamespaceFrom: false,
                            decorators: false,
                            decoratorsBeforeExport: false,
                            topLevelAwait: false,
                            importMeta: false,
                        },
                        transform: null,
                        target: 'es5',
                        loose: false,
                        externalHelpers: false,
                        // Requires v1.2.50 or upper and requires target to be es2016 or upper.
                        keepClassNames: false,
                    },
                    filename: file.path,
                    filenameRelative: file.relative,
                    sourceMap: Boolean(file.sourceMap),
                    sourceFileName: file.relative,
                    caller: { name: 'babel-mbp', ...opts.caller },
                },
                opts
            );
            const output = swc.transformSync(file.contents, fileOpts);
            return output.code;
        }
        return Promise.resolve(file);
    };
};
