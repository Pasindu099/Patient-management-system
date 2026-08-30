'use client'

import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

export const TOOTH_CONDITIONS = [
  { id: 'healthy', label: 'Healthy', color: '#ffffff', border: '#cbd5e1', text: 'text-gray-600', chip: 'bg-white', emoji: '✓' },
  { id: 'caries', label: 'Caries', color: '#fee2e2', border: '#ef4444', text: 'text-red-700', chip: 'bg-red-50', emoji: '🦷' },
  { id: 'filled', label: 'Filled', color: '#dbeafe', border: '#3b82f6', text: 'text-blue-700', chip: 'bg-blue-50', emoji: '●' },
  { id: 'crown', label: 'Crown', color: '#fef3c7', border: '#d97706', text: 'text-amber-700', chip: 'bg-amber-50', emoji: '♛' },
  { id: 'rootcanal', label: 'Root Canal', color: '#ede9fe', border: '#7c3aed', text: 'text-purple-700', chip: 'bg-purple-50', emoji: '⚡' },
  { id: 'extracted', label: 'Extracted', color: '#f1f5f9', border: '#64748b', text: 'text-slate-600', chip: 'bg-slate-50', emoji: '✕' },
  { id: 'missing', label: 'Missing', color: '#f8fafc', border: '#cbd5e1', text: 'text-gray-400', chip: 'bg-gray-50', emoji: '–' },
  { id: 'implant', label: 'Implant', color: '#dcfce7', border: '#16a34a', text: 'text-green-700', chip: 'bg-green-50', emoji: '⚙' },
  { id: 'fracture', label: 'Fracture', color: '#ffedd5', border: '#ea580c', text: 'text-orange-700', chip: 'bg-orange-50', emoji: '⚠' },
  { id: 'watch', label: 'Watch', color: '#fef9c3', border: '#ca8a04', text: 'text-yellow-700', chip: 'bg-yellow-50', emoji: '👁' },
  { id: 'bridge', label: 'Bridge', color: '#dbeafe', border: '#2563eb', text: 'text-blue-800', chip: 'bg-blue-50', emoji: '⌒' },
  { id: 'denture', label: 'Denture', color: '#f0fdf4', border: '#16a34a', text: 'text-green-800', chip: 'bg-green-50', emoji: '☰' },
] as const

export type ToothConditionId = typeof TOOTH_CONDITIONS[number]['id']

export interface ToothState {
  condition: ToothConditionId
  notes: string
  selected: boolean
}

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38]
const ALL_TEETH = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT, ...LOWER_LEFT]

function conditionFor(id: ToothConditionId) {
  return TOOTH_CONDITIONS.find(condition => condition.id === id) ?? TOOTH_CONDITIONS[0]
}

type ToothType = 'incisor' | 'canine' | 'premolar' | 'molar'

function toothType(number: number): ToothType {
  const n = number % 10
  if (n <= 2) return 'incisor'
  if (n === 3) return 'canine'
  if (n <= 5) return 'premolar'
  return 'molar'
}

function toothName(number: number) {
  const type = toothType(number)
  return type[0].toUpperCase() + type.slice(1)
}

function defaultToothState(): ToothState {
  return { condition: 'healthy', notes: '', selected: false }
}

// Anatomical SVG silhouette per tooth type, crown pointing toward the gum line (isUpper flips it)
function toothPath(type: ToothType, isUpper: boolean, w = 34, h = 40): string {
  const cx = w / 2
  const r = 5

  if (type === 'molar') {
    return isUpper
      ? `M${r},0 H${w - r} Q${w},0 ${w},${r} V${h - 10} Q${w - 3},${h} ${cx + 5},${h} Q${cx},${h + 2} ${cx - 5},${h} Q3,${h} 0,${h - 10} V${r} Q0,0 ${r},0 Z`
      : `M${r},0 H${w - r} Q${w},0 ${w},${r} V${h - r} Q${w},${h} ${w - r},${h} H${r} Q0,${h} 0,${h - r} V${r} Q0,0 ${r},0 Z`
  }
  if (type === 'premolar') {
    return isUpper
      ? `M${r},0 H${w - r} Q${w},0 ${w},${r} V${h - 8} Q${cx + 3},${h} ${cx},${h + 1} Q${cx - 3},${h} 0,${h - 8} V${r} Q0,0 ${r},0 Z`
      : `M${r},0 H${w - r} Q${w},0 ${w},${r} V${h - r} Q${w},${h} ${w - r},${h} H${r} Q0,${h} 0,${h - r} V${r} Q0,0 ${r},0 Z`
  }
  if (type === 'canine') {
    return isUpper
      ? `M${r},0 H${w - r} Q${w},0 ${w},${r} V${h - 5} Q${cx},${h + 4} 0,${h - 5} V${r} Q0,0 ${r},0 Z`
      : `M${cx - 2},0 L${w - r},0 Q${w},0 ${w},${r} V${h - r} Q${w},${h} ${w - r},${h} H${r} Q0,${h} 0,${h - r} V${r} Q0,0 ${r},0 Z`
  }
  // incisor
  const iw = w * 0.72
  const ox = (w - iw) / 2
  return isUpper
    ? `M${ox + 3},0 H${ox + iw - 3} Q${ox + iw},0 ${ox + iw},3 V${h - 5} Q${cx},${h + 3} ${ox},${h - 5} V3 Q${ox},0 ${ox + 3},0 Z`
    : `M${ox + 3},0 H${ox + iw - 3} Q${ox + iw},0 ${ox + iw},3 V${h - 3} Q${ox + iw},${h} ${ox + iw - 3},${h} H${ox + 3} Q${ox},${h} ${ox},${h - 3} V3 Q${ox},0 ${ox + 3},0 Z`
}

interface Props {
  teeth: Record<number, ToothState>
  onChange: (teeth: Record<number, ToothState>) => void
  readonly?: boolean
}

export function ToothChart({ teeth, onChange, readonly }: Props) {
  const [activeCondition, setActiveCondition] = useState<ToothConditionId>('caries')
  const [hovered, setHovered] = useState<number | null>(null)

  const getTooth = (number: number): ToothState => teeth[number] ?? defaultToothState()
  const selectedTeeth = useMemo(() => ALL_TEETH.filter(number => getTooth(number).selected), [teeth])

  function toggleTooth(number: number) {
    if (readonly) return
    const current = getTooth(number)
    const selected = !current.selected
    onChange({
      ...teeth,
      [number]: {
        ...current,
        selected,
        condition: selected ? activeCondition : 'healthy',
        notes: selected ? current.notes : '',
      },
    })
  }

  function setCondition(number: number, condition: ToothConditionId) {
    if (readonly) return
    onChange({
      ...teeth,
      [number]: {
        ...getTooth(number),
        selected: condition !== 'healthy',
        condition,
      },
    })
  }

  function setNotes(number: number, notes: string) {
    if (readonly) return
    onChange({ ...teeth, [number]: { ...getTooth(number), notes } })
  }

  function clearAll() {
    if (readonly) return
    onChange(Object.fromEntries(ALL_TEETH.map(number => [number, defaultToothState()])))
  }

  return (
    <div className="space-y-4">
      {!readonly && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900">Tooth condition</p>
              <p className="text-xs font-medium text-gray-500">Choose a condition, then tap teeth on the chart.</p>
            </div>
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              Clear
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {TOOTH_CONDITIONS.filter(condition => condition.id !== 'healthy').map(condition => (
              <button
                key={condition.id}
                type="button"
                onClick={() => setActiveCondition(condition.id)}
                className={cn(
                  'flex min-h-[42px] items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-xs font-bold transition-all',
                  activeCondition === condition.id ? 'scale-[1.03] border-blue-600 shadow-sm ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300',
                  condition.chip
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-md border text-[11px]" style={{ backgroundColor: condition.color, borderColor: condition.border }}>
                  {condition.emoji}
                </span>
                <span className={condition.text}>{condition.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-slate-50 to-white p-3 sm:p-4">
        <div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3">
            <QuadrantLabel side="UR" label="Upper right" />
            <ArchLabel label="Upper arch" />
            <QuadrantLabel side="UL" label="Upper left" align="right" />
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3">
            <Quadrant numbers={UPPER_RIGHT} isUpper getTooth={getTooth} onToggle={toggleTooth} hovered={hovered} setHovered={setHovered} />
            <Midline />
            <Quadrant numbers={UPPER_LEFT} isUpper getTooth={getTooth} onToggle={toggleTooth} hovered={hovered} setHovered={setHovered} />
          </div>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-rose-300 to-rose-300" />
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-500 shadow-sm ring-1 ring-rose-200">
              Gum line · midline
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-rose-300 to-rose-300" />
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-3">
            <Quadrant numbers={LOWER_RIGHT} isUpper={false} getTooth={getTooth} onToggle={toggleTooth} hovered={hovered} setHovered={setHovered} />
            <Midline />
            <Quadrant numbers={LOWER_LEFT} isUpper={false} getTooth={getTooth} onToggle={toggleTooth} hovered={hovered} setHovered={setHovered} />
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-3">
            <QuadrantLabel side="LR" label="Lower right" />
            <ArchLabel label="Lower arch" />
            <QuadrantLabel side="LL" label="Lower left" align="right" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TOOTH_CONDITIONS.map(condition => (
          <div key={condition.id} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600">
            <span className="flex h-4 w-4 items-center justify-center rounded-sm border text-[9px]" style={{ backgroundColor: condition.color, borderColor: condition.border }}>
              {condition.emoji}
            </span>
            {condition.label}
          </div>
        ))}
      </div>

      {!readonly && selectedTeeth.length > 0 && (
        <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-blue-900">Selected teeth</p>
              <p className="text-sm font-medium text-blue-700">{selectedTeeth.length} selected: {selectedTeeth.join(', ')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {selectedTeeth.map(number => {
              const tooth = getTooth(number)
              const condition = conditionFor(tooth.condition)

              return (
                <div key={number} className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900">Tooth {number}</p>
                      <p className="text-xs font-medium text-gray-500">{toothName(number)}</p>
                    </div>
                    <select
                      value={tooth.condition}
                      onChange={event => setCondition(number, event.target.value as ToothConditionId)}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-semibold"
                      style={{ backgroundColor: condition.color }}
                    >
                      {TOOTH_CONDITIONS.map(item => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    value={tooth.notes}
                    onChange={event => setNotes(number, event.target.value)}
                    placeholder="Notes for this tooth..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Quadrant({
  numbers, isUpper, getTooth, onToggle, hovered, setHovered,
}: {
  numbers: number[]
  isUpper: boolean
  getTooth: (number: number) => ToothState
  onToggle: (number: number) => void
  hovered: number | null
  setHovered: (number: number | null) => void
}) {
  return (
    <div className="grid grid-cols-8 gap-0.5 sm:gap-1.5">
      {numbers.map(number => (
        <ToothTile
          key={number}
          number={number}
          isUpper={isUpper}
          state={getTooth(number)}
          isHovered={hovered === number}
          onHover={hover => setHovered(hover ? number : null)}
          onClick={() => onToggle(number)}
        />
      ))}
    </div>
  )
}

function ToothTile({
  number, isUpper, state, isHovered, onHover, onClick,
}: {
  number: number
  isUpper: boolean
  state: ToothState
  isHovered: boolean
  onHover: (hover: boolean) => void
  onClick: () => void
}) {
  const condition = conditionFor(state.condition)
  const type = toothType(number)
  const gone = state.condition === 'missing' || state.condition === 'extracted'
  const path = toothPath(type, isUpper)
  const gradId = `tooth-grad-${number}`

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      title={`Tooth ${number} · ${condition.label}${state.notes ? ` — ${state.notes}` : ''}`}
      className={cn(
        'group relative flex w-full flex-col items-center gap-0.5 rounded-lg border p-0.5 transition-all duration-150 sm:gap-1 sm:rounded-xl sm:p-1.5',
        'focus:outline-none focus:ring-2 focus:ring-blue-400',
        state.selected ? 'border-blue-300 bg-blue-50/60 shadow-sm' : 'border-transparent hover:bg-slate-100/70',
        isHovered && !state.selected && '-translate-y-0.5'
      )}
    >
      <span className={cn('text-[9px] font-bold sm:text-[10px]', state.selected ? 'text-blue-700' : 'text-gray-400')}>{number}</span>

      <svg
        viewBox="0 0 34 40"
        className={cn('h-auto w-full max-w-[34px] transition-transform duration-150', isHovered && 'scale-[1.08] drop-shadow-md', state.selected && 'scale-[1.05]')}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={gone ? 0 : 0.75} />
            <stop offset="100%" stopColor={condition.color} stopOpacity={gone ? 0 : 1} />
          </linearGradient>
        </defs>
        {state.selected && (
          <path d={path} fill="none" stroke="#3B82F6" strokeWidth={4} opacity={0.35} />
        )}
        <path
          d={path}
          fill={gone ? 'none' : `url(#${gradId})`}
          stroke={state.selected ? '#2563eb' : condition.border}
          strokeWidth={state.selected ? 2 : 1.4}
          strokeDasharray={gone ? '3 2.5' : undefined}
        />
        {state.condition !== 'healthy' && (
          <text x={17} y={isUpper ? 20 : 20} textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 11, fontFamily: 'system-ui' }}>
            {condition.emoji}
          </text>
        )}
      </svg>

      <span className="hidden max-w-full truncate text-[9px] font-semibold text-gray-400 sm:block">{toothName(number).slice(0, 4)}</span>
      {state.notes && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-600" />}
    </button>
  )
}

function QuadrantLabel({ side, label, align = 'left' }: { side: string; label: string; align?: 'left' | 'right' }) {
  return (
    <div className={cn('flex items-center gap-2', align === 'right' && 'justify-end')}>
      <span className="rounded-lg bg-gray-900 px-2 py-1 text-xs font-bold text-white">{side}</span>
      <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</span>
    </div>
  )
}

function ArchLabel({ label }: { label: string }) {
  return <span className="hidden w-24 text-center text-xs font-bold uppercase tracking-wide text-gray-400 sm:block">{label}</span>
}

function Midline() {
  return <div className="w-px self-stretch bg-gray-300" />
}
