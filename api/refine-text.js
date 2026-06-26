import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TONE_INSTRUCTIONS = {
  professional:
    'Tone: professional and confident, suitable for a corporate security company addressing serious business clients. Clear, direct, no slang.',
  luxury:
    'Tone: refined, premium, and exclusive, the way a high-end VIP protection or luxury brand would speak to discerning clients. Elegant word choice, understated confidence.',
  friendly:
    'Tone: warm, approachable, and conversational, like a trusted local company speaking to its community, while staying clear and professional.',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Hauna ruhusa' })
  }
  const token = authHeader.replace('Bearer ', '')

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token)
  if (callerError || !callerData?.user) {
    return res.status(401).json({ error: 'Token si sahihi' })
  }

  const { text, tone } = req.body || {}

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Hakuna maandishi ya kuboresha' })
  }

  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'YuccaAI Refine haijawekewa API key kwenye seva (ANTHROPIC_API_KEY)' })
  }

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system:
          'You are AI Refine, a writing assistant for AJ Plus Security, a Tanzanian security company. The person writes marketing or website text in English, but English is not their first language, so the draft may contain grammar mistakes, awkward phrasing, or Swahili sentence structure. Rewrite the text into clean, natural, grammatically correct English that keeps the original meaning and any factual details (names, numbers, services, prices) exactly as given. ' +
          toneInstruction +
          ' Do not add a preamble, explanation, or quotation marks around the result. Output only the rewritten text, nothing else.',
        messages: [{ role: 'user', content: text }],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      return res.status(502).json({ error: 'YuccaAI imeshindwa kujibu', detail: errText })
    }

    const aiData = await aiRes.json()
    const refined = (aiData.content || [])
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim()

    if (!refined) {
      return res.status(502).json({ error: 'YuccaAI haikurudisha jibu' })
    }

    return res.status(200).json({ refined_text: refined })
  } catch (err) {
    return res.status(500).json({ error: 'Tatizo la mtandao kwenye seva' })
  }
}
