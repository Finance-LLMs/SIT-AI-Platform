import { motion } from 'framer-motion'
import { useState } from 'react'
import { CharacterAvatar } from '../components/CharacterAvatar'
import { VoiceSession } from '../components/VoiceSession'
import type { Persona } from '../lib/api'

export default function Advisor({ personas }: { personas: Persona[] }) {
  const advisors = personas.filter(p => p.module === 'advisor')
  const [selected, setSelected] = useState<Persona | null>(null)
  const [topic, setTopic] = useState<string | undefined>()
  const [live, setLive] = useState(false)

  if (live && selected) {
    return (
      <VoiceSession
        persona={selected}
        topic={topic}
        kickoff={topic ? `Hi! I'd like some advice about ${topic}.` : undefined}
        onEnd={() => { setLive(false); setTopic(undefined) }}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-8 py-4">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold text-white">Advisor Studio</h1>
        <p className="mt-2 text-slate-400">One-on-one voice mentoring. Pick a mentor, pick a topic, start talking.</p>
      </div>

      <div className="mx-auto grid w-full max-w-3xl gap-5 sm:grid-cols-2">
        {advisors.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`glass flex flex-col gap-3 p-6 transition ${selected?.id === p.id ? 'ring-1' : ''}`}
            style={selected?.id === p.id ? { borderColor: p.accent, boxShadow: `0 0 30px ${p.accent}22` } : undefined}
          >
            <div className="flex items-center gap-3">
              <CharacterAvatar config={p.avatar} accent={p.accent} mouthOpen={0} size={96} />
              <div>
                <h2 className="font-display font-bold text-white">{p.name}</h2>
                <p className="text-xs text-slate-400">{p.tagline}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(p.topics ?? []).map(t => (
                <button
                  key={t}
                  onClick={() => { setSelected(p); setTopic(t) }}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    selected?.id === p.id && topic === t
                      ? 'text-slate-950'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                  style={selected?.id === p.id && topic === t ? { background: p.accent, borderColor: p.accent } : undefined}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setSelected(p); if (selected?.id !== p.id) setTopic(undefined) }}
              className={`btn-ghost mt-auto text-sm ${selected?.id === p.id ? 'border-white/40' : ''}`}
            >
              {selected?.id === p.id ? '✓ Selected' : 'Choose mentor'}
            </button>
          </motion.div>
        ))}
        {advisors.length === 0 && (
          <p className="col-span-full text-center text-sm text-slate-500">Loading mentors…</p>
        )}
      </div>

      <button
        disabled={!selected}
        onClick={() => setLive(true)}
        className="btn-primary mx-auto w-full max-w-sm"
      >
        🎧 Start session{selected ? ` with ${selected.name.split(' ·')[0]}` : ''}
      </button>
    </div>
  )
}
