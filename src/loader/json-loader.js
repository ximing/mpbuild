const path = require('path');
const _ = require('lodash');

module.exports = function(opts) {
    return function replaceLoader(asset) {
        try {
            let contents = JSON.parse(asset.contents);
            if (contents.extends) {
                if(typeof contents.extends === 'string'){
                    let filePath= '';
                    if(contents.extends[0]==='.'){
                         filePath = path.resolve(asset.dir, contents.extends);
                    }else{
                        filePath = path.join(this.src, contents.extends);
                    }
                    contents = _.merge({}, contents, require(filePath));
                    delete contents['extends'];
                    asset.contents = JSON.stringify(contents);
                }else{
                    console.error('[json-loader] extends 必须为字符串');
                }
            }
        } catch (e) {
            console.error('[json-loader]', e);
        }
        return asset;
    };
};
