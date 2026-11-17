import { Button, Image, Input, Picker, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, type PropsWithChildren, type ReactNode } from 'react'
import { sparkImages } from '../assets/sparks'
import { useStore } from '../store'
import type { Article, Listing, Quote } from '../types'
import { isServer, listingPrice, listingTypes, money, percent } from '../utils/domain'
import { back, copyShareLink, go, toast } from '../utils/navigation'
import type { PageShare } from '../utils/market-share'
import { assetAssessmentUrl } from '../constants/product'
import PlatformTabBar from './platform-tab-bar'

export function Page({
  title,
  subtitle,
  children,
  isBack = false,
  right,
}: PropsWithChildren<{ title: string; subtitle?: string; isBack?: boolean; right?: ReactNode }>) {
  let top = 20
  try {
    top = Taro.getSystemInfoSync().statusBarHeight || 20
  } catch {
    /* desktop preview */
  }
  if (process.env.TARO_ENV === 'h5') top = 12
  return (
    <View className='page'>
      <View className='header' style={{ paddingTop: `${top}px` }}>
        <View className='header-inner'>
          {isBack && (
            <View className='back-button' onClick={() => void back()}>
              ‹
            </View>
          )}
          <Text className='header-title'>{title}</Text>
          {right && <View className='header-right'>{right}</View>}
        </View>
      </View>
      {subtitle && <View className='page-subtitle'>{subtitle}</View>}
      <View className='page-body'>{children}</View>
      {!isBack && <PlatformTabBar />}
    </View>
  )
}
export function Card({
  children,
  className = '',
  onClick,
}: PropsWithChildren<{ className?: string; onClick?: () => void }>) {
  return (
    <View className={`card ${className}`} onClick={onClick}>
      {children}
    </View>
  )
}
export function Tag({ children, color = '' }: PropsWithChildren<{ color?: string }>) {
  return <Text className={`tag ${color}`}>{children}</Text>
}
export function Section({
  title,
  more,
  onMore,
  children,
}: PropsWithChildren<{ title: string; more?: string; onMore?: () => void }>) {
  return (
    <View className='section'>
      <View className='section-heading'>
        <Text className='section-mark'>❯❯</Text>
        <Text className='section-title'>{title}</Text>
        <View className='grow' />
        {children}
        {more && (
          <Text className='more' onClick={onMore}>
            {more} ›
          </Text>
        )}
      </View>
    </View>
  )
}
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  compact = false,
}: {
  items: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  compact?: boolean
}) {
  return (
    <View className={compact ? 'tabs compact' : 'tabs'}>
      {items.map((item) => (
        <View
          key={item.value}
          className={`tab-option ${value === item.value ? 'selected' : ''}`}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </View>
      ))}
    </View>
  )
}
export function Search({
  value,
  onChange,
  onSearch,
  placeholder = '搜索型号 / 关键词，如 4090、H100 整机',
  button = false,
}: {
  value: string
  onChange: (value: string) => void
  onSearch?: () => void
  placeholder?: string
  button?: boolean
}) {
  return (
    <View className='search-row'>
      <View className='search-input-wrap'>
        <Text className='search-icon'>⌕</Text>
        <Input
          className='search-input'
          value={value}
          onInput={(event) => onChange(event.detail.value)}
          onConfirm={onSearch}
          confirmType='search'
          placeholder={placeholder}
          placeholderClass='input-placeholder'
        />
        {value && (
          <Text className='clear-input' onClick={() => onChange('')}>
            ×
          </Text>
        )}
      </View>
      {button && (
        <Button className='button search-button' onClick={onSearch}>
          搜索
        </Button>
      )}
    </View>
  )
}
export function Empty({
  title = '暂无相关内容',
  description,
  action,
  onAction,
}: {
  title?: string
  description?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <View className='empty'>
      <Text className='empty-icon'>◇</Text>
      <Text className='empty-title'>{title}</Text>
      {description && <Text className='muted'>{description}</Text>}
      {action && (
        <Button className='button small' onClick={onAction}>
          {action}
        </Button>
      )}
    </View>
  )
}
export function LoadState({ children }: PropsWithChildren) {
  const loaded = useStore((s) => s.loaded),
    error = useStore((s) => s.loadError),
    load = useStore((s) => s.load)
  if (!loaded)
    return error ? (
      <Empty title={error} action='重新加载' onAction={() => void load()} />
    ) : (
      <View className='loading'>正在加载…</View>
    )
  return <>{children}</>
}
export function DemoNote({ children = '演示数据 · 不代表实时行情' }: PropsWithChildren) {
  return (
    <View className='demo-note'>
      <Text className='demo-dot' />
      {children}
    </View>
  )
}
export function ListingCard({ item, horizontal = false, onClick }: { item: Listing; horizontal?: boolean; onClick?: () => void }) {
  const type = listingTypes[item.type]
  return (
    <View
      className={`listing-card ${horizontal ? 'horizontal' : ''}`}
      onClick={onClick || (() => void go('goods', { id: item.id }))}
    >
      <View className='listing-image'>
        {item.images?.[0] ? (
          <Image src={item.images[0]} mode='aspectFill' className='listing-photo' />
        ) : (
          <Text>{item.emoji}</Text>
        )}
        <Text className='image-caption'>
          {isServer(item.category) ? 'GPU SERVER' : 'GPU COMPUTING'}
        </Text>
      </View>
      <View className='listing-body'>
        <View className='row gap'>
          <Tag color={type.color}>{type.label}</Tag>
          {item.verified && <Tag color='neutral'>✓ 平台核验</Tag>}
        </View>
        <Text className='listing-name'>{item.name}</Text>
        <Text className='listing-extra'>{item.extra}</Text>
        <View className='listing-meta'>
          <Text className='price'>
            {item.type === 'demand' ? '预算 ' : ''}¥{listingPrice(item)}
            <Text className='unit'>{item.unit}</Text>
          </Text>
          <Text className='listing-views'>{item.views}浏览</Text>
        </View>
        {item.originalPrice !== undefined && <Text className='original-price'>¥{money(item.originalPrice)}{item.unit}</Text>}
      </View>
    </View>
  )
}
export function NewsRow({ item, last = false }: { item: Article; last?: boolean }) {
  return (
    <View
      className={`news-row ${last ? 'last' : ''}`}
      onClick={() => void go('article', { id: item.id })}
    >
      <View className='news-icon'>{item.icon}</View>
      <View className='grow min-zero'>
        <Text className='news-title'>{item.title}</Text>
        <View className='news-meta'>
          <Tag>{item.category}</Tag>
          <Text>{item.time}</Text>
        </View>
      </View>
      <Text className='chevron'>›</Text>
    </View>
  )
}
export function QuoteTable({ items }: { items: Quote[] }) {
  const followed = useStore((s) => s.followedQuotes),
    toggleQuote = useStore((s) => s.toggleQuote)
  return (
    <Card className='quote-table'>
      <View className='quote-row quote-table-head'>
        <Text className='quote-name-cell'>产品</Text>
        <Text className='quote-price-cell'>现价 / 涨跌幅</Text>
        <Text>分时走势</Text>
      </View>
      {items.map((item) => (
        <View key={item.id} className='quote-row' onClick={() => void go('quote', { id: item.id })}>
          <View className='quote-name-cell'>
            <Text className='quote-name'>{item.name}</Text>
            <View className='quote-code'>
              <Text
                className={`quote-follow ${followed.includes(item.id) ? 'active' : ''}`}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleQuote(item.id)
                }}
              >
                {followed.includes(item.id) ? '♥' : '+'}
              </Text>
              <Text>{item.code}</Text>
            </View>
          </View>
          <View
            className={`quote-price-cell ${item.percent > 0 ? 'up' : item.percent < 0 ? 'down' : ''}`}
          >
            <Text className='quote-price'>{money(item.price)}</Text>
            <Text className='quote-percent'>{percent(item.percent)}</Text>
          </View>
          <Image className='spark' src={sparkImages[item.id]} mode='aspectFit' />
        </View>
      ))}
    </Card>
  )
}
export function Field({
  label,
  children,
  hint,
  required = false,
}: PropsWithChildren<{ label: string; hint?: string; required?: boolean }>) {
  return (
    <View className='field'>
      <View className='field-label'>
        {label}
        {required && <Text className='required'> *</Text>}
      </View>
      {children}
      {hint && <Text className='field-hint'>{hint}</Text>}
    </View>
  )
}
export function FormInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength = 100,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number' | 'digit'
  maxLength?: number
}) {
  return (
    <Input
      className='form-input'
      value={value}
      type={type}
      maxlength={maxLength}
      placeholder={placeholder}
      placeholderClass='input-placeholder'
      onInput={(event) => onChange(event.detail.value)}
    />
  )
}
export function FormText({
  value,
  onChange,
  placeholder,
  maxLength = 500,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <View>
      <Textarea
        className='form-textarea'
        value={value}
        placeholder={placeholder}
        placeholderClass='input-placeholder'
        maxlength={maxLength}
        onInput={(event) => onChange(event.detail.value)}
      />
      <Text className='text-count'>
        {value.length}/{maxLength}
      </Text>
    </View>
  )
}
export function Select({
  value,
  options,
  onChange,
  placeholder = '请选择',
}: {
  value: string
  options: string[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <Picker
      className='select-field'
      mode='selector'
      range={options}
      disabled={!options.length}
      value={Math.max(0, options.indexOf(value))}
      onChange={(event) => onChange(options[Number(event.detail.value)])}
    >
      <View className={`form-input select-value ${value ? '' : 'placeholder'}`}>
        <Text>{value || placeholder}</Text>
        <Text className='muted'>⌄</Text>
      </View>
    </Picker>
  )
}
export function Upload({
  images,
  onChange,
  max = 9,
  persist = false,
  upload,
  onUploadingChange,
}: {
  images: string[]
  onChange: (images: string[]) => void
  max?: number
  persist?: boolean
  upload?: (path: string) => Promise<string>
  onUploadingChange?: (value: boolean) => void
}) {
  const [uploading, setUploading] = useState(false)
  const choose = async () => {
    if (uploading) return
    setUploading(true)
    onUploadingChange?.(true)
    try {
      const result = await Taro.chooseImage({
        count: max - images.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      const paths = upload ? await Promise.all(result.tempFilePaths.map(upload)) : persist
        ? await Promise.all(
            result.tempFilePaths.map(async (tempFilePath) => {
              if (process.env.TARO_ENV === 'h5') {
                const blob = await (await fetch(tempFilePath)).blob()
                return await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader()
                  reader.onload = () => resolve(String(reader.result))
                  reader.onerror = reject
                  reader.readAsDataURL(blob)
                })
              }
              const saved = await Taro.saveFile({ tempFilePath })
              if (!('savedFilePath' in saved)) throw new Error('Image persistence failed')
              return saved.savedFilePath
            }),
          )
        : result.tempFilePaths
      onChange([...images, ...paths].slice(0, max))
    } catch (error) {
      if (!String((error as { errMsg?: string }).errMsg || '').includes('cancel'))
        void toast(upload && error instanceof Error ? error.message : '暂时无法保存图片，请检查本机空间后重试')
    } finally {
      setUploading(false)
      onUploadingChange?.(false)
    }
  }
  return (
    <View className='upload-list'>
      {images.map((src, i) => (
        <View className='upload-thumb' key={src}>
          <Image
            src={src}
            mode='aspectFill'
            onClick={() => void Taro.previewImage({ current: src, urls: images })}
          />
          <Text
            className='upload-remove'
            onClick={() => { if (!uploading) onChange(images.filter((_, index) => index !== i)) }}
          >
            ×
          </Text>
        </View>
      ))}
      {images.length < max && (
        <View className='upload-add' onClick={() => void choose()}>
          <Text className='upload-plus'>＋</Text>
          <Text>{uploading ? '上传中…' : '添加图片'}</Text>
          <Text>
            {images.length}/{max}
          </Text>
        </View>
      )}
    </View>
  )
}
export function FloatSettle() {
  const merchant = useStore((s) => s.merchant)
  return (
    <View
      className='settle-float'
      onClick={() =>
        void go(
          merchant?.status === 'approved' ? 'shop' : 'settle',
          merchant?.status === 'approved' ? { id: 'mine' } : {},
        )
      }
    >
      <Text>♧</Text>
      <Text>
        {merchant?.status === 'approved'
          ? '店铺'
          : merchant?.status === 'pending'
            ? '审核中'
            : '入驻'}
      </Text>
    </View>
  )
}
export function Sheet({
  title,
  onClose,
  children,
}: PropsWithChildren<{ title: string; onClose: () => void }>) {
  return (
    <View className='sheet-mask' catchMove onClick={onClose}>
      <View className='sheet' onClick={(event) => event.stopPropagation()}>
        <View className='sheet-handle' />
        <View className='row'>
          <Text className='sheet-title'>{title}</Text>
          <View className='grow' />
          <Text className='sheet-close' onClick={onClose}>
            ×
          </Text>
        </View>
        {children}
      </View>
    </View>
  )
}
export function ContactSheet({ onClose, reference }: { onClose: () => void; reference?: string }) {
  return (
    <Sheet title='联系平台' onClose={onClose}>
      <Text className='sheet-description'>告诉我们你的需求，由平台协助对接供需双方。</Text>
      {reference && <View className='notice'>信息编号：{reference}</View>}
      <View className='contact-row'>
        <View className='contact-icon'>☏</View>
        <View className='grow'>
          <Text className='strong block'>微信客服</Text>
          <Text className='muted'>客服服务将在平台开通后提供</Text>
        </View>
        <Button className='button small' onClick={() => void toast('演示版暂未开通客服')}>
          在线咨询
        </Button>
      </View>
      <View className='contact-row'>
        <View className='contact-icon blue'>◷</View>
        <View>
          <Text className='strong block'>服务时间</Text>
          <Text className='muted'>工作日 09:00–18:00</Text>
        </View>
      </View>
      <View className='notice'>
        当前为页面演示，尚未接入客服和联系电话。平台不代收货款，请线下核验后交易。
      </View>
    </Sheet>
  )
}
export function AssetSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title='算力资产评估' onClose={onClose}>
      <View className='asset-intro'>
        <Text className='strong block'>全面评估算力资产价值</Text>
        <View className='asset-pill-row'>
          {['可核验', '可评估', '可定价', '可交易'].map((label) => <Text key={label} className='asset-pill'>{label}</Text>)}
        </View>
      </View>
      <View className='asset-flow'>
        {[
          ['算力接入', '接入设备、录入资产清单'],
          ['性能评测', '整机跑分、出具评测报告'],
          ['资产确权', '确权存证、生成估值报告'],
        ].map(([title, description], index) => <View key={title} className='asset-step'>
          <Text className='asset-step-number'>{index + 1}</Text>
          <View><Text className='strong block'>{title}</Text><Text className='muted'>{description}</Text></View>
        </View>)}
      </View>
      <View className='asset-pc'>
        <Text className='asset-pc-icon'>💻</Text>
        <View className='grow'><Text className='strong block'>请在电脑端打开</Text>
          <Text className='asset-url' selectable>{assetAssessmentUrl.replace('https://', '')}</Text></View>
      </View>
      <View className='asset-actions'>
        <Button className='button ghost grow' onClick={async () => {
          try { await Taro.setClipboardData({ data: assetAssessmentUrl }) }
          catch { void toast('复制失败，请长按链接复制') }
        }}>复制链接</Button>
        <Button className='button wechat-button grow' openType='share' data-share='asset'
          onClick={() => { if (process.env.TARO_ENV === 'h5') void toast('请在微信小程序中分享') }}>↗ 微信分享</Button>
      </View>
      <Text className='field-hint asset-hint'>小程序不支持直接打开此网页，复制链接到电脑浏览器即可。</Text>
    </Sheet>
  )
}
export function BottomActions({
  favorite,
  favoriteBusy = false,
  onFavorite,
  onContact,
  share = true,
  shareData,
  label = '联系平台对接',
}: {
  favorite?: boolean
  favoriteBusy?: boolean
  onFavorite?: () => void
  onContact?: () => void
  share?: boolean
  shareData?: PageShare
  label?: string
}) {
  return (
    <View className='bottom-actions'>
      {onFavorite && (
        <View className={`action-icon ${favorite ? 'active' : ''}`} onClick={favoriteBusy ? undefined : onFavorite}>
          <Text>{favorite ? '♥' : '♡'}</Text>
          <Text>{favoriteBusy ? '处理中…' : favorite ? '已收藏' : '收藏'}</Text>
        </View>
      )}
      {share && (
        <Button
          className='action-icon share-button'
          openType='share'
          onClick={() => {
            if (process.env.TARO_ENV === 'h5') {
              if (shareData) void copyShareLink(shareData)
              else void toast('请在微信小程序中分享')
            }
          }}
        >
          <Text className='wechat'>↗</Text>
          <Text>分享</Text>
        </Button>
      )}
      {onContact && (
        <Button className='button grow' onClick={onContact}>
          {label}
        </Button>
      )}
    </View>
  )
}
export function useContact() {
  const [visible, setVisible] = useState(false)
  return { visible, open: () => setVisible(true), close: () => setVisible(false) }
}
