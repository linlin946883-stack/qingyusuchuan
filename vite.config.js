import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.', // 项目根目录
  base: './', // 使用相对路径（重要！）
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    
    // 多页面应用配置
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        agreement: resolve(__dirname, 'agreement.html'),
        login: resolve(__dirname, 'pages/login.html'),
        call: resolve(__dirname, 'pages/call.html'),
        human: resolve(__dirname, 'pages/human.html'),
        sms: resolve(__dirname, 'pages/sms.html'),
        my: resolve(__dirname, 'pages/my.html'),
        notfound: resolve(__dirname, 'pages/404.html'),
      },
      output: {
        // 资源输出配置
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      }
    },
    
    // 压缩配置（使用 esbuild，速度更快）
    minify: 'esbuild',
    
    // CSS 压缩
    cssMinify: true,
    
    // 生成 source map（可选，调试用）
    sourcemap: false,
  },
  
  // 开发服务器配置
  server: {
    port: 5173,
    open: true, // 自动打开浏览器
    
    // 代理后端 API
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  
  // 预览服务器配置（用于预览打包后的结果）
  preview: {
    port: 4173,
    open: true
  }
});
