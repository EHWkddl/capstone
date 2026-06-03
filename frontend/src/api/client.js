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
