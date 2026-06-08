const REPLICATE_API_URL = 'https://api.replicate.com/v1/models/google/gemini-3-flash/predictions'

type FaqEntry = { question: string; answer: string }

function sanitizeForPrompt(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/[\n\r\t]/g, ' ')
      .replace(/[<>{}\\]/g, '')
      .replace(/(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, '[телефон скрыт]')
      .replace(/\b\d{11}\b/g, '[телефон скрыт]')
      .slice(0, 500)
  }
  if (Array.isArray(value)) return value.map(sanitizeForPrompt)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeForPrompt(v)])
    )
  }
  return value
}

export function buildSystemPrompt(params: {
  botName: string
  property: { name: string; address: string; description: string } | null
  faqEntries: FaqEntry[]
  memorySummary: string
}): string {
  const { botName, property, faqEntries, memorySummary } = params

  const propertyContext = property
    ? `ОБЪЕКТ АРЕНДЫ:\nНазвание: ${sanitizeForPrompt(property.name)}\nАдрес: ${sanitizeForPrompt(property.address)}\nОписание: ${sanitizeForPrompt(property.description)}`
    : 'Информация об объекте не указана.'

  const faqSection = faqEntries.length > 0
    ? `\n═══ БАЗА ЗНАНИЙ (FAQ) ═══\nИспользуй эти ответы когда гость задаёт похожий вопрос. Отвечай своими словами:\n\n${faqEntries.map(e => `В: ${e.question}\nО: ${e.answer}`).join('\n\n')}\n`
    : ''

  const memorySection = memorySummary
    ? `\n═══ ИСТОРИЯ РАЗГОВОРА ═══\n${memorySummary}\n`
    : ''

  return `Ты — ${botName}, онлайн-менеджер по аренде квартир. Отвечаешь ТОЛЬКО на русском языке.
Пишешь тепло, живо, по-человечески. Ты НЕ являешься ИИ — никогда не признавайся что ты бот.

КРИТИЧЕСКИ ВАЖНО — ФОРМАТ ОТВЕТА:
1. Пиши ТОЛЬКО готовый ответ для гостя. Никаких размышлений, пометок, вариантов.
2. ТОЛЬКО обычный текст. ЗАПРЕЩЕНО: звёздочки **, решётки ##, списки, заголовки.
3. Длина: 1-2 коротких предложения. Максимум 150 символов.
4. НЕ СТАВЬ СМАЙЛИКИ И ЭМОДЗИ ни в каком виде.
5. НЕ ПРОЩАЙСЯ ("Всего доброго", "До свидания" — запрещено).

ГРАНИЦЫ:
Ты работаешь ТОЛЬКО по теме аренды квартир. Если вопрос НЕ связан с арендой — отвечай: "Уточню и вернусь с ответом"

ПРАВИЛА АВИТО (СТРОГО):
НЕ ПИСАТЬ: номера телефонов, email, названия мессенджеров (WhatsApp/Telegram/Viber),
ссылки на внешние сайты, предложения перейти в другой мессенджер, данные банков.
Всё общение и оплата — только через платформу Авито.

ЕСЛИ ГОСТЬ ХОЧЕТ ОПЕРАТОРА:
Если гость написал "хочу оператора", "живой человек", "позовите менеджера" — отвечай:
"Передаю вас менеджеру, он свяжется в ближайшее время."
Больше НЕ отвечай в этом чате — оператор берёт управление.

${propertyContext}${faqSection}${memorySection}`
}

interface ReplicatePrediction {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  output?: string[]
  error?: string
}

async function pollPrediction(predictionId: string, token: string): Promise<string> {
  const pollUrl = `https://api.replicate.com/v1/predictions/${predictionId}`
  const deadline = Date.now() + 60_000

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1_000))

    const res = await fetch(pollUrl, { headers: { Authorization: `Token ${token}` } })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`[aiService] pollPrediction failed: ${res.status} ${body}`)
    }

    const prediction = await res.json() as ReplicatePrediction
    if (prediction.status === 'succeeded') {
      const text = (prediction.output || []).join('').trim()
      if (!text) throw new Error('[aiService] Model returned empty output after polling')
      return text
    }
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`[aiService] Prediction ${predictionId} ended: ${prediction.status} — ${prediction.error ?? 'unknown'}`)
    }
  }

  throw new Error(`[aiService] Prediction ${predictionId} timed out`)
}

const MAX_AI_RETRIES = 3

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function createPrediction(
  fullPrompt: string,
  systemPrompt: string,
  token: string
): Promise<string> {
  const res = await fetch(REPLICATE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt: fullPrompt,
        system_instruction: systemPrompt,
        max_output_tokens: 256,
        temperature: 0.4,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    if (res.status === 429) {
      let retryAfter = 10
      try { retryAfter = (JSON.parse(body) as { retry_after?: number }).retry_after ?? 10 } catch { /* ignore */ }
      throw Object.assign(new Error(`[aiService] Rate limited (429). retry_after=${retryAfter}s`), { retryAfter, retryable: true })
    }
    // 5xx — временные ошибки сервера, имеет смысл повторить
    const retryable = res.status >= 500
    throw Object.assign(new Error(`[aiService] createPrediction failed: ${res.status} ${body}`), { retryable })
  }

  const prediction = await res.json() as ReplicatePrediction

  if (prediction.status === 'succeeded') {
    const text = (prediction.output || []).join('').trim()
    if (!text) throw new Error('[aiService] Model returned empty output')
    return text
  }

  if (prediction.status === 'failed' || prediction.status === 'canceled') {
    throw new Error(`[aiService] Prediction ended: ${prediction.status} — ${prediction.error ?? 'unknown'}`)
  }

  return pollPrediction(prediction.id, token)
}

export async function generateReply(
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string
): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('[aiService] REPLICATE_API_TOKEN is not set')

  let fullPrompt = ''
  for (const msg of chatHistory) {
    const roleName = msg.role === 'user' ? 'Client' : 'Assistant'
    fullPrompt += `${roleName}: ${msg.content}\n\n`
  }
  fullPrompt += 'Assistant:'

  let lastErr: unknown
  for (let attempt = 1; attempt <= MAX_AI_RETRIES; attempt++) {
    try {
      return await createPrediction(fullPrompt, systemPrompt, token)
    } catch (err) {
      lastErr = err
      const retryable = Boolean((err as { retryable?: boolean }).retryable)
      if (!retryable || attempt === MAX_AI_RETRIES) break

      // backoff: для 429 уважаем retry_after, иначе экспоненциальный с потолком 20с
      const retryAfter = (err as { retryAfter?: number }).retryAfter
      const delayMs = retryAfter != null
        ? retryAfter * 1000
        : Math.min(2_000 * 2 ** (attempt - 1), 20_000)
      console.warn(`[aiService] attempt ${attempt}/${MAX_AI_RETRIES} failed, retrying in ${delayMs}ms:`, (err as Error).message)
      await sleep(delayMs)
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}
