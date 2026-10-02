import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { getPersonas, type Persona } from './lib/api'
import Home from './pages/Home'
import Assistant from './pages/Assistant'
import Debate from './pages/Debate'
import Advisor from './pages/Advisor'

const tabs = [
  { to: '/', label: 'Home' },
  { to: '/assistant', label: 'Assistant' },
  { to: '/debate', label: 'Debate Arena' },
  { to: '/advisor', label: 'Advisor Studio' },
]

export default function App() {
  const location = useLocation()
  const [personas, setPersonas] = useState<Persona[]>([])

  useEffect(() => {
    getPersonas().then(setPersonas).catch(() => setPersonas([]))
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <div className="aurora" />

      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#070a13]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <NavLink to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-sky-500 text-lg">🦦</span>
            <div className="leading-tight">
              <span className="font-display text-[15px] font-bold text-white">SIT AI Platform</span>
              <p className="text-[11px] text-slate-500">Singapore Institute of Technology</p>
            </div>
          </NavLink>
          <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            {tabs.map(t => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                    isActive ? 'text-slate-950' : 'text-slate-400 hover:text-slate-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="tab-pill"
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-teal-300 to-sky-400"
                        transition={{ type: 'spring', duration: 0.5 }}
                      />
                    )}
                    <span className="relative">{t.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6"
        >
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/assistant" element={<Assistant personas={personas} />} />
            <Route path="/debate" element={<Debate personas={personas} />} />
            <Route path="/advisor" element={<Advisor personas={personas} />} />
          </Routes>
        </motion.main>
      </AnimatePresence>
    </div>
  )
}
