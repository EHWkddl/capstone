const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export async function analyzePrompt({ conversationId, userInput, useSecurity }) {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: conversationId,
      user_input: userInput,
      use_security: useSecurity,
    }),
  })
  return response.json()
}

export async function loadHistory(conversationId) {
  const response = await fetch(
    `${API_BASE_URL}/api/history/${conversationId}`,
  )
  return response.json()
}

export async function fetchLogs({
  limit = 50,
  offset = 0,
  decision = null,
  fromDate = null,
  toDate = null,
  conversationId = null,
} = {}) {
  const params = new URLSearchParams()
  params.append('limit', String(limit))
  params.append('offset', String(offset))
  if (decision) params.append('decision', decision)
  if (fromDate) params.append('from_date', fromDate)
  if (toDate) params.append('to_date', toDate)
  if (conversationId) params.append('conversation_id', conversationId)
  const response = await fetch(
    `${API_BASE_URL}/api/logs?${params.toString()}`,
  )
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

export async function fetchLogDetail(logId) {
  const response = await fetch(`${API_BASE_URL}/api/logs/${logId}`)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json()
}
