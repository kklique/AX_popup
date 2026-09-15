import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getAgency, type Release } from '../data'

type Topic = '정책' | '산업' | '데이터·인프라' | '국제협력' | '규제·안전' | '공공 AX'
type NetworkNode = { label: string; recent: number; previous: number; increase: number; x: number; y: number }
type NetworkEdge = { from: string; to: string; weight: number; x1: number; y1: number; x2: number; y2: number }

const topics: Topic[] = ['정책', '산업', '데이터·인프라', '국제협력', '규제·안전', '공공 AX']
const topicRules: Record<Topic, string[]> = {
  '정책': ['법', '정책', '토론회', '회의'],
  '산업': ['제조', '에너지', '혁신', '산업'],
  '데이터·인프라': ['데이터센터', '데이터', '컴퓨팅', '디지털'],
  '국제협력': ['중앙아시아', '보츠와나', 'apec', '국제', '세계'],
  '규제·안전': ['안보', '법령', '안전'],
  '공공 AX': ['정부', '공공', '행정'],
}
const keywordRules: Record<string, string[]> = {
  '인공지능': ['인공지능', 'ai'],
  '국제협력': ['중앙아시아', '보츠와나', 'apec', '국제'],
  '데이터센터': ['데이터센터', 'aidc'],
  '디지털': ['디지털'],
  '에너지': ['에너지'],
  '제조혁신': ['제조', '스마트제조'],
  '안보': ['안보', '드론', '우주'],
}
const positions = [[50, 50], [18, 25], [82, 24], [25, 79], [76, 79], [52, 13]]

function hasRule(text: string, words: string[]) { return words.some((word) => text.includes(word)) }
function fullText(item: Release) { return `${item.title} ${item.dataContents}`.toLowerCase() }
function matchedKeywords(item: Release) {
  const text = fullText(item)
  return Object.entries(keywordRules).filter(([, rules]) => hasRule(text, rules.map((word) => word.toLowerCase()))).map(([label]) => label)
}
function releaseTopics(item: Release) {
  const text = fullText(item)
  return topics.filter((topic) => hasRule(text, topicRules[topic].map((word) => word.toLowerCase())))
}
function StatCard({ label, value, unit, note }: { label: string; value: number; unit: string; note: string }) {
  return <article className="stat-card"><span>{label}</span><b>{value}<small>{unit}</small></b><p>{note}</p></article>
}
function makeNetwork(releases: Release[]) {
  const latestDate = Math.max(...releases.map((item) => new Date(`${item.regDate}T00:00:00`).getTime()))
  const recentStart = latestDate - 3 * 24 * 60 * 60 * 1000
  const previousStart = recentStart - 4 * 24 * 60 * 60 * 1000
  const recent = releases.filter((item) => new Date(`${item.regDate}T00:00:00`).getTime() >= recentStart)
  const previous = releases.filter((item) => {
    const date = new Date(`${item.regDate}T00:00:00`).getTime()
    return date >= previousStart && date < recentStart
  })
  const count = (items: Release[], label: string) => items.filter((item) => matchedKeywords(item).includes(label)).length
  const nodes = Object.keys(keywordRules).map((label) => ({ label, recent: count(recent, label), previous: count(previous, label) }))
    .filter((item) => item.recent > 0 && item.recent > item.previous)
    .sort((a, b) => b.recent - b.previous - (a.recent - a.previous) || b.recent - a.recent)
    .slice(0, 6)
    .map((item, index) => ({ ...item, increase: item.recent - item.previous, x: positions[index][0], y: positions[index][1] }))
  const nodeMap = new Map(nodes.map((node) => [node.label, node]))
  const weights = new Map<string, number>()
  recent.forEach((item) => {
    const keywords = matchedKeywords(item).filter((label) => nodeMap.has(label))
    keywords.forEach((from, fromIndex) => keywords.slice(fromIndex + 1).forEach((to) => {
      const key = [from, to].sort().join('|')
      weights.set(key, (weights.get(key) ?? 0) + 1)
    }))
  })
  const edges: NetworkEdge[] = [...weights.entries()].map(([key, weight]) => {
    const [from, to] = key.split('|')
    const fromNode = nodeMap.get(from)!
    const toNode = nodeMap.get(to)!
    return { from, to, weight, x1: fromNode.x, y1: fromNode.y, x2: toNode.x, y2: toNode.y }
  })
  return { nodes, edges, recentRange: recent.length, previousRange: previous.length }
}

export function Dashboard({ releases, onMonthlyStats }: { releases: Release[]; onMonthlyStats: () => void }) {
  const heatmap = useMemo(() => {
    const agencies = [...new Set(releases.map((item) => getAgency(item.itemId)))]
    return agencies.map((agency) => ({ agency, values: topics.map((topic) => releases.filter((item) => getAgency(item.itemId) === agency && releaseTopics(item).includes(topic)).length) }))
  }, [releases])
  const network = useMemo(() => makeNetwork(releases), [releases])
  const maxValue = Math.max(1, ...heatmap.flatMap((row) => row.values))
  return <div className="analytics-page"><div className="analytics-heading"><div><span className="eyebrow">AI POLICY SIGNALS</span><h1>부처별 <em>AI 이슈 지형</em></h1><p>수집된 보도자료의 제목과 부제목에서 확인되는 세부 주제 분포입니다.</p></div><button className="analytics-action" onClick={onMonthlyStats}>월별 통계 보기 <b>→</b></button></div><section className="stat-grid"><StatCard label="분석 대상 보도자료" value={releases.length} unit="건" note="현재 저장된 AI 관련 자료" /><StatCard label="발표 기관" value={new Set(releases.map((item) => getAgency(item.itemId))).size} unit="곳" note="자료를 낸 참여 기관" /><StatCard label="확인된 세부 주제" value={topics.filter((topic) => heatmap.some((row) => row.values[topics.indexOf(topic)] > 0)).length} unit="개" note="키워드 기준 분류" /></section><section className="insight-card heatmap-card"><div className="section-title"><div><span>부처별 세부 주제</span><h2>AI 정책 히트맵</h2></div><p>진할수록 해당 주제를 포함한 보도자료가 많습니다.</p></div><div className="heatmap-wrap"><div className="heatmap"><div className="heatmap-row heatmap-head"><span>기관</span>{topics.map((topic) => <b key={topic}>{topic}</b>)}</div>{heatmap.map((row) => <div className="heatmap-row" key={row.agency}><strong>{row.agency}</strong>{row.values.map((value, index) => <span key={`${row.agency}-${topics[index]}`} className="heat-cell" style={{ '--level': value / maxValue } as React.CSSProperties} aria-label={`${row.agency} ${topics[index]} ${value}건`}><i>{value || '–'}</i></span>)}</div>)}</div></div></section><section className="insight-card network-card"><div className="section-title"><div><span>최근 4일 대비 직전 4일</span><h2>급증 키워드 관계망</h2></div><p>증가한 키워드만 표시하고, 최근 기간의 동일 보도자료 동시 언급을 선으로 연결합니다.</p></div>{network.nodes.length && network.edges.length ? <><div className="network-summary"><span>급증 키워드 {network.nodes.length}개</span><span>최근 자료 {network.recentRange}건 · 비교 자료 {network.previousRange}건</span></div><div className="keyword-network" aria-label="급증 키워드 관계망"><svg className="network-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{network.edges.map((edge) => <line key={`${edge.from}-${edge.to}`} x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} strokeWidth={0.6 + edge.weight * 0.55} />)}</svg>{network.nodes.map((node) => <div className="network-node dynamic-node" style={{ left: `${node.x}%`, top: `${node.y}%`, '--node-size': `${82 + node.increase * 14}px` } as React.CSSProperties} key={node.label}><b>{node.label}</b><span>+{node.increase}건</span></div>)}</div></> : <div className="empty-state"><b>급증 관계를 확인할 자료가 아직 부족합니다.</b><span>비교 기간보다 최근 기간에 증가하고 함께 언급된 키워드가 쌓이면 관계망이 표시됩니다.</span></div>}</section></div>
}

export function MonthlyStats({ releases }: { releases: Release[] }) {
  const rows = useMemo(() => {
    const byMonth = releases.reduce<Record<string, Release[]>>((result, item) => { const month = item.regDate.slice(0, 7); result[month] = [...(result[month] ?? []), item]; return result }, {})
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, items]) => ({ month: month.replace('-', '.'), 보도자료: items.length, 기관수: new Set(items.map((item) => getAgency(item.itemId))).size }))
  }, [releases])
  return <div className="analytics-page"><div className="analytics-heading"><div><span className="eyebrow">MONTHLY COLLECTION STATUS</span><h1>월별 <em>수집 통계</em></h1><p>수집 완료된 보도자료를 월별 건수와 발표 기관 수로 확인합니다.</p></div><span className="data-note">발행일 기준 집계</span></div><section className="stat-grid"><StatCard label="누적 보도자료" value={releases.length} unit="건" note="현재 화면에 연결된 자료" /><StatCard label="누적 발표 기관" value={new Set(releases.map((item) => getAgency(item.itemId))).size} unit="곳" note="중복을 제외한 기관 수" /><StatCard label="집계 월" value={rows.length} unit="개월" note="발행일이 확인된 기간" /></section><section className="insight-card monthly-chart-card"><div className="section-title"><div><span>발행일 기준</span><h2>월별 보도자료·기관 수</h2></div><p>데이터가 추가되면 이전·이후 월도 자동 반영됩니다.</p></div><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} barGap={6} margin={{ top: 8, left: -18, right: 8, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e3ebf0" vertical={false} /><XAxis dataKey="month" tick={{ fill: '#758597', fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#758597', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: '#edf8f7' }} /><Bar dataKey="보도자료" radius={[5, 5, 0, 0]} fill="#173e72" /><Bar dataKey="기관수" radius={[5, 5, 0, 0]} fill="#14a19b" /></BarChart></ResponsiveContainer></div><div className="table-wrap"><table><thead><tr><th>월</th><th>보도자료</th><th>작성 기관 수</th></tr></thead><tbody>{rows.map((row) => <tr key={row.month}><td>{row.month}</td><td>{row.보도자료}건</td><td>{row.기관수}곳</td></tr>)}</tbody></table></div></section></div>
}
