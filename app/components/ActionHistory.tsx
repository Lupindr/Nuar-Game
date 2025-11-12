import React from 'react'
import { ActionLogEntry } from '../types.js'

type ActionHistoryProps = {
  entries: ActionLogEntry[]
}

const typeStyles: Record<ActionLogEntry['type'], string> = {
  turn: 'text-yellow-300 border-yellow-500/40',
  kill: 'text-red-300 border-red-500/40',
  civilian: 'text-orange-300 border-orange-500/40',
  interrogate: 'text-sky-300 border-sky-500/40',
  shift: 'text-violet-300 border-violet-500/40',
  elimination: 'text-rose-300 border-rose-500/40',
}

const formatTime = (timestamp: number) => {
  try {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

const ActionHistory: React.FC<ActionHistoryProps> = ({ entries }) => {
  return (
    <aside className="w-full lg:w-80 xl:w-96 bg-zinc-900/70 border-t lg:border-t-0 lg:border-l border-zinc-800 max-h-72 lg:max-h-none overflow-y-auto">
      <div className="p-4 space-y-3">
        <h2 className="text-xl font-title text-white tracking-wide">История действий</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-400">Пока что никаких событий не произошло.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={`p-3 rounded border bg-zinc-800/60 backdrop-blur-sm shadow transition-colors ${typeStyles[entry.type]}`}
              >
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="uppercase tracking-wide">{formatTime(entry.timestamp)}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-100 leading-snug">{entry.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

export default ActionHistory
