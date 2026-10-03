import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { Persona } from '../lib/api'
import { useConversation } from '../lib/useConversation'
import { AvatarStage } from './AvatarStage'

const SUMMARIZE_PROMPT =
  'Please summarize our entire conversation so far in a few sentences and end with a closing statement.'

/** Live voice stage: big avatar, hold-to-talk, rolling transcript, summarize/end. */
export function VoiceSession({ persona, topic, kickoff, onEnd }: {
  persona: Persona
  topic?: string
  kickoff?: string
  onEnd: () => void
}) {
  const conv = useConversation({ personaId: persona.id, topic, autoSpeak: true })
  const scroller = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    if (kickoff && !started.current) {
      started.current = true
      conv.send(kickoff)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [conv.messages, conv.streaming])

  const micToggle = async () => {
    if (conv.voiceState === 'recording') {
      const text = await conv.stopRecording()
      if (text) conv.send(text) // voice modules auto-send
    } else if (conv.voiceState === 'idle' || conv.voiceState === 'speaking') {
      conv.startRecording()
    }
  }

  const busy = conv.voiceState === 'thinking' || conv.voiceState === 'transcribing'

  return (
    <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[440px_1fr]">
      <div className="glass flex flex-col items-center justify-between p-5">
        <AvatarStage persona={persona} voiceState={conv.voiceState} micLevel={conv.micLevel}
          speakLevel={conv.speakLevel} speakBright={conv.speakBright} size={320} />
        {topic && (
          <p className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center text-xs text-slate-400">
            Topic · <span className="text-slate-200">{topic}</span>
          </p>
        )}
        <div className="flex w-full flex-col items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={micToggle}
            disabled={busy}
            className="grid h-20 w-20 place-items-center rounded-full text-3xl shadow-xl transition disabled:opacity-40"
            style={{
              background: conv.voiceState === 'recording'
                ? 'linear-gradient(135deg,#f43f5e,#ef4444)'
                : `linear-gradient(135deg, ${persona.accent}, #38bdf8)`,
              boxShadow: `0 0 40px ${conv.voiceState === 'recording' ? '#f43f5e55' : persona.accent + '44'}`,
            }}
            aria-label={conv.voiceState === 'recording' ? 'Stop and send' : 'Start speaking'}
          >
            {conv.voiceState === 'recording' ? '■' : '🎙️'}
          </motion.button>
          <p className="text-xs text-slate-500">
            {conv.voiceState === 'recording' ? 'Tap to stop & send' : 'Tap to speak'}
          </p>
          <div className="flex w-full gap-2">
            <button
              onClick={() => conv.send(SUMMARIZE_PROMPT)}
              disabled={busy || conv.messages.length < 2}
              className="btn-ghost flex-1 text-sm"
            >
              ✨ Summarize
            </button>
            <button onClick={() => { conv.stopAudio(); onEnd() }} className="btn-ghost flex-1 text-sm text-rose-300">
              End session
            </button>
          </div>
        </div>
      </div>

      <div className="glass flex min-h-[50vh] flex-col">
        <h3 className="border-b border-white/10 px-5 py-3 font-display text-sm font-semibold text-slate-300">
          Live transcript
        </h3>
        <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
          {conv.messages.length === 0 && !conv.streaming && (
            <p className="m-auto text-sm text-slate-500">Tap the mic and start the conversation.</p>
          )}
          {conv.messages.map((m, i) => (
            <div key={i} className="text-[15px] leading-relaxed">
              <span className="mr-2 font-semibold" style={{ color: m.role === 'user' ? '#e2e8f0' : persona.accent }}>
                {m.role === 'user' ? 'You' : persona.name}:
              </span>
              <span className="text-slate-300">{m.content}</span>
            </div>
          ))}
          {conv.streaming && (
            <div className="text-[15px] leading-relaxed">
              <span className="mr-2 font-semibold" style={{ color: persona.accent }}>{persona.name}:</span>
              <span className="text-slate-300">{conv.streaming}</span>
              <span className="cursor-blink" style={{ color: persona.accent }}>▍</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
