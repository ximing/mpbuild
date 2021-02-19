const NodeWatchFileSystem = require('./NodeWatchFileSystem');

class NodeEnvironmentPlugin {
    apply(mpb) {
        mpb.watchFileSystem = new NodeWatchFileSystem();
    }
}
module.exports = NodeEnvironmentPlugin;
