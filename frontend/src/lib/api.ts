import type { AvatarConfig } from '../components/CharacterAvatar'

export interface Persona {
  id: string
  module: 'assistant' | 'debate' | 'advisor'
  name: string
  tagline: string
  accent: string
  voice: string
  avatar?: AvatarConfig
  topics?: string[]
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export const getPersonas = async (): Promise<Persona[]> =>
  (await fetch('/api/personas')).json()

export const getHealth = async (): Promise<Record<string, boolean>> =>
  (await fetch('/api/health')).json()

/** Stream a chat reply over SSE; calls onToken per token, returns full text + sources. */
export async function streamChat(
  body: { persona_id: string; messages: Message[]; topic?: string; rag?: boolean },
  onToken: (full: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; sources: { url: string }[] }> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`chat failed: ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let text = ''
  let event = 'message'
  let sources: { url: string }[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7).trim()
      else if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (event === 'sources') sources = JSON.parse(data)
        else if (event === 'message') {
          const tok = JSON.parse(data).token
          if (tok) { text += tok; onToken(text) }
        }
        event = 'message'
      }
    }
  }
  return { text, sources }
}

export async function transcribe(blob: Blob): Promise<string> {
  const form = new FormData()
  const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'mp4' : 'webm'
  form.append('file', blob, `audio.${ext}`)
  const res = await fetch('/api/stt', { method: 'POST', body: form })
  if (!res.ok) throw new Error('transcription failed')
  return (await res.json()).text
}

export async function speak(text: string, personaId: string): Promise<HTMLAudioElement> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, persona_id: personaId }),
  })
  if (!res.ok) throw new Error('tts failed')
  const url = URL.createObjectURL(await res.blob())
  const audio = new Audio(url)
  audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true })
  return audio
}
