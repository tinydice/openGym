// The weigh-in token (Settings → Account): a long-lived key for one script, such as an iOS Shortcut
// that posts the scale's reading from Apple Health, to POST /api/weighin. The server keeps only a
// hash (api/ingest-token.js), so the token is shown once when it is made; making another replaces
// it, and Revoke ends it. It can add weigh-ins and do nothing else.
import { useEffect, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { dateLocale } from '../lib/i18n-core.js'
import { api } from '../lib/api.js'
import { appBase } from '../lib/app-base.js'
import { copyText } from '../lib/clipboard.js'
import { Row, Button } from './ui.jsx'

const ui = () => useUI.getState()
const toast = m => ui().toast(m)
const PATH = 'api/account/ingest-token'
const when = ms => { try { return new Date(ms).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' } }
// Where the Shortcut posts to: this server, wherever the app is served from.
export const weighInUrl = (loc = typeof location !== 'undefined' ? location : null) => (loc ? loc.origin : '') + appBase(loc) + 'api/weighin'

export function IngestTokenRow() {
  return <Row icon="scale" iconTint="var(--teal)" title={t('Weigh-in token')} accessory="chevron"
    subtitle={t('Lets a Shortcut or script add weigh-ins from your scale.')}
    onClick={() => ui().openSheet(close => <IngestTokenSheet close={close} />)} />
}

export function IngestTokenSheet({ close }) {
  const [info, setInfo] = useState(null)     // { active, created, last }
  const [fresh, setFresh] = useState(null)   // the token just made, until the sheet closes
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { api('/' + PATH).then(setInfo).catch(() => setErr(t('Could not reach the server.'))) }, [])
  const make = async () => {
    setBusy(true); setErr('')
    try {
      const r = await api('/' + PATH, { method: 'POST', body: '{}' })
      setFresh(r.token); setInfo({ active: true, created: r.created, last: null })
    } catch { setErr(t('Could not reach the server.')) }
    setBusy(false)
  }
  const revoke = async () => {
    setBusy(true); setErr('')
    try { await api('/' + PATH, { method: 'DELETE' }); setFresh(null); setInfo({ active: false, created: null, last: null }) }
    catch { setErr(t('Could not reach the server.')) }
    setBusy(false)
  }
  const copy = async text => { if (await copyText(text)) toast(t('Copied')) }
  return <>
    <h3>{t('Weigh-in token')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>
      {t('A Shortcut on your phone can send the reading from your scale to this profile. It uses this token, which can add weigh-ins and nothing else.')}
    </div>
    {!info ? <div className="muted small">{err || '…'}</div> : <>
      {fresh && <>
        <div className="small" style={{ marginBottom: 6, fontWeight: 600 }}>{t('Copy it now. It is not shown again.')}</div>
        <div className="card" dir="ltr" style={{ wordBreak: 'break-all', fontSize: 13, fontFamily: 'ui-monospace, Menlo, monospace', padding: '12px 14px' }}>{fresh}</div>
        <div style={{ height: 8 }} />
        <Button icon="copy" onClick={() => copy(fresh)}>{t('Copy token')}</Button>
        <div style={{ height: 14 }} />
      </>}
      {info.active && !fresh && <div className="small muted" style={{ marginBottom: 14 }}>
        {t('Made {0}.', when(info.created))} {info.last ? t('Last used {0}.', when(info.last)) : t('Not used yet.')}
      </div>}
      <div className="small dim" style={{ marginBottom: 4 }}>{t('Post to')}</div>
      <div className="card" dir="ltr" style={{ wordBreak: 'break-all', fontSize: 13, padding: '10px 14px' }}>{weighInUrl()}</div>
      <div style={{ height: 8 }} />
      <Button icon="copy" onClick={() => copy(weighInUrl())}>{t('Copy address')}</Button>
      <div style={{ height: 14 }} />
      <Button variant={info.active ? undefined : 'primary'} disabled={busy} onClick={make}>
        {info.active ? t('Make a new token (the old one stops)') : t('Make a token')}
      </Button>
      {info.active && <><div style={{ height: 8 }} /><Button variant="ghost" className="dim" disabled={busy} onClick={revoke}>{t('Revoke')}</Button></>}
    </>}
    {err && info && <div className="small" role="alert" style={{ color: 'var(--red)', marginTop: 10 }}>{err}</div>}
    <div style={{ height: 8 }} />
    <Button variant="ghost" onClick={close}>{t('Done')}</Button>
  </>
}
