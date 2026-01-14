# 🎱 Lottery Prediction Bot (Dockerized)

이 프로젝트는 Docker와 Redis를 사용하여 로또 당첨 번호를 자동으로 수집하고, 중복되지 않는 예측 번호를 생성하여 텔레그램으로 전송해주는 봇입니다.

## ✨ 주요 기능
- **자동 데이터 수집:** 동행복권 API를 통해 역대 모든 당첨 이력을 Redis에 적재합니다.
- **번호 분석 및 예측:** 역대 이력과 겹치지 않는 새로운 번호 조합 3개를 생성합니다.
- **결과 채점:** 지난주 예측 결과(당첨 여부)를 자동으로 확인하여 알려줍니다.
- **텔레그램 알림:** 매주 분석 리포트를 깔끔한 메시지로 받아볼 수 있습니다.
- **자동 종료:** 작업이 완료되면 컨테이너가 자동으로 종료되어 리소스를 절약합니다.

## 🛠️ 설정 방법 (필수)

프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 아래 내용을 입력해야 합니다.

**`.env` 예시:**
```env
# 텔레그램 봇 설정 (필수)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Redis 설정 (Docker Compose 사용 시 기본값 유지)
REDIS_HOST=redis
REDIS_PORT=6379

# 타임존 설정 (한국 시간)
TZ=Asia/Seoul
```

## 🚀 실행 방법

### 1. 소스 코드로 직접 실행 (Docker Compose)
이 저장소를 클론(Clone) 받은 후 아래 명령어로 실행합니다.

```bash
# 실행 (작업 완료 후 봇과 Redis가 모두 종료됩니다)
docker compose up --exit-code-from app
```

### 2. GitHub Registry 이미지 사용 (Docker Pull)
이미 빌드된 이미지를 받아 실행하려면 아래 명령어를 사용합니다. (GHCR 권한 설정 필요)

```bash
# 이미지 다운로드
docker pull ghcr.io/사용자명/lottery-bot:latest

# 실행 (환경변수 주입 필요)
docker run --rm --env-file .env ghcr.io/사용자명/lottery-bot:latest
```
*(참고: `docker-compose.yml`을 사용하여 Redis와 함께 실행하는 것을 권장합니다.)*

## ⏰ 자동 실행 설정 (Cron)

매주 토요일 저녁 10시(22:00)에 자동으로 실행되도록 서버의 Crontab에 등록합니다.

1. **Crontab 편집 모드 진입**
   ```bash
   sudo crontab -e
   ```

2. **아래 내용을 맨 아래에 추가**
   (프로젝트 경로가 `~/lottery`라고 가정합니다.)

   ```cron
   # 매주 토요일 22:00 실행 (로그는 cron.log에 저장)
   0 22 * * 6 cd /root/lottery && /usr/bin/docker compose up --exit-code-from app >> /root/lottery/cron.log 2>&1
   ```

   - `cd /root/lottery`: 프로젝트 경로로 이동 (사용자 환경에 맞게 수정하세요)
   - `docker compose`: 최신 버전 Docker는 `docker-compose` 대신 `docker compose`를 사용합니다.

## 📁 디렉토리 구조
```
.
├── docker-compose.yml  # Docker 서비스 정의
├── Dockerfile          # Node.js 앱 이미지 빌드 설정
├── package.json        # 의존성 및 스크립트
├── migration.js        # 데이터 수집 및 마이그레이션 로직
├── predict.js          # 번호 예측 및 텔레그램 전송 로직
├── .env                # 환경 변수 (직접 생성 필요)
└── README.md           # 설명서
```
