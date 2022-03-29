/**
 * Created by ximing on 2019-03-14.
 */
const path = require('path');

module.exports = function (opt) {
    return async function (asset) {
        const { dest } = this;
        const __filename = asset.outputFilePath.replace(`${dest}/`, '');
        const __dirname = path.dirname(__filename);
        // eslint-disable-next-line
        const injectVar = Object.assign(
            { __filename, __dirname },
            opt && opt.custom ? opt.custom(asset, this) : {}
        );
        const varStr = Object.keys(injectVar)
            .reduce((pre, cur) => {
                pre.push(`${cur}='${injectVar[cur]}'`);
                return pre;
            }, [])
            .join(',');
        asset.contents = `var ${varStr};${asset.contents}`;
        return asset;
    };
};
