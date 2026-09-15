import source from './data.json'
export type Release = {
  itemId: string
  title: string
  dataContents: string
  writerName: string
  writerPosition: string
  viewUrl: string
  fileName: string
  fileUrl: string
  regDate: string
}
type SourceData = { body: { items: { item: Release[] } } }
const data = source as SourceData
export const releases = data.body.items.item
export const agencyNames: Record<string, string> = {
  MSS: '중소벤처기업부', MSIT: '과학기술정보통신부', MOTIE: '산업통상자원부', MOE: '교육부', KIPO: '지식재산처',
  MOIS: '행정안전부', MOHW: '보건복지부', MAFRA: '농림축산식품부', MOLIT: '국토교통부', MOEL: '고용노동부',
  MOFA: '외교부', MOJ: '법무부', MOEF: '기획재정부', MND: '국방부', MOC: '문화체육관광부',
  MOECO: '기후에너지환경부', MOGEF: '성평등가족부', MOF: '해양수산부',
}
export function getAgency(source: string | Pick<Release, 'itemId' | 'writerName'>) {
  const itemId = typeof source === 'string' ? source : source.itemId
  return agencyNames[itemId.split('-')[0]] ?? (typeof source === 'string' ? '참여 기관' : source.writerName || '참여 기관')
}
