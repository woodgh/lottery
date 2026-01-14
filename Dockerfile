FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사
COPY . .

# 컨테이너 실행 시 기본 명령 (필요에 따라 변경 가능)
# 예: 주기적으로 실행하려면 cron 등을 설정해야 하지만, 
# 여기서는 수동 실행을 위해 대기 상태로 두거나 특정 스크립트를 실행하게 할 수 있습니다.
# 일단은 컨테이너가 바로 꺼지지 않도록 대기시킵니다.
CMD ["tail", "-f", "/dev/null"]
