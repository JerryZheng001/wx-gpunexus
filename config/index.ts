import { defineConfig } from '@tarojs/cli'
import type { ClientRequest } from 'node:http'
import { readLocalTestToken } from './local-auth'
import { tokenScope } from '../src/services/auth-scope'
const apiBaseUrl = process.env.TARO_APP_API_BASE_URL ?? 'https://test.chengfangtech.com'
const development = process.env.NODE_ENV === 'development' || process.argv.includes('--watch')
const testToken = development ? readLocalTestToken() : ''
export default defineConfig({
  projectName: '算力市',
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
    devServer: {
      host: '127.0.0.1', port: 10086,
      proxy: apiBaseUrl ? [{ context: ['/api'], target: apiBaseUrl, changeOrigin: true,
        onProxyReq: (request: ClientRequest) => {
          request.removeHeader('origin')
          if (testToken && (request.path.startsWith('/api/banking/provider/') ||
            request.path.split('?')[0] === '/api/market-mp/favorites') && !request.getHeader('authorization'))
            request.setHeader('Authorization', `Bearer ${testToken}`)
        },
      }] : [],
    },
    postcss: { pxtransform: { enable: true, config: { designWidth: 750 } } },
  },
  env: {
    NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
    TARO_APP_API_BASE_URL: JSON.stringify(apiBaseUrl),
    // Only the local WeChat watch build needs the fallback in its ignored output.
    TARO_APP_DEV_ACCESS_TOKEN: JSON.stringify(development && process.env.TARO_ENV === 'weapp' ? testToken : ''),
    TARO_APP_DEV_AUTH_SCOPE: JSON.stringify(testToken ? tokenScope(testToken) : ''),
  },
  defineConstants: {},
  copy: { patterns: [], options: {} },
})
