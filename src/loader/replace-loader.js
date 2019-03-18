/**
 * Created by ximing on 2019-03-14.
 */
module.exports = function replaceLoader(asset, opts) {
    let { search, replacement } = opts;
    if (typeof replacement === 'function') {
        // Pass the vinyl file object as this.file
        replacement = replacement.bind({ asset });
    }
    if (search instanceof RegExp) {
        asset.contents = asset.contents.replace(search, replacement);
    } else {
        const chunks = asset.contents.split(search);

        let result;
        if (typeof replacement === 'function') {
            result = [chunks[0]];
            for (let i = 1; i < chunks.length; i++) {
                result.push(replacement(search));
                result.push(chunks[i]);
            }
            result = result.join('');
        } else {
            result = chunks.join(replacement);
        }
        asset.contents = result;
    }
    return asset;
};
