import { Button, Picker, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { getAuthScope, providerApi, uploadListingImage } from '../services/api'
import { ApiError, object } from '../services/http-core'
import { apiConditionLabels, type ApiCondition } from '../services/listing-api'
import { providerActions, type ProviderListing } from '../services/provider-api'
import { createAndSubmit, type PendingDraft } from '../services/provider-draft'
import { emptyProviderForm, formFromProvider, providerFormPayload, restoreProviderForm, type ProviderForm } from '../services/provider-form'
import { useStore } from '../store'
import { go, toast, usePage } from '../utils/navigation'
import { Card, Empty, Field, FormInput, FormText, Page, Select, Tabs, Upload } from './ui'
import { MarketRegionSelect } from './market-region-select'

const formKey = () => `suanlishi:provider-form:v1:${getAuthScope()}`
const pendingKey = () => `suanlishi:provider-pending:v1:${getAuthScope()}`
function readPending(): PendingDraft | undefined {
  const value: unknown = Taro.getStorageSync(pendingKey())
  if (!value) return undefined
  const pending = object(value)
  if (!['sale', 'lease', 'demand'].includes(String(pending.type)) || typeof pending.uncertain !== 'boolean' ||
    pending.id !== undefined && (!Number.isSafeInteger(pending.id) || Number(pending.id) <= 0))
    throw new ApiError('本地待提交记录异常，请先在发布管理核对', 0, 'CREATE_UNCERTAIN')
  return pending as unknown as PendingDraft
}
function readForm(): ProviderForm {
  try {
    return restoreProviderForm(Taro.getStorageSync(formKey()))
  } catch { return { ...emptyProviderForm, images: [] } }
}
export function RemotePublish() {
  usePage(2)
  const edit = useStore((state) => state.remoteEdit)
  const [form, setForm] = useState<ProviderForm>(readForm)
  const [existing, setExisting] = useState<ProviderListing>()
  const [pending, setPending] = useState<PendingDraft>()
  const [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [attempt, setAttempt] = useState(0)
  const lock = useRef(false)
  const persistedEdit = useRef(edit)
  const update = (patch: Partial<ProviderForm>) => { if (!busy && !uploading) setForm((value) => ({ ...value, ...patch })) }
  useEffect(() => {
    let active = true
    setExisting(undefined); setError('')
    if (edit) {
      setLoading(true)
      void providerApi.detail(edit.type, edit.id).then((item) => {
        if (!active) return
        if (!providerActions(item).includes('edit')) throw new ApiError('当前信息不能编辑，请返回发布管理刷新', 403)
        setExisting(item); setForm(formFromProvider(item))
      }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : '详情加载失败') })
        .finally(() => { if (active) setLoading(false) })
    } else {
      setLoading(false); setForm(readForm())
      try { setPending(readPending()) } catch (reason) { setError(reason instanceof Error ? reason.message : '本地记录读取失败') }
    }
    return () => { active = false }
  }, [edit?.type, edit?.id, attempt])
  useDidShow(() => { if (!edit) {
    try { setPending(readPending()) } catch (reason) { setError(reason instanceof Error ? reason.message : '读取失败') }
  } })
  useEffect(() => {
    if (persistedEdit.current !== edit) { persistedEdit.current = edit; return }
    if (edit) return
    try { Taro.setStorageSync(formKey(), form) } catch { setError('本机空间不足，草稿尚未保存') }
  }, [form, edit])
  const submit = async () => {
    if (lock.current || uploading) return
    lock.current = true; setBusy(true)
    try {
      if (existing) {
        await providerApi.edit(existing, providerFormPayload(form, existing))
        useStore.getState().setRemoteEdit(null)
        await toast('修改已保存，信息状态保持不变')
        void go('manage')
      } else {
        // Once a server ID exists the draft is edited/submitted in management.
        // The form is frozen until this pending ID is resolved.
        await createAndSubmit(form.type, providerFormPayload(form), {
          read: readPending,
          write: (value) => { Taro.setStorageSync(pendingKey(), value); setPending(value) },
        }, { create: providerApi.create,
          submit: async (type, id) => {
            const item = await providerApi.detail(type, id)
            if (item.reviewStatus === 'pending_review') return
            await providerApi.action(item, 'submit')
          } })
        // Clear the non-idempotency guard last, after all local cleanup succeeds.
        Taro.removeStorageSync(formKey())
        setForm({ ...emptyProviderForm, images: [] })
        Taro.removeStorageSync(pendingKey()); setPending(undefined)
        await toast('发布成功')
      }
    } catch (reason) {
      let saved: PendingDraft | undefined
      try { saved = readPending(); setPending(saved) } catch { /* Keep the original error. */ }
      const details = reason instanceof ApiError && reason.fieldErrors.length
        ? `\n${reason.fieldErrors.map((field) => `${field.field}: ${field.message}`).join('\n')}` : ''
      await Taro.showModal({ title: saved?.id ? '草稿已保存，提交未完成' : '操作未完成',
        content: `${reason instanceof Error ? reason.message : '请稍后重试'}${details}${saved?.id ? `\n请到发布管理处理 ${saved.type}-${saved.id}，不会重复创建。` : ''}`, showCancel: false })
    } finally { lock.current = false; setBusy(false) }
  }
  const frozen = busy || uploading || Boolean(!edit && (pending?.id || pending?.uncertain))
  const billingLabels = { hour: '按量计费', day: '包日', week: '包周', month: '包月' } as const
  const action = () => void go('manage')
  return <Page title={edit ? '编辑信息' : '发布信息'}>
    {loading ? <View className='loading'>正在读取本人草稿…</View> : error ? <Empty title={error} action='重试' onAction={() => setAttempt(attempt + 1)} /> : <>
      {!edit && (pending?.id || pending?.uncertain) && <Card><Text className='strong'>{pending.id ? `已有平台草稿 ${pending.type}-${pending.id}` : '上次创建结果待确认'}</Text>
        <View className='notice'>请到发布管理核对并继续操作，避免重复创建。</View><Button className='button' onClick={action}>查看发布管理</Button>
        <Button className='button ghost small' onClick={async () => {
          const answer = await Taro.showModal({ title: '已核对平台草稿？', content: '仅在确认已有草稿已处理，或上次请求未创建记录后解除。此操作不会删除平台记录。' })
          if (answer.confirm) { Taro.removeStorageSync(pendingKey()); setPending(undefined) }
        }}>已核对，解除本机保护</Button></Card>}
      <Card><Tabs value={form.type} onChange={(type) => { if (!edit && !frozen) update({ type, category: '' }) }} items={[
        { value: 'sale', label: '售卖' }, { value: 'lease', label: '租赁' }, { value: 'demand', label: '需求' },
      ]} />
        <View className='form' style={frozen ? { pointerEvents: 'none', opacity: 0.7 } : {}}>
          <Field label='信息名称' required><FormInput value={form.title} onChange={(title) => update({ title })} maxLength={form.type === 'sale' ? 128 : 60} /></Field>
          {form.type === 'lease' ? <Field label='商品分类' required><Select value={form.category === 'gpu-server' ? 'GPU服务器' : form.category === 'general_server' ? '通用服务器' : ''}
            options={['GPU服务器', '通用服务器']} onChange={(value) => update({ category: value === 'GPU服务器' ? 'gpu-server' : 'general_server' })} /></Field>
            : <Field label='商品分类' required><FormInput value={form.category} onChange={(category) => update({ category })} placeholder='如：GPU单卡 / GPU服务器' maxLength={64} /></Field>}
          <Field label='GPU 型号' required={!existing}><FormInput value={form.model} onChange={(model) => update({ model })} placeholder='如：RTX 4090 / A100' maxLength={100} /></Field>
          {form.type === 'sale' && <>
            <Field label='供应商名称' required><FormInput value={form.supplierName} onChange={(supplierName) => update({ supplierName })} maxLength={128} /></Field>
            <Field label='联系电话 / 邮箱' required hint='至少填写一项，通用联系方式不能替代。'><FormInput value={form.contactPhone} onChange={(contactPhone) => update({ contactPhone })} placeholder='联系电话' maxLength={128} />
              <View className='field-extra'><FormInput value={form.contactEmail} onChange={(contactEmail) => update({ contactEmail })} placeholder='电子邮箱' maxLength={128} /></View></Field>
          </>}
          <Field label='商品数量' required><FormInput value={form.quantity} type='number' onChange={(quantity) => update({ quantity })} placeholder='1 至 1000000' maxLength={7} /></Field>
          {form.type === 'lease' && <>
            <Field label='每台设备 GPU 数量' required><FormInput value={form.gpuCount} type='number' onChange={(gpuCount) => update({ gpuCount })} /></Field>
            <Field label='计费方式' required hint={existing ? '编辑时保留原计费方式。' : undefined}><Select value={billingLabels[form.billing]} options={Object.values(billingLabels)}
              onChange={(label) => { if (!existing) update({ billing: (Object.keys(billingLabels) as Array<keyof typeof billingLabels>).find((key) => billingLabels[key] === label)! }) }} /></Field>
          </>}
          {form.type === 'demand' && <Field label='需求类型' required><Tabs value={form.demandMode} onChange={(demandMode) => update({ demandMode })}
            items={[{ value: 'purchase', label: '求购' }, { value: 'lease', label: '求租' }]} /></Field>}
          <Field label={form.type === 'demand' ? '单个商品预算（元）' : '单个商品价格（元）'} required hint={form.type === 'lease' ? `按${billingLabels[form.billing]}计价` : '最高价留空表示固定价格。'}>
            <View className='form-columns'><FormInput value={form.price} type='digit' onChange={(price) => update({ price })} placeholder={form.type === 'lease' ? '现价' : '最低价'} maxLength={20} />
              {form.type !== 'lease' && <FormInput value={form.maxPrice} type='digit' onChange={(maxPrice) => update({ maxPrice })} placeholder='最高价（选填）' maxLength={20} />}</View>
          </Field>
          {form.type === 'lease' && <Field label='原价（选填）'><FormInput value={form.originalPrice} type='digit' onChange={(originalPrice) => update({ originalPrice })} /></Field>}
          {form.type !== 'demand' && <Field label='成色'><Select value={form.condition ? apiConditionLabels[form.condition] : ''} options={Object.values(apiConditionLabels)}
            onChange={(label) => update({ condition: (Object.keys(apiConditionLabels) as ApiCondition[]).find((key) => apiConditionLabels[key] === label)! })} />
            {form.condition === 'custom' && <FormInput value={form.conditionNote} onChange={(conditionNote) => update({ conditionNote })} placeholder='成色说明' maxLength={100} />}</Field>}
          <Field label='交付周期' required><FormInput value={form.delivery} onChange={(delivery) => update({ delivery })} placeholder='如：一周内' maxLength={50} /></Field>
          <Field label='有效期设置' hint='当前服务保存有效期设置，实际到期时间以平台返回为准。'>
            <Select value={{ unlimited: '长期有效', days: '指定天数', date: '指定日期' }[form.validityMode]} options={['长期有效', '指定天数', '指定日期']}
              onChange={(label) => update({ validityMode: label === '长期有效' ? 'unlimited' : label === '指定天数' ? 'days' : 'date' })} />
            {form.validityMode === 'days' && <Select value={form.validityDays} options={['7', '15', '30', '60', '90']} onChange={(validityDays) => update({ validityDays })} />}
            {form.validityMode === 'date' && <Picker mode='date' value={form.validityUntil} onChange={(event) => update({ validityUntil: event.detail.value })}><View className='form-input'>{form.validityUntil || '选择日期'}</View></Picker>}
          </Field>
          <Field label='交易地区' required={form.type === 'demand'}>
            <MarketRegionSelect value={form.location} allowClear={!existing && form.type !== 'demand'} onChange={(location) => update({ location })} />
          </Field>
          <Field label='通用联系方式' required={form.type !== 'sale'}><FormInput value={form.contact} onChange={(contact) => update({ contact })} placeholder='微信号或其他联系方式' maxLength={128} /></Field>
          <Field label='描述'><FormText value={form.description} onChange={(description) => update({ description })} maxLength={form.type === 'sale' ? 500 : 200} /></Field>
          <Field label='商品图片（最多 9 张）'><Upload images={form.images} upload={uploadListingImage} onUploadingChange={setUploading}
            onChange={(images) => setForm((value) => ({ ...value, images }))} /></Field>
        </View>
        <View className='notice'>信息提交后进入平台审核，审核通过才会公开上架。</View>
        <Button className='button full' disabled={frozen || Boolean(edit && !existing)} onClick={() => void submit()}>{busy ? '处理中…' : edit ? '保存修改' : '提交审核'}</Button>
        <Button className='button ghost full' onClick={action}>查看我的发布</Button>
      </Card>
    </>}
  </Page>
}
