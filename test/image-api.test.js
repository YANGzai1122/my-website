import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, createImageClient, normalizeTasks, validateGeneratePayload } from '../server/image-api.js'

test('validates and maps a GPT Image request', () => {
  const payload = validateGeneratePayload({
    model: 'gpt-image-2.5',
    prompt: '  白色背景产品摄影  ',
    n: 2,
    size: '1024x1024',
  })
  assert.deepEqual(payload, {
    model: 'gpt-image-2.5',
    prompt: '白色背景产品摄影',
    n: 2,
    size: '1024x1024',
    response_format: 'url',
  })
})

test('rejects invalid sizes and excessive reference images', () => {
  assert.throws(
    () => validateGeneratePayload({ prompt: 'test', size: '999x999' }),
    (error) => error instanceof ApiError && error.code === 'invalid_image_size',
  )
  assert.throws(
    () => validateGeneratePayload({ prompt: 'test', referenceImages: Array(9).fill('https://example.com/a.png') }),
    (error) => error instanceof ApiError && error.code === 'too_many_reference_images',
  )
})

test('normalizes single and batched asynchronous tasks', () => {
  assert.deepEqual(normalizeTasks({ id: 'task_one', status: 'queued', progress: 0 }), [{
    id: 'task_one', status: 'queued', progress: 0, imageUrl: null, error: null,
  }])

  assert.deepEqual(normalizeTasks({ data: [
    { task_id: 'task_a', status: 'processing', progress: 30 },
    { task_id: 'task_b', status: 'completed', url: 'https://cdn.example.com/b.png' },
  ] }), [
    { id: 'task_a', status: 'processing', progress: 30, imageUrl: null, error: null },
    { id: 'task_b', status: 'completed', progress: 100, imageUrl: 'https://cdn.example.com/b.png', error: null },
  ])
})

test('client keeps the API key server-side and parses an immediate result', async () => {
  const calls = []
  const client = createImageClient({
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return new Response(JSON.stringify({ data: [{ url: 'https://cdn.example.com/result.png' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })
  const result = await client.generate({ prompt: 'test', size: '1024x1024' })
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key')
  assert.equal(result.tasks[0].status, 'completed')
  assert.equal(result.tasks[0].imageUrl, 'https://cdn.example.com/result.png')
})

test('task queries preserve the requested task id when the completed payload only contains data URLs', async () => {
  const client = createImageClient({
    apiKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify({
      status: 'completed',
      data: [{ url: 'https://cdn.example.com/completed.png' }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  })
  const result = await client.getTask('task_original')
  assert.equal(result.task.id, 'task_original')
  assert.equal(result.task.status, 'completed')
  assert.equal(result.task.imageUrl, 'https://cdn.example.com/completed.png')
})

test('shuyanai provider validates its own model allowlist', async () => {
  const { IMAGE_PROVIDERS, resolveImageProvider } = await import('../server/image-api.js')
  assert.equal(resolveImageProvider('shuyanai'), 'shuyanai')
  assert.equal(resolveImageProvider('unknown'), 'xjjuhe')
  assert.deepEqual(
    IMAGE_PROVIDERS.shuyanai.models.map((m) => m.id),
    ['wan2.7-image-pro', 'qwen-image-2.0-pro', 'qwen-image-max'],
  )

  const payload = validateGeneratePayload({ model: 'qwen-image-max', prompt: 'test', size: '1024x1024' }, 'shuyanai')
  assert.equal(payload.model, 'qwen-image-max')

  // xjjuhe 的模型在数眼下应被拒绝
  assert.throws(
    () => validateGeneratePayload({ model: 'gpt-image-2.5', prompt: 'test' }, 'shuyanai'),
    (error) => error instanceof ApiError && error.code === 'invalid_model',
  )

  // 数眼 client 默认走 platform.shuyanai.com，且缺 key 时报错指向 SHUYANAI_API_KEY
  assert.throws(
    () => createImageClient({ provider: 'shuyanai' }),
    (error) => error instanceof ApiError && error.code === 'missing_api_key' && /SHUYANAI_API_KEY/.test(error.message),
  )

  const calls = []
  const client = createImageClient({
    apiKey: 'sk-test',
    provider: 'shuyanai',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return new Response(JSON.stringify({ data: [{ url: 'https://cdn.example.com/sy.png' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })
  const result = await client.generate({ model: 'wan2.7-image-pro', prompt: 'test' })
  assert.ok(calls[0].url.startsWith('https://platform.shuyanai.com/v1/images/generations'))
  assert.equal(result.tasks[0].imageUrl, 'https://cdn.example.com/sy.png')
})
