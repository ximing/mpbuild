const path = require('path');

function fixNPM(code) {
    code = code.replace(/([\w\[\]a-d\.]+)\s*instanceof Function/g, (matchs, word) => {
        return ` typeof ${word} ==='function' `;
    });
    code = code.replace(/'use strict';\n?/g, '');

    if (/[^\w_]process\.\w/.test(code) && !/typeof process/.test(code)) {
        code = `var process={};${code}`;
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
            }
            return Promise.resolve();
        });
    }
};
