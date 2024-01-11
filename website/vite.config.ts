import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 必须与 GitHub Pages 项目页路径一致：https://ximing.github.io/mpbuild/
// content/ 位于项目根内，Vite 默认监听；md 经 import.meta.glob eager 导入，
// 新增/修改内容文件会触发页面刷新，无需额外配置。
export default defineConfig({
  base: '/mpbuild/',
  plugins: [react()],
});
