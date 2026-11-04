import { Text, View } from '@tarojs/components'
import { useState } from 'react'
import {
  AssetSheet,
  Card,
  ContactSheet,
  DemoNote,
  Page,
  Tag,
  useContact,
} from '../../components/ui'
import { useStore } from '../../store'
import { go, usePage } from '../../utils/navigation'

export default function Me() {
  usePage(4)
  const mine = useStore((s) => s.mine),
    favorites = useStore((s) => s.favorites),
    followed = useStore((s) => s.followedQuotes),
    history = useStore((s) => s.history),
    merchant = useStore((s) => s.merchant)
  const [assetOpen, setAssetOpen] = useState(false),
    contact = useContact()
  const menu = [
    {
      icon: '📝',
      label: '我的发布',
      hint: `审核中 ${mine.filter((item) => item.status === 'audit').length}`,
      action: () => void go('manage'),
    },
    {
      icon: '⭐',
      label: '我的收藏',
      hint: '本机保存',
      action: () => void go('records', { mode: 'favorites' }),
    },
    {
      icon: '👣',
      label: '浏览足迹',
      hint: '本机保存',
      action: () => void go('records', { mode: 'history' }),
    },
    { icon: '📊', label: '算力资产评估', hint: 'PC 端', action: () => setAssetOpen(true) },
    { icon: '🎧', label: '联系平台', hint: '', action: contact.open },
  ]
  return (
    <Page title='我的'>
      <View className='profile'>
        <View className='avatar'>🧑‍💻</View>
        <View className='grow'>
          <View className='row gap'>
            <Text className='profile-name'>Jerry</Text>
            <Tag>演示用户</Tag>
          </View>
          <Text className='muted'>欢迎来到算力市</Text>
        </View>
        <Text className='settings-icon' onClick={() => void go('about')}>
          ⚙
        </Text>
      </View>
      <View className='stats-row'>
        {[
          { value: mine.length, label: '我的发布', action: () => void go('manage') },
          {
            value: favorites.length + followed.length,
            label: '收藏',
            action: () => void go('records', { mode: 'favorites' }),
          },
          {
            value: history.length,
            label: '足迹',
            action: () => void go('records', { mode: 'history' }),
          },
        ].map((item) => (
          <View className='stat' key={item.label} onClick={item.action}>
            <Text className='stat-number'>{item.value}</Text>
            <Text className='muted'>{item.label}</Text>
          </View>
        ))}
      </View>
      <Card
        className='merchant-entry'
        onClick={() =>
          void go(
            merchant?.status === 'approved' ? 'shop' : 'settle',
            merchant?.status === 'approved' ? { id: 'mine' } : {},
          )
        }
      >
        <Text className='merchant-entry-icon'>{merchant?.status === 'pending' ? '⏳' : '🏪'}</Text>
        <View className='grow min-zero'>
          <Text className='strong block'>
            {merchant?.status === 'approved'
              ? '我的店铺'
              : merchant?.status === 'pending'
                ? '入驻审核中（演示）'
                : '商家入驻'}
          </Text>
          <Text className='muted'>
            {merchant ? merchant.name : '企业 / 个人均可申请，拥有专属店铺主页'}
          </Text>
        </View>
        <Text className='chevron'>›</Text>
      </Card>
      <Card className='menu'>
        {menu.map((item) => (
          <View className='menu-item' key={item.label} onClick={item.action}>
            <View className='menu-icon'>{item.icon}</View>
            <Text className='grow'>{item.label}</Text>
            {item.hint && <Tag color={item.label === '我的发布' ? 'orange' : ''}>{item.hint}</Tag>}
            <Text className='chevron'>›</Text>
          </View>
        ))}
      </Card>
      <Card className='menu'>
        <View className='menu-item' onClick={() => void go('feedback')}>
          <View className='menu-icon'>📮</View>
          <Text className='grow'>意见反馈</Text>
          <Text className='chevron'>›</Text>
        </View>
        <View className='menu-item' onClick={() => void go('about')}>
          <View className='menu-icon'>ⓘ</View>
          <Text className='grow'>关于我们</Text>
          <Text className='chevron'>›</Text>
        </View>
      </Card>
      <View className='notice page-notice'>
        平台不介入资金往来，不代收货款。交易前请自行核验设备与对方身份。
      </View>
      <DemoNote>当前为演示用户，数据仅保存在本机</DemoNote>
      {assetOpen && <AssetSheet onClose={() => setAssetOpen(false)} />}
      {contact.visible && <ContactSheet onClose={contact.close} />}
    </Page>
  )
}
