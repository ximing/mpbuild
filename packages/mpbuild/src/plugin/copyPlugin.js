module.exports = class CopyPlugin {
    constructor(options) {
        this.options = options;
    }

    async apply(mpb) {
        console.log('CopyPlugin');
    }
};
