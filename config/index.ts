import { defineConfig } from '@tarojs/cli'
export default defineConfig({
  projectName: '算力市',
  date: '2026-11-03',
  designWidth: 750,
  deviceRatio: { 640: 2.34 / 2, 750: 1, 828: 1.81 / 2 },
  sourceRoot: 'src',
  outputRoot: process.env.TARO_ENV === 'h5' ? 'dist-h5' : 'dist',
  framework: 'react',
  compiler: { type: 'webpack5', prebundle: { enable: false } },
  plugins: ['@tarojs/plugin-platform-weapp', '@tarojs/plugin-platform-h5'],
  cache: { enable: false },
  mini: {
    postcss: { pxtransform: { enable: true }, url: { enable: true, config: { limit: 1024 } } },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    router: { mode: 'hash' },
    devServer: { host: '127.0.0.1', port: 10086 },
    postcss: { pxtransform: { enable: true, config: { designWidth: 750 } } },
  },
  env: { NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development') },
  defineConstants: {},
  copy: { patterns: [], options: {} },
})
