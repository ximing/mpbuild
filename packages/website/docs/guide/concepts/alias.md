---
title: alias(别名)
order: 2
---

## 模块别名

```javascript
module.exports = {
  alias: {
    module2: path.resolve(__dirname, 'app/third/module.js'),
    // 起别名 "module2" -> "./app/third/module.js" 和 "module/file" 会导致错误
    // 模块别名相对于当前上下文导入
  },
};
```

| `alias:`                          | `import 'xyz'`                        | `import 'xyz/file.js'`               |
| :-------------------------------- | :------------------------------------ | :----------------------------------- |
| `{}`                              | `/abc/node_modules/xyz/index.js`      | `/abc/node_modules/xyz/file.js`      |
| `{ xyz: '/abc/path/to/file.js' }` | `/abc/path/to/file.js`                | error                                |
| `{ xyz: './dir/file.js' }`        | `/abc/dir/file.js`                    | error                                |
| `{ xyz: '/some/dir' }`            | `/some/dir/index.js`                  | `/some/dir/file.js`                  |
| `{ xyz: './dir' }`                | `/abc/dir/index.js`                   | `/abc/dir/file.js`                   |
| `{ xyz: 'modu' }`                 | `/abc/node_modules/modu/index.js`     | `/abc/node_modules/modu/file.js`     |
| `{ xyz: 'modu/some/file.js' }`    | `/abc/node_modules/modu/some/file.js` | error                                |
| `{ xyz: 'modu/dir' }`             | `/abc/node_modules/modu/dir/index.js` | `/abc/node_modules/modu/dir/file.js` |
