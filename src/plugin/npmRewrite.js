const path = require('path');

function fixNPM(code) {
    code = code.replace(/([\w\[\]a-d\.]+)\s*instanceof Function/g, (matchs, word) => {
        return ` typeof ${word} ==='function' `;
    });
    code = code.replace(/'use strict';\n?/g, '');

    // if (/[^\w_]process\.\w/.test(code) && !/typeof process/.test(code)) {
    //     code = `var process={};${code}`;
    // }
    if (/[^\w_]process\.\w/.test(code)) {
        code = `var process={env:{NODE_ENV:"production"}};${code}`;
    }
    return code;
}
module.exports = class NPMRewrite {
    apply(mpb) {
        mpb.hooks.addAsset.tapPromise('NPMRewrite', async (asset) => {
            if (
                /\.js$/.test(asset.outputFilePath) &&
                asset.contents &&
                asset.path.indexOf('node_modules')
            ) {
                if (asset.name === '_global.js') {
                    asset.contents = asset.contents.replace("Function('return this')()", 'this');
                } else {
                    asset.contents = fixNPM(asset.contents);
                }
                // @TODO 更好的做法？
                if (asset.filePath.endsWith('react-reconciler/index.js')) {
                    asset.contents = `module.exports = require('./cjs/react-reconciler.production.min.js');`;
                }
                if (asset.filePath.endsWith('react/index.js')) {
                    asset.contents = `module.exports = require('./cjs/react.production.min.js');`;
                }
                if (asset.filePath.endsWith('reflect-metadata/Reflect.js')) {
                    asset.contents = asset.contents.replace('var Reflect;', '');
                }
            }
            return Promise.resolve();
        });
    }
};
