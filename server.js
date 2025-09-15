const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const { analyzeFaceWithChatGPT5, analyzeMakeupTipsWithImages } = require('./services/gpt4oService');

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
        'http://192.168.1.82:8080',  // Python HTTP 서버 허용
        'https://betterme-ten.vercel.app',
        'https://better-jn20tnnp3-atalies-projects.vercel.app',
        'https://better-hejanbd08-atalies-projects.vercel.app',
        'https://better-4kwtyrx9w-atalies-projects.vercel.app',
        'https://better-me-3805.onrender.com',
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

// 카카오페이 결제 준비 API
app.post('/api/payment/kakao/ready', async (req, res) => {
    try {
        const { amount = 29000, item_name = '헤어/메이크업 팁 패키지', user_id = 'user' } = req.body;
        
        // 카카오페이 API 설정
        const KAKAO_PAY_ADMIN_KEY = process.env.KAKAO_PAY_ADMIN_KEY;
        if (!KAKAO_PAY_ADMIN_KEY) {
            return res.status(500).json({ error: '카카오페이 설정이 필요합니다.' });
        }

        const partner_order_id = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const partner_user_id = user_id;
        const quantity = 1;
        const total_amount = amount;
        const tax_free_amount = 0;
        const approval_url = `${req.protocol}://${req.get('host')}/kakao-pay/success`;
        const cancel_url = `${req.protocol}://${req.get('host')}/kakao-pay/cancel`;
        const fail_url = `${req.protocol}://${req.get('host')}/kakao-pay/fail`;

        const kakaoPayData = {
            cid: 'TC0ONETIME', // 테스트용 CID
            partner_order_id,
            partner_user_id,
            item_name,
            quantity,
            total_amount,
            tax_free_amount,
            approval_url,
            cancel_url,
            fail_url
        };

        const response = await axios.post('https://kapi.kakao.com/v1/payment/ready', kakaoPayData, {
            headers: {
                'Authorization': `KakaoAK ${KAKAO_PAY_ADMIN_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
            }
        });

        console.log('카카오페이 결제 준비 성공:', response.data);
        
        res.json({
            success: true,
            tid: response.data.tid,
            next_redirect_pc_url: response.data.next_redirect_pc_url,
            next_redirect_mobile_url: response.data.next_redirect_mobile_url,
            next_redirect_app_url: response.data.next_redirect_app_url,
            android_app_scheme: response.data.android_app_scheme,
            ios_app_scheme: response.data.ios_app_scheme,
            created_at: response.data.created_at
        });

    } catch (error) {
        console.error('카카오페이 결제 준비 오류:', error.response?.data || error.message);
        res.status(500).json({
            error: '카카오페이 결제 준비 중 오류가 발생했습니다.',
            details: error.response?.data?.message || error.message
        });
    }
});

// 카카오페이 결제 승인 API
app.post('/api/payment/kakao/approve', async (req, res) => {
    try {
        const { tid, pg_token, partner_order_id, partner_user_id } = req.body;
        
        if (!tid || !pg_token) {
            return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
        }

        const KAKAO_PAY_ADMIN_KEY = process.env.KAKAO_PAY_ADMIN_KEY;
        if (!KAKAO_PAY_ADMIN_KEY) {
            return res.status(500).json({ error: '카카오페이 설정이 필요합니다.' });
        }

        const approveData = {
            cid: 'TC0ONETIME',
            tid,
            partner_order_id,
            partner_user_id,
            pg_token
        };

        const response = await axios.post('https://kapi.kakao.com/v1/payment/approve', approveData, {
            headers: {
                'Authorization': `KakaoAK ${KAKAO_PAY_ADMIN_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
            }
        });

        console.log('카카오페이 결제 승인 성공:', response.data);
        
        res.json({
            success: true,
            payment: response.data
        });

    } catch (error) {
        console.error('카카오페이 결제 승인 오류:', error.response?.data || error.message);
        res.status(500).json({
            error: '카카오페이 결제 승인 중 오류가 발생했습니다.',
            details: error.response?.data?.message || error.message
        });
    }
});

// 토스페이먼츠 결제 API
app.post('/api/payment/toss/ready', async (req, res) => {
    try {
        const { amount = 29000, orderName = '헤어/메이크업 팁 패키지', customerName = '고객' } = req.body;
        
        const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY;
        if (!TOSS_SECRET_KEY) {
            return res.status(500).json({ error: '토스페이먼츠 설정이 필요합니다.' });
        }

        const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const successUrl = `${req.protocol}://${req.get('host')}/toss-pay/success`;
        const failUrl = `${req.protocol}://${req.get('host')}/toss-pay/fail`;

        const tossData = {
            orderId,
            amount,
            orderName,
            customerName,
            successUrl,
            failUrl
        };

        const response = await axios.post('https://api.tosspayments.com/v1/payments', tossData, {
            headers: {
                'Authorization': `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('토스페이먼츠 결제 준비 성공:', response.data);
        
        res.json({
            success: true,
            payment: response.data
        });

    } catch (error) {
        console.error('토스페이먼츠 결제 준비 오류:', error.response?.data || error.message);
        res.status(500).json({
            error: '토스페이먼츠 결제 준비 중 오류가 발생했습니다.',
            details: error.response?.data?.message || error.message
        });
    }
});

// 토스페이먼츠 결제 승인 API
app.post('/api/payment/toss/confirm', async (req, res) => {
    try {
        const { paymentKey, orderId, amount } = req.body;
        
        if (!paymentKey || !orderId || !amount) {
            return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
        }

        const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY;
        if (!TOSS_SECRET_KEY) {
            return res.status(500).json({ error: '토스페이먼츠 설정이 필요합니다.' });
        }

        const confirmData = {
            paymentKey,
            orderId,
            amount
        };

        const response = await axios.post('https://api.tosspayments.com/v1/payments/confirm', confirmData, {
            headers: {
                'Authorization': `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('토스페이먼츠 결제 승인 성공:', response.data);
        
        res.json({
            success: true,
            payment: response.data
        });

    } catch (error) {
        console.error('토스페이먼츠 결제 승인 오류:', error.response?.data || error.message);
        res.status(500).json({
            error: '토스페이먼츠 결제 승인 중 오류가 발생했습니다.',
            details: error.response?.data?.message || error.message
        });
    }
});

// 토스페이먼츠 콜백 라우트
app.get('/toss-pay/success', (req, res) => {
    console.log('토스페이먼츠 결제 성공 콜백:', req.query);
    const { paymentKey, orderId, amount } = req.query;
    
    if (paymentKey && orderId && amount) {
        res.redirect(`/?payment=success&step=3&paymentKey=${paymentKey}&orderId=${orderId}&amount=${amount}`);
    } else {
        res.redirect('/?payment=error');
    }
});

app.get('/toss-pay/fail', (req, res) => {
    console.log('토스페이먼츠 결제 실패 콜백:', req.query);
    res.redirect('/?payment=fail&step=2');
});

// PayPal 결제 API
app.post('/api/payment/paypal/create-order', async (req, res) => {
    try {
        const { amount = 29000, currency = 'USD' } = req.body;
        
        const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
        const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
        
        // 테스트 모드: API 키가 없으면 시뮬레이션으로 처리
        if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
            console.log('PayPal API 키가 설정되지 않음 - 테스트 모드로 시뮬레이션 처리');
            
            // 시뮬레이션 응답
            const mockOrderId = `test_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const mockApprovalUrl = `${req.protocol}://${req.get('host')}/paypal/success?token=${mockOrderId}&PayerID=test_payer`;
            
            return res.json({
                success: true,
                orderId: mockOrderId,
                approvalUrl: mockApprovalUrl
            });
        }

        // PayPal 액세스 토큰 가져오기
        const authResponse = await axios.post('https://api-m.sandbox.paypal.com/v1/oauth2/token', 
            'grant_type=client_credentials', {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const accessToken = authResponse.data.access_token;

        // PayPal 주문 생성
        const orderData = {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: currency,
                    value: (amount / 1000).toFixed(2) // 29000원을 29.00 USD로 변환
                },
                description: 'Hair/Makeup Tips Package'
            }],
            application_context: {
                return_url: `${req.protocol}://${req.get('host')}/paypal/success`,
                cancel_url: `${req.protocol}://${req.get('host')}/paypal/cancel`
            }
        };

        const orderResponse = await axios.post('https://api-m.sandbox.paypal.com/v2/checkout/orders', orderData, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('PayPal 주문 생성 성공:', orderResponse.data);
        
        res.json({
            success: true,
            orderId: orderResponse.data.id,
            approvalUrl: orderResponse.data.links.find(link => link.rel === 'approve').href
        });

    } catch (error) {
        console.error('PayPal 주문 생성 오류:', error.response?.data || error.message);
        res.status(500).json({
            error: 'PayPal 주문 생성 중 오류가 발생했습니다.',
            details: error.response?.data?.message || error.message
        });
    }
});

// PayPal 결제 승인 API
app.post('/api/payment/paypal/capture-order', async (req, res) => {
    try {
        const { orderId } = req.body;
        
        if (!orderId) {
            return res.status(400).json({ error: '주문 ID가 필요합니다.' });
        }

        const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
        const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
        
        // 테스트 모드: API 키가 없으면 시뮬레이션으로 처리
        if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
            console.log('PayPal API 키가 설정되지 않음 - 테스트 모드로 시뮬레이션 처리');
            
            // 시뮬레이션 응답
            return res.json({
                success: true,
                payment: {
                    id: orderId,
                    status: 'COMPLETED',
                    amount: {
                        currency_code: 'USD',
                        value: '29.00'
                    }
                }
            });
        }

        // PayPal 액세스 토큰 가져오기
        const authResponse = await axios.post('https://api-m.sandbox.paypal.com/v1/oauth2/token', 
            'grant_type=client_credentials', {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const accessToken = authResponse.data.access_token;

        // PayPal 주문 승인
        const captureResponse = await axios.post(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`, {}, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('PayPal 결제 승인 성공:', captureResponse.data);
        
        res.json({
            success: true,
            payment: captureResponse.data
        });

    } catch (error) {
        console.error('PayPal 결제 승인 오류:', error.response?.data || error.message);
        res.status(500).json({
            error: 'PayPal 결제 승인 중 오류가 발생했습니다.',
            details: error.response?.data?.message || error.message
        });
    }
});

// Stripe 결제 API (카드결제용)
app.post('/api/payment/stripe/create-payment-intent', async (req, res) => {
    try {
        const { amount = 29000, currency = 'usd' } = req.body;
        
        const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
        
        // 테스트 모드: API 키가 없으면 시뮬레이션으로 처리
        if (!STRIPE_SECRET_KEY) {
            console.log('Stripe API 키가 설정되지 않음 - 테스트 모드로 시뮬레이션 처리');
            
            // 시뮬레이션 응답
            const mockPaymentIntentId = `pi_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const mockClientSecret = `${mockPaymentIntentId}_secret_test_${Math.random().toString(36).substr(2, 9)}`;
            
            return res.json({
                success: true,
                clientSecret: mockClientSecret,
                paymentIntentId: mockPaymentIntentId
            });
        }

        const paymentIntent = await axios.post('https://api.stripe.com/v1/payment_intents', 
            `amount=${amount}&currency=${currency}&automatic_payment_methods[enabled]=true`, {
            headers: {
                'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log('Stripe 결제 의도 생성 성공:', paymentIntent.data);
        
        res.json({
            success: true,
            clientSecret: paymentIntent.data.client_secret,
            paymentIntentId: paymentIntent.data.id
        });

    } catch (error) {
        console.error('Stripe 결제 의도 생성 오류:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Stripe 결제 의도 생성 중 오류가 발생했습니다.',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// PayPal 콜백 라우트
app.get('/paypal/success', (req, res) => {
    console.log('PayPal 결제 성공 콜백:', req.query);
    const { token, PayerID } = req.query;
    
    if (token && PayerID) {
        res.redirect(`/?payment=success&step=3&paypal_token=${token}&payer_id=${PayerID}`);
    } else {
        res.redirect('/?payment=error');
    }
});

app.get('/paypal/cancel', (req, res) => {
    console.log('PayPal 결제 취소 콜백:', req.query);
    res.redirect('/?payment=cancel&step=2');
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

// 서버 기반 분석 결과 저장소 (임시 저장용)
const serverAnalysisResults = new Map();

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

        // 언어 정보 추출 (기본값: 'ko')
        const language = req.body.language || 'ko';
        console.log(`🌍 클라이언트에서 전달받은 언어: ${language}`);
        
        // 세션 ID 처리 (클라이언트에서 전송한 세션 ID 사용, 없으면 새로 생성)
        let sessionId = req.body.sessionId;
        if (!sessionId) {
            sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.log('클라이언트 세션 ID가 없어서 새로 생성:', sessionId);
        } else {
            console.log('클라이언트에서 전달받은 세션 ID 사용:', sessionId);
        }
        
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
        ], sessionId, language); // 세션 ID와 언어 정보 전달

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
        
        // WebSocket으로 분석 완료 알림 전송
        const client = clients.get(sessionId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'analysis_complete',
                result: analysisResult,
                sessionId: sessionId
            }));
            console.log('WebSocket으로 분석 완료 알림 전송:', sessionId);
        } else {
            console.log('WebSocket 클라이언트를 찾을 수 없음:', sessionId);
        }
        
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


// 분석 결과 저장 API (중복 제거됨 - 아래 모바일 최적화 버전 사용)

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

// 서버 기반 분석 결과 저장 API (모바일 최적화)
app.post('/api/save-analysis-result', (req, res) => {
    try {
        const { analysisResult, uploadedImages, currentStep } = req.body;
        
        // 고유 ID 생성
        const resultId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 서버에 저장
        serverAnalysisResults.set(resultId, {
            analysisResult,
            uploadedImages,
            currentStep,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24시간 후 만료
        });
        
        console.log('서버에 분석 결과 저장됨:', resultId);
        
        res.json({ 
            success: true, 
            resultId,
            message: '분석 결과가 서버에 저장되었습니다.'
        });
        
    } catch (error) {
        console.error('분석 결과 저장 중 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '분석 결과 저장 중 오류가 발생했습니다.' 
        });
    }
});

// 서버 기반 분석 결과 조회 API (모바일 최적화)
app.get('/api/get-analysis-result-server/:resultId', (req, res) => {
    try {
        const { resultId } = req.params;
        
        if (serverAnalysisResults.has(resultId)) {
            const result = serverAnalysisResults.get(resultId);
            
            // 만료 시간 확인
            if (new Date() > new Date(result.expiresAt)) {
                serverAnalysisResults.delete(resultId);
                return res.status(410).json({ 
                    success: false, 
                    error: '분석 결과가 만료되었습니다.' 
                });
            }
            
            // 분석 결과가 있으면 currentStep을 4로 강제 설정
            const currentStepToReturn = result.analysisResult ? 4 : result.currentStep;
            
            res.json({ 
                success: true, 
                result: {
                    analysisResult: result.analysisResult,
                    uploadedImages: result.uploadedImages,
                    currentStep: currentStepToReturn,
                    createdAt: result.createdAt
                }
            });
        } else {
            res.status(404).json({ 
                success: false, 
                error: '분석 결과를 찾을 수 없습니다.' 
            });
        }
        
    } catch (error) {
        console.error('분석 결과 조회 중 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '분석 결과 조회 중 오류가 발생했습니다.' 
        });
    }
});

// 만료된 분석 결과 정리 (주기적 실행)
setInterval(() => {
    const now = new Date();
    for (const [resultId, result] of serverAnalysisResults.entries()) {
        if (now > new Date(result.expiresAt)) {
            serverAnalysisResults.delete(resultId);
            console.log('만료된 분석 결과 삭제:', resultId);
        }
    }
}, 60 * 60 * 1000); // 1시간마다 실행



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

// 메이크업 팁 분석 API
app.post('/api/analyze-makeup-tips', upload.fields([
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

        console.log('메이크업 팁 분석 - 3장 이미지 업로드 완료:', {
            front: req.files.front[0].filename,
            side45: req.files.side45[0].filename,
            side90: req.files.side90[0].filename
        });

        // 언어 정보 추출 (기본값: 'ko')
        const language = req.body.language || 'ko';
        console.log(`🌍 메이크업 팁 분석 - 클라이언트에서 전달받은 언어: ${language}`);
        
        // 세션 ID 처리
        let sessionId = req.body.sessionId;
        if (!sessionId) {
            sessionId = `makeup_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.log('메이크업 팁 분석 - 새 세션 ID 생성:', sessionId);
        } else {
            console.log('메이크업 팁 분석 - 클라이언트 세션 ID 사용:', sessionId);
        }
        
        // 분석 시작 상태 등록
        analysisProgress.set(sessionId, {
            sessionId,
            status: 'analyzing',
            progress: 0,
            message: '메이크업 팁 분석 시작...',
            updatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        });
        
        console.log('메이크업 팁 분석 세션 시작:', sessionId);
        
        // 얼굴분석 결과 가져오기
        let faceAnalysisResult = null;
        const faceAnalysisResultId = req.body.faceAnalysisResultId;
        
        // 1. faceAnalysisResultId로 서버에서 가져오기 시도
        if (faceAnalysisResultId) {
            const storedResult = serverAnalysisResults.get(faceAnalysisResultId);
            if (storedResult && storedResult.analysisResult) {
                faceAnalysisResult = storedResult.analysisResult;
                console.log('얼굴분석 결과를 서버에서 가져왔습니다:', faceAnalysisResultId);
            } else {
                console.log('얼굴분석 결과를 찾을 수 없습니다:', faceAnalysisResultId);
            }
        }
        
        // 2. faceAnalysisResultId가 없거나 결과를 찾지 못한 경우 직접 전달된 결과 사용
        if (!faceAnalysisResult && req.body.faceAnalysisResult) {
            try {
                faceAnalysisResult = typeof req.body.faceAnalysisResult === 'string' 
                    ? JSON.parse(req.body.faceAnalysisResult) 
                    : req.body.faceAnalysisResult;
                console.log('직접 전달된 얼굴분석 결과를 사용합니다.');
            } catch (error) {
                console.error('직접 전달된 얼굴분석 결과 파싱 오류:', error);
            }
        }
        
        if (!faceAnalysisResult) {
            console.log('얼굴분석 결과를 찾을 수 없습니다. ID:', faceAnalysisResultId);
        }
        
        // 3장 사진 모두 ChatGPT에 전송하여 메이크업 팁 분석 요청
        const analysisResult = await analyzeMakeupTipsWithImages([
            req.files.front[0].path,
            req.files.side45[0].path,
            req.files.side90[0].path
        ], sessionId, language, faceAnalysisResult);

        // 분석 완료 후 모든 업로드된 파일 삭제
        req.files.front.forEach(file => {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        });
        req.files.side45.forEach(file => {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        });
        req.files.side90.forEach(file => {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        });

        // 분석 완료 상태 업데이트
        analysisProgress.set(sessionId, {
            sessionId,
            status: 'completed',
            progress: 100,
            message: '메이크업 팁 분석 완료!',
            updatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        });
        
        // WebSocket으로 분석 완료 알림 전송 (선택적)
        const client = clients.get(sessionId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'makeup_analysis_complete',
                result: analysisResult,
                sessionId: sessionId
            }));
            console.log('WebSocket으로 메이크업 팁 분석 완료 알림 전송:', sessionId);
        } else {
            console.log('WebSocket 클라이언트를 찾을 수 없음, HTTP 응답으로 결과 전송:', sessionId);
        }
        
        // AI 거부 응답인지 확인
        if (analysisResult && analysisResult.error === 'ai_refusal') {
            console.log('AI 거부 응답 처리');
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
                analysis: analysisResult.analysis || '메이크업 팁 분석 결과를 가져올 수 없습니다.'
            };
            
            console.log('HTTP 응답으로 메이크업 팁 분석 결과 전송:', {
                success: true,
                analysisLength: cleanAnalysis.analysis.length,
                sessionId: sessionId
            });
            
            res.json({
                success: true,
                analysis: cleanAnalysis,
                sessionId: sessionId
            });
        }

    } catch (error) {
        console.error('메이크업 팁 분석 오류:', error);
        
        // 오류 발생 시 업로드된 파일 삭제
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: '메이크업 팁 분석 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 404 처리
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: '요청한 엔드포인트를 찾을 수 없습니다.' 
    });
});

// 서버 시작
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Better Me App Backend Server가 포트 ${PORT}에서 실행 중입니다.`);
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
