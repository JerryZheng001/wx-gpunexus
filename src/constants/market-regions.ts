import data from './market-regions.json'

export interface MarketLocation { provinceCode: string; cityCode: string }
export interface MarketProvince { code: string; name: string; cities: Array<{ code: string; name: string }> }

// Province/city subset of @province-city-china/data 8.5.8; see docs/REGION_DATA.md.
export const marketRegions: readonly MarketProvince[] = data
export const marketProvince = (code?: string) => marketRegions.find((province) => province.code === code)
export const marketCities = (provinceCode?: string) => marketProvince(provinceCode)?.cities ?? []
export function isMarketLocation(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const location = value as Partial<MarketLocation>
  return typeof location.provinceCode === 'string' && typeof location.cityCode === 'string' &&
    marketCities(location.provinceCode).some((city) => city.code === location.cityCode)
}
