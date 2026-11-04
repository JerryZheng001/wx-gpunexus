import { Button, Picker, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { Card, Field, FormInput, FormText, Page, Select, Tabs, Upload } from '../../components/ui'
import { billingCycles, billingUnits, conditions, deliveries, durations, productCategories, regions } from '../../constants/publish'
import { marketService } from '../../services/market'
import { useStore } from '../../store'
import { localDate, validateDraft } from '../../utils/domain'
import { go, toast, usePage } from '../../utils/navigation'

export default function Publish() {
  usePage(2)
  const draft = useStore((s) => s.draft),
    setDraft = useStore((s) => s.setDraft),
    save = useStore((s) => s.saveListing),
    reset = useStore((s) => s.resetDraft)
  const [submitting, setSubmitting] = useState(false)
  const rent = draft.type === 'rent', demand = draft.type === 'demand'
  const cities = regions[draft.province] || (draft.city ? [draft.city] : [])
  const billingUnit = billingUnits[draft.billing]
  const submit = async () => {
    if (submitting) return
    const error = validateDraft(draft)
    if (error) { void toast(error); return }
    setSubmitting(true)
    try {
      const item = await marketService.submitListing(draft)
      save(item)
      await Taro.showModal({
        title: '演示发布已保存',
        content: '已保存在本机发布管理的“审核中”。当前尚未发送平台，正式服务开通后可提交审核。',
        showCancel: false,
      })
      void go('manage')
    } catch (error) {
      void toast(error instanceof Error ? error.message : '保存失败，请重试')
    } finally { setSubmitting(false) }
  }
  return (
    <Page title={draft.editId ? '编辑信息' : '发布信息'}>
      <View className='draft-bar'>
        <Text>草稿自动保存在本机</Text>
        <Text className='orange-text' onClick={async () => {
          const result = await Taro.showModal({ title: '清空草稿？', content: '当前填写内容将被清除。' })
          if (result.confirm) reset()
        }}>清空</Text>
      </View>
      <Card>
        <Tabs items={[
          { value: 'sell', label: '💰 售卖' },
          { value: 'rent', label: '🔁 租赁' },
          { value: 'demand', label: '📢 需求' },
        ]} value={draft.type} onChange={(type) => setDraft({ type })} />
        <View className='form'>
          <Field label='城市' required>
            <View className='form-columns'>
              <Select value={draft.province} placeholder='请选择省份' options={Object.keys(regions)}
                onChange={(province) => setDraft({ province, city: regions[province][0] })} />
              <Select value={draft.city} placeholder='请选择城市' options={cities}
                onChange={(city) => setDraft({ city })} />
            </View>
          </Field>
          <Field label={draft.type === 'sell' ? '商品名称' : '产品名称'} required>
            <FormInput value={draft.name} onChange={(name) => setDraft({ name })}
              placeholder={draft.type === 'sell' ? '如：NVIDIA RTX 4090 24G 涡轮卡' : rent ? '如：H100 8 卡整机 / RTX 4090 单卡' : '如：RTX 4090 / A100 8 卡服务器'} />
          </Field>
          <Field label='型号' required>
            <FormInput value={draft.model} onChange={(model) => setDraft({ model })}
              placeholder='如：RTX 4090 24G / A100 80G SXM' />
          </Field>
          <Field label='商品分类'>
            <Select value={draft.category} options={productCategories}
              onChange={(category) => setDraft({ category: category as typeof draft.category })} />
          </Field>
          {!demand && <Field label='成色' required={draft.condition === '自定义'}>
            <Select value={draft.condition} options={conditions} onChange={(condition) => setDraft({ condition })} />
            {draft.condition === '自定义' && <View className='field-extra'>
              <FormInput value={draft.customCondition} onChange={(customCondition) => setDraft({ customCondition })}
                placeholder='请输入自定义成色，如：8 成新、有轻微划痕' />
            </View>}
          </Field>}
          <Field label='数量' required>
            <FormInput value={draft.quantity} onChange={(quantity) => setDraft({ quantity })}
              placeholder='如：10 张 / 2 台' maxLength={16} />
          </Field>
          {rent ? <Field label='计费与定价' required>
            <Tabs compact items={billingCycles.map((value) => ({ value, label: value }))}
              value={draft.billing} onChange={(billing) => setDraft({ billing })} />
            <View className='form-columns field-extra'>
              <Field label={`现价（¥/${billingUnit}）`}>
                <FormInput value={draft.price} onChange={(price) => setDraft({ price })} placeholder='如：168,000' maxLength={16} />
              </Field>
              <Field label={`原价（¥/${billingUnit}，划线价）`}>
                <FormInput value={draft.originalPrice} onChange={(originalPrice) => setDraft({ originalPrice })}
                  placeholder='选填，如：188,000' maxLength={16} />
              </Field>
            </View>
            <Text className='field-hint'>原价为选填的市场划线价，须不低于现价；单位随计费方式自动切换。</Text>
          </Field> : <Field label={demand ? '求购预算' : '售价'} required hint='最高价选填；留空表示单一价格。'>
            <View className='form-columns'>
              <FormInput value={draft.price} onChange={(price) => setDraft({ price })} placeholder='最低价（¥）' type='digit' maxLength={16} />
              <FormInput value={draft.maxPrice} onChange={(maxPrice) => setDraft({ maxPrice })} placeholder='最高价（¥）' type='digit' maxLength={16} />
            </View>
          </Field>}
          <Field label='交付周期'>
            <Select value={draft.delivery} options={deliveries} onChange={(delivery) => setDraft({ delivery })} />
          </Field>
          {!rent && <Field label='有效期'>
            <Select value={draft.duration} options={durations} onChange={(duration) => setDraft({ duration })} />
            {draft.duration === '自定义' && <View className='field-extra'>
              <Picker mode='date' start={localDate()} value={draft.expiryDate || localDate()}
                onChange={(event) => setDraft({ expiryDate: event.detail.value })}>
                <View className={`form-input select-value ${draft.expiryDate ? '' : 'placeholder'}`}>
                  <Text>{draft.expiryDate || '请选择截止日期'}</Text><Text className='muted'>▦</Text>
                </View>
              </Picker>
            </View>}
          </Field>}
          <Field label='联系方式' required hint='由平台转接，不在商品详情中公开展示。'>
            <FormInput value={draft.contact} onChange={(contact) => setDraft({ contact })}
              placeholder='手机号 / 微信号（平台转接，不公开）' maxLength={100} />
          </Field>
          <Field label={demand ? '求购商品描述' : '商品描述'}>
            <FormText value={draft.description} onChange={(description) => setDraft({ description })}
              placeholder={demand ? '期望型号、数量、交付要求、是否需发票…' : rent ? '配置清单、包含哪些服务、押金与起租说明…' : '成色细节、保修情况、发票、验货方式…'} />
          </Field>
          <Field label={demand ? '求购图片（最多 9 张）' : '商品图片（最多 9 张）'}>
            <Upload persist images={draft.images} onChange={(images) => setDraft({ images })} />
          </Field>
          <View className='notice'>
            📋 发布须知：信息经平台审核后展示。平台仅提供信息展示，交易请线下自行核验，谨防诈骗。联系方式由平台转接。
          </View>
          <View className='demo-inline'>演示版：提交仅保存在本机，不会公开发布。</View>
          <Button className='button full' disabled={submitting} onClick={() => void submit()}>提交审核（演示）</Button>
        </View>
      </Card>
    </Page>
  )
}
