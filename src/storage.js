const HISTORY_KEY = 'ai-image-workbench:history:v1'

export function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.slice(0, 80) : []
  } catch {
    return []
  }
}

export function saveHistory(items) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 80)))
  } catch {
    // Browsers may reject storage in private mode. The current session still works.
  }
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}
