# Beauty AI App - AI 외모 분석 및 성형외과 상담

AI 기술을 활용하여 고객의 얼굴 이미지를 분석하고 성형외과 상담 실장처럼 구체적이고 객관적인 외모 피드백을 제공하는 웹 애플리케이션입니다.

## 🚀 주요 기능

- **AI 얼굴 분석**: GPT-4o API를 활용한 정밀한 얼굴 분석
- **성형외과 상담**: 전문적인 외모 피드백 및 개선 방안 제시
- **구체적 분석 항목**:
  - 얼굴형 (달걀형, 둥근형, 땅콩형, 마름모형, 하트형, 육각형)
  - 얼굴 비율 (상안부, 중안부, 하안부)
  - 피부 상태 (여드름, 흉터, 모공크기, 유분기, 피부 색감)
  - 눈 분석 (쌍커풀, 눈동자 크기, 눈꼬리 위치 등)
  - 코 분석 (길이, 너비, 콧망울, 콧볼 비율)
  - 입 분석 (모양, 비율, 조화로움)
- **포인트 등급**: 성형견적 기준 S+ ~ F 등급 시스템
- **개선 방안**: 구체적인 화장법, 시술, 수술 추천

## 🛠️ 기술 스택

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- 반응형 웹 디자인
- Font Awesome 아이콘
- Google Fonts (Noto Sans KR)

### Backend
- Node.js
- Express.js
- OpenAI GPT-4o API
- Multer (파일 업로드)
- CORS 지원

## 📋 설치 및 설정

### 1. 저장소 클론
```bash
git clone <repository-url>
cd beauty-ai-app
```

### 2. 백엔드 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env` 파일을 생성하고 다음 내용을 입력하세요:

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

### 4. OpenAI API 키 발급
1. [OpenAI Platform](https://platform.openai.com/)에 가입
2. API 키 생성
3. `.env` 파일에 API 키 입력

## 🚀 실행 방법

### 백엔드 서버 실행
```bash
# 개발 모드 (자동 재시작)
npm run dev

# 프로덕션 모드
npm start
```

### 프론트엔드 실행
프론트엔드는 정적 파일이므로 Live Server나 다른 정적 파일 서버를 사용하여 실행할 수 있습니다.

**VS Code Live Server 사용:**
1. VS Code에서 Live Server 확장 프로그램 설치
2. `index.html` 파일 우클릭 → "Open with Live Server" 선택

**Python HTTP 서버 사용:**
```bash
# Python 3
python -m http.server 5500

# Python 2
python -m SimpleHTTPServer 5500
```

## 📱 사용 방법

### 1. 사진 활용 동의
- 서비스 이용약관 및 개인정보 처리 동의
- 필수 동의 항목 체크

### 2. 사진 업로드
- 정면 사진 업로드 (최대 10MB)
- 지원 형식: JPG, PNG, WEBP
- 드래그 앤 드롭 지원

### 3. AI 분석
- GPT-4o API를 통한 자동 얼굴 분석
- 실시간 진행률 표시

### 4. 피드백 제공
- 종합 평가 및 포인트 등급
- 상세한 외모 분석 결과
- 구체적인 개선 방안 제시

### 5. 결과 확인
- 원본 vs 개선된 이미지 비교
- 적용된 개선사항 요약
- 결과 이미지 다운로드

## 🔧 API 엔드포인트

### POST /api/analyze-face
얼굴 이미지 분석 API

**Request:**
- `Content-Type: multipart/form-data`
- `image`: 분석할 이미지 파일

**Response:**
```json
{
  "success": true,
  "analysis": {
    "얼굴형": "긴 달걀형",
    "얼굴비율": "상안부:중안부:하안부 = 1:1.2:1.1",
    "피부상태": "피부 톤이 고르고...",
    "눈": "쌍커풀이 있고...",
    "코": "코 길이가 적당하고...",
    "입": "입술 비율이 조화롭고...",
    "결론": "전반적으로 우아한 분위기...",
    "포인트": "S+",
    "피드백": "개선 방안..."
  }
}
```

### GET /api/health
서버 상태 확인 API

## 📁 프로젝트 구조

```
beauty-ai-app/
├── index.html          # 메인 HTML 파일
├── styles.css          # CSS 스타일시트
├── script.js           # 프론트엔드 JavaScript
├── server.js           # Express.js 서버
├── package.json        # Node.js 의존성
├── env.example         # 환경 변수 예시
├── services/
│   └── gpt4oService.js # GPT-4o API 서비스
├── uploads/            # 업로드된 이미지 임시 저장소
└── README.md           # 프로젝트 문서
```

## ⚠️ 주의사항

1. **API 키 보안**: OpenAI API 키를 공개 저장소에 업로드하지 마세요
2. **파일 크기**: 업로드 가능한 이미지 크기는 최대 10MB입니다
3. **개인정보**: 업로드된 이미지는 분석 완료 후 즉시 삭제됩니다
4. **API 사용량**: OpenAI API 사용량에 따른 비용이 발생할 수 있습니다

## 🚀 배포

### Heroku 배포
```bash
# Heroku CLI 설치 후
heroku create your-app-name
heroku config:set OPENAI_API_KEY=your_api_key
git push heroku main
```

### Vercel 배포
```bash
# Vercel CLI 설치 후
vercel --prod
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해 주세요.

---

**Made with ❤️ by Beauty AI App Team**
