import { useState } from 'react'
import { AvatarStage } from '../components/AvatarStage'
import { ChatPanel } from '../components/ChatPanel'
import type { Persona } from '../lib/api'
import { useConversation } from '../lib/useConversation'

const FALLBACK: Persona = {
  id: 'ollie', module: 'assistant', name: 'Ollie the Otter',
  tagline: "SIT's friendly campus guide", accent: '#2dd4bf', voice: '',
  avatar: { kind: 'otter' },
}

export default function Assistant({ personas }: { personas: Persona[] }) {
  const persona = personas.find(p => p.id === 'ollie') ?? FALLBACK
  const [voiceReplies, setVoiceReplies] = useState(true)
  const conv = useConversation({ personaId: persona.id, rag: true, autoSpeak: voiceReplies })

  return (
    <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[1fr_380px]">
      <div className="order-2 flex min-h-[60vh] flex-col lg:order-1">
        <ChatPanel
          messages={conv.messages}
          streaming={conv.streaming}
          voiceState={conv.voiceState}
          sources={conv.sources}
          accent={persona.accent}
          placeholder="Ask about SIT programmes, admissions, campus life…"
          onSend={conv.send}
          onMicStart={conv.startRecording}
          onMicStop={conv.stopRecording}
        />
      </div>

      <aside className="glass order-1 flex flex-col p-4 lg:order-2">
        <AvatarStage persona={persona} voiceState={conv.voiceState} micLevel={conv.micLevel}
          speakLevel={conv.speakLevel} speakBright={conv.speakBright} size={300} />
        <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
          <label className="flex cursor-pointer items-center justify-between text-sm text-slate-300">
            Voice replies
            <button
              role="switch"
              aria-checked={voiceReplies}
              onClick={() => { setVoiceReplies(v => !v); conv.stopAudio() }}
              className={`h-6 w-11 rounded-full p-0.5 transition ${voiceReplies ? 'bg-teal-400' : 'bg-white/15'}`}
            >
              <span className={`block h-5 w-5 rounded-full bg-white transition ${voiceReplies ? 'translate-x-5' : ''}`} />
            </button>
          </label>
          <button onClick={conv.reset} className="btn-ghost w-full text-sm">New conversation</button>
        </div>
      </aside>
    </div>
  )
}
