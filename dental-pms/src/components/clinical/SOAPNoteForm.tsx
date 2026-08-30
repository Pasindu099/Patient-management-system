'use client'

import { useState } from 'react'
import { FileText, Lock, Mic, ChevronDown, ChevronUp } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface Props {
  patientId:   string
  currentUser: { id: string; name: string; role: string }
  onSaved:     () => void
}

const NOTE_TEMPLATES: Record<string, Partial<{ subjective: string; objective: string; assessment: string; plan: string }>> = {
  checkup: {
    subjective: 'Patient presents for routine checkup. No pain or discomfort reported.',
    objective:  'Extraoral: No lymphadenopathy. Intraoral: Soft tissues WNL. ',
    assessment: 'Good oral hygiene. No active caries detected.',
    plan:       'Continue 6-month recall. Reinforce oral hygiene instructions.',
  },
  cleaning: {
    subjective: 'Patient presents for scaling and polishing.',
    objective:  'Moderate supragingival calculus noted. Gingival inflammation present.',
    assessment: 'Gingivitis. Full mouth scaling and polishing completed.',
    plan:       'Recall in 6 months. Use interdental brushes daily.',
  },
  extraction: {
    subjective: 'Patient presents for extraction. ',
    objective:  'LA administered. Tooth mobile/non-restorable.',
    assessment: 'Extraction of tooth completed without complications.',
    plan:       'Bite on gauze for 30 minutes. Avoid hot food/drink. Review in 1 week if needed.',
  },
  emergency: {
    subjective: 'Patient presents as emergency with pain in ',
    objective:  'Percussion +/-. Palpation +/-. EPT response: ',
    assessment: '',
    plan:       '',
  },
}

export function SOAPNoteForm({ patientId, currentUser, onSaved }: Props) {
  const [noteType,   setNoteType]   = useState<'soap' | 'general'>('soap')
  const [subjective, setSubjective] = useState('')
  const [objective,  setObjective]  = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan,       setPlan]       = useState('')
  const [content,    setContent]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [expanded,   setExpanded]   = useState(true)

  function applyTemplate(key: string) {
    const t = NOTE_TEMPLATES[key]
    if (!t) return
    setNoteType('soap')
    setSubjective(t.subjective ?? '')
    setObjective(t.objective  ?? '')
    setAssessment(t.assessment ?? '')
    setPlan(t.plan ?? '')
  }

  async function handleSave() {
    const hasContent = noteType === 'soap'
      ? (subjective || objective || assessment || plan).trim().length > 0
      : content.trim().length > 0

    if (!hasContent) { showToast('error', 'Please add some content before saving'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/clinical/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          noteType,
          subjective: noteType === 'soap' ? subjective : undefined,
          objective:  noteType === 'soap' ? objective  : undefined,
          assessment: noteType === 'soap' ? assessment : undefined,
          plan:       noteType === 'soap' ? plan       : undefined,
          content:    noteType === 'general' ? content : undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      showToast('success', 'Note saved and locked')
      setSubjective(''); setObjective(''); setAssessment(''); setPlan(''); setContent('')
      onSaved()
    } catch {
      showToast('error', 'Could not save note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="section-card">
      <div
        className="section-card-header cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">New clinical note</h2>
        </div>
        {expanded
          ? <ChevronUp className="w-5 h-5 text-gray-400" />
          : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </div>

      {expanded && (
        <div className="section-card-body space-y-4">
          {/* Note type toggle */}
          <div className="flex gap-2">
            {(['soap', 'general'] as const).map(t => (
              <button
                key={t}
                onClick={() => setNoteType(t)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors min-h-[44px]',
                  noteType === t
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                )}
              >
                {t === 'soap' ? 'SOAP note' : 'General note'}
              </button>
            ))}

            {/* Quick templates */}
            <div className="flex gap-1.5 ml-auto flex-wrap">
              {Object.keys(NOTE_TEMPLATES).map(k => (
                <button
                  key={k}
                  onClick={() => applyTemplate(k)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-gray-100
                             text-gray-600 hover:bg-blue-50 hover:text-blue-700
                             border border-gray-200 transition-colors capitalize min-h-[44px]"
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {noteType === 'soap' ? (
            <div className="space-y-3">
              {[
                { key: 'S', label: 'Subjective', value: subjective, set: setSubjective,
                  hint: 'What the patient tells you' },
                { key: 'O', label: 'Objective', value: objective, set: setObjective,
                  hint: 'What you observe and measure' },
                { key: 'A', label: 'Assessment', value: assessment, set: setAssessment,
                  hint: 'Your diagnosis or findings' },
                { key: 'P', label: 'Plan', value: plan, set: setPlan,
                  hint: 'Treatment carried out and next steps' },
              ].map(field => (
                <div key={field.key} className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center
                                  justify-center font-bold text-sm flex-shrink-0 mt-1">
                    {field.key}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-semibold text-gray-700">{field.label}</label>
                      <span className="text-xs text-gray-400">{field.hint}</span>
                    </div>
                    <textarea
                      value={field.value}
                      onChange={e => field.set(e.target.value)}
                      className="form-input !h-20 resize-none"
                      placeholder={`${field.label}…`}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="form-input !h-32 resize-none"
              placeholder="Enter your clinical note here…"
              autoFocus
            />
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Will be locked after saving · {currentUser.name}
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
              ) : (
                <><Lock className="w-4 h-4" />Save & lock note</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
