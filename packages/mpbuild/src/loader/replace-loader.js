/**
 * Created by ximing on 2019-03-14.
 */
const obj = {};

module.exports = function (opts) {
    let { search, replacement } = opts;
    return function replaceLoader(asset) {
        let runReplacement = replacement;
        if (typeof runReplacement === 'function') {
            // Pass the vinyl file object as this.file
            obj.asset = asset;
            runReplacement = runReplacement.bind(obj);
        }
        if (search instanceof RegExp) {
            asset.contents = asset.contents.replace(search, runReplacement);
        } else {
            const chunks = asset.contents.split(search);

            let result;
            if (typeof runReplacement === 'function') {
                result = [chunks[0]];
                for (let i = 1; i < chunks.length; i++) {
                    result.push(runReplacement(search));
                    result.push(chunks[i]);
                }
                result = result.join('');
            } else {
                result = chunks.join(runReplacement);
            }
            asset.contents = result;
        }
        return asset;
    };
};
