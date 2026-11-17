import { Button, View } from '@tarojs/components'
import { marketCities, marketProvince, marketRegions, type MarketLocation } from '../constants/market-regions'
import { Select } from './ui'

export function MarketRegionSelect({ value, onChange, allowClear = false }: {
  value?: MarketLocation
  onChange: (value: MarketLocation | undefined) => void
  allowClear?: boolean
}) {
  const province = marketProvince(value?.provinceCode)
  const cities = marketCities(value?.provinceCode)
  const city = cities.find((item) => item.code === value?.cityCode)
  return <>
    <View className='form-columns'>
      <Select value={province?.name || (value?.provinceCode ? `已保存省份（${value.provinceCode}）` : '')}
        placeholder='请选择省份' options={marketRegions.map((item) => item.name)} onChange={(name) => {
          const next = marketRegions.find((item) => item.name === name)
          if (!next || next.code === value?.provinceCode) return
          const direct = next.cities.length === 1 && next.cities[0].code === next.code
          onChange({ provinceCode: next.code, cityCode: direct ? next.code : '' })
        }} />
      <Select value={city?.name || (value?.cityCode ? `已保存城市（${value.cityCode}）` : '')}
        placeholder={value?.provinceCode ? '请选择城市' : '请先选择省份'} options={cities.map((item) => item.name)} onChange={(name) => {
          const next = cities.find((item) => item.name === name)
          if (next && province) onChange({ provinceCode: province.code, cityCode: next.code })
        }} />
    </View>
    {allowClear && value && <Button className='button ghost small' onClick={() => onChange(undefined)}>清除地区</Button>}
  </>
}
