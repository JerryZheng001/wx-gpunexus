import { Image, Text, View } from '@tarojs/components'
import { tabIcons } from '../assets/icons'
import { useStore } from '../store'
import { switchTab } from '../utils/navigation'
import './index.scss'
const names = ['首页', '行情', '发布', '市场', '我的']
export default function CustomTabBar() {
  const active = useStore((s) => s.activeTab)
  return (
    <View className='custom-tabbar'>
      {names.map((name, index) => (
        <View
          key={name}
          className={`nav-item ${active === index ? 'nav-active' : ''}`}
          onClick={() => {
            if (index !== active) void switchTab(index)
          }}
        >
          {index === 2 ? (
            <View className='publish-circle'>＋</View>
          ) : (
            <Image className='nav-icon' src={tabIcons[index][active === index ? 1 : 0]} />
          )}
          <Text className='nav-label'>{name}</Text>
        </View>
      ))}
    </View>
  )
}
