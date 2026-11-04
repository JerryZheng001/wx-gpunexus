import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useEffect } from 'react'
import { useStore } from '../store'
import { assetShare } from '../constants/product'

export const tabPaths = ['home', 'market', 'publish', 'mall', 'me']
export const go = (page: string, params: Record<string, string> = {}) =>
  Taro.navigateTo({
    url: `/pages/${page}/index${
      Object.keys(params).length
        ? '?' +
          Object.entries(params)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('&')
        : ''
    }`,
  })
export const switchTab = (index: number) => {
  useStore.getState().setTab(index)
  return Taro.switchTab({ url: `/pages/${tabPaths[index]}/index` })
}
export const back = () => (Taro.getCurrentPages().length > 1 ? Taro.navigateBack() : switchTab(0))
export const toast = (title: string) => Taro.showToast({ title, icon: 'none' })
export function usePage(tab?: number, share?: { title: string; path: string }) {
  const load = useStore((state) => state.load)
  useEffect(() => {
    void load()
  }, [load])
  useDidShow(() => {
    if (tab !== undefined) useStore.getState().setTab(tab)
  })
  useShareAppMessage(
    (options) => {
      const target = options.target as { dataset?: { share?: string } } | undefined
      return target?.dataset?.share === 'asset' ? assetShare
        : share || { title: '算力市 · GPU 单卡与整机供需平台', path: '/pages/home/index' }
    },
  )
}
