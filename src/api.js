async function request(path, options) {
  let response
  try {
    response = await fetch(path, options)
  } catch {
    throw new Error('网络连接失败，请检查本地服务是否已启动')
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error?.message || `请求失败（${response.status}）`)
  }
  return payload
}

export function healthCheck() {
  return request('/api/health')
}

export function submitImage(payload) {
  return request('/api/images/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function fetchImageTask(taskId) {
  return request(`/api/images/tasks/${encodeURIComponent(taskId)}`)
}
