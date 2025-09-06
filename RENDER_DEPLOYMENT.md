# Render 배포 가이드

## 🚀 Render에 Node.js + Express 앱 배포하기

### 1. GitHub 리포지토리 준비
1. 코드를 GitHub에 푸시
2. 리포지토리가 공개 또는 Render에서 접근 가능한지 확인

### 2. Render 대시보드에서 배포
1. [Render 대시보드](https://dashboard.render.com) 접속
2. "New +" → "Web Service" 선택
3. GitHub 리포지토리 연결

### 3. 배포 설정
```
Name: better-me-app
Environment: Node
Region: Oregon (US West)
Branch: main
Root Directory: (비워두기)
Build Command: npm install
Start Command: npm start
```

### 4. 환경변수 설정
Render 대시보드의 "Environment" 탭에서 다음 환경변수 추가:

```
NODE_ENV=production
OPENAI_API_KEY=your_actual_openai_api_key_here
PORT=10000
```

### 5. CORS 설정 업데이트
배포 후 생성된 URL로 CORS 설정을 업데이트해야 합니다:

1. Render에서 앱 URL 확인 (예: https://better-me-app.onrender.com)
2. `server.js`의 CORS 설정에서 해당 URL 추가

### 6. 프록시 엔드포인트 사용법

#### OpenAI Chat Completions 프록시
```javascript
// 기존 OpenAI API 호출 대신 프록시 사용
const response = await fetch('https://your-app.onrender.com/api/openai/chat/completions', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        messages: [
            { role: 'user', content: 'Hello, how are you?' }
        ],
        model: 'gpt-4o',
        max_tokens: 1000,
        temperature: 0.7
    })
});
```

#### OpenAI Vision 프록시
```javascript
const response = await fetch('https://your-app.onrender.com/api/openai/vision', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...',
        prompt: 'Describe this image',
        model: 'gpt-4o'
    })
});
```

### 7. 보안 장점
- ✅ OpenAI API 키가 클라이언트에 노출되지 않음
- ✅ 서버에서만 API 키 관리
- ✅ 요청 제한 및 로깅 가능
- ✅ 에러 핸들링 중앙화

### 8. 배포 후 확인사항
1. 앱이 정상적으로 시작되는지 확인
2. `/api/status` 엔드포인트 테스트
3. OpenAI 프록시 엔드포인트 테스트
4. CORS 설정 확인

### 9. 모니터링
- Render 대시보드에서 로그 확인
- 서버 상태 모니터링
- API 사용량 추적

## 🔧 문제 해결

### 일반적인 문제들
1. **빌드 실패**: `package.json`의 의존성 확인
2. **환경변수 오류**: Render 대시보드에서 환경변수 재확인
3. **CORS 오류**: 클라이언트 도메인을 CORS 설정에 추가
4. **OpenAI API 오류**: API 키 유효성 확인

### 로그 확인
Render 대시보드의 "Logs" 탭에서 실시간 로그를 확인할 수 있습니다.