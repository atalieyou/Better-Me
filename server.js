const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');
require('dotenv').config();

const { analyzeFaceWithChatGPT5 } = require('./services/gpt4oService');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

// WebSocket 연결 관리
const clients = new Map(); // sessionId -> WebSocket 연결

// WebSocket 연결 처리
wss.on('connection', (ws, req) => {
    console.log('새로운 WebSocket 연결:', req.socket.remoteAddress);
    
    let sessionId = null;
    
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            console.log('WebSocket 메시지 수신:', message.type);
            
            switch (message.type) {
                case 'init_session':
                    sessionId = message.sessionId;
                    clients.set(sessionId, ws);
                    console.log('세션 등록:', sessionId);
                    break;
                    
                    
                default:
                    console.log('알 수 없는 메시지 타입:', message.type);
            }
        } catch (error) {
            console.error('WebSocket 메시지 처리 오류:', error);
        }
    });
    
    ws.on('close', () => {
        if (sessionId) {
            clients.delete(sessionId);
            console.log('WebSocket 연결 종료:', sessionId);
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket 오류:', error);
        if (sessionId) {
            clients.delete(sessionId);
        }
    });
});

// 미들웨어 설정
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://192.168.1.82:3000',
        'https://betterme-ten.vercel.app',
        'https://better-jn20tnnp3-atalies-projects.vercel.app',
        'https://better-hejanbd08-atalies-projects.vercel.app',
        'https://better-4kwtyrx9w-atalies-projects.vercel.app',
        process.env.CORS_ORIGIN
    ].filter(Boolean),
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 정적 파일 서빙 (프론트엔드)
app.use(express.static(__dirname));

// 카카오페이 콜백 라우트
app.get('/kakao-pay/success', (req, res) => {
    console.log('카카오페이 결제 성공 콜백:', req.query);
    
    // 결제 성공 처리
    const { pg_token, partner_order_id, partner_user_id } = req.query;
    
    if (pg_token) {
        // 결제 승인 처리 (실제 구현 시 카카오페이 API 호출)
        console.log('결제 승인 처리:', { pg_token, partner_order_id, partner_user_id });
        
        // 결제 완료 페이지로 리다이렉트
        res.redirect('/?payment=success&step=3');
    } else {
        res.redirect('/?payment=error');
    }
});

app.get('/kakao-pay/cancel', (req, res) => {
    console.log('카카오페이 결제 취소 콜백:', req.query);
    res.redirect('/?payment=cancel&step=2');
});

app.get('/kakao-pay/fail', (req, res) => {
    console.log('카카오페이 결제 실패 콜백:', req.query);
    res.redirect('/?payment=fail&step=2');
});

// 업로드 디렉토리 생성
const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024 // 20MB
    },
    fileFilter: function (req, file, cb) {
        // 이미지 파일만 허용
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
        }
    }
});

// 분석 결과 저장용 메모리 저장소 (실제 운영에서는 데이터베이스 사용 권장)
const analysisResults = new Map();

// 분석 진행 상태 관리용 메모리 저장소
const analysisProgress = new Map();

// 라우트 설정
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API 상태 확인
app.get('/api/status', (req, res) => {
    res.json({ 
        message: 'Beauty AI App Backend Server',
        version: '1.0.0',
        status: 'running'
    });
});

// OpenAI 프록시 엔드포인트 (키 숨김)
app.post('/api/openai/chat/completions', async (req, res) => {
    try {
        const { messages, model = 'gpt-4o', max_tokens = 1000, temperature = 0.7 } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model,
            messages,
            max_tokens,
            temperature
        }, {
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('OpenAI API Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'OpenAI API request failed',
            message: error.response?.data?.error?.message || error.message
        });
    }
});

// OpenAI 이미지 분석 프록시 엔드포인트
app.post('/api/openai/vision', async (req, res) => {
    try {
        const { image, prompt, model = 'gpt-4o' } = req.body;
        
        if (!image || !prompt) {
            return res.status(400).json({ error: 'Image and prompt are required' });
        }

        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: image } }
                    ]
                }
            ],
            max_tokens: 1000
        }, {
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('OpenAI Vision API Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'OpenAI Vision API request failed',
            message: error.response?.data?.error?.message || error.message
        });
    }
});

// 얼굴 분석 API (3장 이미지 지원)
app.post('/api/analyze-face', upload.fields([
    { name: 'front', maxCount: 1 },
    { name: 'side45', maxCount: 1 },
    { name: 'side90', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || !req.files.front || !req.files.side45 || !req.files.side90) {
            return res.status(400).json({ 
                error: '정면, 45도 측면, 90도 측면 사진이 모두 필요합니다.' 
            });
        }

        console.log('3장 이미지 업로드 완료:', {
            front: req.files.front[0].filename,
            side45: req.files.side45[0].filename,
            side90: req.files.side90[0].filename
        });

        // 세션 ID 생성
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 분석 시작 상태 등록
        analysisProgress.set(sessionId, {
            sessionId,
            status: 'analyzing',
            progress: 0,
            message: 'AI 분석 시작...',
            updatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        });
        
        console.log('분석 세션 시작:', sessionId);
        
        // 3장 사진 모두 ChatGPT에 전송하여 얼굴 분석 요청
        const analysisResult = await analyzeFaceWithChatGPT5([
            req.files.front[0].path,
            req.files.side45[0].path,
            req.files.side90[0].path
        ], sessionId); // 세션 ID 전달

        // 분석 완료 후 모든 업로드된 파일 삭제
        Object.values(req.files).forEach(files => {
            files.forEach(file => {
                fs.unlinkSync(file.path);
            });
        });

        // 분석 완료 상태 업데이트
        analysisProgress.set(sessionId, {
            sessionId,
            status: 'completed',
            progress: 100,
            message: 'AI 분석 완료!',
            updatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        });
        
        // AI 거부 응답인지 확인
        if (analysisResult.error === 'ai_refusal') {
            // AI 거부 시 실패 상태로 업데이트
            analysisProgress.set(sessionId, {
                sessionId,
                status: 'failed',
                progress: 0,
                message: 'AI 분석 거부됨',
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            });
            
            res.json({
                success: false,
                error: 'ai_refusal',
                reason: analysisResult.reason,
                details: analysisResult.details,
                sessionId: sessionId
            });
        } else {
            // AI 응답만 깔끔하게 추출해서 전송
            const cleanAnalysis = {
                analysis: analysisResult.raw_analysis || 'AI 분석 결과를 가져올 수 없습니다.'
            };
            
            res.json({
                success: true,
                analysis: cleanAnalysis,
                sessionId: sessionId
            });
        }

    } catch (error) {
        console.error('얼굴 분석 오류:', error);
        
        // 오류 발생 시 업로드된 파일 삭제
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: '얼굴 분석 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});


// 분석 결과 저장 API
app.post('/api/save-analysis-result', async (req, res) => {
    try {
        const { analysisResult, uploadedImages } = req.body;
        
        if (!analysisResult) {
            return res.status(400).json({ 
                error: '분석 결과가 필요합니다.' 
            });
        }

        // 고유 ID 생성 (타임스탬프 + 랜덤 문자열)
        const resultId = `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 결과 저장
        analysisResults.set(resultId, {
            id: resultId,
            analysisResult,
            uploadedImages,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7일 후 만료
        });

        console.log('분석 결과 저장 완료:', resultId);
        
        res.json({
            success: true,
            resultId: resultId,
            shareUrl: `http://localhost:3000/share/${resultId}`
        });

    } catch (error) {
        console.error('분석 결과 저장 오류:', error);
        
        res.status(500).json({
            error: '분석 결과 저장 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 분석 진행 상태 조회 API
app.get('/api/analysis-progress/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        if (!sessionId) {
            return res.status(400).json({ 
                error: '세션 ID가 필요합니다.' 
            });
        }

        const progress = analysisProgress.get(sessionId);
        
        if (!progress) {
            return res.status(404).json({
                error: '분석 진행 상태를 찾을 수 없습니다.',
                details: '세션이 만료되었거나 잘못된 세션입니다.'
            });
        }

        console.log('분석 진행 상태 조회 완료:', sessionId, progress);
        
        res.json({
            success: true,
            progress: progress
        });

    } catch (error) {
        console.error('분석 진행 상태 조회 오류:', error);
        
        res.status(500).json({
            error: '분석 진행 상태 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 분석 진행 상태 업데이트 API
app.post('/api/update-analysis-progress', async (req, res) => {
    try {
        const { sessionId, status, progress, message } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ 
                error: '세션 ID가 필요합니다.' 
            });
        }

        // 진행 상태 업데이트
        analysisProgress.set(sessionId, {
            sessionId,
            status, // 'analyzing', 'completed', 'failed'
            progress, // 0-100
            message,
            updatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30분 후 만료
        });

        console.log('분석 진행 상태 업데이트 완료:', sessionId, { status, progress, message });
        
        res.json({
            success: true,
            message: '진행 상태가 업데이트되었습니다.'
        });

    } catch (error) {
        console.error('분석 진행 상태 업데이트 오류:', error);
        
        res.status(500).json({
            error: '분석 진행 상태 업데이트 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 공유 링크로 결과 조회 API
app.get('/api/get-analysis-result/:resultId', async (req, res) => {
    try {
        const { resultId } = req.params;
        
        if (!resultId) {
            return res.status(400).json({ 
                error: '결과 ID가 필요합니다.' 
            });
        }

        const result = analysisResults.get(resultId);
        
        if (!result) {
            return res.status(404).json({
                error: '분석 결과를 찾을 수 없습니다.',
                details: '링크가 만료되었거나 잘못된 링크입니다.'
            });
        }

        // 만료 확인
        if (new Date() > new Date(result.expiresAt)) {
            analysisResults.delete(resultId);
            return res.status(410).json({
                error: '분석 결과가 만료되었습니다.',
                details: '링크는 7일간 유효합니다.'
            });
        }

        console.log('분석 결과 조회 완료:', resultId);
        
        res.json({
            success: true,
            result: result
        });

    } catch (error) {
        console.error('분석 결과 조회 오류:', error);
        
        res.status(500).json({
            error: '분석 결과 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});



// 서버 상태 확인 API
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 에러 핸들링 미들웨어
app.use((error, req, res, next) => {
    console.error('서버 오류:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                error: '파일 크기가 너무 큽니다. 10MB 이하의 파일을 업로드해주세요.' 
            });
        }
    }
    
    res.status(500).json({ 
        error: '서버 내부 오류가 발생했습니다.' 
    });
});

// 공유 링크 페이지 (404 처리 전에 추가)
app.get('/share/:resultId', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 처리
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: '요청한 엔드포인트를 찾을 수 없습니다.' 
    });
});

// 서버 시작
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Better me App Backend Server가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📁 업로드 디렉토리: ${uploadDir}`);
    console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5500'}`);
    console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '설정됨' : '설정되지 않음'}`);
    console.log(`🔗 로컬 접속: http://localhost:${PORT}`);
    console.log(`🔗 네트워크 접속: http://192.168.1.82:${PORT}`);
    console.log(`📱 모바일 접속: http://192.168.1.82:${PORT}`);
    console.log(`🔌 WebSocket 서버가 활성화되었습니다.`);
});

// 에러 핸들링
server.on('error', (error) => {
    console.error('서버 오류:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`포트 ${PORT}가 이미 사용 중입니다.`);
    }
});

process.on('uncaughtException', (error) => {
    console.error('처리되지 않은 예외:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('처리되지 않은 Promise 거부:', reason);
    process.exit(1);
});

module.exports = app;
