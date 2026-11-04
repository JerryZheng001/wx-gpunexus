import { Text, View } from '@tarojs/components'
import { Card, DemoNote, Page } from '../../components/ui'
import { usePage } from '../../utils/navigation'
export default function About() {
  usePage()
  return (
    <Page title='关于算力市' isBack>
      <View className='about-logo'>算</View>
      <Text className='about-title'>算力市</Text>
      <View className='about-subtitle'>GPU 单卡 · 整机供需平台</View>
      <Card>
        <View className='row'>
          <Text className='strong'>连接算力供需，发现市场价值</Text>
          <View className='grow' />
        </View>
        <View className='detail-description'>
          算力市提供 GPU
          单卡、整机的售卖、租赁与需求信息，汇集市场行情与行业资讯，协助供需双方通过平台联系、线下核验和交易。
        </View>
      </Card>
      <Card>
        <Text className='strong'>演示版本说明</Text>
        <View className='detail-description'>
          当前版本用于体验页面与交互。行情、资讯、商家及初始发布记录均为示例数据，不代表实际报价、供货或资质核验结果。
        </View>
        <View className='detail-description'>
          收藏、关注、足迹、草稿和模拟提交保存在当前设备。尚未接入账户、短信、平台审核或在线客服；清除小程序数据后，本机记录会被删除。
        </View>
      </Card>
      <View className='notice page-notice'>
        平台不代收货款，不参与资金结算。请自行核验设备、身份和交易条件。
      </View>
      <DemoNote>算力市 · 页面演示版 0.1.0</DemoNote>
    </Page>
  )
}
