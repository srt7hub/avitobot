interface Dialogue {
  id: string
  guestName: string
  lastMessage: string
  wasHumanTakeover: boolean
  updatedAt: string
}

interface Props {
  dialogues: Dialogue[]
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export default function DialogueList({ dialogues }: Props) {
  if (dialogues.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">Диалогов пока нет</p>
  }

  return (
    <ul className="divide-y divide-gray-50">
      {dialogues.map(d => (
        <li key={d.id} className="py-3 flex items-start gap-2">
          <span className="text-sm mt-0.5">{d.wasHumanTakeover ? '⚡' : '●'}</span>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-800">{d.guestName || 'Гость'}</span>
            {d.lastMessage && (
              <span className="text-sm text-gray-500"> — «{d.lastMessage}»</span>
            )}
          </div>
          <div className="text-xs text-gray-400 whitespace-nowrap">
            {d.wasHumanTakeover ? 'Оператор' : 'AI'} · {formatTime(d.updatedAt)}
          </div>
        </li>
      ))}
    </ul>
  )
}
