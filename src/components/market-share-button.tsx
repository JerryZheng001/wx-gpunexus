import { Button, Text } from '@tarojs/components'
import { copyShareLink } from '../utils/navigation'
import type { PageShare } from '../utils/market-share'

export function MarketShareButton({ share, compact = false }: { share: PageShare; compact?: boolean }) {
  return <Button className={compact ? 'market-card-share' : 'market-share-button'} openType='share'
    data-share='market' data-share-payload={JSON.stringify(share)} onClick={(event) => {
      event.stopPropagation()
      if (process.env.TARO_ENV === 'h5') void copyShareLink(share)
    }}>
    <Text>↗ 分享</Text>
  </Button>
}
