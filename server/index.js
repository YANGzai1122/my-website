import dotenv from 'dotenv'
import express from 'express'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ApiError, createImageClient, IMAGE_PROVIDERS, resolveImageProvider } from './image-api.js'
import { createToolsClient } from './tools-api.js'

dotenv.config({ path: '.env.local' })
dotenv.config()

const app = express()
const port = Number(process.env.PORT || 8787)
const host = process.env.HOST || '0.0.0.0'
const dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(dirname, '../dist')
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || 'https://yangzai1122.github.io')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

app.disable('x-powered-by')
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}))
app.use((request, response, next) => {
  const origin = request.get('origin')
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204)
  next()
})
app.use(express.json({ limit: '85mb' }))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, provider: IMAGE_PROVIDER, configured: Boolean(imageApiKey()) })
})

// 前端用：当前做图供应商 + 可选模型列表（不含密钥）
app.get('/api/config', (_request, response) => {
  const provider = IMAGE_PROVIDERS[IMAGE_PROVIDER]
  response.json({
    provider: IMAGE_PROVIDER,
    providerLabel: provider.label,
    imageModels: provider.models,
  })
})

function toolsClient() {
  return createToolsClient({ apiKey: process.env.XJJUHE_API_KEY, baseUrl: process.env.XJJUHE_BASE_URL })
}

// 做图供应商：xjjuhe（默认）或 shuyanai（数眼智能），由 IMAGE_PROVIDER 环境变量切换
const IMAGE_PROVIDER = resolveImageProvider(process.env.IMAGE_PROVIDER)

function imageApiKey() {
  return IMAGE_PROVIDER === 'shuyanai' ? process.env.SHUYANAI_API_KEY : process.env.XJJUHE_API_KEY
}

function imageClient() {
  const baseUrl = IMAGE_PROVIDER === 'shuyanai'
    ? process.env.SHUYANAI_BASE_URL
    : process.env.XJJUHE_BASE_URL
  return createImageClient({ apiKey: imageApiKey(), baseUrl, provider: IMAGE_PROVIDER })
}

app.post('/api/tools/video', async (request, response, next) => {
  try { response.status(202).json(await toolsClient().createVideo(request.body)) } catch (error) { next(error) }
})

app.get('/api/tools/video/:taskId', async (request, response, next) => {
  try { response.json(await toolsClient().getVideo(request.params.taskId)) } catch (error) { next(error) }
})

app.post('/api/tools/video-parse', async (request, response, next) => {
  try { response.json(await toolsClient().parseVideo(request.body?.kind, request.body?.url)) } catch (error) { next(error) }
})

app.post('/api/tools/product-parse', async (request, response, next) => {
  try { response.json(await toolsClient().parseProduct(request.body?.platform, request.body?.url, request.body?.lang)) } catch (error) { next(error) }
})

app.post('/api/tools/digital-human', async (request, response, next) => {
  try { response.status(202).json(await toolsClient().createDigitalHuman(request.body)) } catch (error) { next(error) }
})

app.post('/api/images/generate', async (request, response, next) => {
  try {
    response.status(202).json(await imageClient().generate(request.body))
  } catch (error) {
    next(error)
  }
})

app.get('/api/images/tasks/:taskId', async (request, response, next) => {
  try {
    response.json(await imageClient().getTask(request.params.taskId))
  } catch (error) {
    next(error)
  }
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }))
  app.get('/{*splat}', (_request, response) => response.sendFile(path.join(distDir, 'index.html')))
}

app.use((error, _request, response, _next) => {
  const safeError = error instanceof ApiError
    ? error
    : error?.type === 'entity.too.large'
      ? new ApiError(413, 'request_too_large', '上传内容过大，请压缩参考图后重试')
      : new ApiError(500, 'internal_error', '服务器暂时异常')

  if (!(error instanceof ApiError)) console.error('[server]', error)
  response.status(safeError.status).json({
    error: {
      code: safeError.code,
      message: safeError.message,
    },
  })
})

app.listen(port, host, () => {
  console.log(`API server: http://${host}:${port}`)
})
