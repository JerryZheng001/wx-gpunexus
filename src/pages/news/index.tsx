import { View } from '@tarojs/components'
import { useState } from 'react'
import { Card, DemoNote, Empty, LoadState, NewsRow, Page, Search, Tabs } from '../../components/ui'
import { useStore } from '../../store'
import { usePage } from '../../utils/navigation'
export default function News() {
  usePage()
  const articles = useStore((s) => s.articles)
  const [category, setCategory] = useState('全部'),
    [keyword, setKeyword] = useState('')
  const categories = ['全部', ...new Set(articles.map((item) => item.category))]
  const items = articles.filter(
    (item) =>
      (category === '全部' || category === item.category) && item.title.includes(keyword.trim()),
  )
  return (
    <Page title='市场资讯' isBack>
      <Search value={keyword} onChange={setKeyword} placeholder='搜索资讯关键词' />
      <View className='page-gutter'>
        <Tabs
          compact
          value={category}
          onChange={setCategory}
          items={categories.map((value) => ({ value, label: value }))}
        />
      </View>
      <LoadState>
        {items.length ? (
          <Card className='news-list'>
            {items.map((item) => (
              <NewsRow item={item} key={item.id} />
            ))}
          </Card>
        ) : (
          <Empty title='没有找到相关资讯' />
        )}
        <DemoNote>文章内容来自产品原型，仅用于演示</DemoNote>
      </LoadState>
    </Page>
  )
}
