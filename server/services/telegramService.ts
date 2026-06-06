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
  botToken: string,
  chatId: string,
  avitoChatId: string,
  guestName: string
): Promise<void> {
  if (!botToken || !chatId) return

  const text = [
    `🚨 <b>ЗАПРОС ОПЕРАТОРА</b>`,
    ``,
    `Гость: <b>${guestName}</b>`,
    `<a href="https://www.avito.ru/profile/messenger/channel/${avitoChatId}">Открыть диалог</a>`,
    ``,
    `Гость просит связаться с менеджером.`,
  ].join('\n')

  await postMessage(botToken, chatId, text)
}

export async function sendDialogueNotification(
  botToken: string,
  chatId: string,
  avitoChatId: string,
  guestName: string,
  guestMessage: string,
  aiReply: string
): Promise<void> {
  if (!botToken || !chatId) return

  const text = [
    `💬 <b>${guestName}</b>`,
    `${guestMessage.slice(0, 300)}`,
    ``,
    `🤖 <b>AI:</b>`,
    `${aiReply.slice(0, 300)}`,
    ``,
    `<a href="https://www.avito.ru/profile/messenger/channel/${avitoChatId}">Открыть диалог</a>`,
  ].join('\n')

  await postMessage(botToken, chatId, text)
}

export async function sendUnknownAnswerAlert(
  botToken: string,
  chatId: string,
  avitoChatId: string,
  guestName: string,
  guestMessage: string,
  aiReply: string
): Promise<void> {
  if (!botToken || !chatId) return

  const text = [
    `⚠️ <b>Бот не знает ответ</b>`,
    ``,
    `Гость: <b>${guestName}</b>`,
    `${guestMessage.slice(0, 300)}`,
    ``,
    `🤖 <b>AI ответил:</b>`,
    `${aiReply.slice(0, 300)}`,
    ``,
    `<a href="https://www.avito.ru/profile/messenger/channel/${avitoChatId}">Открыть диалог</a>`,
  ].join('\n')

  await postMessage(botToken, chatId, text)
}

export async function sendOpsAlert(message: string): Promise<void> {
  const botToken = process.env.OPS_TELEGRAM_BOT_TOKEN
  const chatId = process.env.OPS_TELEGRAM_CHAT_ID

  if (!botToken || !chatId) return

  await postMessage(botToken, chatId, `[OPS ALERT] ${message}`)
}
