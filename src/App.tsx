import { useEffect, useMemo, useState } from 'react'
import { Dashboard, MonthlyStats } from './components/Analytics'
import { CollectionManager } from './components/CollectionManager'
import { DeploymentManager } from './components/DeploymentManager'
import { getAgency, releases, type Release } from './data'
import { api } from './lib/api'
import './index.css'
type Section = '통합검색' | '대시보드' | '월별 통계' | 'AX 동향보고서' | '기관 관리' | 'GitHub 배포'
const menuItems: { label: Section; display: string }[] = [
  { label: '통합검색', display: '뉴스' },
  { label: '대시보드', display: '히트맵' },
  { label: '월별 통계', display: '월별추이' },
  { label: 'AX 동향보고서', display: 'AI 리포트' },
  { label: '기관 관리', display: '수집 관리' },
  { label: 'GitHub 배포', display: 'GitHub 배포' },
]
function countByAgency(items: Release[]) {
  return Object.entries(items.reduce<Record<string, number>>((result, release) => {
    const agency = getAgency(release)
    result[agency] = (result[agency] ?? 0) + 1
    return result
  }, {})).sort(([, first], [, second]) => second - first)
}
function ReleaseList({ items, onOpen }: { items: Release[]; onOpen: (item: Release) => void }) {
  if (!items.length) return <div className="empty-state"><b>조건에 맞는 보도자료가 없습니다.</b><span>검색어 또는 기관 필터를 바꿔 다시 확인해 보세요.</span></div>
  return <div className="release-list">{items.map((item) => <article className="release-item" key={item.itemId}>
    <button className="release-summary" onClick={() => onOpen(item)} aria-label={`${item.title} 요약 보기`}>
      <span className="release-date">{item.regDate.replaceAll('-', '.')}</span>
      <div><span className="release-agency">{getAgency(item)}</span><h3>{item.title}</h3><p>{item.dataContents}</p></div>
      <span className="open-mark" aria-hidden="true">›</span>
    </button>
    {item.viewUrl ? <a className="list-source-link" href={item.viewUrl} target="_blank" rel="noreferrer">원문 보기 <span aria-hidden="true">↗</span></a> : <span className="link-pending">실데이터 연결 시 원문이 표시됩니다</span>}
  </article>)}</div>
}
function SearchView({ query, setQuery, selectedAgency, setActiveMenu, items }: { query: string; setQuery: (value: string) => void; selectedAgency: string; setActiveMenu: (value: Section) => void; items: Release[] }) {
  return <div className="content-body search-page">
    <div className="search-hero"><span className="eyebrow">GOVERNMENT AX NEWS ARCHIVE</span><h1>정부기관 <em>AI·AX 보도자료</em><br />통합 아카이브</h1><p className="intro">대한민국 정책브리핑에 공개된 정부기관의 인공지능 전환 관련 보도자료를 한곳에서 살펴보세요.</p></div>
    <label className="main-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목·기관·키워드 검색" /><button onClick={() => setQuery('')}>초기화</button></label>
    <div className="filter-row"><span>주요 분류</span>{['생성형 AI', '공공 AX', 'AI 인프라', 'AI 안전'].map((tag) => <button key={tag} onClick={() => setQuery(tag === 'AI 인프라' ? '데이터센터' : tag)}>{tag}</button>)}</div>
    <section className="info-strip"><div><span>수집 뉴스</span><b>{items.length}<small>건</small></b></div><div><span>선택 기관</span><b>{selectedAgency === '전체 기관' ? new Set(items.map((item) => getAgency(item))).size : '1'}<small>곳</small></b></div><button onClick={() => setActiveMenu('대시보드')}>기관별 AX 주제 살펴보기 <b>→</b></button></section>
  </div>
}
function ComingSoon({ section }: { section: Section }) {
  const isReport = section === 'AX 동향보고서'
  return <div className="content-body simple-page"><span className="eyebrow">{isReport ? 'AI GENERATED REPORT' : 'SERVICE GUIDE'}</span><h1>{isReport ? <>AX <em>동향보고서</em></> : <>서비스 <em>안내</em></>}</h1><p className="intro">{isReport ? '수집된 보도자료를 근거로 전체·분기별 주요 흐름을 정리하는 보고서 화면입니다.' : '대한민국 정책브리핑에서 확인한 보도자료의 제목, 발행일, 원문 주소를 보존해 제공합니다.'}</p><div className="notice-card"><b>{isReport ? '분기별 분석 자료를 준비하고 있습니다.' : '수집 범위와 기준을 안내합니다.'}</b><span>{isReport ? '현재 연결된 자료가 누적되면 근거 보도자료와 함께 보고서를 표시합니다.' : 'AI·인공지능 전환과 밀접한 보도자료를 중심으로 수집하며, 원문은 정책브리핑에서 확인할 수 있습니다.'}</span></div></div>
}
export default function App() {
  const [activeMenu, setActiveMenu] = useState<Section>('GitHub 배포')
  const [selectedAgency, setSelectedAgency] = useState('전체 기관')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Release | null>(null)
  const [items, setItems] = useState<Release[]>(releases)
  const agencies = useMemo(() => countByAgency(items), [items])
  const filtered = useMemo(() => items.filter((item) => {
    const text = `${item.title} ${item.dataContents} ${getAgency(item)}`.toLowerCase()
    return (selectedAgency === '전체 기관' || getAgency(item) === selectedAgency) && text.includes(query.toLowerCase())
  }), [query, selectedAgency])
  useEffect(() => {
    const formatDate = (value: Date) => value.toISOString().slice(0, 10)
    const collectRecentReleases = async () => {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      try {
        const response = await api(`collection/run?start_date=${formatDate(yesterday)}&end_date=${formatDate(today)}`, { method: 'POST' })
        if (!response.ok) return
        const data = await response.json() as { releases?: Release[] }
        if (data.releases?.length) setItems(data.releases)
      } catch { /* 수집에 실패해도 기존 초기 목록을 안전하게 유지 */ }
    }
    void collectRecentReleases()
  }, [])
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null) }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [])
  const page = activeMenu === '대시보드' ? <Dashboard releases={items} onMonthlyStats={() => setActiveMenu('월별 통계')} /> : activeMenu === '월별 통계' ? <MonthlyStats releases={items} /> : activeMenu === '기관 관리' ? <CollectionManager onCollected={setItems} /> : activeMenu === 'GitHub 배포' ? <DeploymentManager /> : activeMenu === '통합검색' ? <SearchView query={query} setQuery={setQuery} selectedAgency={selectedAgency} setActiveMenu={setActiveMenu} items={items} /> : <ComingSoon section={activeMenu} />
  const headerTitle = menuItems.find((item) => item.label === activeMenu)?.display ?? activeMenu
  return <main className={`app-shell ${activeMenu !== '통합검색' ? 'analysis-mode' : ''}`}>
    <header className="site-header"><div className="brand-area"><div className="brand-mark" aria-hidden="true"><span>AI</span></div><div><button className="brand" onClick={() => setActiveMenu('통합검색')}>Gov.AX Insight <small>정부 부처 AI 보도자료</small></button><p>정부기관 인공지능 전환(AX) 보도자료를 전해 드립니다</p></div></div><nav className="top-menu" aria-label="주요 메뉴">{menuItems.map((item) => <button key={item.label} onClick={() => setActiveMenu(item.label)} className={activeMenu === item.label ? 'active' : ''}>{item.display}</button>)}<span className="menu-separator" /><span className="source-caption">대한민국 정책브리핑</span></nav></header>
    <div className="workspace"><aside className="left-frame"><div className="sidebar-total"><b>{items.length}</b><span>수집 뉴스 (누적)</span></div><div className="sidebar-search"><input value={query} onChange={(event) => { setQuery(event.target.value); setActiveMenu('통합검색') }} placeholder="제목·기관·키워드 검색" aria-label="통합 검색" /></div><section className="agency-panel"><div className="panel-heading"><span>기관</span><b>보도자료순</b></div><button className={selectedAgency === '전체 기관' ? 'agency-button selected' : 'agency-button'} onClick={() => { setSelectedAgency('전체 기관'); setActiveMenu('통합검색') }}><span>전체 보도자료</span><b>{items.length}</b></button><div className="agency-scroll">{agencies.map(([agency, count]) => <button key={agency} onClick={() => { setSelectedAgency(agency); setActiveMenu('통합검색') }} className={selectedAgency === agency ? 'agency-button selected' : 'agency-button'}><span>{agency}</span><b>{count}</b></button>)}</div></section><div className="coverage"><span>수집 기준</span><b>대한민국 정책브리핑</b><small>원문 링크와 발행일 보존</small></div></aside>
      <section className="content-frame"><div className="content-topline"><span>Gov.AX Insight</span><b>/</b><strong>{headerTitle}</strong></div>{page}</section>
      {activeMenu === '통합검색' && <section className="right-frame"><header><div><span>뉴스</span><h2>{selectedAgency}</h2></div><b className="result-count">{filtered.length}건</b></header><div className="sort-line"><span>발행일 최신순</span><button>필터 <i>⌄</i></button></div><ReleaseList items={filtered} onOpen={setSelected} /></section>}
    </div>
    {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}><article className="release-modal" role="dialog" aria-modal="true" aria-labelledby="release-title" onMouseDown={(event) => event.stopPropagation()}><button className="close-modal" onClick={() => setSelected(null)} aria-label="닫기">×</button><span className="eyebrow">AI 요약 · 검토 완료</span><h2 id="release-title">{selected.title}</h2><div className="meta">{getAgency(selected)} <b>·</b> {selected.regDate.replaceAll('-', '.')}</div><p className="one-line">{selected.dataContents}</p><h3>핵심 내용</h3><ul><li>AI 관련 정책과 현장 활용 기반을 강화하는 내용을 담고 있습니다.</li><li>기관별 추진 과제와 지원 방향을 함께 안내합니다.</li><li>수집된 제목과 부제목을 바탕으로 요약을 제공합니다.</li></ul>{selected.viewUrl ? <a className="source-link" href={selected.viewUrl} target="_blank" rel="noreferrer">정책브리핑 원문 보기 <span aria-hidden="true">↗</span></a> : <div className="source-pending">원문 링크 정보가 없어 실데이터 연결 시 표시됩니다.</div>}</article></div>}
  </main>
}
