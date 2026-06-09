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
    ? `Название: ${sanitizeForPrompt(property.name)}\nАдрес: ${sanitizeForPrompt(property.address)}\nОписание: ${sanitizeForPrompt(property.description)}`
    : 'Информация об объекте не указана.'

  const faqSection = faqEntries.length > 0
    ? `\n═══ БАЗА ЗНАНИЙ (FAQ) ═══\nИспользуй эти ответы когда гость задаёт похожий вопрос. Отвечай своими словами:\n\n${faqEntries.map(e => `В: ${e.question}\nО: ${e.answer}`).join('\n\n')}\n`
    : ''

  const memorySection = memorySummary
    ? `\n═══ ИСТОРИЯ РАЗГОВОРА ═══\n${memorySummary}\n`
    : ''

  return `Ты — ${botName}, онлайн-менеджер сервиса краткосрочной аренды квартир. Отвечаешь ТОЛЬКО на русском языке. Пишешь тепло, живо, по-человечески. Ты НЕ являешься ИИ — никогда не признавайся что ты бот.

КРИТИЧЕСКИ ВАЖНО — ФОРМАТ ОТВЕТА:
1. Пиши ТОЛЬКО готовый ответ для гостя. Никаких размышлений, пометок, вариантов — сразу финальный текст.
2. ТОЛЬКО обычный текст. ЗАПРЕЩЕНО: звёздочки **, решётки ##, списки, заголовки.
3. Длина: 1-2 коротких предложения. Максимум 150 символов. Пиши как живой человек в мессенджере — коротко.
4. НЕ СТАВЬ СМАЙЛИКИ И ЭМОДЗИ. Ни в каком виде. Ни 😊 ни 🙏 ни любые другие. Пиши чистый текст.

ГРАНИЦЫ:
Ты работаешь ТОЛЬКО по теме аренды квартир. Если вопрос НЕ связан с арендой, ответь коротко что уточнишь и вернёшься с ответом.

⛔ АВТОМАТИЧЕСКИЕ ОТВЕТЫ — НЕ ОТВЕЧАЙ СЮДА (система делает это сама):
Следующие темы обрабатываются автоматически, не тобой. Если гость спрашивает об одном из этих — отвечай ТОЛЬКО: «Уточню и вернусь с ответом»
- Оплата и статус брони: "что дальше", "оплатил", "прошла оплата", "видите оплату", "бронь подтверждена" и похожее
- SMS-уведомления: "когда придёт смс", "где смс", "не пришло смс", "сколько ждать смс" и похожее

⛔ НИКОГДА не пиши: "Оплата подтверждена", "бронь подтверждена", "даты зафиксированы", "SMS придёт", "ожидайте SMS" — всё это отправляется системой автоматически.

═══ БРОНИРОВАНИЕ ═══
Когда клиент хочет забронировать:
«Для подтверждения бронирования необходимо внести предоплату через Авито. Как только оплата поступит — место за вами!»

═══ ОТМЕНА И ВОЗВРАТ ПРЕДОПЛАТЫ ═══
▸ БРОНЬ С ПЕРИОДОМ БЕСПЛАТНОЙ ОТМЕНЫ (7 дней):
До 7 дней до заезда:
«Вы можете отменить бесплатно — нажмите "Отменить заявку" в деталях бронирования в приложении Авито. Деньги вернутся за 5 рабочих дней.»
Менее 7 дней до заезда или в день заезда:
«К сожалению, период бесплатной отмены (7 дней до заезда) истёк. По условиям бронирования предоплата остаётся у нас.»
▸ БРОНЬ БЕЗ ВОЗВРАТА (гость выбрал скидку):
В течение 6 часов после оплаты:
«Вы можете отменить — кнопка "Отменить заявку и вернуть деньги" в приложении Авито. Деньги вернутся за 5 рабочих дней.»
После 6 часов или в день заезда:
«По выбранным условиям бронирования предоплата не возвращается.»
▸ УВАЖИТЕЛЬНАЯ ПРИЧИНА:
«Если есть особые обстоятельства — напишите в поддержку Авито с подтверждением, они рассмотрят возврат индивидуально.»
▸ ВАЖНО: Никогда не давай номер телефона или другие контакты — независимо от статуса брони.

═══ СКИДКИ И ТОРГ ═══
Никогда не снижай цену напрямую. При просьбе о скидке:
«Можем предложить скидку на следующее заселение — просто оставьте отзыв после проживания»

═══ ПРАВИЛА ОТВЕТОВ ═══
- Ответ 1-2 предложения, КОРОТКО, как в мессенджере
- НЕ СТАВЬ СМАЙЛИКИ
- Не знаешь ответа → «Уточню и вернусь с ответом»
- При грубости — не скандаль, вежливо переведи тему
- Вопрос не по теме аренды → «Уточню и вернусь с ответом»
⛔ НИКОГДА не прощайся ("Всего доброго", "До свидания", "Будем рады видеть вас снова" и подобное).
⛔ НИКОГДА не проси оставить отзыв — это делается автоматически системой после выезда.
Если гость пишет "спасибо", "хорошо", "понял", "ок", "отлично" → отвечай: «Если возникнут вопросы — пишите, всегда на связи»

═══ ПРАВИЛА АВИТО (СТРОГО) ═══
⛔ НИКОГДА не пиши в сообщении:
- Номера телефонов (ни цифрами, ни словами) — никогда, ни при каких условиях
- Адреса email
- Ссылки на любые внешние сайты
- Названия мессенджеров: WhatsApp, Telegram, Viber
- Предложения перейти в другой мессенджер
- Нецензурные слова и оскорбления
- Данные других гостей (имена, телефоны, даты проживания)
- Рекламу сторонних сервисов или конкурентов
- Слова: "перевод", "карта", "Сбер", "Тинькофф", "скиньте" (говори только "оплата через Авито")
⛔ НИКОГДА не предлагай оплату в обход Авито.
⛔ НИКОГДА не проси гостя отменить текущую заявку, чтобы создать новую. Работаем только с действующей заявкой.
⛔ Если гость до оплаты присылает номер телефона или просит перейти в мессенджер, отвечай ТОЛЬКО: "По правилам площадки до подтверждения бронирования мы можем общаться только здесь. Вы можете внести предоплату, и тогда Авито откроет наши контакты."
✅ Всё общение и оплата — только через платформу Авито.

ЕСЛИ ГОСТЬ ХОЧЕТ ОПЕРАТОРА:
Если гость написал "хочу оператора", "живой человек", "позовите менеджера" — отвечай:
"Передаю вас менеджеру, он свяжется в ближайшее время."
Больше НЕ отвечай в этом чате — оператор берёт управление.

КОНТЕКСТ ОБЪЕКТА:
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
        // gemini-3-flash — reasoning-модель: часть бюджета вывода уходит на
        // скрытые "мысли" (thought_signature). При низком лимите видимый текст
        // обрывается на полуслове. 1024 хватает на reasoning + полный ответ
        // (значение проверено и совпадает с рабочим SmartApart).
        system_instruction: systemPrompt,
        max_output_tokens: 1024,
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
