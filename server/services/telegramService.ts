const TG_API = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'

async function postMessage(botToken: string, chatId: string, text: string): Promise<void> {
  try {
    const res = await fetch(`${TG_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[telegramService] sendMessage failed:', res.status, body)
    }
  } catch (err) {
    console.error('[telegramService] sendMessage error:', err)
  }
}

export async function sendHumanTakeoverAlert(
  telegramContact: string,
  botToken: string,
  avitoChatId: string,
  guestName: string
): Promise<void> {
  if (!botToken || !telegramContact) return

  const text = [
    `🚨 <b>ЗАПРОС ОПЕРАТОРА</b>`,
    ``,
    `Гость: <b>${guestName}</b>`,
    `Чат Авито: <a href="https://www.avito.ru/profile/messenger/channel/${avitoChatId}">Открыть диалог</a>`,
    ``,
    `Гость просит связаться с менеджером.`,
    `@${telegramContact.replace('@', '')}`,
  ].join('\n')

  await postMessage(botToken, telegramContact, text)
}

export async function sendOpsAlert(message: string): Promise<void> {
  const botToken = process.env.OPS_TELEGRAM_BOT_TOKEN
  const chatId = process.env.OPS_TELEGRAM_CHAT_ID

  if (!botToken || !chatId) return

  await postMessage(botToken, chatId, `[OPS ALERT] ${message}`)
}
