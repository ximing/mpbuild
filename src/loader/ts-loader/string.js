module.exports.endsWith = function(str, tail) {
    return !tail.length || str.slice(-tail.length) === tail;
};
