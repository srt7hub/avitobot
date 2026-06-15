interface SanitizeResult {
  text: string
  warnings: string[]
  promptLeaked?: boolean
}

const PROMPT_LEAK_PATTERNS = [
  /no emojis/i,
  /don'?t know the answer/i,
  /don'?t argue/i,
  /rudeness\s*->/i,
  /->.*уточню/i,
  /politely change/i,
  /system.{0,10}prompt/i,
]

export function isPromptLeak(text: string): boolean {
  return PROMPT_LEAK_PATTERNS.some(p => p.test(text))
}

const BANNED_WORDS = [
  'whatsapp', 'ватсап', 'вацап', 'вотсап',
  'telegram', 'телеграм', 'телега',
  'viber', 'вайбер',
  'сбер', 'тинькофф', 'тиньков',
  'перевод на карту', 'скиньте на карту', 'переведите на карту',
  'номер карты',
]

const PHONE_REGEX = /(\+?[78][\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})/g
const EXTERNAL_LINK_REGEX = /https?:\/\/(?!(?:www\.)?avito\.ru)\S+/gi

export function sanitizeAiResponse(text: string): SanitizeResult {
  const warnings: string[] = []
  let result = text

  // Strip markdown formatting
  result = result.replace(/\*\*(.+?)\*\*/g, '$1')
  result = result.replace(/\*(.+?)\*/g, '$1')
  result = result.replace(/^#+\s+/gm, '')
  result = result.replace(/^[-*]\s+/gm, '')
  result = result.replace(/```[\s\S]*?```/g, '')
  result = result.replace(/`([^`]+)`/g, '$1')

  // Strip all emoji
  result = result.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')

  if (PHONE_REGEX.test(result)) {
    warnings.push('PHONE_DETECTED')
    result = result.replace(PHONE_REGEX, '[контакт скрыт]')
  }

  if (EXTERNAL_LINK_REGEX.test(result)) {
    warnings.push('EXTERNAL_LINK')
    result = result.replace(EXTERNAL_LINK_REGEX, '[ссылка удалена]')
  }

  const textLower = result.toLowerCase()
  for (const word of BANNED_WORDS) {
    if (textLower.includes(word)) warnings.push(`BANNED_WORD:${word}`)
  }

  if (result.length > 250) {
    const truncated = result.slice(0, 247)
    const lastSpace = truncated.lastIndexOf(' ')
    result = (lastSpace > 200 ? truncated.slice(0, lastSpace) : truncated) + '...'
    warnings.push('TRUNCATED')
  }

  result = result.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ')

  if (isPromptLeak(result)) {
    warnings.push('PROMPT_LEAK')
    return { text: 'Уточню вопрос и вернусь с ответом', warnings, promptLeaked: true }
  }

  result = result.trim()

  // Убираем финальную точку — в мессенджере живее без неё. Только одиночную
  // точку: многоточие (...), «?» и «!» оставляем. Внутренние точки не трогаем.
  if (result.endsWith('.') && !result.endsWith('..')) {
    result = result.slice(0, -1)
  }

  return { text: result, warnings }
}
