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
