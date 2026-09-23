import { ApiError } from './image-api.js'

const VIDEO_MODELS = new Set(['omni_flash-10s', 'sora-2-12s', 'veo_3_1-fast-fl'])
const VIDEO_SIZES = new Set(['1280x720', '1920x1080', '720x1280', '1080x1920'])
const PRODUCT_PLATFORMS = {
  shopee: '/v1/parse/shopee',
  amazon: '/v1/parse/amazon',
  xhs: '/v1/parse/xhs',
  douyin: '/v1/parse/douyin',
  channels: '/v1/parse/wechat-channels',
  instagram: '/v1/parse/instagram',
}
const TASK_ID_PATTERN = /^[a-zA-Z0-9_-]{3,200}$/

function assert(condition, message, code = 'invalid_request') {
  if (!condition) throw new ApiError(400, code, message)
}

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function normalizeBaseUrl(value) {
  return (value || 'https://xjjuhe.site').replace(/\/$/, '').replace(/\/v1$/, '')
}

function upstreamError(status, payload) {
  const message = payload?.error?.message || payload?.message || '上游工具请求失败'
  const code = payload?.error?.code || payload?.code || 'upstream_error'
  return new ApiError(status >= 500 ? 502 : status, code, message)
}

async function parseResponse(response) {
  const raw = await response.text()
  let payload = {}
  try { payload = raw ? JSON.parse(raw) : {} } catch { throw new ApiError(502, 'invalid_upstream_response', '上游返回了无法识别的数据') }
  if (!response.ok) throw upstreamError(response.status, payload)
  return payload
}

function normalizeVideoTask(payload) {
  const item = payload?.task || payload?.data || payload
  const id = item?.id || item?.task_id
  assert(id, '视频服务未返回任务编号', 'missing_task_id')
  const status = String(item?.status || 'queued').toLowerCase()
  const normalized = ['completed', 'succeeded', 'success'].includes(status)
    ? 'completed'
    : ['failed', 'error', 'cancelled', 'canceled'].includes(status) ? 'failed' : status === 'processing' || status === 'running' ? 'processing' : 'queued'
  return {
    id,
    status: normalized,
    progress: Number.isFinite(Number(item?.progress)) ? Number(item.progress) : normalized === 'completed' ? 100 : 0,
    videoUrl: item?.video_url || item?.video || item?.url || item?.data?.video_url || null,
    coverUrl: item?.cover_url || item?.cover || null,
    error: item?.error?.message || item?.error || item?.message || null,
  }
}

export function createToolsClient({ apiKey, baseUrl = 'https://xjjuhe.site', fetchImpl = fetch }) {
  if (!apiKey) throw new ApiError(500, 'missing_api_key', '服务器未配置 XJJUHE_API_KEY')
  const root = normalizeBaseUrl(baseUrl)

  async function request(path, options = {}, timeoutMs = 90_000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(`${root}${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${apiKey}`, ...(options.headers || {}), ...(options.body && !options.headers?.['Content-Type'] ? { 'Content-Type': 'application/json' } : {}) },
        signal: controller.signal,
      })
      return await parseResponse(response)
    } catch (error) {
      if (error?.name === 'AbortError') throw new ApiError(504, 'upstream_timeout', '工具服务响应超时，请稍后重试')
      if (error instanceof ApiError) throw error
      throw new ApiError(502, 'upstream_unreachable', '暂时无法连接工具服务')
    } finally { clearTimeout(timer) }
  }

  return {
    async createVideo(input) {
      const model = text(input?.model, 'omni_flash-10s')
      const prompt = text(input?.prompt)
      const size = text(input?.size, '1280x720')
      assert(VIDEO_MODELS.has(model), '不支持该视频模型', 'invalid_model')
      assert(prompt && prompt.length <= 4000, '请填写 1–4000 字的视频描述', 'invalid_prompt')
      assert(VIDEO_SIZES.has(size), '不支持该视频尺寸', 'invalid_size')
      if (model === 'veo_3_1-fast-fl') assert(Array.isArray(input?.images) && input.images.length > 0, 'VEO 模型必须上传参考图', 'reference_required')
      const payload = await request('/v1/videos', { method: 'POST', body: JSON.stringify({ model, prompt, size, ...(Array.isArray(input?.images) && input.images.length ? { images: input.images.slice(0, 2) } : {}) }) }, 30_000)
      return { task: normalizeVideoTask(payload) }
    },

    async getVideo(taskId) {
      assert(TASK_ID_PATTERN.test(taskId), '任务编号格式不正确', 'invalid_task_id')
      return { task: { ...normalizeVideoTask(await request(`/v1/videos/${encodeURIComponent(taskId)}`, {}, 30_000)), id: taskId } }
    },

    async parseVideo(kind, url) {
      const value = text(url)
      assert(/^https?:\/\//i.test(value), '请输入有效的视频链接', 'invalid_url')
      const path = kind === 'watermark' ? '/v1/parse/video-watermark' : '/v1/parse/copywriting'
      return request(path, { method: 'POST', body: JSON.stringify({ url: value }) }, 45_000)
    },

    async parseProduct(platform, url, lang) {
      const value = text(url)
      assert(PRODUCT_PLATFORMS[platform], '不支持该商品平台', 'invalid_platform')
      assert(/^https?:\/\//i.test(value), '请输入有效的商品链接', 'invalid_url')
      if (platform === 'amazon') return request(`${PRODUCT_PLATFORMS[platform]}?url=${encodeURIComponent(value)}${lang ? `&translate=${encodeURIComponent(lang)}` : ''}`, {}, 45_000)
      return request(PRODUCT_PLATFORMS[platform], { method: 'POST', body: JSON.stringify({ url: value, ...(lang ? { lang } : {}) }) }, 45_000)
    },

    async createDigitalHuman(input) {
      const templateId = text(input?.templateId)
      const textValue = text(input?.text)
      const audioUrl = text(input?.audioUrl)
      assert(templateId, '请填写数字人模板 ID', 'template_required')
      assert(textValue || audioUrl, '请填写播报文案或驱动音频 URL', 'script_required')
      const payload = await request('/v1/digital-human/videos/generations', {
        method: 'POST',
        headers: { 'Idempotency-Key': text(input?.idempotencyKey) || `baiye-${Date.now()}-${Math.random().toString(36).slice(2)}` },
        body: JSON.stringify({ model: 'digital-human', template_id: templateId, ...(textValue ? { text: textValue } : {}), ...(audioUrl ? { audio_url: audioUrl } : {}) }),
      }, 30_000)
      return { task: normalizeVideoTask(payload) }
    },
  }
}
