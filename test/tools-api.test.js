import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../server/image-api.js'
import { createToolsClient } from '../server/tools-api.js'

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}

test('video client validates model and normalizes an async task', async () => {
  const calls = []
  const client = createToolsClient({
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return jsonResponse({ id: 'video_task_1', status: 'queued' }, 202)
    },
  })
  const result = await client.createVideo({ model: 'omni_flash-10s', prompt: '产品缓慢旋转', size: '1280x720' })
  assert.equal(result.task.id, 'video_task_1')
  assert.equal(result.task.status, 'queued')
  assert.equal(calls[0].url, 'https://xjjuhe.site/v1/videos')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key')
  await assert.rejects(() => client.createVideo({ model: 'unknown', prompt: 'test' }), (error) => error instanceof ApiError && error.code === 'invalid_model')
})

test('product parser uses GET for Amazon and POST for other platforms', async () => {
  const calls = []
  const client = createToolsClient({ apiKey: 'test-key', fetchImpl: async (url, options) => { calls.push({ url, options }); return jsonResponse({ success: true, data: { title: '商品' } }) } })
  await client.parseProduct('amazon', 'https://amazon.com/dp/ABC123', 'zh-CN')
  await client.parseProduct('douyin', 'https://v.douyin.com/example/', 'zh-CN')
  assert.match(calls[0].url, /\/v1\/parse\/amazon\?url=/)
  assert.equal(calls[0].options.method, undefined)
  assert.equal(calls[1].url, 'https://xjjuhe.site/v1/parse/douyin')
  assert.equal(calls[1].options.method, 'POST')
})

test('digital human requires a template and script or audio', async () => {
  const client = createToolsClient({ apiKey: 'test-key', fetchImpl: async () => jsonResponse({ id: 'dh_task_1', status: 'queued' }, 202) })
  await assert.rejects(() => client.createDigitalHuman({ text: '你好' }), (error) => error instanceof ApiError && error.code === 'template_required')
  await assert.rejects(() => client.createDigitalHuman({ templateId: 'template_1' }), (error) => error instanceof ApiError && error.code === 'script_required')
  const result = await client.createDigitalHuman({ templateId: 'template_1', text: '你好' })
  assert.equal(result.task.id, 'dh_task_1')
})
