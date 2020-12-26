/**
 * Created by ximing on 2018/7/11.
 */
'use strict';
module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            ['feat', 'fix', 'docs', 'release', 'refactor', 'perf', 'test', 'build', 'ci', 'revert']
        ],
        'scope-empty': [1, 'always'],
        'subject-full-stop': [0, 'never'],
        'subject-case': [0, 'never']
    }
};
