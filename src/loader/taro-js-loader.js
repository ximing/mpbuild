/**
 * Created by ximing on 2019-03-14.
 */
const wxTransformer = require('@tarojs/transformer-wx');
const through = require('through2');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const Util = require('@tarojs/cli/dist/util/index');
const traverse = require('babel-traverse').default;
const babel = require('babel-core');
const t = require('babel-types');
const generate = require('babel-generator').default;
const template = require('babel-template');

const taroJsFramework = '@tarojs/taro';
const taroJsComponents = '@tarojs/components';
const config = {
    src: 'src',
    dest: 'dist',
    cwd: process.cwd()
};
const PARSE_AST_TYPE = {
    ENTRY: 'ENTRY',
    PAGE: 'PAGE',
    COMPONENT: 'COMPONENT',
    NORMAL: 'NORMAL'
};
const CONFIG_MAP = {
    navigationBarTitleText: 'navigationBarTitleText',
    navigationBarBackgroundColor: 'navigationBarBackgroundColor',
    enablePullDownRefresh: 'enablePullDownRefresh',
    list: 'list',
    text: 'text',
    iconPath: 'iconPath',
    selectedIconPath: 'selectedIconPath'
};
const babylonConfig = {
    sourceType: 'module',
    plugins: [
        'typescript',
        'classProperties',
        'jsx',
        'trailingFunctionCommas',
        'asyncFunctions',
        'exponentiationOperator',
        'asyncGenerators',
        'objectRestSpread',
        'decorators',
        'dynamicImport'
    ]
};
const constantsReplaceList = {
    'process.env.NODE_ENV': 'development',
    'process.env.TARO_ENV': 'weapp'
};

function traverseObjectNode(node, obj) {
    if (node.type === 'ClassProperty' || node.type === 'ObjectProperty') {
        const { properties } = node.value;
        obj = {};
        properties.forEach((p) => {
            let key = t.isIdentifier(p.key) ? p.key.name : p.key.value;
            if (CONFIG_MAP[key]) {
                key = CONFIG_MAP[key];
            }
            obj[key] = traverseObjectNode(p.value);
        });
        return obj;
    }
    if (node.type === 'ObjectExpression') {
        const { properties } = node;
        obj = {};
        properties.forEach((p) => {
            let key = t.isIdentifier(p.key) ? p.key.name : p.key.value;
            if (CONFIG_MAP[key]) {
                key = CONFIG_MAP[key];
            }
            obj[key] = traverseObjectNode(p.value);
        });
        return obj;
    }
    if (node.type === 'ArrayExpression') {
        return node.elements.map((item) => traverseObjectNode(item));
    }
    if (node.type === 'NullLiteral') {
        return null;
    }
    return node.value;
}

function parseAst(type, ast, depComponents, sourceFilePath) {
    const styleFiles = [];
    const scriptFiles = [];
    const jsonFiles = [];
    const mediaFiles = [];
    let configObj = {};
    let componentClassName = null;
    const taroJsReduxConnect = null;
    const taroMiniAppFramework = `@tarojs/taro-weapp`;
    let taroImportDefaultName;
    let needExportDefault = false;
    let exportTaroReduxConnected = null;
    // let newAst = babel.transformFromAst(ast, '', {
    //     plugins: [[require('babel-plugin-transform-define').default, constantsReplaceList]]
    // }).ast;
    traverse(ast, {
        ClassDeclaration(astPath) {
            const { node } = astPath;
            let hasCreateData = false;
            if (node.superClass) {
                astPath.traverse({
                    ClassMethod(astPath) {
                        if (astPath.get('key').isIdentifier({ name: '_createData' })) {
                            hasCreateData = true;
                        }
                    }
                });
                if (hasCreateData) {
                    needExportDefault = true;
                    astPath.traverse({
                        ClassMethod(astPath) {
                            const { node } = astPath;
                            if (node.kind === 'constructor') {
                                astPath.traverse({
                                    ExpressionStatement(astPath) {
                                        const { node } = astPath;
                                        if (
                                            node.expression &&
                                            node.expression.type === 'AssignmentExpression' &&
                                            node.expression.operator === '='
                                        ) {
                                            const { left } = node.expression;
                                            if (
                                                left.type === 'MemberExpression' &&
                                                left.object.type === 'ThisExpression' &&
                                                left.property.type === 'Identifier' &&
                                                left.property.name === 'config'
                                            ) {
                                                configObj = traverseObjectNode(
                                                    node.expression.right
                                                );
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    });
                    if (node.id === null) {
                        componentClassName = '_TaroComponentClass';
                        astPath.replaceWith(
                            t.classDeclaration(
                                t.identifier(componentClassName),
                                node.superClass,
                                node.body,
                                node.decorators || []
                            )
                        );
                    } else if (node.id.name === 'App') {
                        componentClassName = '_App';
                        astPath.replaceWith(
                            t.classDeclaration(
                                t.identifier(componentClassName),
                                node.superClass,
                                node.body,
                                node.decorators || []
                            )
                        );
                    } else {
                        componentClassName = node.id.name;
                    }
                }
            }
        },

        ClassExpression(astPath) {
            const { node } = astPath;
            if (node.superClass) {
                let hasCreateData = false;
                astPath.traverse({
                    ClassMethod(astPath) {
                        if (astPath.get('key').isIdentifier({ name: '_createData' })) {
                            hasCreateData = true;
                        }
                    }
                });
                if (hasCreateData) {
                    needExportDefault = true;
                    if (node.id === null) {
                        const parentNode = astPath.parentPath.node;
                        if (t.isVariableDeclarator(astPath.parentPath)) {
                            componentClassName = parentNode.id.name;
                        } else {
                            componentClassName = '_TaroComponentClass';
                        }
                        astPath.replaceWith(
                            t.ClassExpression(
                                t.identifier(componentClassName),
                                node.superClass,
                                node.body,
                                node.decorators || []
                            )
                        );
                    } else if (node.id.name === 'App') {
                        componentClassName = '_App';
                        astPath.replaceWith(
                            t.ClassExpression(
                                t.identifier(componentClassName),
                                node.superClass,
                                node.body,
                                node.decorators || []
                            )
                        );
                    } else {
                        componentClassName = node.id.name;
                    }
                }
            }
        },

        ClassProperty(astPath) {
            const { node } = astPath;
            if (node.key.name === 'config') {
                configObj = traverseObjectNode(node);
            }
        },

        ImportDeclaration(astPath) {
            const { node } = astPath;
            const { source } = node;
            let { value } = source;
            const { specifiers } = node;
            if (Util.isNpmPkg(value)) {
                if (value === taroJsComponents) {
                    astPath.remove();
                } else {
                    let isDepComponent = false;
                    if (depComponents && depComponents.length) {
                        depComponents.forEach((item) => {
                            if (item.path === value) {
                                isDepComponent = true;
                            }
                        });
                    }
                    if (isDepComponent) {
                        astPath.remove();
                    } else {
                        const { specifiers } = node;
                        if (value === taroJsFramework) {
                            let defaultSpecifier = null;
                            specifiers.forEach((item) => {
                                if (item.type === 'ImportDefaultSpecifier') {
                                    defaultSpecifier = item.local.name;
                                }
                            });
                            if (defaultSpecifier) {
                                taroImportDefaultName = defaultSpecifier;
                            }
                            value = taroMiniAppFramework;
                        }
                        source.value = value;
                    }
                }
            }
        },

        CallExpression(astPath) {
            const { node } = astPath;
            const { callee } = node;
            if (t.isMemberExpression(callee)) {
                if (
                    taroImportDefaultName &&
                    callee.object.name === taroImportDefaultName &&
                    callee.property.name === 'render'
                ) {
                    astPath.remove();
                }
            } else if (callee.name === 'require') {
                const args = node.arguments;
                let { value } = args[0];
                if (Util.isNpmPkg(value)) {
                    if (value === taroJsComponents) {
                        astPath.remove();
                    } else {
                        let isDepComponent = false;
                        if (depComponents && depComponents.length) {
                            depComponents.forEach((item) => {
                                if (item.path === value) {
                                    isDepComponent = true;
                                }
                            });
                        }
                        if (isDepComponent) {
                            astPath.remove();
                        } else if (t.isVariableDeclaration(astPath.parentPath.parentPath)) {
                            const parentNode = astPath.parentPath.parentPath.node;
                            if (
                                parentNode.declarations.length === 1 &&
                                parentNode.declarations[0].init
                            ) {
                                const { id } = parentNode.declarations[0];
                                if (value === taroJsFramework && id.type === 'Identifier') {
                                    taroImportDefaultName = id.name;
                                    value = taroMiniAppFramework;
                                }
                            }
                        }
                    }
                }
                args[0].value = value;
            }
        },

        ExportDefaultDeclaration(astPath) {
            const { node } = astPath;
            const { declaration } = node;
            needExportDefault = false;
            if (
                declaration &&
                (declaration.type === 'ClassDeclaration' || declaration.type === 'ClassExpression')
            ) {
                const { superClass } = declaration;
                if (superClass) {
                    let hasCreateData = false;
                    astPath.traverse({
                        ClassMethod(astPath) {
                            if (astPath.get('key').isIdentifier({ name: '_createData' })) {
                                hasCreateData = true;
                            }
                        }
                    });
                    if (hasCreateData) {
                        needExportDefault = true;
                        if (declaration.id === null) {
                            componentClassName = '_TaroComponentClass';
                        } else if (declaration.id.name === 'App') {
                            componentClassName = '_App';
                        } else {
                            componentClassName = declaration.id.name;
                        }
                        const isClassDcl = declaration.type === 'ClassDeclaration';
                        const classDclProps = [
                            t.identifier(componentClassName),
                            superClass,
                            declaration.body,
                            declaration.decorators || []
                        ];
                        astPath.replaceWith(
                            isClassDcl
                                ? t.classDeclaration.apply(null, classDclProps)
                                : t.classExpression.apply(null, classDclProps)
                        );
                    }
                }
            } else if (declaration.type === 'CallExpression') {
                const { callee } = declaration;
                if (callee && callee.type === 'CallExpression') {
                    const subCallee = callee.callee;
                    if (subCallee.type === 'Identifier' && subCallee.name === taroJsReduxConnect) {
                        const args = declaration.arguments;
                        if (args.length === 1 && args[0].name === componentClassName) {
                            needExportDefault = true;
                            exportTaroReduxConnected = `${componentClassName}__Connected`;
                            astPath.replaceWith(
                                t.variableDeclaration('const', [
                                    t.variableDeclarator(
                                        t.identifier(`${componentClassName}__Connected`),
                                        t.CallExpression(declaration.callee, declaration.arguments)
                                    )
                                ])
                            );
                        }
                    }
                }
            }
        },
        Program: {
            exit(astPath) {
                astPath.traverse({
                    CallExpression(astPath) {
                        const { node } = astPath;
                        const { callee } = node;
                        if (callee.name === 'require') {
                            const args = node.arguments;
                            const { value } = args[0];
                            const valueExtname = path.extname(value);
                            if (value.indexOf('.') === 0) {
                                let importPath = path.resolve(path.dirname(sourceFilePath), value);
                                importPath = Util.resolveScriptPath(importPath);
                                if (true) {
                                    if (
                                        astPath.parent.type === 'AssignmentExpression' ||
                                        'ExpressionStatement'
                                    ) {
                                        astPath.parentPath.remove();
                                    } else if (astPath.parent.type === 'VariableDeclarator') {
                                        astPath.parentPath.parentPath.remove();
                                    } else {
                                        astPath.remove();
                                    }
                                }
                            }
                        }
                    }
                });
                const { node } = astPath;
                const exportVariableName = exportTaroReduxConnected || componentClassName;
                if (needExportDefault) {
                    const exportDefault = template(
                        `export default ${exportVariableName}`,
                        babylonConfig
                    )();
                    node.body.push(exportDefault);
                }
                const taroMiniAppFrameworkPath = taroMiniAppFramework;
                switch (type) {
                    case PARSE_AST_TYPE.ENTRY:
                        node.body.push(
                            template(
                                `App(require('${taroMiniAppFrameworkPath}').default.createApp(${exportVariableName}))`,
                                babylonConfig
                            )()
                        );
                        break;
                    case PARSE_AST_TYPE.PAGE:
                        node.body.push(
                            template(
                                `Component(require('${taroMiniAppFrameworkPath}').default.createComponent(${exportVariableName}, true))`,
                                babylonConfig
                            )()
                        );
                        break;
                    case PARSE_AST_TYPE.COMPONENT:
                        node.body.push(
                            template(
                                `Component(require('${taroMiniAppFrameworkPath}').default.createComponent(${exportVariableName}))`,
                                babylonConfig
                            )()
                        );
                        break;
                    default:
                        break;
                }
            }
        }
    });
    return {
        code: generate(ast).code,
        styleFiles,
        scriptFiles,
        jsonFiles,
        configObj,
        mediaFiles,
        componentClassName
    };
}

module.exports = async function(asset, opts) {
    const { path: sourcePath, outputFilePath, contents } = asset;
    // console.log('start');
    try {
        // const pageWXMLPath = assetPath.replace(p.extname(assetPath), wxml);
        // const outputPath = p.join(
        //     config.cwd,
        //     config.dest,
        //     assetPath.replace(p.join(config.cwd, config.src), '')
        // );
        if (contents.indexOf(taroJsFramework) >= 0) {
            console.log('handle taro file');
            const baseOptions = {
                isRoot: true,
                sourcePath,
                outputPath: outputFilePath,
                code: '',
                env: constantsReplaceList,
                adapter: 'weapp',
                isTyped: false
            };
            const { compressedTemplate, code: resCode, pageDepComponents, ast } = wxTransformer(
                Object.assign({}, baseOptions, {
                    code: contents
                })
            );
            const parseRes = parseAst(PARSE_AST_TYPE.PAGE, ast, pageDepComponents);
            // fse.outputFileSync(outputPath.replace(p.extname(sourcePath), wxml), compressedTemplate, {
            //     encoding
            // });
            // console.log('code', parseRes.code);
            asset.contents = parseRes.code;
        }
    } catch (e) {
        console.error(e);
    }
    // console.log('end');
    return asset;
};
