import { motion } from 'framer-motion'
import type { Persona } from '../lib/api'
import type { VoiceState } from '../lib/useConversation'
import { CharacterAvatar } from './CharacterAvatar'

const stateLabel: Record<VoiceState, string> = {
  idle: 'Ready',
  recording: 'Listening…',
  transcribing: 'Transcribing…',
  thinking: 'Thinking…',
  speaking: 'Speaking',
}

export function AvatarStage({ persona, voiceState, micLevel, speakLevel, speakBright = 0, size = 300 }: {
  persona: Persona
  voiceState: VoiceState
  micLevel: number
  speakLevel: number
  speakBright?: number
  size?: number
}) {
  const speaking = voiceState === 'speaking'
  const recording = voiceState === 'recording'
  const accent = persona.accent

  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <div className="relative flex items-center justify-center" style={{ width: size + 24, height: size + 24 }}>
        {speaking && [0, 0.45, 0.9].map(delay => (
          <span
            key={delay}
            className="speak-ring absolute inset-3 rounded-full border-2"
            style={{ borderColor: accent, animationDelay: `${delay}s` }}
          />
        ))}
        <motion.div
          animate={
            recording
              ? { scale: 1 + micLevel * 0.18 }
              : voiceState === 'thinking'
                ? { rotate: [0, 2, -2, 0], transition: { repeat: Infinity, duration: 2 } }
                : { scale: 1, rotate: 0 }
          }
          style={{ filter: `drop-shadow(0 0 34px ${accent}44)` }}
        >
          <CharacterAvatar
            config={persona.avatar}
            accent={accent}
            mouthOpen={speaking ? speakLevel : 0}
            mouthWide={speaking ? speakBright : 0}
            size={size}
          />
        </motion.div>
      </div>

      <div className="text-center">
        <h2 className="font-display text-xl font-bold text-white">{persona.name}</h2>
        <p className="text-sm text-slate-400">{persona.tagline}</p>
      </div>

      <div
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium"
        style={{ color: voiceState === 'idle' ? '#94a3b8' : accent }}
      >
        <span
          className={`h-2 w-2 rounded-full ${voiceState !== 'idle' ? 'animate-pulse' : ''}`}
          style={{ background: voiceState === 'idle' ? '#475569' : accent }}
        />
        {stateLabel[voiceState]}
      </div>

      {recording && (
        <div className="flex h-8 items-end gap-1">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="w-1 rounded-full transition-all duration-75"
              style={{
                background: accent,
                height: `${4 + Math.max(0, micLevel * 28 * (0.4 + Math.sin(i * 1.7 + Date.now() / 90) ** 2))}px`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
