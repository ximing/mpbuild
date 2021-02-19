/**
 * Created by ximing on 2019-03-14.
 */
// const pathAlias = require('path-alias');
const path = require('path');
const os = require('os');

module.exports = class Helper {
    constructor(mpb) {
        this.mpb = mpb;
        // let { alias } = this.mpb.config;
        // if (!alias) {
        //     alias = {};
        // }
        // Object.keys(alias).forEach((key) => {
        //     pathAlias.setAlias(key, alias[key]);
        // });
    }

    // getFilePath(base, filePath) {
    //     // 如果 src 下面 json里面使用了 /aa/xxx 这种 绝对路径，按照微信的解析方式就是相对于 src目录为绝对路径的开始
    //     // 相同的js等都是这个规则，所以这里解析就要按照此规则来，如果是src外的地址，那就要依据dist转换为相对应的地址
    //     // if (filePath.includes('@')) {
    //     //     const newPath = pathAlias(filePath);
    //     //     if (newPath !== filePath) return newPath;
    //     // }
    //     // 如果包含node_modules说明是引用的外部组件直接直接处理文件路径
    //     if (filePath.includes('node_modules')) {
    //         if (filePath.includes(base)) {
    //             return filePath;
    //         }
    //         return path.resolve(base, filePath);
    //     }
    //     if (filePath.includes('@')) {
    //         const newPath = pathAlias.resolve(filePath);
    //         if (newPath !== filePath) return newPath;
    //     } else if (filePath[0] === '/') {
    //         return path.resolve(this.mpb.config.src, filePath.substr(1));
    //     }
    //     return path.resolve(base, filePath);
    // }

    splitExtension(fileName, knownExtensions) {
        if (knownExtensions) {
            for (const ext of knownExtensions) {
                const index = fileName.length - ext.length - 1;
                if (fileName.substr(index) === `.${ext}`) {
                    return [fileName.substr(0, index), ext];
                }
            }
        }

        const ext = path.extname(fileName).toLowerCase().substr(1);
        const index = fileName.length - ext.length;
        return [fileName.substr(0, index - 1), ext];
    }
};
