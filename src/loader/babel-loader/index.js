/**
 * Created by ximing on 2018/11/24.
 */
const babel = require('@babel/core');

module.exports = function(file, opts) {
    opts = opts || {};
    const fileOpts = Object.assign({}, opts, {
        filename: file.path,
        filenameRelative: file.relative,
        sourceMap: Boolean(file.sourceMap),
        sourceFileName: file.relative,
        caller: Object.assign({ name: 'babel-mbp' }, opts.caller)
    });
    return babel.transformAsync(file.contents, fileOpts).then((res) => {
        if (res) {
            file.contents = res.code;
            file.babel = res.metadata;
        }
        return file;
    });
};
