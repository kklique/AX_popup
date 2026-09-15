from __future__ import annotations
import asyncio
import html
import json
import os
import re
import sqlite3
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.getenv('DATABASE_PATH', str(ROOT / 'backend' / 'data' / 'gov_ax.db')))
SEED_PATH = ROOT / 'src' / 'data.json'
AGENCIES = {
    'MSS': '중소벤처기업부', 'MSIT': '과학기술정보통신부', 'MOTIE': '산업통상자원부', 'MOE': '교육부',
    'KIPO': '지식재산처', 'MOIS': '행정안전부', 'MOHW': '보건복지부', 'MAFRA': '농림축산식품부',
    'MOLIT': '국토교통부', 'MOEL': '고용노동부', 'MOFA': '외교부', 'MOJ': '법무부', 'MOEF': '기획재정부',
    'MND': '국방부', 'MOC': '문화체육관광부', 'MOECO': '기후에너지환경부', 'MOGEF': '성평등가족부', 'MOF': '해양수산부',
}
AGENCY_CODES = {name: code for code, name in AGENCIES.items()} | {'산업통상부': 'MOTIE', '기후에너지환경부': 'MOECO', '성평등가족부': 'MOGEF'}
AI_PATTERN = re.compile(r'(인공지능|\bai\b|생성형|피지컬|데이터센터|aidc|llm|인공지능전환|ai 전환)', re.I)
class SettingsIn(BaseModel):
    enabled: bool
    time: str = Field(pattern=r'^\d{2}:\d{2}$')
    scope: list[str]
class ReleaseOut(BaseModel):
    itemId: str
    title: str
    dataContents: str
    writerName: str
    writerPosition: str
    writerPhone: str = ''
    writerEmail: str = ''
    viewUrl: str = ''
    fileName: str = ''
    fileUrl: str = ''
    regDate: str
class CollectionRunOut(BaseModel):
    id: str
    time: str
    target: str
    added: int
    status: Literal['완료', '실패']
    message: str
def db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection
def init_db() -> None:
    with db() as con:
        con.executescript('''
        CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id = 1), enabled INTEGER NOT NULL, run_time TEXT NOT NULL, scope_json TEXT NOT NULL, last_success_date TEXT);
        CREATE TABLE IF NOT EXISTS press_releases (
          item_id TEXT PRIMARY KEY, title TEXT NOT NULL, data_contents TEXT NOT NULL, writer_name TEXT NOT NULL,
          writer_position TEXT NOT NULL, writer_phone TEXT NOT NULL DEFAULT '', writer_email TEXT NOT NULL DEFAULT '',
          view_url TEXT NOT NULL DEFAULT '', file_name TEXT NOT NULL DEFAULT '', file_url TEXT NOT NULL DEFAULT '',
          reg_date TEXT NOT NULL, collected_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_press_releases_date ON press_releases(reg_date DESC);
        CREATE TABLE IF NOT EXISTS collection_runs (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, target TEXT NOT NULL, added INTEGER NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL);
        ''')
        con.execute('INSERT OR IGNORE INTO settings(id, enabled, run_time, scope_json) VALUES(1, 1, ?, ?)', ('07:30', json.dumps(list(AGENCIES))))
        if con.execute('SELECT COUNT(*) FROM press_releases').fetchone()[0] == 0 and SEED_PATH.exists():
            items = json.loads(SEED_PATH.read_text(encoding='utf-8')).get('body', {}).get('items', {}).get('item', [])
            for item in items:
                save_release(con, item)
def save_release(con: sqlite3.Connection, item: dict) -> bool:
    values = (
        item.get('itemId', ''), item.get('title', ''), item.get('dataContents', ''), item.get('writerName', ''),
        item.get('writerPosition', item.get('writerName', '')), item.get('writerPhone', ''), item.get('writerEmail', ''),
        item.get('viewUrl', ''), item.get('fileName', ''), item.get('fileUrl', ''), item.get('regDate', ''), datetime.now().isoformat(),
    )
    before = con.total_changes
    con.execute('''INSERT INTO press_releases(item_id,title,data_contents,writer_name,writer_position,writer_phone,writer_email,view_url,file_name,file_url,reg_date,collected_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(item_id) DO UPDATE SET title=excluded.title,data_contents=excluded.data_contents,writer_name=excluded.writer_name,writer_position=excluded.writer_position,view_url=excluded.view_url,reg_date=excluded.reg_date,collected_at=excluded.collected_at''', values)
    return con.total_changes > before
def settings_payload() -> dict:
    with db() as con:
        row = con.execute('SELECT enabled, run_time, scope_json, last_success_date FROM settings WHERE id=1').fetchone()
        releases = [dict_release(item) for item in con.execute('SELECT * FROM press_releases ORDER BY reg_date DESC, item_id DESC').fetchall()]
        runs = [dict(id=row['id'], time=row['created_at'], target=row['target'], added=row['added'], status=row['status'], message=row['message']) for row in con.execute('SELECT * FROM collection_runs ORDER BY created_at DESC LIMIT 10').fetchall()]
    return {'settings': {'enabled': bool(row['enabled']), 'time': row['run_time'], 'scope': json.loads(row['scope_json'])}, 'runs': runs, 'releases': releases, 'lastSuccessDate': row['last_success_date']}
def dict_release(row: sqlite3.Row) -> dict:
    return {'itemId': row['item_id'], 'title': row['title'], 'dataContents': row['data_contents'], 'writerName': row['writer_name'], 'writerPosition': row['writer_position'], 'writerPhone': row['writer_phone'], 'writerEmail': row['writer_email'], 'viewUrl': row['view_url'], 'fileName': row['file_name'], 'fileUrl': row['file_url'], 'regDate': row['reg_date']}
def clean(value: str) -> str:
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', ' ', value))).strip()
def fetch_official_results(start_date: str, end_date: str) -> list[dict]:
    found: dict[str, dict] = {}
    for word in ('인공지능', 'AI', '생성형 AI'):
        params = urlencode({'srchWord': word, 'startDate': start_date, 'endDate': end_date, 'pageIndex': '1'})
        request = Request(f'https://www.korea.kr/briefing/pressReleaseList.do?{params}', headers={'User-Agent': 'GovAX-Collection/1.0 (official press release index)'})
        with urlopen(request, timeout=20) as response:
            page = response.read().decode('utf-8', errors='ignore')
        pattern = re.compile(r'<li>\s*<a href="([^"]*pressReleaseView\.do\?[^\"]+)"[\s\S]*?<strong>([\s\S]*?)</strong>[\s\S]*?<span class="lead">([\s\S]*?)</span>[\s\S]*?<span class="source">\s*<span>(\d{4}-\d{2}-\d{2})</span>\s*<span>([^<]+)</span>')
        for href, raw_title, raw_lead, reg_date, raw_agency in pattern.findall(page):
            agency = clean(raw_agency)
            code = AGENCY_CODES.get(agency)
            title, lead = clean(raw_title), clean(raw_lead)
            if not code or not AI_PATTERN.search(f'{title} {lead}'):
                continue
            source_url = f"https://www.korea.kr{html.unescape(href)}"
            news_id = re.search(r'newsId=(\d+)', href)
            item_id = f"{code}-{news_id.group(1) if news_id else source_url}"
            found[item_id] = {'itemId': item_id, 'title': title, 'dataContents': lead, 'writerName': agency, 'writerPosition': agency, 'viewUrl': source_url, 'regDate': reg_date}
    return sorted(found.values(), key=lambda item: (item['regDate'], item['itemId']), reverse=True)
def collect_now(start_date: str | None = None, end_date: str | None = None) -> dict:
    state = settings_payload()
    last = state.get('lastSuccessDate')
    start = start_date or ((datetime.strptime(last, '%Y-%m-%d').date() - timedelta(days=1)).isoformat() if last else '2026-01-01')
    today = date.today().isoformat()
    end = end_date or today
    try:
        datetime.strptime(start, '%Y-%m-%d')
        datetime.strptime(end, '%Y-%m-%d')
        if start > end:
            raise ValueError('시작일은 종료일보다 늦을 수 없습니다.')
        incoming = fetch_official_results(start, end)
        permitted = set(state['settings']['scope'])
        selected = [item for item in incoming if item['itemId'].split('-')[0] in permitted]
        with db() as con:
            added = sum(save_release(con, item) for item in selected)
            con.execute('UPDATE settings SET last_success_date=? WHERE id=1', (end,))
            run = (str(int(datetime.now().timestamp() * 1000)), datetime.now().strftime('%Y.%m.%d. %p %I:%M'), f"{len(permitted)}개 기관", added, '완료', f'{start}~{end} 정책브리핑 AI 관련 자료를 확인했습니다.')
            con.execute('INSERT INTO collection_runs VALUES(?,?,?,?,?,?)', run)
        return {'releases': settings_payload()['releases'], 'state': settings_payload()}
    except Exception as error:
        with db() as con:
            con.execute('INSERT INTO collection_runs VALUES(?,?,?,?,?,?)', (str(int(datetime.now().timestamp() * 1000)), datetime.now().strftime('%Y.%m.%d. %p %I:%M'), f"{len(state['settings']['scope'])}개 기관", 0, '실패', str(error)))
        raise HTTPException(status_code=502, detail=f'정책브리핑 수집에 실패했습니다: {error}') from error
async def scheduler() -> None:
    last_marker = ''
    while True:
        now = datetime.now()
        state = settings_payload()['settings']
        marker = now.strftime('%Y-%m-%d-%H:%M')
        if state['enabled'] and state['time'] == now.strftime('%H:%M') and marker != last_marker:
            last_marker = marker
            await asyncio.to_thread(collect_now)
        await asyncio.sleep(25)
@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    task = asyncio.create_task(scheduler())
    yield
    task.cancel()
app = FastAPI(title='Gov.AX Insight API', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(','), allow_methods=['*'], allow_headers=['*'])
@app.get('/api/health')
def health(): return {'status': 'ok', 'database': 'sqlite'}
@app.get('/api/collection/status')
def status(): return settings_payload()
@app.post('/api/collection/settings')
def update_settings(next_settings: SettingsIn):
    allowed = [code for code in next_settings.scope if code in AGENCIES]
    with db() as con:
        con.execute('UPDATE settings SET enabled=?, run_time=?, scope_json=? WHERE id=1', (int(next_settings.enabled), next_settings.time, json.dumps(allowed)))
    return settings_payload()
@app.post('/api/collection/run')
def run_collection(start_date: str | None = None, end_date: str | None = None):
    return collect_now(start_date, end_date)
@app.get('/api/press-releases', response_model=list[ReleaseOut])
def press_releases(query: str = '', agency: str = ''):
    with db() as con:
        rows = con.execute('SELECT * FROM press_releases WHERE (? = "" OR title || " " || data_contents || " " || writer_name LIKE ?) AND (? = "" OR writer_name = ?) ORDER BY reg_date DESC', (query, f'%{query}%', agency, agency)).fetchall()
    return [dict_release(row) for row in rows]
