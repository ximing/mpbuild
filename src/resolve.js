const fs = require('fs');
const { CachedInputFileSystem, ResolverFactory } = require('enhanced-resolve');

class Resolve {
    static create({ extensions, alias, modules, lookupStartPath, unsafeCache }) {
        const myResolver = ResolverFactory.createResolver({
            // Typical usage will consume the `fs` + `CachedInputFileSystem`, which wraps Node.js `fs` to add caching.
            // fileSystem: new CachedInputFileSystem(fs, 1000),
            fileSystem: fs,
            useSyncFileSystemCalls: true,
            extensions,
            alias,
            modules,
            unsafeCache,
            enforceExtension: false,
            enableConcord: false,
            symlinks: false,
            // moduleExtensions:extensions,
            mainField: ['browser', 'main'],
        });
        const resolveContext = {};
        return (request, startPath) => {
            return myResolver.resolveSync(
                {},
                startPath || lookupStartPath,
                request,
                resolveContext
            );
        };
    }
}

module.exports = Resolve;
