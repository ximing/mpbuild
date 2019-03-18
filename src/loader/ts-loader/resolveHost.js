const { statSync } = require('fs');

module.exports = {
    directoryExists(dirPath) {
        try {
            return statSync(dirPath).isDirectory();
        } catch (err) {
            return false;
        }
    },
    fileExists(filePath) {
        try {
            return statSync(filePath).isFile();
        } catch (err) {
            return false;
        }
    }
};
