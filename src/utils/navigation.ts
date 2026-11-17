import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useEffect } from 'react'
import { useStore } from '../store'
import { assetShare } from '../constants/product'
import { browserShareUrl, timelineShare, type PageShare } from './market-share'

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
export async function copyShareLink(share: PageShare) {
  try {
    await Taro.setClipboardData({ data: browserShareUrl(share, window.location.href) })
    await toast('分享链接已复制')
  } catch { await toast('链接复制失败，请重试') }
}
export function usePage(tab?: number, share?: PageShare) {
  const load = useStore((state) => state.load)
  useEffect(() => {
    void load()
  }, [load])
  useDidShow(() => {
    if (tab !== undefined) useStore.getState().setTab(tab)
  })
  useShareAppMessage(
    (options) => {
      const target = options.target as { dataset?: { share?: string; sharePayload?: string } } | undefined
      if (target?.dataset?.share === 'asset') return assetShare
      if (target?.dataset?.share === 'market' && target.dataset.sharePayload) {
        try {
          const payload: PageShare = JSON.parse(target.dataset.sharePayload)
          if (typeof payload.title === 'string' && /^\/pages\/(goods|mall)\/index(?:\?|$)/.test(payload.path)) return payload
        } catch { /* Fall back to the current page's share. */ }
      }
      return share || { title: '算力市 · GPU 单卡与整机供需平台', path: '/pages/home/index' }
    },
  )
  useShareTimeline(() => timelineShare(share || { title: '算力市 · GPU 单卡与整机供需平台', path: '/pages/home/index' }))
}
