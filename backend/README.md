# Gov.AX Insight 백엔드

보도자료, 수집 일정, 수집 실행 이력을 SQLite에 보관하는 FastAPI 서버입니다.

## 구성

- `backend/main.py`: API, SQLite 저장, 정책브리핑 수집 작업
- `backend/data/gov_ax.db`: 서버를 처음 실행하면 자동 생성되는 데이터베이스
- `backend/requirements.txt`: 서버 실행에 필요한 도구 목록

## 로컬 실행

```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8787
```

화면 개발 서버는 `/api` 요청을 이 서버로 전달합니다.

## 운영 전환

운영에서는 `DATABASE_PATH` 환경변수로 영속 볼륨 경로를 지정하고, 상시 실행 가능한 호스팅 환경에 이 서버를 배포하세요. AI 요약 API 키를 연결할 경우에도 키는 서버 환경변수에만 보관해야 합니다.
