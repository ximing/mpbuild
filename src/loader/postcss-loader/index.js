const path = require('path');
const validateOptions = require('schema-utils');
const postcss = require('postcss');
const postcssrc = require('postcss-load-config');
const workerpool = require('workerpool');

const pool = workerpool.pool(`${__dirname}/worker.js`);

const Warning = require('./Warning.js');
const SyntaxError = require('./Error.js');
const parseOptions = require('./options.js');

async function loader(asset, options = {}) {
    validateOptions(require('./options.json'), options, 'PostCSS Loader');

    const file = asset.path;
    const cssSource = asset.contents;
    const { sourceMap } = options;
    const { length } = Object.keys(options).filter((option) => {
        switch (option) {
            case 'ident':
            case 'config':
            case 'sourceMap':
                return;
            default:
                return option;
        }
    });

    let config;
    if (length) {
        config = parseOptions.call(this, options);
    } else {
        const rc = {
            path: path.dirname(file),
            ctx: {
                file: {
                    extname: path.extname(file),
                    dirname: path.dirname(file),
                    basename: path.basename(file)
                },
                options: {}
            }
        };

        if (options.config) {
            if (options.config.path) {
                rc.path = path.resolve(options.config.path);
            }

            if (options.config.ctx) {
                rc.ctx.options = options.config.ctx;
            }
        }
        config = await postcssrc(rc.ctx, rc.path);
    }

    if (!config) {
        config = {};
    }

    if (config.file) {
        console.error('[postcss loader] config.file', config.file);
        // this.addDependency(config.file);
    }

    // Disable override `to` option from `postcss.config.js`
    if (config.options.to) {
        delete config.options.to;
    }
    // Disable override `from` option from `postcss.config.js`
    if (config.options.from) {
        delete config.options.from;
    }

    const plugins = config.plugins || [];

    options = Object.assign(
        {
            from: file,
            map: sourceMap
                ? sourceMap === 'inline'
                    ? { inline: true, annotation: false }
                    : { inline: false, annotation: false }
                : false
        },
        config.options
    );

    if (typeof options.parser === 'string') {
        options.parser = require(options.parser);
    }

    if (typeof options.syntax === 'string') {
        options.syntax = require(options.syntax);
    }

    if (typeof options.stringifier === 'string') {
        options.stringifier = require(options.stringifier);
    }

    try {
        const result = await postcss(plugins).process(cssSource, options);

        let { css, map, root, processor, messages } = result;

        result.warnings().forEach((warning) => {
            console.warn(new Warning(warning));
        });

        messages.forEach((msg) => {
            if (msg.type === 'dependency') {
                this.addDependency(msg.file);
            }
        });

        map = map ? map.toJSON() : null;

        if (map) {
            map.file = path.resolve(map.file);
            map.sources = map.sources.map((src) => path.resolve(src));
        }

        const ast = {
            type: 'postcss',
            version: processor.version,
            root
        };

        asset.setMeta('ast', ast);
        asset.setMeta('messages', messages);
        asset.setMeta('sourceMap', map);
        asset.contents = css;
    } catch (err) {
        if (err.file) {
            console.log('postcss loader', err.file);
        }
        if (err.name === 'CssSyntaxError') {
            console.log(new SyntaxError(err));
        } else {
            console.log(err);
        }
    }
    return asset;
}

module.exports = loader;
