/* eslint-disable no-restricted-syntax */
/* eslint-disable max-classes-per-file */

const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const htmlmin = require('html-minifier');
const chalk = require('chalk');
const notifier = require('node-notifier');
const Asset = require('../asset');
const resolve = require('../resolve');

class VirtualAsset extends Asset {
    render() {
        return Promise.resolve();
    }
}

const debrisType = 'debris';
const ixChildType = 'ixChild';
const debrisContentCache = {};
const rootJsonMap = {};
const mainPkgPathMap = {};

const TYPE = 'ix_type';
const PARENT = 'ix_parent';
const ROOT = 'ix_root';
const EXT = 'ix_ext';

const minifyHtml = (content, mbp) => (mbp.optimization.minimize && mbp.optimization.minimize.wxml) ? htmlmin.minify(content, {
    removeComments: true,
    keepClosingSlash: true,
    collapseWhitespace: true,
    caseSensitive: true,
}) : content;

const replaceNode = (oldNode, newNodes = []) => {
    const nodeIndex = oldNode.parent.children.findIndex(item => item === oldNode);
    oldNode.parent.children.splice(nodeIndex, 1, ...newNodes);
}

const checkCycleDep = (asset, filePath, depStr = '') => {
    if(!depStr) {
        depStr = filePath;
    }

    depStr = `${asset.filePath} ---> ${depStr}`;
    if(asset.filePath === filePath) throw new Error(`[include-extension]: circular dependency : ${depStr}.`);

    const parent = asset.getMeta(PARENT);
    if(parent) {
        checkCycleDep(parent, filePath, depStr);
    }
}

const genDebrisAsset = (filePath, parentAsset, ext = 'wxml', meta = {}) => {
    const rootAsset = parentAsset.getMeta(ROOT) || parentAsset;
    const { dir, name } = path.parse(parentAsset.outputFilePath);
    const newAsset = new VirtualAsset(filePath, `virtual-${path.join(dir, name)}.${ext}`, meta);
    newAsset.setMeta(TYPE, debrisType);
    newAsset.setMeta(PARENT, parentAsset);
    newAsset.setMeta(ROOT, rootAsset);
    newAsset.setMeta(EXT, ext);
    newAsset.mtime = Date.now();
    return newAsset;
}

const findJsonWithWxml = (filePath, mpb) => {
    let { name, dir } = path.parse(filePath);
    // eslint-disable-next-line prefer-destructuring
    if(name.includes('.')) name = name.split('.')[0];
    const jsonPath = resolve.resolveSync(path.join(dir, name), dir, mpb.exts.json);
    if(fs.existsSync(jsonPath)) return jsonPath;
}

const recordTemplateJson = (asset, mpb) => {
    const rootAsset = asset.getMeta(ROOT);
    const key = `${asset.outputFilePath}`; 
    if(!rootAsset) {
        // 没有rootAsset，代表该asset就是rootAsset，此时则清空map
        rootJsonMap[key] = new Map();
    } else {
        const rootKey = `${rootAsset.outputFilePath}`;
        const jsonPath = findJsonWithWxml(asset.filePath, mpb);
        if(!jsonPath) return;
        rootJsonMap[rootKey].set(asset, jsonPath);
    }
}

const replaceIncludex = async (asset, mpb) => {
    recordTemplateJson(asset, mpb);
    const $ = cheerio.load(asset.contents, {
        xmlMode: true,
        decodeEntities: false
    });

    const root = asset.getMeta('root');
    const nodes = Array.from($('includex'));

    for(let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        const { attribs } = node;
        // eslint-disable-next-line no-continue
        if (!attribs.src) continue;

        const res = mpb.hooks.resolve.call({
            lib: attribs.src,
            resolveLib: '',
            asset,
            resolveType: 'wxml',
            exts: ['.wxs'].concat(mpb.exts.wxml),
        });
        const filePath = res.resolveLib;

        const { outputPath } = mpb.hooks.rewriteOutputPath.call({
            filePath,
            asset,
            depType: 'wxml',
        });

        if (!node.children.length) {
            // 如果没有children 代表可以用原生的include能力节约包大小
            node.name = 'include';
            attribs.src = path.relative(
                path.dirname(asset.outputFilePath),
                outputPath
            );
            
            const newAsset = new Asset(filePath, outputPath, {
                [ROOT]: asset.getMeta(ROOT) || asset,
                source: asset.filePath,
                [TYPE]: ixChildType,
                root
            });
            newAsset.mtime = Date.now();

            await mpb.assetManager.addAsset(newAsset);
        } else {
            // 如果有childern就需要走构建的复制粘贴
            checkCycleDep(asset, filePath);
            // 如果我们自定义的节点树上已经不存在该asset了那就用原始content，不然就可以用缓存过的contents
            let includeContent = debrisContentCache[filePath];
            
            if(!includeContent) {
                try {
                    includeContent = fs.readFileSync(filePath).toString();
                    debrisContentCache[filePath] = includeContent;
                } catch(e) {
                    console.log(`[include-extension]: Clear ${asset.filePath} roots map.`);
                    throw e;
                }
            };

            const newAsset = genDebrisAsset(filePath, asset, 'wxml', { root });
            newAsset.contents = includeContent;
            await mpb.assetManager.addAsset(newAsset);
            recordTemplateJson(newAsset, mpb);
            includeContent = newAsset.contents;

            const $includeContent = cheerio.load(includeContent, {
                xmlMode: true,
                decodeEntities: false
            });

            const slots = Array.from($includeContent('slot'));
            const slotMap = {};

            // 先处理具名slot
            slots.forEach(slot => {
                const { attribs = {} } = slot;
                if(attribs.name) {
                    if(slotMap[attribs.name]) throw new Error(`[include-extension]: duplicate slot name: ${attribs.name}.`);
                    slotMap[attribs.name] = slot;
                    const namedChildren = node.children.filter(item => (item.attribs && item.attribs.slot) === attribs.name);
                    if(namedChildren.length > 1) throw new Error(`[include-extension]: duplicate slot elements: ${attribs.name}.`);
                    replaceNode(slot, namedChildren);

                    if(namedChildren.length) {
                        delete namedChildren[0].attribs.slot;
                        // 删除
                        replaceNode(namedChildren[0]);
                    }
                } else {
                    if(slotMap.default) throw new Error(`[include-extension]: duplicate default slot.`);
                    slotMap.default = slot;
                }
            });

            // 最后再处理默认slot
            slotMap.default && replaceNode(slotMap.default, node.children);
            
            // 将整个includex替换成处理好的template
            replaceNode(node, $includeContent.root()[0].children);
        }
    }

    asset.contents = minifyHtml($.html(), mpb);
}

const mergeComponents = async (origin, item, jsonAsset, mpb) => {
    const { filePath, comps } = item;

    for(let key in comps) {
        if(!origin[key]) { origin[key] = comps[key]; }
        else if(origin[key] && origin[key] !== comps[key]) {
            const msg = `[include-extension]: ${jsonAsset.filePath} 与引用的 ${filePath}，usingComponents中的${key}重名了，请修改`;
            if(mpb.isWatch) {
                notifier.notify({
                    title: 'include-extension-error',
                    message: msg,
                });
                console.error(chalk.red(msg));
            } else throw new Error(msg);
        }
    }
    return origin;
}

const addIncludexJson = async (jsonAsset, filePaths, mpb) => {
    const originJson = JSON.parse(jsonAsset.contents);
    const originComps = originJson.usingComponents;
    const root = jsonAsset.getMeta('root');

    const res = await Promise.all(filePaths.map(async filePath => {
        let { outputPath } = mpb.hooks.rewriteOutputPath.call({
            filePath,
            asset: jsonAsset,
            depType: 'json',
        });

        if (outputPath.endsWith('.config.js')) {
            outputPath = outputPath.replace('.config.js', '.json');
        }

        let comps = mainPkgPathMap[outputPath];
        if(!comps || mpb.hasInit) {
            const newAsset = genDebrisAsset(filePath, jsonAsset, 'json', { root });
            await mpb.assetManager.addAsset(newAsset);
            comps = JSON.parse(newAsset.contents).usingComponents;
            if(!root) {
                mainPkgPathMap[outputPath] = comps;
            }
        }

        return {
            filePath,
            comps
        }
    }));

    for(const item of res) mergeComponents(originComps, item, jsonAsset, mpb);
    jsonAsset.contents = JSON.stringify(originJson);
}

module.exports = class IncludeExtension {
    apply(mpb) {
        if(mpb.config.output.component && mpb.config.output.component.relative) throw new Error('includex不支持相对路径模式，如需支持联系yozosann');

        mpb.hooks.actionBeforeHandleOnWatching.tapPromise('IncludeExtension', async (asset, type) => {
            const assetType = asset.getMeta(TYPE);
            if(!assetType) return false;

            debrisContentCache[asset.filePath] = undefined;

            // 无论删除还更改都是一样都处理
            if(assetType === ixChildType) {
                console.log(chalk.cyan('[include-extension]'), `${ixChildType} ${asset.filePath} rebuild.`);
                const newAsset = new Asset(asset.filePath, asset.outputFilePath, asset.getMeta());
                newAsset.mtime = Date.now();
                return mpb.assetManager.addAsset(newAsset);
            }

            if(assetType === debrisType) {
                const rootAsset = asset.getMeta(ROOT);
                console.log(chalk.cyan('[include-extension]'), `${debrisType} ${asset.filePath} ${type}, ${rootAsset.filePath} rebuild.`);
                const newAsset = new Asset(rootAsset.filePath, rootAsset.outputFilePath, rootAsset.getMeta());
                newAsset.mtime = Date.now();
                return mpb.assetManager.addAsset(newAsset);
            }
        })

        mpb.hooks.beforeEmitFile.tapPromise('IncludeExtension', async (asset) => {
            if (/\.wxml$/.test(asset.name)) {

                if (asset.contents.includes('includex')) { 
                    await replaceIncludex(asset, mpb);
                }

                if (asset.getMeta(TYPE) === ixChildType) {
                    const $ = cheerio.load(asset.contents, {
                        xmlMode: true,
                        decodeEntities: false
                    });

                    const nodes = Array.from($('slot'));
                    nodes.forEach(node => {
                        replaceNode(node, node.children);
                    });

                    asset.contents = minifyHtml($.html(), mpb);
                }
            }

            const group = asset.getMeta('group');
            if (/\.json$/.test(asset.name) && mpb.hasInit && group) {
                const wxmlAsset = group.getTypeAsset('wxml');
                const { outputFilePath } = wxmlAsset || {};
                if(!rootJsonMap[outputFilePath]) return;
                const filePaths = Array.from(new Set(rootJsonMap[outputFilePath].values()));
                await addIncludexJson(asset, filePaths, mpb);
            }
            return asset;
        });

        mpb.hooks.beforeRenderGroup.tapPromise('IncludeExtension', async group => {
            const asset = group.getTypeAsset('wxml');
            const { outputFilePath } = asset || {};
            if(!rootJsonMap[outputFilePath]) return;
            const jsonAsset = group.getTypeAsset('json');
            const filePaths = Array.from(new Set(rootJsonMap[outputFilePath].values()));
            await addIncludexJson(jsonAsset, filePaths, mpb);
            return group;
        })
    }
};

