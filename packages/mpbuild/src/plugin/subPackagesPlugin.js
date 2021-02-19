const _ = require('lodash');

module.exports = class SubPackagesPlugin {
    constructor(opt = {}) {
        this.mustIncludeSubPackage = opt.mustIncludeSubPackage || [];
    }

    apply(mpb) {
        mpb.hooks.resolveAppEntryJS.tap('SubPackagesPlugin', (appEntry) => {
            if (mpb.__subPackages && typeof mpb.__subPackages === 'string') {
                console.log('进入指定子包编译模式，编译子包为:', mpb.__subPackages);
                const subPackageRootArr = this.mustIncludeSubPackage.concat(
                    mpb.__subPackages.split(',')
                );
                const entry = _.cloneDeep(appEntry);
                entry.router = entry.router.filter((item) => !item.root || subPackageRootArr.includes(item.root));
                delete entry.preloadRule;
                return entry;
            }
            return appEntry;
        });
    }
};
