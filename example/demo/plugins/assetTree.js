/* eslint-disable max-classes-per-file */
const genNodeKey = (filePath, outputFilePath) => `${filePath}-${outputFilePath}`;

class AssetNode {
    constructor(filePath, outputFilePath, parentNode) {
        this.filePath = filePath;
        this.outputFilePath = outputFilePath;
        this.nodeKey = genNodeKey(filePath, outputFilePath);
        // 如果是根节点就没有parents和roots 而有descendants
        this.parents = [];
        this.roots = [];
        this.children = [];
        this.descendants = [];

        this.setAncestry(parentNode);
    }

    addChild(node) {
        if(this.children.find(existedNode => node.filePath === existedNode.filePath && node.outputFilePath === existedNode.outputFilePath)) return;
        this.children.push(node);
    }

    addAncestry(node) {
        if(this.descendants.find(existedNode => node.filePath === existedNode.filePath && node.outputFilePath === existedNode.outputFilePath)) return;
        this.descendants.push(node);
    }

    setParent(node) {
        if(this.parents.find(existedNode => node.filePath === existedNode.filePath && node.outputFilePath === existedNode.outputFilePath)) return;
        this.parents.push(node);
    }

    setRoot(node) {
        if(this.roots.find(existedNode => node.filePath === existedNode.filePath && node.outputFilePath === existedNode.outputFilePath)) return;
        this.roots.push(node);
    }

    setAncestry(parentNode) {
        if(!parentNode) return;
        parentNode.addChild(this);

        this.setParent(parentNode);
        if(parentNode.roots.length) {
            this.roots = parentNode.roots;
            parentNode.roots.forEach(root => root.addAncestry(this));
        } else {
            parentNode.addAncestry(this);
            this.setRoot(parentNode);
        }
    }
}

class AssetTree {
    constructor() {
        this.rootsMap = {};
    }

    buildARoot(asset) {
        const nodeKey = genNodeKey(asset.filePath, asset.outputFilePath);
        if(['component', 'page'].includes(asset.getMeta('type'))) {
            this.rootsMap[nodeKey] = new AssetNode(asset.filePath, asset.outputFilePath);
        }
    }

    // 传入的asset只会是根节点
    deleteRoot(asset) {
        const nodeKey = genNodeKey(asset.filePath, asset.outputFilePath);
        return delete this.rootsMap[nodeKey];
    }

    // 传入的asset可以是根节点可以是碎片节点
    deleteAncestry(asset) {
        const nodeKey = genNodeKey(asset.filePath, asset.outputFilePath);
        if(['component', 'page'].includes(asset.getMeta('type'))) {
            return delete this.rootsMap[nodeKey];
        }

        const roots = this.getDebrisNodeRoots(asset);
        roots.forEach(root =>  delete this.rootsMap[root.nodeKey]);
    }

    addLeaf(asset, filePath, outputFilePath) {
        let child = this.getNode({filePath, outputFilePath}, true);
        const parentNode = this.getNode(asset);
        if(!child) {
            child = new AssetNode(filePath, outputFilePath, parentNode);
        };
        child.setAncestry(parentNode);
    }

    getNode(asset, isDebris = false) {
        const nodeKey = genNodeKey(asset.filePath, asset.outputFilePath);
        if(!isDebris && ['component', 'page'].includes(asset.getMeta('type'))) {
            return this.rootsMap[nodeKey];
        }

        const roots = this.getDebrisNodeRoots(asset);
        if(!roots.length) return;
        
        return roots[0].descendants.find(node => node.filePath === asset.filePath);
    }

    // hasDebrisNode(asset) {
    //     return this.getDebrisNodeRoots(asset).length;
    // }

    getDebrisNodeRoots(asset) {
        return Object.values(this.rootsMap).filter(root => root.descendants.find(node => node.filePath === asset.filePath));
    }
}

module.exports.assetTree = new AssetTree();
module.exports.AssetNode = AssetNode;
module.exports.AssetTree = AssetTree;
