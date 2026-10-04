export interface AvatarConfig {
  kind: 'otter' | 'face'
  skin?: string
  hair?: 'short' | 'side' | 'bald' | 'long' | 'bun'
  hairColor?: string
  accessory?: 'glasses' | 'earrings' | 'kopi' | 'none'
  shirt?: string
  outfit?: 'tee' | 'shirt' | 'blazer'
  aged?: boolean
  stubble?: boolean
}

/** Semi-realistic illustrated avatar. The jaw, lips and teeth articulate from
 *  the live speech signal: `mouthOpen` (voiced energy envelope) drops the jaw,
 *  `mouthWide` (high-frequency share) spreads the lips. */
export function CharacterAvatar({ config, accent, mouthOpen, mouthWide = 0, size = 160 }: {
  config?: AvatarConfig
  accent: string
  mouthOpen: number
  mouthWide?: number
  size?: number
}) {
  const c = config ?? { kind: 'face' as const }
  const open = Math.min(1, Math.max(0, mouthOpen))
  const wide = Math.min(1, Math.max(0, mouthWide))
  const uid = c.kind + (c.skin ?? '') // stable per-config gradient ids
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`bg-${uid}`} cx="35%" cy="28%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.38" />
          <stop offset="55%" stopColor={accent} stopOpacity="0.10" />
          <stop offset="100%" stopColor="#0b0f1a" stopOpacity="0.9" />
        </radialGradient>
        <radialGradient id={`skin-${uid}`} cx="42%" cy="34%">
          <stop offset="0%" stopColor={lighten(c.skin ?? '#e8b98a', 18)} />
          <stop offset="62%" stopColor={c.skin ?? '#e8b98a'} />
          <stop offset="100%" stopColor={darken(c.skin ?? '#e8b98a', 22)} />
        </radialGradient>
        <linearGradient id={`hair-${uid}`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor={lighten(c.hairColor ?? '#2b2018', 25)} />
          <stop offset="45%" stopColor={c.hairColor ?? '#2b2018'} />
          <stop offset="100%" stopColor={darken(c.hairColor ?? '#2b2018', 25)} />
        </linearGradient>
        <linearGradient id={`cloth-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lighten(c.shirt ?? '#334155', 14)} />
          <stop offset="100%" stopColor={darken(c.shirt ?? '#334155', 20)} />
        </linearGradient>
        <radialGradient id={`fur-${uid}`} cx="42%" cy="30%">
          <stop offset="0%" stopColor="#9d6b40" />
          <stop offset="60%" stopColor="#7d5230" />
          <stop offset="100%" stopColor="#5d3c22" />
        </radialGradient>
        <radialGradient id={`iris-${uid}`} cx="50%" cy="45%">
          <stop offset="0%" stopColor="#8a5a2e" />
          <stop offset="70%" stopColor="#4a2d14" />
          <stop offset="100%" stopColor="#2a1708" />
        </radialGradient>
        <filter id={`soft-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <clipPath id={`clip-${uid}`}><circle cx="100" cy="100" r="96" /></clipPath>
      </defs>
      <circle cx="100" cy="100" r="96" fill={`url(#bg-${uid})`} stroke={`${accent}55`} strokeWidth="1.5" />
      <g clipPath={`url(#clip-${uid})`} className="breathe">
        {c.kind === 'otter'
          ? <Otter open={open} wide={wide} uid={uid} />
          : <Face c={c} open={open} wide={wide} uid={uid} />}
      </g>
    </svg>
  )
}

/* ---------- colour helpers ---------- */
function clamp(n: number) { return Math.max(0, Math.min(255, n)) }
function shift(hex: string, amt: number): string {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map(i => clamp(parseInt(h.slice(i, i + 2), 16) + amt))
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
}
const lighten = (hex: string, amt: number) => shift(hex, amt)
const darken = (hex: string, amt: number) => shift(hex, -amt)

/* ---------- articulated mouth (shared) ---------- */
function Mouth({ cx, cy, open, wide, skin, lipTint }: {
  cx: number; cy: number; open: number; wide: number; skin: string; lipTint?: string
}) {
  const jaw = open * 8                      // jaw drop in px
  const halfW = 13 + wide * 4 - open * 2    // lips narrow slightly as jaw drops
  const lip = lipTint ?? darken(skin, 48)
  return (
    <g style={{ transition: 'transform 60ms linear' }}>
      {/* inner cavity */}
      <path
        d={`M ${cx - halfW} ${cy}
            Q ${cx} ${cy - 2.5} ${cx + halfW} ${cy}
            Q ${cx + halfW * 0.9} ${cy + 3 + jaw} ${cx} ${cy + 4 + jaw}
            Q ${cx - halfW * 0.9} ${cy + 3 + jaw} ${cx - halfW} ${cy} Z`}
        fill="#3d1a1f"
        style={{ transition: 'd 60ms linear' }}
      />
      {/* upper teeth, revealed as the jaw drops */}
      {open > 0.12 && (
        <path d={`M ${cx - halfW + 3} ${cy + 0.5} Q ${cx} ${cy - 1.5} ${cx + halfW - 3} ${cy + 0.5} L ${cx + halfW - 4} ${cy + 2.6} Q ${cx} ${cy + 4} ${cx - halfW + 4} ${cy + 2.6} Z`}
          fill="#f1e8dc" />
      )}
      {/* tongue on wide-open vowels */}
      {open > 0.45 && (
        <ellipse cx={cx} cy={cy + 3.5 + jaw * 0.8} rx={halfW * 0.5} ry={2.2 + jaw * 0.25} fill="#a84a50" />
      )}
      {/* upper lip with cupid's bow */}
      <path
        d={`M ${cx - halfW - 1} ${cy}
            Q ${cx - halfW * 0.45} ${cy - 3.2} ${cx - 2.5} ${cy - 1.8}
            Q ${cx} ${cy - 3} ${cx + 2.5} ${cy - 1.8}
            Q ${cx + halfW * 0.45} ${cy - 3.2} ${cx + halfW + 1} ${cy}
            Q ${cx} ${cy + 1.4} ${cx - halfW - 1} ${cy} Z`}
        fill={lip} opacity="0.92"
      />
      {/* lower lip rides the jaw */}
      <path
        d={`M ${cx - halfW * 0.85} ${cy + 2.2 + jaw}
            Q ${cx} ${cy + 6.5 + jaw} ${cx + halfW * 0.85} ${cy + 2.2 + jaw}
            Q ${cx} ${cy + 3.2 + jaw} ${cx - halfW * 0.85} ${cy + 2.2 + jaw} Z`}
        fill={lighten(lip, 28)}
      />
      {/* chin crease deepens as mouth opens */}
      <path d={`M ${cx - 6} ${cy + 10 + jaw} Q ${cx} ${cy + 12.5 + jaw} ${cx + 6} ${cy + 10 + jaw}`}
        stroke={darken(skin, 30)} strokeWidth="1.2" fill="none" opacity={0.25 + open * 0.3} />
    </g>
  )
}

/* ---------- realistic eye ---------- */
function Eye({ x, y, uid, lash }: { x: number; y: number; uid: string; lash?: boolean }) {
  return (
    <g>
      {/* socket shading */}
      <ellipse cx={x} cy={y - 1} rx="10.5" ry="7" fill="#00000014" filter={`url(#soft-${uid})`} />
      <g className="blink" style={{ transformOrigin: `${x}px ${y}px` }}>
        {/* sclera as almond */}
        <path d={`M ${x - 9} ${y} Q ${x} ${y - 6.5} ${x + 9} ${y} Q ${x} ${y + 5.5} ${x - 9} ${y} Z`} fill="#f6f1ea" />
        <g className="gaze">
          <circle cx={x} cy={y - 0.5} r="4" fill={`url(#iris-${uid})`} />
          <circle cx={x} cy={y - 0.5} r="1.8" fill="#120a05" />
          <circle cx={x + 1.3} cy={y - 1.8} r="0.9" fill="#ffffff" opacity="0.9" />
        </g>
        {/* upper lid line + lash */}
        <path d={`M ${x - 9} ${y} Q ${x} ${y - 6.5} ${x + 9} ${y}`} fill="none" stroke="#4a3328" strokeWidth={lash ? 1.9 : 1.2} strokeLinecap="round" />
        <path d={`M ${x - 9} ${y} Q ${x} ${y + 5.5} ${x + 9} ${y}`} fill="none" stroke="#4a3328" strokeWidth="0.7" opacity="0.5" />
      </g>
    </g>
  )
}

/* ---------- human face ---------- */
function Face({ c, open, wide, uid }: { c: AvatarConfig; open: number; wide: number; uid: string }) {
  const skin = c.skin ?? '#e8b98a'
  const hairFill = `url(#hair-${uid})`
  const jaw = open * 5
  return (
    <g>
      {/* neck + clothing */}
      <path d="M 86 136 L 86 158 Q 100 166 114 158 L 114 136 Q 100 146 86 136 Z" fill={darken(skin, 14)} />
      <Clothing c={c} uid={uid} />
      {/* head: skull with temples, cheekbones, jaw taper */}
      <path
        d={`M 100 42
            C 128 42 142 62 142 88
            C 142 102 138 114 130 ${124 + jaw * 0.4}
            C 123 ${133 + jaw * 0.6} 112 ${142 + jaw} 100 ${142 + jaw}
            C 88 ${142 + jaw} 77 ${133 + jaw * 0.6} 70 ${124 + jaw * 0.4}
            C 62 114 58 102 58 88
            C 58 62 72 42 100 42 Z`}
        fill={`url(#skin-${uid})`}
        style={{ transition: 'd 60ms linear' }}
      />
      {/* ears */}
      <g fill={darken(skin, 8)}>
        <path d="M 58 90 Q 50 84 52 94 Q 54 104 60 104 Q 62 98 58 90 Z" />
        <path d="M 142 90 Q 150 84 148 94 Q 146 104 140 104 Q 138 98 142 90 Z" />
      </g>
      <path d="M 55 92 Q 56 97 59 99" stroke={darken(skin, 26)} strokeWidth="1" fill="none" />
      <path d="M 145 92 Q 144 97 141 99" stroke={darken(skin, 26)} strokeWidth="1" fill="none" />
      {/* side shadow for depth */}
      <path d={`M 128 60 C 138 76 137 106 126 ${122 + jaw * 0.5} C 134 110 138 92 136 76 Z`}
        fill="#00000018" filter={`url(#soft-${uid})`} />
      {/* forehead highlight */}
      <ellipse cx="92" cy="62" rx="20" ry="10" fill="#ffffff22" filter={`url(#soft-${uid})`} />
      {/* cheek blush */}
      <ellipse cx="74" cy="106" rx="8" ry="5" fill="#c9705522" filter={`url(#soft-${uid})`} />
      <ellipse cx="126" cy="106" rx="8" ry="5" fill="#c9705522" filter={`url(#soft-${uid})`} />
      {/* age lines */}
      {c.aged && (
        <g stroke={darken(skin, 28)} strokeWidth="1.1" fill="none" opacity="0.55">
          <path d="M 76 56 Q 100 50 124 56" />
          <path d="M 78 62 Q 100 57 122 62" />
          <path d="M 82 114 Q 86 122 92 127" />
          <path d="M 118 114 Q 114 122 108 127" />
          <path d="M 64 96 Q 63 102 65 107" />
          <path d="M 136 96 Q 137 102 135 107" />
        </g>
      )}
      {/* stubble */}
      {c.stubble && (
        <path d={`M 72 118 Q 100 ${146 + jaw} 128 118 Q 124 ${138 + jaw} 100 ${140 + jaw} Q 76 ${138 + jaw} 72 118 Z`}
          fill={darken(skin, 34)} opacity="0.18" filter={`url(#soft-${uid})`} />
      )}
      {/* brows: tapered fills */}
      <path d="M 66 76 Q 76 70.5 89 74 Q 77 74.5 67.5 78.5 Z" fill={c.hairColor ?? '#2b2018'} opacity="0.9" />
      <path d="M 111 74 Q 124 70.5 134 76 Q 132.5 78.5 123 74.5 Q 117 73.5 111 74 Z" fill={c.hairColor ?? '#2b2018'} opacity="0.9" />
      <Eye x={79} y={88} uid={uid} lash={c.hair === 'long' || c.hair === 'bun'} />
      <Eye x={121} y={88} uid={uid} lash={c.hair === 'long' || c.hair === 'bun'} />
      {/* nose: bridge, tip, alae */}
      <path d="M 98 90 Q 96 102 93 107" stroke={darken(skin, 20)} strokeWidth="1.4" fill="none" opacity="0.5" />
      <path d="M 93 107 Q 96 111 100 110.5 Q 104 111 107 107" stroke={darken(skin, 26)} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <ellipse cx="96" cy="109" rx="1.4" ry="1" fill={darken(skin, 40)} opacity="0.5" />
      <ellipse cx="104" cy="109" rx="1.4" ry="1" fill={darken(skin, 40)} opacity="0.5" />
      <ellipse cx="97.5" cy="103" rx="2.6" ry="4.5" fill="#ffffff1e" filter={`url(#soft-${uid})`} />
      {/* nasolabial hint while speaking */}
      <path d={`M 88 110 Q 86 116 89 121`} stroke={darken(skin, 24)} strokeWidth="1" fill="none" opacity={0.2 + open * 0.3} />
      <path d={`M 112 110 Q 114 116 111 121`} stroke={darken(skin, 24)} strokeWidth="1" fill="none" opacity={0.2 + open * 0.3} />
      <Mouth cx={100} cy={122} open={open} wide={wide} skin={skin}
        lipTint={c.hair === 'long' ? '#9c4f56' : undefined} />
      {/* hair */}
      <Hair style={c.hair} fill={hairFill} color={c.hairColor ?? '#2b2018'} />
      {/* accessories */}
      {c.accessory === 'glasses' && (
        <g fill="none" stroke="#1f1d1b" strokeWidth="2">
          <rect x="63" y="80" width="31" height="19" rx="9" opacity="0.9" />
          <rect x="106" y="80" width="31" height="19" rx="9" opacity="0.9" />
          <path d="M 94 87 Q 100 84.5 106 87" />
          <path d="M 63 86 L 58 88 M 137 86 L 142 88" strokeWidth="1.6" />
          <rect x="64" y="81" width="29" height="8" rx="7" fill="#ffffff10" stroke="none" />
          <rect x="107" y="81" width="29" height="8" rx="7" fill="#ffffff10" stroke="none" />
        </g>
      )}
      {c.accessory === 'earrings' && (
        <g>
          <circle cx="57" cy="106" r="2.4" fill="#f5c04c" />
          <circle cx="143" cy="106" r="2.4" fill="#f5c04c" />
          <circle cx="56.4" cy="105.4" r="0.8" fill="#fff6d8" />
          <circle cx="142.4" cy="105.4" r="0.8" fill="#fff6d8" />
        </g>
      )}
      {c.accessory === 'kopi' && (
        <g>
          <path d="M 134 166 L 160 166 L 157 188 L 137 188 Z" fill="#0e9f6e" />
          <path d="M 160 170 q 11 2 1 11" stroke="#0e9f6e" strokeWidth="3.5" fill="none" />
          <ellipse cx="147" cy="166" rx="13" ry="3.6" fill="#5b3a1e" />
          <ellipse cx="147" cy="165.4" rx="9" ry="2.2" fill="#8a5a2e" />
          <path d="M 143 158 q 2 -5 0 -9 M 150 158 q 2 -5 0 -9" stroke="#ffffff55" strokeWidth="1.6" fill="none" />
        </g>
      )}
    </g>
  )
}

function Hair({ style, fill, color }: { style?: AvatarConfig['hair']; fill: string; color: string }) {
  switch (style) {
    case 'short':
      return (
        <g>
          <path d="M 58 86 C 56 52 76 38 100 38 C 124 38 144 52 142 86 C 140 72 134 60 122 55 C 110 50 90 50 78 55 C 66 60 60 72 58 86 Z" fill={fill} />
          <path d="M 70 58 Q 85 50 102 51" stroke="#ffffff22" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      )
    case 'side':
      return (
        <g>
          <path d="M 58 84 C 55 52 74 40 98 39 C 126 38 144 54 142 84 C 138 66 128 58 112 57 C 122 52 128 50 132 52 C 120 44 100 44 88 50 C 72 56 61 68 58 84 Z" fill={fill} />
          <path d="M 88 50 Q 104 45 118 50" stroke="#ffffff2e" strokeWidth="2" fill="none" />
        </g>
      )
    case 'bald':
      return (
        <g fill={fill}>
          <path d="M 57 92 Q 54 76 61 68 Q 64 84 65 100 Q 59 99 57 92 Z" />
          <path d="M 143 92 Q 146 76 139 68 Q 136 84 135 100 Q 141 99 143 92 Z" />
          <path d="M 61 68 C 70 50 86 42 100 42 C 114 42 130 50 139 68 C 128 56 114 50 100 50 C 86 50 72 56 61 68 Z" opacity="0.25" />
        </g>
      )
    case 'long':
      return (
        <g>
          <path d="M 52 140 C 44 66 62 38 100 38 C 138 38 156 66 148 140 L 132 140 C 138 96 136 70 116 60 Q 128 72 126 84 C 118 66 104 60 100 60 C 96 60 82 66 74 84 Q 72 72 84 60 C 64 70 62 96 68 140 Z" fill={fill} />
          <path d="M 70 60 Q 90 46 112 50" stroke="#ffffff26" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 60 100 Q 58 120 60 138 M 140 100 Q 142 120 140 138" stroke={darken(color, 18)} strokeWidth="1.5" fill="none" opacity="0.6" />
        </g>
      )
    case 'bun':
      return (
        <g>
          <circle cx="100" cy="37" r="13" fill={fill} />
          <path d="M 91 33 Q 100 27 109 33" stroke="#ffffff26" strokeWidth="2" fill="none" />
          <path d="M 58 88 C 56 52 76 40 100 40 C 124 40 144 52 142 88 C 136 64 120 56 100 56 C 80 56 64 64 58 88 Z" fill={fill} />
          <path d="M 66 70 Q 82 56 100 55 M 134 70 Q 118 56 100 55" stroke={darken(color, 16)} strokeWidth="1.2" fill="none" opacity="0.7" />
        </g>
      )
    default:
      return null
  }
}

function Clothing({ c, uid }: { c: AvatarConfig; uid: string }) {
  const cloth = `url(#cloth-${uid})`
  const outfit = c.outfit ?? 'shirt'
  return (
    <g>
      {/* shoulders */}
      <path d="M 40 200 C 44 170 64 154 86 150 L 100 160 L 114 150 C 136 154 156 170 160 200 Z" fill={cloth} />
      {/* head's soft shadow on chest */}
      <ellipse cx="100" cy="156" rx="26" ry="8" fill="#00000030" filter={`url(#soft-${uid})`} />
      {outfit === 'shirt' && (
        <g>
          <path d="M 86 150 L 100 160 L 94 170 L 84 156 Z" fill={lighten(c.shirt ?? '#334155', 26)} />
          <path d="M 114 150 L 100 160 L 106 170 L 116 156 Z" fill={lighten(c.shirt ?? '#334155', 26)} />
          <circle cx="100" cy="174" r="1.3" fill="#ffffff66" />
          <circle cx="100" cy="186" r="1.3" fill="#ffffff66" />
        </g>
      )}
      {outfit === 'blazer' && (
        <g>
          <path d="M 86 150 L 100 162 L 80 196 L 68 170 Z" fill={darken(c.shirt ?? '#334155', 28)} />
          <path d="M 114 150 L 100 162 L 120 196 L 132 170 Z" fill={darken(c.shirt ?? '#334155', 28)} />
          <path d="M 94 164 L 100 162 L 106 164 L 103 200 L 97 200 Z" fill="#e9e4da" />
        </g>
      )}
      {outfit === 'tee' && (
        <path d="M 84 152 Q 100 164 116 152 L 114 158 Q 100 168 86 158 Z" fill={darken(c.shirt ?? '#334155', 24)} />
      )}
    </g>
  )
}

/* ---------- otter (Ollie) ---------- */
function Otter({ open, wide, uid }: { open: number; wide: number; uid: string }) {
  const jaw = open * 6
  return (
    <g>
      {/* body */}
      <ellipse cx="100" cy="190" rx="54" ry="44" fill={`url(#fur-${uid})`} />
      <ellipse cx="100" cy="196" rx="30" ry="34" fill="#c9a876" opacity="0.8" />
      {/* SIT lanyard-scarf */}
      <path d="M 56 154 Q 100 174 144 154 L 144 166 Q 100 186 56 166 Z" fill="#0d9488" />
      <path d="M 56 154 Q 100 174 144 154 L 144 158 Q 100 178 56 158 Z" fill="#14b8a6" />
      <rect x="94" y="172" width="12" height="16" rx="2" fill="#f1f5f9" />
      <rect x="96" y="175" width="8" height="5" rx="1" fill="#0d9488" />
      {/* ears */}
      <circle cx="60" cy="54" r="10" fill="#6d4a2a" />
      <circle cx="140" cy="54" r="10" fill="#6d4a2a" />
      <circle cx="61" cy="55" r="5" fill="#4a3018" />
      <circle cx="139" cy="55" r="5" fill="#4a3018" />
      {/* head */}
      <path d={`M 100 36 C 132 36 150 58 148 86 C 147 104 138 118 126 ${126 + jaw * 0.4} C 116 ${133 + jaw * 0.7} 108 ${136 + jaw} 100 ${136 + jaw} C 92 ${136 + jaw} 84 ${133 + jaw * 0.7} 74 ${126 + jaw * 0.4} C 62 118 53 104 52 86 C 50 58 68 36 100 36 Z`}
        fill={`url(#fur-${uid})`} style={{ transition: 'd 60ms linear' }} />
      {/* brow highlight */}
      <ellipse cx="90" cy="58" rx="22" ry="10" fill="#ffffff1c" filter={`url(#soft-${uid})`} />
      {/* muzzle */}
      <path d={`M 100 88 C 120 88 130 98 129 ${110 + jaw * 0.5} C 128 ${122 + jaw} 114 ${128 + jaw} 100 ${128 + jaw} C 86 ${128 + jaw} 72 ${122 + jaw} 71 ${110 + jaw * 0.5} C 70 98 80 88 100 88 Z`}
        fill="#e7d0ad" style={{ transition: 'd 60ms linear' }} />
      <Eye x={78} y={78} uid={uid} />
      <Eye x={122} y={78} uid={uid} />
      {/* nose with gloss */}
      <path d="M 92 96 Q 100 92 108 96 Q 106 104 100 105 Q 94 104 92 96 Z" fill="#33210f" />
      <ellipse cx="97" cy="97" rx="2.6" ry="1.4" fill="#ffffff55" />
      <path d="M 100 105 L 100 110" stroke="#5b3a1e" strokeWidth="1.6" />
      {/* whiskers */}
      <g stroke="#cdb48d" strokeWidth="1.5" strokeLinecap="round" opacity="0.85">
        <path d="M 74 102 Q 56 98 44 100" /><path d="M 74 108 Q 57 108 45 112" />
        <path d="M 126 102 Q 144 98 156 100" /><path d="M 126 108 Q 143 108 155 112" />
      </g>
      <Mouth cx={100} cy={114} open={open} wide={wide} skin="#e7d0ad" lipTint="#5b3a1e" />
    </g>
  )
}
