import dotenv from 'dotenv'
import express from 'express'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ApiError, createImageClient } from './image-api.js'

dotenv.config({ path: '.env.local' })
dotenv.config()

const app = express()
const port = Number(process.env.PORT || 8787)
const dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(dirname, '../dist')

app.disable('x-powered-by')
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}))
app.use(express.json({ limit: '85mb' }))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, configured: Boolean(process.env.XJJUHE_API_KEY) })
})

app.post('/api/images/generate', async (request, response, next) => {
  try {
    const client = createImageClient({
      apiKey: process.env.XJJUHE_API_KEY,
      baseUrl: process.env.XJJUHE_BASE_URL,
    })
    response.status(202).json(await client.generate(request.body))
  } catch (error) {
    next(error)
  }
})

app.get('/api/images/tasks/:taskId', async (request, response, next) => {
  try {
    const client = createImageClient({
      apiKey: process.env.XJJUHE_API_KEY,
      baseUrl: process.env.XJJUHE_BASE_URL,
    })
    response.json(await client.getTask(request.params.taskId))
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

app.listen(port, '127.0.0.1', () => {
  console.log(`API server: http://127.0.0.1:${port}`)
})
