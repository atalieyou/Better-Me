# Render 배포 가이드

## 🚀 Render에 배포하는 방법

### 1. Render 계정 생성
1. [render.com](https://render.com)에 접속
2. GitHub 계정으로 로그인
3. "New +" 버튼 클릭

### 2. Web Service 생성
1. "Web Service" 선택
2. GitHub 저장소 연결
3. 저장소 선택: `beauty-ai-app`

### 3. 서비스 설정
- **Name**: `beauty-ai-app`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `node server.js`
- **Plan**: `Free`

### 4. 환경 변수 설정
- **OPENAI_API_KEY**: OpenAI API 키 입력
- **NODE_ENV**: `production`
- **PORT**: `10000` (자동 설정됨)

### 5. 배포 완료
- "Create Web Service" 클릭
- 배포 완료 후 URL 확인

## 📋 배포 후 확인사항

### 환경 변수 확인
- OpenAI API 키가 올바르게 설정되었는지 확인
- 서비스가 정상적으로 시작되는지 확인

### 테스트
1. 배포된 URL로 접속
2. 3장의 사진 업로드
3. AI 분석 진행 확인

## 🔧 문제 해결

### 메모리 부족 오류
- 이미지 압축 강화
- 동시 사용자 수 제한

### API 키 오류
- 환경 변수에서 OPENAI_API_KEY 확인
- API 키 권한 확인

## 📊 무료 플랜 제한사항

- **서버 가동 시간**: 월 750시간
- **메모리**: 512MB
- **CPU**: 제한적
- **대역폭**: 제한적

## 💡 최적화 팁

1. **이미지 압축**: 클라이언트에서 이미지 크기 최적화
2. **캐싱**: 분석 결과 캐싱으로 API 호출 최소화
3. **비동기 처리**: WebSocket을 통한 실시간 업데이트
