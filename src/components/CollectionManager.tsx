import { useEffect, useMemo, useState } from 'react'
import { agencyNames, type Release } from '../data'
type CollectionRun = { id: string; time: string; target: string; added: number; status: '완료' | '실패'; message: string }
type CollectionSettings = { enabled: boolean; time: string; scope: string[] }
type CollectionState = { settings: CollectionSettings; runs: CollectionRun[] }
const defaultSettings: CollectionSettings = { enabled: true, time: '07:30', scope: Object.keys(agencyNames) }
export function CollectionManager({ onCollected }: { onCollected: (items: Release[]) => void }) {
  const [settings, setSettings] = useState<CollectionSettings>(defaultSettings)
  const [runs, setRuns] = useState<CollectionRun[]>([])
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const agencies = useMemo(() => Object.entries(agencyNames), [])
  const loadStatus = async () => {
    try {
      const response = await fetch('/api/collection/status')
      if (!response.ok) throw new Error('수집 상태를 불러오지 못했습니다.')
      const data = await response.json() as CollectionState
      setSettings(data.settings); setRuns(data.runs)
    } catch (error) { setNotice(error instanceof Error ? error.message : '수집 상태를 불러오지 못했습니다.') } finally { setLoading(false) }
  }
  useEffect(() => { void loadStatus() }, [])
  useEffect(() => {
    const restore = async () => {
      try {
        const response = await fetch('/api/collection/status')
        const data = await response.json() as CollectionState & { releases?: Release[] }
        if (data.releases?.length) onCollected(data.releases)
      } catch { /* 기존 화면 자료를 안전하게 유지 */ }
    }
    void restore()
  }, [onCollected])
  const toggleAgency = (code: string) => setSettings((current) => ({ ...current, scope: current.scope.includes(code) ? current.scope.filter((item) => item !== code) : [...current.scope, code] }))
  const save = async () => {
    try {
      const response = await fetch('/api/collection/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
      if (!response.ok) throw new Error('수집 일정을 저장하지 못했습니다.')
      const data = await response.json() as CollectionState
      setSettings(data.settings); setRuns(data.runs); setNotice(`매일 ${settings.time}에 선택 기관의 정책브리핑 보도자료를 수집하도록 저장했습니다.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : '일정 저장 중 오류가 발생했습니다.') }
  }
  const runNow = async () => {
    setCollecting(true); setNotice('대한민국 정책브리핑에서 AI 관련 보도자료를 수집하고 있습니다.')
    try {
      const response = await fetch('/api/collection/run', { method: 'POST' })
      const data = await response.json() as { releases?: Release[]; state?: CollectionState; message?: string }
      if (!response.ok || !data.releases || !data.state) throw new Error(data.message ?? '수집에 실패했습니다.')
      onCollected(data.releases); setSettings(data.state.settings); setRuns(data.state.runs); setNotice(`${data.releases.length}건의 정책브리핑 AI 관련 보도자료를 실제로 확인했습니다.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : '수집 중 오류가 발생했습니다.') } finally { setCollecting(false) }
  }
  return <div className="manager-page">
    <div className="manager-heading"><div><span className="eyebrow">DAILY COLLECTION CONTROL</span><h1>매일 <em>보도자료 수집</em> 관리</h1><p>대한민국 정책브리핑의 공식 보도자료 목록을 서버가 매일 확인하고, AI 관련 자료만 통합검색에 반영합니다.</p></div><span className="data-note">정책브리핑 공식 목록 연동</span></div>
    {notice && <div className="manager-notice" role="status">{notice}</div>}
    <section className="manager-grid"><article className="manager-card schedule-card"><div className="card-title"><div><span>자동 수집</span><h2>매일 수집 일정</h2></div><label className="toggle"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} /><i /><b>{settings.enabled ? '사용' : '중지'}</b></label></div><p>활성화하면 서버가 지정 시각에 선택 기관의 신규 AI 관련 보도자료를 수집하고, 제목·부제목·기관·발행일·원문 주소를 저장합니다.</p><label className="time-field">매일 실행 시각<input type="time" value={settings.time} onChange={(event) => setSettings((current) => ({ ...current, time: event.target.value }))} /></label><div className="manager-actions"><button className="primary-action" onClick={() => void save()} disabled={loading}>일정 저장</button><button className="secondary-action" onClick={() => void runNow()} disabled={collecting || loading}>{collecting ? '수집 중…' : '지금 수집 실행'}</button></div></article><article className="manager-card status-card"><span>현재 수집 범위</span><b>{settings.scope.length}<small>개 기관</small></b><p>부 단위 중앙행정기관과 지식재산처를 대상으로 정책브리핑의 공식 검색 결과를 수집합니다.</p><dl><div><dt>수집 기준</dt><dd>2026.01.01 이후</dd></div><div><dt>원문 출처</dt><dd>대한민국 정책브리핑</dd></div><div><dt>AI 판별</dt><dd>제목·부제목 키워드</dd></div></dl></article></section>
    <section className="manager-card agency-setting"><div className="card-title"><div><span>수집 대상</span><h2>기관 선택</h2></div><button className="text-action" onClick={() => setSettings((current) => ({ ...current, scope: current.scope.length === agencies.length ? [] : agencies.map(([code]) => code) }))}>{settings.scope.length === agencies.length ? '전체 해제' : '전체 선택'}</button></div><p>선택 기관만 수집합니다. 실제 실행 시 정책브리핑 결과에서 기관명과 공식 원문 주소를 함께 가져옵니다.</p><div className="agency-check-grid">{agencies.map(([code, name]) => <label key={code} className="agency-check"><input type="checkbox" checked={settings.scope.includes(code)} onChange={() => toggleAgency(code)} /><span>{name}</span></label>)}</div></section>
    <section className="manager-card run-card"><div className="card-title"><div><span>최근 실행</span><h2>수집 실행 이력</h2></div></div>{runs.length ? <div className="run-list">{runs.map((run) => <div className="run-item" key={run.id}><div><b>{run.status}</b><strong>{run.target} · 신규 확인 {run.added}건</strong><span>{run.message}</span></div><time>{run.time}</time></div>)}</div> : <div className="empty-state"><b>아직 서버 수집 이력이 없습니다.</b><span>‘지금 수집 실행’을 누르면 정책브리핑을 조회하고 최근 이력이 표시됩니다.</span></div>}</section>
  </div>
}
