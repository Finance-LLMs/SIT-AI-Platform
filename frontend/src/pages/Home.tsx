import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const modules = [
  {
    to: '/assistant',
    emoji: '🦦',
    title: 'Assistant',
    desc: 'Ask Ollie the Otter anything about SIT — programmes, admissions, campus life. Grounded in live SIT web content with hybrid retrieval.',
    chips: ['RAG', 'Voice & text', 'Cited sources'],
    accent: '#2dd4bf',
  },
  {
    to: '/debate',
    emoji: '🎭',
    title: 'Debate Arena',
    desc: 'Debate Singapore\'s voices of society — an elder statesman, a pop idol, a professor, a kopitiam uncle. Live voice, one-tap summaries.',
    chips: ['SG personas', 'Live voice', 'Summaries'],
    accent: '#ec4899',
  },
  {
    to: '/advisor',
    emoji: '📈',
    title: 'Advisor Studio',
    desc: 'One-on-one voice mentoring: finance frameworks with Arjun or study science with Dr. Mei. Pick a topic chip and start talking.',
    chips: ['Mentors', 'Topic chips', 'Hands-free'],
    accent: '#38bdf8',
  },
]

export default function Home() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-12 py-8">
      <div className="text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mx-auto mb-4 w-fit rounded-full border border-teal-300/20 bg-teal-300/10 px-4 py-1 text-xs font-medium text-teal-300"
        >
          Singapore-first · on-prem GPUs · ElevenLabs voices · lip-synced avatars
        </motion.p>
        <h1 className="font-display text-5xl font-extrabold leading-tight text-white md:text-6xl">
          Talk to AI that{' '}
          <span className="bg-gradient-to-r from-teal-300 via-sky-400 to-violet-400 bg-clip-text text-transparent">
            knows SIT
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">
          One platform for campus Q&A, persona debates and voice mentoring — streaming
          answers, neural voices and retrieval over real SIT content.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {modules.map((m, i) => (
          <motion.div
            key={m.to}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i }}
            whileHover={{ y: -6 }}
          >
            <Link to={m.to} className="glass group flex h-full flex-col gap-3 p-6" style={{ boxShadow: `0 0 0 0 transparent` }}>
              <span
                className="grid h-12 w-12 place-items-center rounded-xl text-2xl"
                style={{ background: `${m.accent}1f`, border: `1px solid ${m.accent}44` }}
              >
                {m.emoji}
              </span>
              <h2 className="font-display text-xl font-bold text-white">{m.title}</h2>
              <p className="flex-1 text-sm leading-relaxed text-slate-400">{m.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {m.chips.map(c => (
                  <span key={c} className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-400">{c}</span>
                ))}
              </div>
              <span className="mt-1 text-sm font-semibold transition group-hover:translate-x-1" style={{ color: m.accent }}>
                Open →
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
