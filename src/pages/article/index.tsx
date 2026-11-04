import { Button, Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { Card, DemoNote, Empty, LoadState, Page, Tag } from '../../components/ui'
import { useStore } from '../../store'
import { go, toast, usePage } from '../../utils/navigation'
export default function Article() {
  const { id } = useRouter().params
  const articles = useStore((s) => s.articles),
    favorites = useStore((s) => s.favorites),
    toggle = useStore((s) => s.toggleFavorite)
  const article = articles.find((item) => item.id === id),
    on = favorites.some((item) => item.kind === 'article' && item.id === id)
  usePage(undefined, {
    title: article?.title || '算力市市场资讯',
    path: `/pages/article/index?id=${encodeURIComponent(id || '')}`,
  })
  return (
    <Page title='资讯详情' isBack>
      <LoadState>
        {article ? (
          <>
            <Card>
              <Text className='article-title'>{article.title}</Text>
              <View className='article-meta'>
                <Tag color='orange'>{article.category}</Tag>
                <Text>{article.source}</Text>
                <Text>{article.time}</Text>
                <Text>{article.views} 阅读</Text>
              </View>
              <View className='article-body'>
                {article.paragraphs.map((paragraph, index) => (
                  <Text key={index}>{paragraph}</Text>
                ))}
              </View>
            </Card>
            <Card className='shop-link' onClick={() => void go('quotes')}>
              <View className='news-icon'>📈</View>
              <View className='grow'>
                <Text className='strong block'>关注 GPU 市场动向</Text>
                <Text className='muted'>查看型号报价与价格走势</Text>
              </View>
              <Text className='chevron'>›</Text>
            </Card>
            <DemoNote>原型示例文章 · 不构成交易建议</DemoNote>
            <View className='bottom-actions'>
              <View
                className={`action-icon ${on ? 'active' : ''}`}
                onClick={() => {
                  toggle('article', article.id)
                  void toast(on ? '已取消收藏' : '已收藏资讯')
                }}
              >
                <Text>{on ? '♥' : '♡'}</Text>
                <Text>{on ? '已收藏' : '收藏'}</Text>
              </View>
              <Button className='button grow' style={{ background: '#07a957' }} openType='share'>
                分享给好友
              </Button>
            </View>
          </>
        ) : (
          <Empty title='这篇资讯不存在' />
        )}
      </LoadState>
    </Page>
  )
}
