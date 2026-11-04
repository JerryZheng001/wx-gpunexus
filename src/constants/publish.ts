import type { BillingCycle, ProductCategory } from '../types'

// Representative cities from the supplied prototype. Replace with the agreed
// administrative-region source when the backend is available.
export const regions: Record<string, string[]> = {
  北京市: ['北京市'], 上海市: ['上海市'], 重庆市: ['重庆市'], 天津市: ['天津市'],
  广东省: ['深圳市', '广州市', '东莞市', '佛山市'],
  浙江省: ['杭州市', '宁波市', '温州市'],
  江苏省: ['南京市', '苏州市', '无锡市'],
  四川省: ['成都市', '绵阳市'], 湖北省: ['武汉市'],
  福建省: ['厦门市', '福州市'], 山东省: ['青岛市', '济南市'],
  陕西省: ['西安市'], 湖南省: ['长沙市'],
}
export const productCategories: ProductCategory[] = ['GPU服务器', '通用服务器', '其他']
export const conditions = ['全新', '99 新', '95 新', '9 成新', '拆机良品', '自定义']
export const deliveries = ['现货（24 小时内）', '1-3 天', '1 周内', '2 周内', '1 个月内', '面议']
export const durations = ['长期有效', '7 天', '15 天', '30 天', '60 天', '90 天', '自定义']
export const billingCycles: BillingCycle[] = ['包日', '包周', '包月', '按量计费']
export const billingUnits: Record<BillingCycle, string> = { 包日: '天', 包周: '周', 包月: '月', 按量计费: '小时' }
