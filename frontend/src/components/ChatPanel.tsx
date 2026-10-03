import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Message } from '../lib/api'
import type { VoiceState } from '../lib/useConversation'

function Bubble({ role, children, accent }: { role: string; children: React.ReactNode; accent: string }) {
  const user = role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${user ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
          user ? 'rounded-br-md text-slate-950' : 'rounded-bl-md bg-white/[0.07] text-slate-100'
        }`}
        style={user ? { background: `linear-gradient(135deg, ${accent}, #38bdf8)` } : undefined}
      >
        {children}
      </div>
    </motion.div>
  )
}

export function ChatPanel({ messages, streaming, voiceState, sources, accent, placeholder, onSend, onMicStart, onMicStop }: {
  messages: Message[]
  streaming: string
  voiceState: VoiceState
  sources: { url: string }[]
  accent: string
  placeholder: string
  onSend: (text: string) => void
  onMicStart: () => void
  onMicStop: () => Promise<string>
}) {
  const [input, setInput] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const busy = voiceState === 'thinking' || voiceState === 'transcribing'

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming])

  const submit = () => {
    if (!input.trim() || busy) return
    onSend(input)
    setInput('')
  }

  const toggleMic = async () => {
    if (voiceState === 'recording') {
      const text = await onMicStop()
      if (text) setInput(prev => (prev ? `${prev} ${text}` : text)) // review before send
    } else {
      onMicStart()
    }
  }

  return (
    <div className="glass flex h-full min-h-0 flex-col">
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
        {messages.length === 0 && !streaming && (
          <div className="m-auto text-center text-slate-500">
            <p className="text-4xl">💬</p>
            <p className="mt-2 text-sm">Ask anything — type below or tap the mic.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} accent={accent}>{m.content}</Bubble>
        ))}
        {streaming && (
          <Bubble role="assistant" accent={accent}>
            {streaming}
            <span className="cursor-blink" style={{ color: accent }}>▍</span>
          </Bubble>
        )}
        {voiceState === 'thinking' && !streaming && (
          <div className="flex gap-1.5 pl-2">
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full"
                style={{ background: accent }}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
              />
            ))}
          </div>
        )}
        <AnimatePresence>
          {sources.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2 pl-1">
              {[...new Set(sources.map(s => s.url))].slice(0, 4).map(url => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
                >
                  🔗 {new URL(url).pathname.slice(1, 30) || 'singaporetech.edu.sg'}
                </a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 p-3">
        <button
          onClick={toggleMic}
          disabled={busy}
          aria-label={voiceState === 'recording' ? 'Stop recording' : 'Start recording'}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition active:scale-95 ${
            voiceState === 'recording'
              ? 'animate-pulse border-rose-400/60 bg-rose-500/20 text-rose-300'
              : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          {voiceState === 'recording' ? '■' : '🎙️'}
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={voiceState === 'transcribing' ? 'Transcribing…' : placeholder}
          disabled={busy}
          className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-[15px] outline-none placeholder:text-slate-500 focus:border-white/25"
        />
        <button onClick={submit} disabled={busy || !input.trim()} className="btn-primary h-11">
          Send
        </button>
      </div>
    </div>
  )
}
