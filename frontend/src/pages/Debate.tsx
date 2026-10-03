import { motion } from 'framer-motion'
import { useState } from 'react'
import { CharacterAvatar } from '../components/CharacterAvatar'
import { VoiceSession } from '../components/VoiceSession'
import type { Persona } from '../lib/api'

const SUGGESTED = [
  'Should AI be allowed to override human decisions in healthcare?',
  'Should Singapore university education be free for all citizens?',
  'Is social media doing more harm than good to Singaporean youth?',
]

export default function Debate({ personas }: { personas: Persona[] }) {
  const debaters = personas.filter(p => p.module === 'debate')
  const [selected, setSelected] = useState<Persona | null>(null)
  const [topic, setTopic] = useState(SUGGESTED[0])
  const [live, setLive] = useState(false)

  if (live && selected) {
    return (
      <VoiceSession
        persona={selected}
        topic={topic}
        kickoff={`Let's begin the debate. Please open with your position on: ${topic}`}
        onEnd={() => setLive(false)}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-8 py-4">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold text-white">Debate Arena</h1>
        <p className="mt-2 text-slate-400">Choose your opponent and your motion — then argue it out, out loud.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {debaters.map((p, i) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -4 }}
            onClick={() => setSelected(p)}
            className={`glass flex flex-col items-center gap-2 p-5 text-center transition ${
              selected?.id === p.id ? 'ring-2' : ''
            }`}
            style={selected?.id === p.id ? { boxShadow: `0 0 30px ${p.accent}33`, borderColor: p.accent } : undefined}
          >
            <CharacterAvatar config={p.avatar} accent={p.accent} mouthOpen={0} size={116} />
            <span className="font-display font-bold text-white">{p.name}</span>
            <span className="text-xs text-slate-400">{p.tagline}</span>
          </motion.button>
        ))}
        {debaters.length === 0 && (
          <p className="col-span-full text-center text-sm text-slate-500">Loading personas…</p>
        )}
      </div>

      <div className="glass mx-auto flex w-full max-w-2xl flex-col gap-3 p-5">
        <label className="text-sm font-medium text-slate-300">Debate motion</label>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 outline-none focus:border-white/25"
        />
        <div className="flex flex-wrap gap-2">
          {SUGGESTED.map(s => (
            <button
              key={s}
              onClick={() => setTopic(s)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                topic === s ? 'border-pink-400/60 bg-pink-400/15 text-pink-200' : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          disabled={!selected || !topic.trim()}
          onClick={() => setLive(true)}
          className="btn-primary mt-2"
        >
          🎭 Start debate{selected ? ` with ${selected.name}` : ''}
        </button>
      </div>
    </div>
  )
}
