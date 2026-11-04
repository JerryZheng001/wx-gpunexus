import { Canvas, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { CandlestickChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useId, useRef } from 'react'
import type { Quote } from '../types'
import { chartSamples } from '../utils/domain'
import { theme } from '../constants/theme'

echarts.use([LineChart, CandlestickChart, GridComponent, TooltipComponent, CanvasRenderer])
export function PriceChart({
  quote,
  period = 'day',
  candles = false,
}: {
  quote: Quote
  period?: string
  candles?: boolean
}) {
  const id = 'price-' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const chart = useRef<ReturnType<typeof echarts.init> | null>(null)
  const option = () => {
    const data = chartSamples(
      quote.price,
      quote.volatility * (period === 'day' ? 1 : period === 'week' ? 2.4 : 3.6),
      quote.id + period,
      period === 'day' ? 30 : period === 'week' ? 14 : 12,
    )
    const color = quote.percent >= 0 ? theme.up : theme.down
    return {
      animation: false,
      backgroundColor: 'transparent',
      grid: { top: 18, left: 8, right: 58, bottom: 28, containLabel: false },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: theme.surface,
        borderColor: theme.border,
        textStyle: { color: theme.text, fontSize: 11 },
        axisPointer: { type: 'cross', label: { backgroundColor: theme.primary, color: theme.surface } },
      },
      xAxis: {
        type: 'category' as const,
        data: data.map((item) =>
          period === 'day'
            ? `${item.label}日`
            : period === 'week'
              ? `${item.label}周`
              : `${item.label}月`,
        ),
        boundaryGap: candles,
        axisLine: { lineStyle: { color: theme.border } },
        axisTick: { show: false },
        axisLabel: { color: theme.muted, fontSize: 9, interval: Math.floor(data.length / 4) },
      },
      yAxis: {
        type: 'value' as const,
        scale: true,
        position: 'right' as const,
        splitNumber: 3,
        axisLabel: {
          color: theme.muted,
          fontSize: 9,
          formatter: (value: number) =>
            value >= 10000 ? `${(value / 10000).toFixed(1)}万` : value.toFixed(0),
        },
        splitLine: { lineStyle: { color: theme.border, type: 'dashed' as const } },
      },
      series: candles
        ? [
            {
              type: 'candlestick' as const,
              data: data.map((item) => [item.open, item.close, item.low, item.high]),
              itemStyle: {
                color: theme.up,
                color0: theme.down,
                borderColor: theme.up,
                borderColor0: theme.down,
              },
            },
          ]
        : [
            {
              type: 'line' as const,
              data: data.map((item) => Number(item.close.toFixed(2))),
              symbol: 'none',
              smooth: 0.2,
              lineStyle: { width: 2, color },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  {
                    offset: 0,
                    color: quote.percent >= 0 ? 'rgba(229,72,77,.25)' : 'rgba(48,164,108,.25)',
                  },
                  { offset: 1, color: 'rgba(0,0,0,0)' },
                ]),
              },
            },
          ],
    }
  }
  const latest = useRef(option)
  latest.current = option
  useEffect(() => {
    let stopped = false,
      attempts = 0,
      retry: ReturnType<typeof setTimeout> | undefined
    const initialize = () => {
      if (process.env.TARO_ENV === 'h5') {
        const native = document.querySelector<HTMLCanvasElement>(`#${id} canvas`)
        const rect = native?.getBoundingClientRect()
        if (!native || !rect?.width || !rect.height) {
          if (++attempts < 10) retry = setTimeout(initialize, 100)
          return
        }
        chart.current = echarts.init(native, undefined, {
          renderer: 'canvas',
          width: rect.width,
          height: rect.height,
          devicePixelRatio: window.devicePixelRatio || 1,
        })
        chart.current.setOption(latest.current())
        return
      }
      Taro.createSelectorQuery()
        .select(`#${id}`)
        .fields({ node: true, size: true })
        .exec((result) => {
          if (stopped) return
          const value = result[0] as
            | { node?: HTMLCanvasElement; width?: number; height?: number }
            | undefined
          const native = value?.node
          if (!native || !value?.width || !value.height) {
            if (++attempts < 10) retry = setTimeout(initialize, 100)
            return
          }
          const dpr = Taro.getSystemInfoSync().pixelRatio || 2
          native.width = value.width * dpr
          native.height = value.height * dpr
          // WeChat Canvas 2D exposes a drawing node, rather than a browser DOM element.
          const surface = {
            getContext: (type: string) => native!.getContext(type as '2d'),
            style: {},
            nodeName: 'CANVAS',
            width: native.width,
            height: native.height,
            setAttribute: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
          }
          echarts.setPlatformAPI({ createCanvas: () => native! })
          chart.current = echarts.init(surface as unknown as HTMLCanvasElement, undefined, {
            renderer: 'canvas',
            width: value.width,
            height: value.height,
            devicePixelRatio: dpr,
          })
          chart.current.setOption(latest.current())
        })
    }
    Taro.nextTick(initialize)
    return () => {
      stopped = true
      clearTimeout(retry)
      chart.current?.dispose()
      chart.current = null
    }
  }, [id])
  useEffect(() => {
    chart.current?.setOption(option(), true)
  }, [quote.id, period, candles])
  const touch = (
    type: 'mousemove',
    event: { touches?: { x?: number; y?: number; clientX?: number; clientY?: number }[] },
  ) => {
    if (process.env.TARO_ENV === 'h5') return
    const point = event.touches?.[0]
    if (!point || !chart.current) return
    const handler = chart.current.getZr().handler
    handler.dispatch(type, {
      zrX: point.x ?? point.clientX ?? 0,
      zrY: point.y ?? point.clientY ?? 0,
      preventDefault: () => {},
      stopPropagation: () => {},
    })
  }
  return (
    <View className='price-chart'>
      <Canvas
        id={id}
        canvasId={id}
        type='2d'
        className='chart-canvas'
        disableScroll
        onTouchStart={(event) => touch('mousemove', event)}
        onTouchMove={(event) => touch('mousemove', event)}
        onTouchEnd={() => chart.current?.dispatchAction({ type: 'hideTip' })}
      />
      <View className='chart-legend'>
        <Text>
          <Text className={quote.percent >= 0 ? 'up' : 'down'}>■ </Text>
          {candles ? '红涨绿跌' : '指数走势'}
        </Text>
        <Text>单位：{quote.isIndex ? '指数点' : '元'}</Text>
      </View>
    </View>
  )
}
