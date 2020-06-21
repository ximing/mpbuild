/**
 * Created by ximing on 2018/11/24.
 */
const babel = require('@babel/core');

module.exports = function (opts = {}) {
    return function (file) {
        if (file.contents) {
            const fileOpts = { ...opts, filename: file.path,
                filenameRelative: file.relative,
                sourceMap: Boolean(file.sourceMap),
                sourceFileName: file.relative,
                caller: {name: 'babel-mbp', ...opts.caller},};
            return babel.transformAsync(file.contents, fileOpts).then((res) => {
                if (res) {
                    file.contents = res.code;
                    file.babel = res.metadata;
                    file.ast = res.ast;
                }
                return file;
            });
        }
        return Promise.resolve(file);
    };
};
