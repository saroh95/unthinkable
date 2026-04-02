import { useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

const inputBase =
  'w-full rounded-lg border border-slate-600/80 bg-slate-800/80 px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 ' +
  'shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400/80 focus:border-teal-500/50 transition duration-200'

const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5'

function App() {
  const [symptoms, setSymptoms] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('')
  const [duration, setDuration] = useState('')
  const [severity, setSeverity] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)

    if (symptoms.trim().length < 10) {
      setError('Please describe your symptoms in at least a few words (10+ characters).')
      return
    }

    const ageNum =
      age === '' || age === undefined ? undefined : Number.parseInt(age, 10)
    if (age !== '' && (Number.isNaN(ageNum) || ageNum < 0 || ageNum > 120)) {
      setError('Age must be a number between 0 and 120, or leave it blank.')
      return
    }

    setIsLoading(true)
    try {
      const body = {
        symptomsText: symptoms.trim(),
        ...(ageNum !== undefined ? { age: ageNum } : {}),
        ...(sex ? { sex } : {}),
        ...(duration ? { duration } : {}),
        ...(severity ? { severity } : {}),
      }

      const res = await fetch(`${API_BASE_URL}/api/check-symptoms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg =
          [data.error, data.details].filter(Boolean).join(' — ') ||
          `Request failed (${res.status}).`
        throw new Error(msg)
      }

      setResult(data)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setSymptoms('')
    setAge('')
    setSex('')
    setDuration('')
    setSeverity('')
    setError('')
    setResult(null)
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-teal-950/40 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-6 md:py-8">
        <header className="mb-8 text-center md:text-left">
          <p className="inline-flex rounded-full border border-teal-500/35 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-200">
            Educational symptom checker — not medical advice
          </p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Tell us what’s bothering you
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Share the details of how you feel, and we’ll offer a friendly, educational summary of what might be going on.
          </p>
        </header>

        <div className="flex flex-col gap-5">
          <section>
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4 shadow-xl shadow-black/20 backdrop-blur-sm md:p-5"
            >
              <h2 className="text-xs font-semibold text-white">Share the story</h2>
              <p className="mt-1 text-[11px] text-slate-400">
                The more details you add, the more useful the suggestions can be — still educational only.
              </p>

              <div className="mt-5 space-y-5">
                <div>
                  <label htmlFor="symptoms" className={labelClass}>
                    What’s bothering you? <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    id="symptoms"
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    rows={5}
                    disabled={isLoading}
                    className={`${inputBase} min-h-[130px] resize-y`}
                    placeholder="Tell us what’s bothering you — include timing, triggers, and where it hurts."
                  />
                  <p className="mt-2 text-[11px] leading-snug text-slate-500">
                    Example: “Dull ache in lower right abdomen since yesterday, worse when walking, no fever.”
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <label htmlFor="age" className={labelClass}>
                      Age <span className="font-normal normal-case text-slate-600">(optional)</span>
                    </label>
                    <input
                      id="age"
                      type="number"
                      min={0}
                      max={120}
                      inputMode="numeric"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      disabled={isLoading}
                      className={inputBase}
                      placeholder="e.g. 34"
                    />
                  </div>
                  <div>
                    <label htmlFor="sex" className={labelClass}>
                      Gender / sex <span className="font-normal normal-case text-slate-600">(optional)</span>
                    </label>
                    <div className="relative">
                      <select
                        id="sex"
                        value={sex}
                        onChange={(e) => setSex(e.target.value)}
                        disabled={isLoading}
                        className={`${inputBase} cursor-pointer appearance-none pr-10`}
                      >
                        <option value="">Prefer not to say</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other / prefer to self-describe</option>
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                        ▼
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-[1.05fr_0.95fr]">
                  <div>
                    <label htmlFor="duration" className={labelClass}>
                      How long has it been?
                    </label>
                    <div className="relative">
                      <select
                        id="duration"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        disabled={isLoading}
                        className={`${inputBase} cursor-pointer appearance-none pr-10`}
                      >
                        <option value="">Prefer not to say</option>
                        <option value="hours_0_24">Less than 24 hours</option>
                        <option value="days_1_3">1–3 days</option>
                        <option value="days_4_7">4–7 days</option>
                        <option value="weeks_plus">More than a week</option>
                        <option value="unknown">Not sure</option>
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                        ▼
                      </span>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="severity" className={labelClass}>
                      How bad does it feel?
                    </label>
                    <div className="relative">
                      <select
                        id="severity"
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value)}
                        disabled={isLoading}
                        className={`${inputBase} cursor-pointer appearance-none pr-10`}
                      >
                        <option value="">Prefer not to say</option>
                        <option value="mild">Mild — annoying but manageable</option>
                        <option value="moderate">Moderate — affects daily activities</option>
                        <option value="severe">Severe — hard to function</option>
                        <option value="unknown">Hard to rate</option>
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                        ▼
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-3 text-xs text-rose-100 transition-opacity duration-200"
                >
                  <p className="font-semibold text-rose-200">Could not complete check</p>
                  <p className="mt-1 text-rose-100/95">{error}</p>
                  {error.includes('Gemini') || error.includes('API') ? (
                    <p className="mt-2 text-[11px] text-rose-200/80">
                      Confirm <code className="rounded bg-black/30 px-1">GEMINI_API_KEY</code> and{' '}
                      <code className="rounded bg-black/30 px-1">GEMINI_MODEL</code> in <code className="rounded bg-black/30 px-1">server/.env</code>, then restart the backend.
                    </p>
                  ) : null}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isLoading}
                  className="order-2 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:opacity-50 transition duration-200 sm:order-1"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="order-1 inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-teal-500 to-emerald-600 px-6 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-teal-900/30 hover:from-teal-400 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-55 transition duration-200 sm:order-2 sm:min-w-[190px]"
                >
                  {isLoading ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-slate-900/40 border-t-slate-900 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    'Analyze my symptoms'
                  )}
                </button>
              </div>
            </form>
          </section>

          <section className="flex flex-col gap-4">
            <div className="rounded-2xl border border-rose-500/70 bg-rose-950/15 p-4 text-xs text-rose-100 shadow-lg shadow-rose-950/20">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-rose-200">🛑</span>
                <div>
                  <p className="font-semibold text-rose-200">Emergency</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-rose-100/90">
                    If you have chest pain, trouble breathing, sudden weakness, confusion, severe bleeding, or self-harm thoughts, call emergency services now.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-slate-700/80 bg-slate-900/60 p-4 shadow-xl shadow-black/20 backdrop-blur-sm md:p-5">
              <h2 className="text-xs font-semibold text-white">Summary</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                A friendly overview based on what you shared — not medical advice.
              </p>

              <div className="mt-4 flex-1">
                {isLoading ? (
                  <div className="space-y-3 pt-2 animate-pulse" aria-busy="true" aria-label="Loading result">
                    <div className="h-3 w-3/4 rounded bg-slate-700/80" />
                    <div className="h-3 w-full rounded bg-slate-700/60" />
                    <div className="h-3 w-5/6 rounded bg-slate-700/60" />
                    <div className="h-24 w-full rounded-xl bg-slate-800/60" />
                  </div>
                ) : result ? (
                  <div className="space-y-4 animate-result-enter">
                    <p className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
                      {result.disclaimer || 'Educational only — not a diagnosis.'}
                    </p>

                    {result.parseError ? (
                      <div
                        role="alert"
                        className="rounded-xl border border-amber-500/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
                      >
                        <p className="font-semibold text-amber-200">Structured output could not be parsed</p>
                        <p className="mt-1 text-amber-100/90">{result.parseError}</p>
                        {result.rawText ? (
                          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/40 p-2 text-[11px] text-slate-300 whitespace-pre-wrap">
                            {result.rawText}
                          </pre>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="max-h-[420px] space-y-4 overflow-y-auto rounded-xl border border-slate-700/50 bg-slate-950/40 p-3.5">
                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/15 text-teal-300">✓</span>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400">Most likely</h3>
                            <p className="text-[11px] text-slate-500">The top match based on your description.</p>
                          </div>
                        </div>
                        {result.probableConditions?.slice(0, 1).length ? (
                          result.probableConditions.slice(0, 1).map((item, i) => (
                            <div
                              key={i}
                              className="rounded-2xl border border-slate-700/70 bg-slate-900/50 px-4 py-3 text-xs text-slate-100 transition hover:border-teal-400/40 hover:bg-slate-900/70"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-semibold text-white">{item.title}</span>
                                <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium text-teal-200">Likely</span>
                              </div>
                              {item.note ? (
                                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{item.note}</p>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No strong matches available yet.</p>
                        )}
                      </section>

                      <section className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">?</span>
                            <div>
                              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">Possible</h3>
                              <p className="text-[11px] text-slate-500">Worth considering if several details fit.</p>
                            </div>
                          </div>
                          {result.probableConditions?.slice(1, 3).length ? (
                            result.probableConditions.slice(1, 3).map((item, i) => (
                              <div
                                key={i}
                                className="rounded-2xl border border-slate-700/70 bg-slate-900/50 px-3 py-3 text-xs text-slate-100 transition hover:border-amber-400/40 hover:bg-slate-900/70"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-semibold text-white">{item.title}</span>
                                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">Possible</span>
                                </div>
                                {item.note ? (
                                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{item.note}</p>
                                ) : null}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500">No additional items yet.</p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-700/70 text-slate-300">•</span>
                            <div>
                              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Less likely</h3>
                              <p className="text-[11px] text-slate-500">Other possibilities to keep in mind.</p>
                            </div>
                          </div>
                          {result.probableConditions?.slice(3).length ? (
                            result.probableConditions.slice(3).map((item, i) => (
                              <div
                                key={i}
                                className="rounded-2xl border border-slate-700/70 bg-slate-900/50 px-3 py-3 text-xs text-slate-100 transition hover:border-slate-500/40 hover:bg-slate-900/70"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-semibold text-white">{item.title}</span>
                                  <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium text-slate-300">Less likely</span>
                                </div>
                                {item.note ? (
                                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{item.note}</p>
                                ) : null}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500">No less likely matches listed.</p>
                          )}
                        </div>
                      </section>

                      <section>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">Red flags</h3>
                        {result.redFlags?.length ? (
                          <ul className="mt-3 list-inside list-disc space-y-1.5 text-xs text-slate-200">
                            {result.redFlags.map((line, i) => (
                              <li key={i} className="leading-relaxed">
                                {line}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">None listed.</p>
                        )}
                      </section>

                      <section>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Recommended next steps</h3>
                        {result.recommendedNextSteps?.length ? (
                          <ol className="mt-3 list-inside list-decimal space-y-2 text-xs text-slate-200">
                            {result.recommendedNextSteps.map((line, i) => (
                              <li key={i} className="leading-relaxed">
                                {line}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">No next steps were provided.</p>
                        )}
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/60 bg-slate-950/20 px-4 py-8 text-center">
                    <p className="text-sm text-slate-500">Submit the form to get a friendly summary of what might be happening.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <p className="mt-10 text-center text-[11px] text-slate-500">
          For learning only — not a medical device. Always follow your healthcare provider’s guidance.
        </p>
      </div>
    </div>
  )
}

export default App
