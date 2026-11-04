import { Button, Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect } from 'react'
import {
  BottomActions,
  Card,
  ContactSheet,
  DemoNote,
  Empty,
  LoadState,
  Page,
  Tag,
  useContact,
} from '../../components/ui'
import { useStore } from '../../store'
import { isServer, listingPrice, listingTypes, money, statuses } from '../../utils/domain'
import { go, toast, usePage } from '../../utils/navigation'
export default function Goods() {
  const { id } = useRouter().params
  const catalog = useStore((s) => s.catalog),
    mine = useStore((s) => s.mine),
    shops = useStore((s) => s.shops),
    favorites = useStore((s) => s.favorites),
    toggle = useStore((s) => s.toggleFavorite),
    visit = useStore((s) => s.visit)
  const item = [...catalog, ...mine].find((value) => value.id === id)
  usePage(undefined, {
    title: item ? `${item.name} · ¥${listingPrice(item)}` : '算力市供需信息',
    path: `/pages/goods/index?id=${encodeURIComponent(id || '')}`,
  })
  useEffect(() => {
    if (item) visit(item.id)
  }, [item?.id, visit])
  const contact = useContact()
  const shop = shops.find((value) => value.id === item?.shop)
  const favorite = favorites.some((value) => value.kind === 'goods' && value.id === id)
  return (
    <Page title='信息详情' isBack>
      <LoadState>
        {item ? (
          <>
            {item.images?.length ? (
              <Swiper className='goods-gallery' indicatorDots circular>
                {item.images.map((src) => (
                  <SwiperItem key={src}>
                    <Image
                      src={src}
                      mode='aspectFill'
                      onClick={() => void Taro.previewImage({ current: src, urls: item.images! })}
                    />
                  </SwiperItem>
                ))}
              </Swiper>
            ) : (
              <View className='goods-hero'>
                <Text>{item.emoji}</Text>
                <Text className='hero-wordmark'>
                  {isServer(item.category) ? 'GPU SERVER' : 'GPU COMPUTING'}
                </Text>
              </View>
            )}
            <Card>
              <View className='row gap'>
                <Tag color={listingTypes[item.type].color}>{listingTypes[item.type].label}</Tag>
                <Tag>{item.category}</Tag>
                {item.verified && <Tag color='green'>✓ 平台核验</Tag>}
                <Tag>{item.views} 浏览</Tag>
              </View>
              <Text className='goods-title'>{item.name}</Text>
              <View className='price goods-price'>
                {item.type === 'demand' ? '预算 ' : ''}¥{listingPrice(item)}
                <Text className='unit'>{item.unit}</Text>
              </View>
              {item.originalPrice !== undefined && <Text className='original-price'>原价 ¥{money(item.originalPrice)}{item.unit}</Text>}
              <Text className='muted'>
                {item.extra} · 编号 SL-{item.id}
              </Text>
            </Card>
            <Card>
              <Text className='strong'>📋 详细说明</Text>
              <View className='detail-grid'>
                <Text>交易城市　{item.city}</Text>
                <Text>设备数量　{item.quantityText || item.quantity}</Text>
                {item.type !== 'demand' && <Text>成色　{item.condition}</Text>}
                {item.model && <Text>型号　{item.model}</Text>}
                {item.delivery && <Text>交付周期　{item.delivery}</Text>}
                {item.billing && <Text>计费方式　{item.billing}</Text>}
                {item.type !== 'rent' && <Text>有效期　{item.expiresAt ? `至 ${item.expiresAt.slice(0, 10)}` : '长期有效'}</Text>}
                <Text>状态　{statuses[item.status || 'show']}</Text>
              </View>
              <View className='detail-description'>
                {item.description || '暂无补充说明，请联系平台咨询。'}
              </View>
              <View className='notice' style={{ marginTop: '12px' }}>
                看中这条信息？联系平台并提供编号 SL-{item.id}，由客服协助对接。
              </View>
            </Card>
            <Card
              className='shop-link'
              onClick={() => {
                if (shop || item.shop === 'mine') void go('shop', { id: item.shop! })
              }}
            >
              <View className='shop-logo'>{shop?.emoji || '🧑'}</View>
              <View className='grow'>
                <Text className='shop-name'>
                  {shop?.name || (item.shop === 'mine' ? '我的演示发布' : '个人发布者')}
                </Text>
                <View className='row gap' style={{ marginTop: '6px' }}>
                  {shop ? (
                    <Tag color={shop.type === 'enterprise' ? 'blue' : 'green'}>
                      {shop.type === 'enterprise' ? '企业入驻' : '个人入驻'}
                    </Tag>
                  ) : (
                    <Text className='muted'>由平台协助线下对接</Text>
                  )}
                </View>
              </View>
              {(shop || item.shop === 'mine') && <Text className='orange-text'>进店 ›</Text>}
            </Card>
            <Card>
              <Text className='strong'>🛡️ 交易提示</Text>
              <View className='detail-description'>
                平台不介入资金往来。请线下核验货物后自行交易；任何要求向“平台账户”付款的行为均需警惕。
              </View>
              <Button
                className='button ghost small'
                style={{ marginTop: '12px' }}
                onClick={() =>
                  void go('feedback', { reference: `SL-${item.id}`, type: '内容问题' })
                }
              >
                举报此信息
              </Button>
            </Card>
            <DemoNote>供需信息为原型演示数据</DemoNote>
            <BottomActions
              favorite={favorite}
              onFavorite={() => {
                toggle('goods', item.id)
                void toast(favorite ? '已取消收藏' : '已收藏')
              }}
              onContact={contact.open}
            />
            {contact.visible && (
              <ContactSheet onClose={contact.close} reference={`SL-${item.id}`} />
            )}
          </>
        ) : (
          <Empty
            title='信息已下架或不存在'
            action='查看市场'
            onAction={() => void Taro.switchTab({ url: '/pages/mall/index' })}
          />
        )}
      </LoadState>
    </Page>
  )
}
