import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'

const KEY = 'airaware.profile.v1'
export const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}

/** Holds the household profile (stored only in this browser: no names or identifiers) and the current plan. */
export function AppProvider({ children }) {
  const [profile, setProfileState] = useState(load)
  const [demo, setDemo] = useState(false)
  const [state, setState] = useState({ plan: null, loading: false, error: null })

  const refresh = useCallback(async (p = profile, useDemo = demo) => {
    if (!p) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      setState({ plan: await api.plan(p, useDemo), loading: false, error: null })
    } catch (e) {
      setState({ plan: null, loading: false, error: e.message })
    }
  }, [profile, demo])

  useEffect(() => { if (profile) refresh(profile, demo) }, [profile, demo]) // eslint-disable-line react-hooks/exhaustive-deps

  const setProfile = (p) => {
    try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* storage unavailable */ }
    setProfileState(p)
  }
  const clearProfile = () => {
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    setProfileState(null); setDemo(false); setState({ plan: null, loading: false, error: null })
  }

  const value = useMemo(() => ({ profile, setProfile, clearProfile, demo, setDemo, refresh, ...state }), [profile, demo, state, refresh])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
