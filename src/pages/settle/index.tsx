import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { Card, DemoNote, Field, FormInput, Page, Tabs, Tag, Upload } from '../../components/ui'
import { marketService } from '../../services/market'
import { useStore } from '../../store'
import { go, switchTab, toast, usePage } from '../../utils/navigation'
export default function Settle() {
  usePage()
  const merchant = useStore((s) => s.merchant),
    setMerchant = useStore((s) => s.setMerchant)
  const [type, setType] = useState<'enterprise' | 'personal'>('enterprise'),
    [name, setName] = useState(''),
    [credit, setCredit] = useState(''),
    [person, setPerson] = useState(''),
    [identity, setIdentity] = useState(''),
    [phone, setPhone] = useState(''),
    [code, setCode] = useState(''),
    [sentPhone, setSentPhone] = useState(''),
    [category, setCategory] = useState('GPU 单卡'),
    [images, setImages] = useState<string[]>([]),
    [agreed, setAgreed] = useState(false),
    [countdown, setCountdown] = useState(0),
    [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])
  const enterprise = type === 'enterprise'
  const sendCode = () => {
    if (countdown) return
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      void toast('请填写有效的 11 位手机号')
      return
    }
    setSentPhone(phone)
    setCountdown(60)
    void Taro.showModal({
      title: '演示验证码',
      content: '本次未发送短信。演示验证码：888888',
      showCancel: false,
    })
  }
  const submit = async () => {
    if (submitting) return
    let error = ''
    if (!name.trim()) error = enterprise ? '请填写商户名称' : '请填写店铺名称'
    else if (enterprise && !/^[0-9A-Z]{18}$/.test(credit)) error = '请填写 18 位统一社会信用代码'
    else if (!person.trim()) error = enterprise ? '请填写法人姓名' : '请填写真实姓名'
    else if (!enterprise && !/^\d{17}[\dXx]$/.test(identity)) error = '请填写 18 位身份证号码'
    else if (!/^1[3-9]\d{9}$/.test(phone)) error = '请填写有效手机号'
    else if (sentPhone !== phone || code !== '888888') error = '请先获取并填写正确的演示验证码'
    else if (images.length < (enterprise ? 1 : 2))
      error = enterprise ? '请添加营业执照示例图片' : '请添加身份证两面示例图片'
    else if (!agreed) error = '请阅读并同意演示入驻协议'
    if (error) {
      void toast(error)
      return
    }
    setSubmitting(true)
    try {
      setMerchant(await marketService.submitMerchant(name, type))
    } catch {
      void toast('保存失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }
  const agreement = () =>
    void Taro.showModal({
      title: '演示入驻协议',
      content:
        '本页面仅用于体验商家入驻流程，不构成正式入驻申请。请使用测试资料。演示数据仅保存在本机，正式入驻协议及信息服务规则将在平台开放后另行提供。',
      showCancel: false,
    })
  return (
    <Page title='商家入驻' isBack>
      <Card className='merchant-entry'>
        <View className='row gap'>
          <Tag color='orange'>平台核验标识</Tag>
          <Tag color='orange'>专属店铺</Tag>
          <Tag color='orange'>行情展示位</Tag>
          <Tag color='orange'>信息推荐</Tag>
        </View>
      </Card>
      {merchant ? (
        <Card>
          <View className='success-state'>
            <Text className='success-state-icon'>
              {merchant.status === 'approved' ? '🏪' : '⏳'}
            </Text>
            <Text className='success-state-title'>
              {merchant.status === 'approved' ? '演示店铺已开通' : '入驻申请已保存（演示）'}
            </Text>
            <Text className='muted'>
              {merchant.name} · {merchant.type === 'enterprise' ? '企业入驻' : '个人入驻'}
            </Text>
            <View className='notice' style={{ marginTop: '18px', textAlign: 'left' }}>
              本机演示状态，尚未向平台提交申请，不代表实际审核结果。
            </View>
            {merchant.status === 'pending' ? (
              <Button
                className='button full'
                onClick={() => setMerchant({ ...merchant, status: 'approved' })}
              >
                模拟审核通过
              </Button>
            ) : (
              <Button className='button full' onClick={() => void go('shop', { id: 'mine' })}>
                查看我的演示店铺
              </Button>
            )}
            <Button className='button ghost full' onClick={() => void switchTab(4)}>
              返回「我的」
            </Button>
            <Text
              className='muted block'
              style={{ marginTop: '18px' }}
              onClick={() => void go('shop', { id: 'xunjie' })}
            >
              看看示例商家的店铺 ›
            </Text>
          </View>
        </Card>
      ) : (
        <>
          <View className='page-gutter'>
            <Tabs
              value={type}
              onChange={(value) => {
                setType(value)
                setImages([])
                setAgreed(false)
              }}
              items={[
                { value: 'enterprise', label: '🏢 企业入驻' },
                { value: 'personal', label: '🧑 个人入驻' },
              ]}
            />
          </View>
          <View className='notice page-notice'>
            当前为演示流程，请使用测试资料和示例图片。证件号码、联系人和证件图片不会写入本地申请记录。
          </View>
          <Card>
            <View className='form' style={{ marginTop: 0 }}>
              <Field label={enterprise ? '商户名称' : '店铺名称'} required>
                <FormInput
                  value={name}
                  onChange={setName}
                  placeholder={enterprise ? '请输入公司全称' : '如：老王的显卡铺'}
                />
              </Field>
              {enterprise && (
                <Field label='统一社会信用代码' required>
                  <FormInput
                    value={credit}
                    onChange={(value) => setCredit(value.toUpperCase())}
                    placeholder='18 位统一社会信用代码'
                    maxLength={18}
                  />
                </Field>
              )}
              <Field label={enterprise ? '法人姓名' : '真实姓名'} required>
                <FormInput
                  value={person}
                  onChange={setPerson}
                  placeholder='请输入姓名'
                  maxLength={30}
                />
              </Field>
              {!enterprise && (
                <Field label='身份证号码' required>
                  <FormInput
                    value={identity}
                    onChange={setIdentity}
                    placeholder='18 位身份证号码'
                    maxLength={18}
                  />
                </Field>
              )}
              <Field label='联系电话' required>
                <View className='row' style={{ gap: '8px' }}>
                  <View className='grow'>
                    <FormInput
                      value={phone}
                      onChange={(value) => {
                        setPhone(value)
                        setCode('')
                      }}
                      placeholder='11 位手机号'
                      type='number'
                      maxLength={11}
                    />
                  </View>
                  <Button
                    className='button ghost small'
                    disabled={countdown > 0}
                    onClick={sendCode}
                  >
                    {countdown ? `${countdown}s 后重发` : '获取验证码'}
                  </Button>
                </View>
              </Field>
              <Field label='验证码' required>
                <FormInput
                  value={code}
                  onChange={setCode}
                  placeholder='填写演示验证码'
                  type='number'
                  maxLength={6}
                />
              </Field>
              <Field label='经营分类'>
                <Tabs
                  compact
                  value={category}
                  onChange={setCategory}
                  items={['GPU 单卡', 'GPU 整机', '配件周边', '租赁服务'].map((value) => ({
                    value,
                    label: value,
                  }))}
                />
              </Field>
              <Field
                label={enterprise ? '营业执照示例图片' : '身份证示例图片（人像面、国徽面）'}
                required
              >
                <Upload images={images} onChange={setImages} max={enterprise ? 3 : 2} />
              </Field>
            </View>
          </Card>
          <Card>
            <View className='agree-row'>
              <View
                className={`checkbox ${agreed ? 'checked' : ''}`}
                onClick={() => setAgreed(!agreed)}
              >
                {agreed ? '✓' : ''}
              </View>
              <View>
                <Text onClick={() => setAgreed(!agreed)}>已阅读并同意 </Text>
                <Text className='orange-text' onClick={agreement}>
                  《演示入驻协议与信息服务规则》
                </Text>
              </View>
            </View>
            <Button
              className='button full'
              disabled={!agreed || submitting}
              onClick={() => void submit()}
            >
              提交申请（演示）
            </Button>
          </Card>
        </>
      )}
      <DemoNote>入驻与审核状态仅供演示</DemoNote>
    </Page>
  )
}
