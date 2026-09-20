const ALLOWED_MODELS = new Set(['gpt-image-2.5', 'gpt-image-2', 'nano_banana_2'])
const GPT_IMAGE_SIZES = new Set([
  '1024x1024',
  '1280x720',
  '720x1280',
  '1248x832',
  '832x1248',
  '1152x864',
  '864x1152',
  '1120x896',
  '896x1120',
  '1456x624',
])
const ASPECT_RATIOS = new Set([
  'auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9',
])
const DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,[a-zA-Z0-9+/=\r\n]+$/
const TASK_ID_PATTERN = /^[a-zA-Z0-9_-]{3,200}$/

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function assert(condition, status, code, message) {
  if (!condition) throw new ApiError(status, code, message)
}

function validateReferenceImage(value) {
  if (typeof value !== 'string') return false
  if (DATA_URL_PATTERN.test(value)) return Buffer.byteLength(value, 'utf8') <= 14_000_000
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && value.length <= 4_096
  } catch {
    return false
  }
}

export function validateGeneratePayload(input) {
  assert(input && typeof input === 'object', 400, 'invalid_body', '请求内容必须是 JSON 对象')

  const model = typeof input.model === 'string' ? input.model.trim() : 'gpt-image-2.5'
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : ''
  const n = Number(input.n ?? 1)
  const size = typeof input.size === 'string' ? input.size : '1024x1024'
  const aspectRatio = typeof input.aspectRatio === 'string' ? input.aspectRatio : undefined
  const referenceImages = Array.isArray(input.referenceImages) ? input.referenceImages : []

  assert(ALLOWED_MODELS.has(model), 400, 'invalid_model', '不支持该图像模型')
  assert(prompt.length > 0, 400, 'invalid_prompt', '请填写生图描述')
  assert(prompt.length <= (model === 'nano_banana_2' ? 10_000 : 4_000), 400, 'invalid_prompt', '生图描述过长')
  assert(Number.isInteger(n) && n >= 1 && n <= 4, 400, 'invalid_n', '生成数量必须为 1–4')
  assert(referenceImages.length <= 8, 400, 'too_many_reference_images', '参考图最多 8 张')
  assert(referenceImages.every(validateReferenceImage), 400, 'invalid_reference_image', '参考图必须是 HTTPS 直链或有效的 PNG/JPEG/WEBP Data URL')

  if (model === 'nano_banana_2') {
    assert(!aspectRatio || ASPECT_RATIOS.has(aspectRatio), 400, 'invalid_aspect_ratio', '不支持该画面比例')
  } else {
    assert(GPT_IMAGE_SIZES.has(size), 400, 'invalid_image_size', '不支持该图片尺寸')
  }

  return {
    model,
    prompt,
    n,
    ...(model === 'nano_banana_2' ? { aspect_ratio: aspectRatio || '1:1' } : { size }),
    ...(referenceImages.length ? { reference_images: referenceImages } : {}),
    response_format: 'url',
  }
}

function readImageUrl(item) {
  return item?.url || item?.image_url || item?.data?.[0]?.url || null
}

export function normalizeTasks(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError(502, 'invalid_upstream_response', '生图服务返回了无法识别的数据')
  }

  const rawItems = Array.isArray(payload.data) && payload.data.length > 0
    ? payload.data
    : [payload]

  return rawItems.map((item, index) => {
    const imageUrl = readImageUrl(item)
    const id = item?.task_id || item?.id || (imageUrl ? `result-${index}` : null)
    if (!id) throw new ApiError(502, 'missing_task_id', '生图服务未返回任务编号')

    const rawStatus = String(item?.status || (imageUrl ? 'completed' : 'queued')).toLowerCase()
    const status = ['completed', 'succeeded', 'success'].includes(rawStatus)
      ? 'completed'
      : ['failed', 'error', 'cancelled', 'canceled'].includes(rawStatus)
        ? 'failed'
        : rawStatus === 'processing' || rawStatus === 'running'
          ? 'processing'
          : 'queued'

    return {
      id,
      status,
      progress: Number.isFinite(Number(item?.progress)) ? Number(item.progress) : status === 'completed' ? 100 : 0,
      imageUrl,
      error: item?.fail_reason || item?.error?.message || item?.message || null,
    }
  })
}

function upstreamError(status, payload) {
  const upstreamCode = payload?.error?.code || payload?.code || 'upstream_error'
  const messages = {
    invalid_image_size: '当前模型不支持所选尺寸',
    invalid_image_parameter: '图片参数不正确',
    invalid_image_prompt: '提示词无效，请调整后重试',
    content_policy_violation: '内容未通过安全检查，请调整描述或参考图',
    rate_limit_exceeded: '请求过于频繁，请稍后再试',
    insufficient_quota: '接口账户余额不足',
    model_unavailable: '当前图像模型暂时不可用',
    image_service_error: '图像服务暂时异常，请稍后重试',
  }
  return new ApiError(status >= 500 ? 502 : status, upstreamCode, messages[upstreamCode] || payload?.error?.message || '生图服务请求失败')
}

async function parseResponse(response) {
  const text = await response.text()
  let payload
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    throw new ApiError(502, 'invalid_upstream_response', '生图服务返回了非 JSON 数据')
  }
  if (!response.ok) throw upstreamError(response.status, payload)
  return payload
}

export function createImageClient({ apiKey, baseUrl = 'https://xjjuhe.site', fetchImpl = fetch }) {
  assert(apiKey, 500, 'missing_api_key', '服务器未配置 XJJUHE_API_KEY')
  const normalizedBase = baseUrl.replace(/\/$/, '')

  async function request(path, options = {}) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)
    try {
      const response = await fetchImpl(`${normalizedBase}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        signal: controller.signal,
      })
      return await parseResponse(response)
    } catch (error) {
      if (error?.name === 'AbortError') throw new ApiError(504, 'upstream_timeout', '生图服务响应超时，请稍后查看或重试')
      if (error instanceof ApiError) throw error
      throw new ApiError(502, 'upstream_unreachable', '暂时无法连接生图服务')
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    async generate(input) {
      const body = validateGeneratePayload(input)
      const payload = await request('/v1/images/generations', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return { tasks: normalizeTasks(payload) }
    },

    async getTask(taskId) {
      assert(TASK_ID_PATTERN.test(taskId), 400, 'invalid_task_id', '任务编号格式不正确')
      const payload = await request(`/v1/images/generations/${encodeURIComponent(taskId)}`)
      return { task: { ...normalizeTasks(payload)[0], id: taskId } }
    },
  }
}
