import { ApiError } from './http-core'
import type { ApiListingType } from './listing-api'

export interface PendingDraft { type: ApiListingType; id?: number; uncertain: boolean }
export interface DraftStorage { read(): PendingDraft | undefined; write(value: PendingDraft): void }
// Save the server ID before submit. A failed submit must never create a second
// draft; an uncertain create must be checked in the owner list before retrying.
export async function createAndSubmit(
  type: ApiListingType, payload: Record<string, unknown>, storage: DraftStorage,
  api: { create(type: ApiListingType, payload: Record<string, unknown>): Promise<{ id: number; type: ApiListingType }>
    submit(type: ApiListingType, id: number): Promise<void> },
) {
  let pending = storage.read()
  if (pending?.uncertain) throw new ApiError('上次创建结果尚未确认，请先在发布管理核对草稿', 0, 'CREATE_UNCERTAIN')
  if (pending?.id && pending.type !== type) throw new ApiError('已有待提交草稿，请先到发布管理处理', 409)
  if (!pending?.id) {
    // Persist the uncertainty marker before issuing a non-idempotent request.
    pending = { type, uncertain: true }
    storage.write(pending)
    try {
      const created = await api.create(type, payload)
      pending = { type: created.type, id: created.id, uncertain: false }
      storage.write(pending)
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500)
        storage.write({ type, uncertain: false })
      throw error
    }
  }
  await api.submit(type, pending.id!)
  return pending
}
