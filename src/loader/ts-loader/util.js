/**
 * Created by ximing on 2019-03-19.
 */
const path = require('path');
const ts = require('typescript');
const { flattenDiagnosticMessageText } = require('typescript');
const normalizePath = require('normalize-path');
// eslint-disable-next-line
const Es6Error = require('es6-error');

class FormattedDiagnostic extends Es6Error {
    constructor(message, file) {
        super(message);
        this.file = file;
    }
}
module.exports.FormattedDiagnostic = FormattedDiagnostic;
const deduplicateDiagnostics = ts.sortAndDeduplicateDiagnostics;

module.exports.groupByFile = (diagnostics) => {
    const deduplicatedDiagnostics = deduplicateDiagnostics(diagnostics);

    return deduplicatedDiagnostics.reduce((groups, diagnostic) => {
        const fileName = diagnostic.file ? diagnostic.file.fileName : 'global';
        if (!groups[fileName]) {
            groups[fileName] = [];
        }
        groups[fileName].push(diagnostic);
        return groups;
    }, {});
};

module.exports.formatFilePath = (filePath, context) => {
    let fileName = normalizePath(path.relative(context, filePath));
    if (fileName && fileName[0] !== '.') {
        fileName = `./${fileName}`;
    }
    return fileName;
};

module.exports.replaceAbsolutePaths = (message, context) => {
    const contextPath = normalizePath(context);
    return message.replace(new RegExp(contextPath, 'g'), '.');
};

module.exports.formatDiagnosticMessage = (diagnostic, delimiter, context) => module.exports.replaceAbsolutePaths(
        flattenDiagnosticMessageText(diagnostic.messageText, delimiter),
        context
    );
