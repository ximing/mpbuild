const ts = require('typescript');
const chalk = require('chalk');
const {
    getDefaultOptions,
    getCompilerOptionsFromTsConfig,
    adjustCompilerOptions
} = require('./options.js');
const { createFilter } = require('../../util');
const { groupByFile } = require('./util');
const codeframe = require('./codeFrame');

module.exports = function typescript(asset, options = {}) {
    options = Object.assign({}, options);

    const filter = createFilter(
        options.include || ['*.ts+(|x)', '**/*.ts+(|x)'],
        options.exclude || ['*.d.ts', '**/*.d.ts']
    );
    delete options.include;
    delete options.exclude;

    // Allow users to override the TypeScript version used for transpilation and tslib version used for helpers.
    const typescript = options.typescript || ts;

    delete options.typescript;
    delete options.tslib;

    // Load options from `tsconfig.json` unless explicitly asked not to.
    const tsconfig =
        options.tsconfig === false
            ? {}
            : getCompilerOptionsFromTsConfig(typescript, options.tsconfig);

    delete options.tsconfig;

    // Since the CompilerOptions aren't designed for the Rollup
    // use case, we'll adjust them for use with Rollup.
    adjustCompilerOptions(typescript, tsconfig);
    adjustCompilerOptions(typescript, options);

    options = Object.assign(tsconfig, getDefaultOptions(), options);

    // Verify that we're targeting ES2015 modules.
    const moduleType = options.module.toUpperCase();
    if (
        moduleType !== 'ES2015' &&
        moduleType !== 'ES6' &&
        moduleType !== 'ESNEXT' &&
        moduleType !== 'COMMONJS'
    ) {
        throw new Error(
            `typescript-loader: The module kind should be 'ES2015' or 'ESNext, found: '${
                options.module
            }'`
        );
    }

    const parsed = typescript.convertCompilerOptionsFromJson(options, process.cwd());

    if (parsed.errors.length) {
        parsed.errors.forEach((error) =>
            console.error(`mpb-lodder-typescript: ${error.messageText}`)
        );

        throw new Error(`mpb-lodder-typescript: Couldn't process compiler options`);
    }

    const compilerOptions = parsed.options;
    const [outputPrefix] = this.helper.splitExtension(asset.outputFilePath);
    asset.outputFilePath = `${outputPrefix}.js`;
    if (!filter(asset.name)) {
        asset.contents = '// ts file';
        return asset;
    }
    const transformed = typescript.transpileModule(asset.contents, {
        fileName: asset.name,
        reportDiagnostics: true,
        compilerOptions
    });

    // All errors except `Cannot compile modules into 'es6' when targeting 'ES5' or lower.`
    const diagnostics = transformed.diagnostics
        ? transformed.diagnostics.filter((diagnostic) => diagnostic.code !== 1204)
        : [];

    let fatalError = false;

    const groupedByFile = groupByFile(diagnostics);
    const formattedDiagnostics = Object.keys(groupedByFile)
        .map((file) => groupedByFile[file])
        .map((diagnostics) => codeframe(diagnostics, asset.dir));
    console.log('formattedDiagnostics', formattedDiagnostics);
    formattedDiagnostics.forEach((diagnostic) => {
        if (diagnostic.category === ts.DiagnosticCategory.Error) {
            console.log(chalk.red('[ts-loader-error]'), asset.path);
            fatalError = true;
        }
        console.log(diagnostic.FormattedDiagnostic);
    });
    // diagnostics.forEach((diagnostic) => {
    //     const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    //
    //     if (diagnostic.file) {
    //         const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
    //             diagnostic.start
    //         );
    //         console.error(
    //             `${diagnostic.file.fileName}(${line + 1},${character + 1}): error TS${
    //                 diagnostic.code
    //             }: ${message}`
    //         );
    //     } else {
    //         console.error(`[ts-loader] Error: ${message}`);
    //     }
    //
    //     if (diagnostic.category === ts.DiagnosticCategory.Error) {
    //         fatalError = true;
    //     }
    // });

    if (fatalError) {
        throw new Error(`There were TypeScript errors transpiling`);
    }
    asset.contents = transformed.outputText;
    asset.setMeta(
        'sourceMap',
        transformed.sourceMapText ? JSON.parse(transformed.sourceMapText) : null
    );
    return asset;
};
