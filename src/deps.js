const Node = require('./node.js');

module.exports = class Deps {
    constructor(mpb) {
        this.mpb = mpb;
        this.nodes = new Map();
        mpb.hooks.resolve.tap(
            'ResolvePlugin',
            ({ imported, originImported, asset, resolveType }) => {
                this.addEdge(asset.path, imported);
                return { imported, asset, resolveType, originImported };
            }
        );
    }

    addNode(path) {
        if (!this.nodes.get(path)) {
            this.nodes.set(path, new Node(path, this.mpb));
        }
    }

    removeNode(path) {
        const node = this.getNode(path);
        node.remove();
        this.nodes.delete(path);
    }

    getNode(path) {
        let node = this.nodes.get(path);
        if (!node) {
            node = new Node(path, this.mpb);
            this.nodes.set(path, node);
        }
        return node;
    }

    addEdge(parent, child) {
        const parentNode = this.getNode(parent),
            childNode = this.getNode(child);
        parentNode.addChild(childNode);
        childNode.addParent(parentNode);
    }

    removeEdge(parent, child) {
        const parentNode = this.getNode(parent),
            childNode = this.getNode(child);
        parentNode.removeChild(childNode);
        childNode.removeChild(parentNode);
    }

    createEndpoint() {}

    addAssetToEndpoint() {}

    removeAssetFromEndpoint() {}
};
