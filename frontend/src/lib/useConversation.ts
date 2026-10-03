import { useCallback, useRef, useState } from 'react'
import { type Message, speak, streamChat, transcribe } from './api'

export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking'

interface Options {
  personaId: string
  topic?: string
  rag?: boolean
  autoSpeak?: boolean
}

/** One hook drives every module: messages, SSE streaming, mic capture, and
 *  low-latency TTS — replies are spoken sentence-by-sentence while the rest of
 *  the answer is still streaming, with an articulated lip-sync signal. */
export function useConversation({ personaId, topic, rag, autoSpeak }: Options) {
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState('')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [sources, setSources] = useState<{ url: string }[]>([])
  const [micLevel, setMicLevel] = useState(0)
  const [speakLevel, setSpeakLevel] = useState(0)   // jaw openness 0..1
  const [speakBright, setSpeakBright] = useState(0) // lip spread 0..1
  const recorder = useRef<(MediaRecorder & { chunks: Blob[] }) | null>(null)
  const audioEl = useRef<HTMLAudioElement | null>(null)
  const levelRaf = useRef(0)
  const speakRaf = useRef(0)
  const audioCtx = useRef<AudioContext | null>(null)
  const ttsQueue = useRef<string[]>([])
  const playing = useRef(false)
  const streamDone = useRef(true)

  const stopAudio = useCallback(() => {
    ttsQueue.current = []
    playing.current = false
    streamDone.current = true
    audioEl.current?.pause()
    audioEl.current = null
    cancelAnimationFrame(speakRaf.current)
    setSpeakLevel(0)
    setSpeakBright(0)
  }, [])

  /** Analyse the playing TTS audio: jaw follows the speech-energy envelope
   *  (fast attack, slower release, silence-gated), lip spread follows the
   *  high-frequency share. */
  const trackSpeech = useCallback((audio: HTMLAudioElement) => {
    try {
      audioCtx.current ??= new AudioContext()
      const ctx = audioCtx.current
      if (ctx.state === 'suspended') void ctx.resume()
      const src = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.35
      src.connect(analyser)
      analyser.connect(ctx.destination)
      const freq = new Uint8Array(analyser.frequencyBinCount)
      let env = 0
      const tick = () => {
        if (audioEl.current !== audio || audio.ended) return
        analyser.getByteFrequencyData(freq)
        // ~43 Hz/bin at 44.1 kHz: 90–900 Hz = voiced energy, 1.8–5 kHz = brightness
        let low = 0, high = 0
        for (let i = 2; i <= 20; i++) low += freq[i]
        for (let i = 42; i <= 115; i++) high += freq[i]
        low /= 19 * 255
        high /= 74 * 255
        const energy = Math.min(1, low * 1.9)
        env = energy > env ? env + (energy - env) * 0.75 : env * 0.78
        if (env < 0.06) env = 0
        setSpeakLevel(env)
        setSpeakBright(Math.min(1, high * 3))
        speakRaf.current = requestAnimationFrame(tick)
      }
      tick()
    } catch { /* lip sync is best-effort */ }
  }, [])

  const playNext = useCallback(function playNextInner() {
    if (playing.current) return
    const next = ttsQueue.current.shift()
    if (!next) {
      if (streamDone.current) { setVoiceState('idle'); setSpeakLevel(0); setSpeakBright(0) }
      return
    }
    playing.current = true
    setVoiceState('speaking')
    void (async () => {
      try {
        const audio = await speak(next, personaId)
        const finish = () => {
          if (audioEl.current === audio) audioEl.current = null
          cancelAnimationFrame(speakRaf.current)
          setSpeakLevel(0)
          playing.current = false
          playNextInner()
        }
        if (!playing.current) return // session was stopped while fetching
        audioEl.current = audio
        audio.onended = finish
        audio.onerror = finish
        await audio.play()
        trackSpeech(audio)
        const cap = (Number.isFinite(audio.duration) ? audio.duration : 30) + 2
        setTimeout(() => { if (audioEl.current === audio) finish() }, cap * 1000)
      } catch {
        playing.current = false
        playNextInner()
      }
    })()
  }, [personaId, trackSpeech])

  const send = useCallback(async (text: string) => {
    const content = text.trim()
    if (!content) return
    stopAudio()
    streamDone.current = false
    const history: Message[] = [...messages, { role: 'user', content }]
    setMessages(history)
    setStreaming('')
    setVoiceState('thinking')

    // speak complete sentences as soon as they stream in
    let consumed = 0
    const feed = (full: string, final = false) => {
      if (!autoSpeak) return
      for (;;) {
        const rest = full.slice(consumed)
        const m = rest.match(/[.!?…]+[)"'”]?(\s|$)/)
        if (!m || m.index === undefined) break
        const end = consumed + m.index + m[0].length
        const sentence = full.slice(consumed, end).trim()
        consumed = end
        if (sentence.length > 1) { ttsQueue.current.push(sentence); playNext() }
      }
      if (final) {
        const rest = full.slice(consumed).trim()
        if (rest.length > 1) { ttsQueue.current.push(rest); playNext() }
      }
    }

    try {
      const { text: reply, sources: src } = await streamChat(
        { persona_id: personaId, messages: history, topic, rag },
        (full) => { setStreaming(full); feed(full) },
      )
      setMessages([...history, { role: 'assistant', content: reply }])
      setStreaming('')
      setSources(src)
      feed(reply, true)
      streamDone.current = true
      if (!autoSpeak || (!playing.current && ttsQueue.current.length === 0)) {
        setVoiceState('idle')
      }
    } catch {
      setMessages([...history, { role: 'assistant', content: '⚠️ Something went wrong reaching the AI. Please try again.' }])
      setStreaming('')
      streamDone.current = true
      setVoiceState('idle')
    }
  }, [messages, personaId, topic, rag, autoSpeak, stopAudio, playNext])

  /** Returns the transcript (caller decides: fill input, or auto-send). */
  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const rec = recorder.current
      if (!rec || rec.state === 'inactive') return resolve('')
      rec.onstop = async () => {
        cancelAnimationFrame(levelRaf.current)
        setMicLevel(0)
        rec.stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(rec.chunks, { type: rec.mimeType })
        setVoiceState('transcribing')
        try {
          resolve(await transcribe(blob))
        } catch {
          resolve('')
        } finally {
          setVoiceState('idle')
        }
      }
      rec.stop()
    })
  }, [])

  const startRecording = useCallback(async () => {
    stopAudio()
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const rec = new MediaRecorder(stream) as MediaRecorder & { chunks: Blob[] }
    rec.chunks = []
    rec.ondataavailable = (e) => { if (e.data.size) rec.chunks.push(e.data) }
    rec.start()
    recorder.current = rec
    setVoiceState('recording')
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    ctx.createMediaStreamSource(stream).connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(data)
      setMicLevel(data.reduce((a, b) => a + b, 0) / data.length / 255)
      levelRaf.current = requestAnimationFrame(tick)
    }
    tick()
  }, [stopAudio])

  const reset = useCallback(() => {
    stopAudio()
    setMessages([])
    setStreaming('')
    setSources([])
    setVoiceState('idle')
  }, [stopAudio])

  return { messages, streaming, voiceState, sources, micLevel, speakLevel, speakBright, send, startRecording, stopRecording, reset, stopAudio }
}
