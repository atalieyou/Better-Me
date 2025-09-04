# Beauty AI App 설정 가이드

## 🚀 빠른 시작

### 1. Node.js 설치

#### macOS (Homebrew 사용)
```bash
# Homebrew 설치 (없는 경우)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 설치
brew install node

# 설치 확인
node --version
npm --version
```

#### macOS (직접 다운로드)
1. [Node.js 공식 사이트](https://nodejs.org/)에서 LTS 버전 다운로드
2. 다운로드한 .pkg 파일 실행하여 설치

#### Windows
1. [Node.js 공식 사이트](https://nodejs.org/)에서 LTS 버전 다운로드
2. 다운로드한 .msi 파일 실행하여 설치

#### Linux (Ubuntu/Debian)
```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -

# Node.js 설치
sudo apt-get install -y nodejs

# 설치 확인
node --version
npm --version
```

### 2. 프로젝트 설정

```bash
# 의존성 설치
npm install

# 환경 변수 파일 생성
cp env.example .env
```

### 3. OpenAI API 키 설정

1. [OpenAI Platform](https://platform.openai.com/)에 가입
2. API 키 생성
3. `.env` 파일에 API 키 입력:
```env
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 4. 서버 실행

```bash
# 개발 모드 (자동 재시작)
npm run dev

# 또는 프로덕션 모드
npm start
```

### 5. 프론트엔드 실행

**VS Code Live Server 사용 (권장):**
1. VS Code에서 Live Server 확장 프로그램 설치
2. `index.html` 파일 우클릭 → "Open with Live Server" 선택

**Python HTTP 서버 사용:**
```bash
# Python 3
python -m http.server 5500

# Python 2
python -m SimpleHTTPServer 5500
```

**Node.js serve 사용:**
```bash
npx serve . -p 5500
```

## 🔧 환경 변수 설정

`.env` 파일에 다음 내용을 설정하세요:

```env
# OpenAI API 설정
OPENAI_API_KEY=your_openai_api_key_here

# 서버 설정
PORT=3000
NODE_ENV=development

# 파일 업로드 설정
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# CORS 설정
CORS_ORIGIN=http://localhost:5500
```

## 📱 사용 방법

### 1. 브라우저에서 접속
- 프론트엔드: `http://localhost:5500`
- 백엔드: `http://localhost:3000`

### 2. 이미지 업로드
- 정면 사진 업로드 (최대 10MB)
- 지원 형식: JPG, PNG, WEBP

### 3. AI 분석
- GPT-4o API를 통한 자동 얼굴 분석
- 실시간 진행률 표시

### 4. 결과 확인
- 상세한 외모 분석 결과
- 포인트 등급 (S+ ~ F)
- 구체적인 개선 방안

## 🚨 문제 해결

### npm install 오류
```bash
# Node.js 버전 확인
node --version

# npm 캐시 정리
npm cache clean --force

# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install
```

### 포트 충돌
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :3000
lsof -i :5500

# 프로세스 종료
kill -9 <PID>
```

### CORS 오류
- `.env` 파일의 `CORS_ORIGIN` 설정 확인
- 프론트엔드와 백엔드 포트 설정 확인

### OpenAI API 오류
- API 키가 올바르게 설정되었는지 확인
- API 사용량 및 크레딧 확인
- 네트워크 연결 상태 확인

## 🔒 보안 주의사항

1. **API 키 보안**
   - `.env` 파일을 `.gitignore`에 추가
   - API 키를 공개 저장소에 업로드하지 않음
   - 프로덕션 환경에서는 환경 변수로 설정

2. **파일 업로드 보안**
   - 이미지 파일 형식 검증
   - 파일 크기 제한 (10MB)
   - 업로드된 파일은 분석 완료 후 즉시 삭제

3. **개인정보 보호**
   - 업로드된 이미지는 서버에 저장하지 않음
   - 분석 결과는 클라이언트에만 전송

## 📊 성능 최적화

### 이미지 처리
- Sharp 라이브러리를 사용한 이미지 최적화
- 적절한 이미지 크기 및 형식 권장

### API 응답 시간
- GPT-4o API 응답 시간 최적화
- 진행률 표시로 사용자 경험 향상

## 🚀 배포 준비

### 프로덕션 환경 변수
```env
NODE_ENV=production
PORT=process.env.PORT
CORS_ORIGIN=https://yourdomain.com
```

### PM2 사용 (권장)
```bash
# PM2 설치
npm install -g pm2

# 애플리케이션 시작
pm2 start server.js --name "beauty-ai-app"

# 상태 확인
pm2 status

# 로그 확인
pm2 logs beauty-ai-app
```

## 📞 지원

문제가 발생하거나 도움이 필요한 경우:
1. GitHub Issues에 문제 보고
2. 프로젝트 문서 확인
3. Node.js 및 Express.js 공식 문서 참조

---

**Happy Coding! 🎉**
