const path = require('path');

module.exports = class ReWriteImportedPlugin {
    apply(mpb) {
        mpb.hooks.reWriteImported.tap(
            'ReWriteImportedPlugin',
            ({ importedSrc, asset, resolveType, importedDest }) => {
                return {
                    importedSrc,
                    asset,
                    resolveType,
                    importedDest
                };
            }
        );
    }
};
