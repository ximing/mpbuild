const path = require('path');

module.exports = class ReWriteImportedPlugin {
    apply(mpb) {
        mpb.hooks.reWriteImported.tap(
            'ReWriteImportedPlugin',
            ({ importedSrc, asset, resolveType, importedDest }) => {
                let dest = '';
                if (resolveType === 'manifest') {
                    dest = importedDest.replace(mpb.dest, '');
                } else {
                    dest = path.relative(path.dirname(asset.outputFilePath), importedDest);
                    if (dest[0] !== '.') {
                        dest = `./${dest}`;
                        // console.log(dest, importedDest, importedSrc, asset.outputFilePath);
                    }
                }
                return {
                    importedSrc,
                    asset,
                    resolveType,
                    importedDest: dest,
                };
            }
        );
    }
};
