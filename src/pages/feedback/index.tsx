import { Button, Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { Card, Field, FormInput, FormText, Page, Tabs, Upload } from '../../components/ui'
import { marketService } from '../../services/market'
import { useStore } from '../../store'
import { back, toast, usePage } from '../../utils/navigation'
export default function Feedback() {
  usePage()
  const params = useRouter().params,
    save = useStore((s) => s.saveFeedback)
  const types = ['功能异常', '产品建议', '内容问题', '其他']
  const [type, setType] = useState(types.includes(params.type || '') ? params.type! : '产品建议'),
    [content, setContent] = useState(params.reference ? `关于信息 ${params.reference}：` : ''),
    [contact, setContact] = useState(''),
    [images, setImages] = useState<string[]>([]),
    [sending, setSending] = useState(false),
    [done, setDone] = useState(false)
  const submit = async () => {
    if (sending) return
    if (content.trim().length < 5) {
      void toast('请填写至少 5 个字的问题描述')
      return
    }
    setSending(true)
    try {
      save(
        await marketService.submitFeedback({
          type,
          content: content.trim(),
          contact: contact.trim(),
          images,
        }),
      )
      setDone(true)
    } catch {
      void toast('保存失败，请重试')
    } finally {
      setSending(false)
    }
  }
  return (
    <Page title='意见反馈' isBack>
      {done ? (
        <Card>
          <View className='success-state'>
            <Text className='success-state-icon'>✅</Text>
            <Text className='success-state-title'>演示反馈已保存</Text>
            <Text className='muted'>已保存到本机，尚未发送平台。感谢你体验反馈流程。</Text>
            <Button className='button full' onClick={() => void back()}>
              返回
            </Button>
          </View>
        </Card>
      ) : (
        <Card>
          <View className='form' style={{ marginTop: 0 }}>
            <Field label='反馈类型'>
              <Tabs
                value={type}
                onChange={setType}
                compact
                items={types.map((value) => ({ value, label: value }))}
              />
            </Field>
            <Field label='问题描述' required>
              <FormText
                value={content}
                onChange={setContent}
                maxLength={200}
                placeholder='请描述操作过程、遇到的问题和预期结果（至少 5 个字）'
              />
            </Field>
            <Field label='上传截图（选填，最多 3 张）'>
              <Upload persist images={images} onChange={setImages} max={3} />
            </Field>
            <Field label='联系方式（选填）'>
              <FormInput
                value={contact}
                onChange={setContact}
                placeholder='手机号 / 微信号，方便我们回访'
                maxLength={80}
              />
            </Field>
            <View className='notice'>
              当前为演示流程，反馈仅保存在本机。正式服务开通后可发送至平台。
            </View>
            <Button className='button full' disabled={sending} onClick={() => void submit()}>
              提交反馈（演示）
            </Button>
          </View>
        </Card>
      )}
    </Page>
  )
}
