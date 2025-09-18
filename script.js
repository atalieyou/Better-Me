// 전역 변수
let currentStep = 1;
let uploadedImage = null;
let analysisResults = null;
let feedbackData = null;

// API URL을 동적으로 가져오는 함수
function getApiBaseUrl() {
    const hostname = window.location.hostname;
    
    // API 서버는 항상 3000 포트에서 실행 중
    const apiPort = '3000';
    
    // localhost나 로컬 IP인 경우 HTTP 사용
    if (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
        return `http://${hostname}:${apiPort}`;
    }
    
    // 외부 도메인인 경우 HTTPS 사용
    return `https://${hostname}`;
}

// WebSocket URL을 동적으로 가져오는 함수
function getWebSocketUrl() {
    const hostname = window.location.hostname;
    
    // localhost나 로컬 IP인 경우 WS 사용
    if (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
        return `ws://${hostname}:3000/ws`;
    }
    
    // 배포 환경에서는 WSS 사용
    return `wss://${hostname}/ws`;
}

// WebSocket 관련 전역 변수
let ws = null;
let sessionId = null;
let isWebSocketConnected = false;

// DOM이 로드된 후 실행
console.log('🔥 script.js 파일이 로드되었습니다!');

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 DOM이 로드되었습니다. 앱을 초기화합니다...');
    console.log('🚀 initializeApp 호출 시작');
    
    try {
        // GA4 초기 page_view (landing)
        if (typeof gtag === 'function') {
            gtag('event', 'page_view', {
                page_title: document.title,
                page_location: window.location.href,
                page_path: '/'
            });
        }
        await initializeApp();
        console.log('🚀 initializeApp 호출 완료');
        setupRealTimeValidation();
        checkUrlHash();
        checkPaymentStatus();
        console.log('앱 초기화 완료');
    } catch (error) {
        console.error('앱 초기화 중 오류 발생:', error);
    }
});

// 즉시 실행되는 로그
console.log('🔥 script.js 즉시 실행 로그 - DOMContentLoaded 이벤트 리스너 등록됨');

// 결제 상태 확인 함수
function checkPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const payment = urlParams.get('payment');
    const step = urlParams.get('step');
    
    if (payment === 'success' && step === '3') {
        console.log('결제 성공 - 메이크업 팁 분석으로 이동');
        // 결제 성공 시 메이크업 팁 분석 페이지로 이동
        setTimeout(() => {
            window.location.href = 'makeup-tips-analysis.html';
        }, 1000);
    } else if (payment === 'cancel' || payment === 'fail') {
        console.log('결제 실패/취소 - 결제 페이지로 이동');
        // 결제 실패/취소 시 결제 페이지로 이동
        setTimeout(() => {
            window.location.href = 'payment.html';
        }, 1000);
    }
}

// URL 해시 확인하여 1단계로 이동
function checkUrlHash() {
    if (window.location.hash === '#step-1') {
        showStep(1);
    }
}

// 실시간 체크박스 검증 설정
function setupRealTimeValidation() {
    const checkboxes = [
        document.getElementById('service-terms'),
        document.getElementById('privacy-consent'),
        document.getElementById('privacy-transfer')
    ];
    
    const nextButton = document.getElementById('next-step-2');
    
    function validateTerms() {
        const allChecked = checkboxes.every(checkbox => checkbox && checkbox.checked);
        nextButton.disabled = !allChecked;
        
        if (allChecked) {
            nextButton.style.background = '#CD3D3A';
            nextButton.style.cursor = 'pointer';
        } else {
            nextButton.style.background = '#ccc';
            nextButton.style.cursor = 'not-allowed';
        }
    }
    
    // 각 체크박스에 이벤트 리스너 추가
    checkboxes.forEach(checkbox => {
        if (checkbox) {
            checkbox.addEventListener('change', validateTerms);
        }
    });
    
    // 초기 상태 설정
    validateTerms();
}

// WebSocket 연결 설정
function setupWebSocket() {
    console.log('=== WebSocket 연결 설정 시작 ===');
    
    try {
        // WebSocket 서버 URL 설정 (동적 감지)
        const wsUrl = getWebSocketUrl();
        
        // WebSocket 연결 생성
        const ws = new WebSocket(wsUrl);
        
        // 연결 성공 시
        ws.onopen = function() {
            console.log('WebSocket 연결 성공');
            isWebSocketConnected = true;
            
            // 연결 상태를 전역 변수에 저장
            window.ws = ws;
            
            // 세션 ID 생성 및 전송
            const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            window.currentSessionId = sessionId;
            
            ws.send(JSON.stringify({
                type: 'init_session',
                sessionId: sessionId,
                timestamp: new Date().toISOString()
            }));
            
            console.log('WebSocket 세션 초기화 완료:', sessionId);
        };
        
        // 메시지 수신 시
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                console.log('WebSocket 메시지 수신:', data);
                
                // 메시지 타입에 따른 처리
                switch (data.type) {
                    case 'analysis_progress':
                        // AI 분석 진행 상황 업데이트
                        updateAnalysisProgress(data.progress);
                        break;
                        
                    case 'analysis_complete':
                        // AI 분석 완료 알림
                        handleAnalysisComplete(data.result);
                        break;
                        
                    case 'makeup_analysis_complete':
                        // 메이크업 팁 분석 완료 알림
                        handleMakeupAnalysisComplete(data.result);
                        break;case 'error':
                        // 서버 오류 알림
                        console.error('서버 오류:', data.message);
                        showError('서버 오류: ' + data.message);
                        break;
                        
                    default:
                        console.log('알 수 없는 메시지 타입:', data.type);
                }
                
            } catch (error) {
                console.error('WebSocket 메시지 파싱 오류:', error);
            }
        };
        
        // 연결 오류 시
        ws.onerror = function(error) {
            console.error('WebSocket 연결 오류:', error);
            isWebSocketConnected = false;
            // 오류가 발생해도 앱 실행을 중단하지 않음
            console.log('WebSocket 연결 실패했지만 앱은 계속 실행됩니다.');
        };
        
        // 연결 종료 시
        ws.onclose = function(event) {
            console.log('WebSocket 연결 종료:', event.code, event.reason);
            isWebSocketConnected = false;
            
            // 재연결 시도 (5초 후)
            setTimeout(() => {
                console.log('WebSocket 재연결 시도...');
                setupWebSocket();
            }, 5000);
        };
        
        console.log('WebSocket 연결 설정 완료');
        
    } catch (error) {
        console.error('WebSocket 설정 중 오류:', error);
        // 오류가 발생해도 앱 실행을 중단하지 않음
        console.log('WebSocket 설정 실패했지만 앱은 계속 실행됩니다.');
    }
}

// AI 분석 진행 상황 업데이트
function updateAnalysisProgress(progress) {
    console.log('AI 분석 진행 상황 업데이트:', progress);
    
    try {
        const progressFill = document.getElementById('analysis-progress-fill');
        const progressText = document.getElementById('analysis-progress-text');
        
        if (progressFill && progressText) {
            progressFill.style.width = progress.percentage + '%';
            updateProgressStatusWithRepeatingTyping(progress.message, 80);
        }
    } catch (error) {
        console.error('진행 상황 업데이트 중 오류:', error);
    }
}

// AI 분석 완료 처리 (WebSocket으로 받은 경우)
function handleAnalysisComplete(result) {
    console.log('🔔 WebSocket으로 AI 분석 완료 처리:', result);
    
    try {
        // 분석 결과 저장 (WebSocket에서 받은 데이터 구조에 맞게)
        if (result && result.raw_analysis) {
            analysisResults = result;
        } else {
            // 직접 분석 결과인 경우
            analysisResults = { raw_analysis: result };
        }
        
        console.log('🔍 저장된 분석 결과:', analysisResults);
        
        // sessionStorage에 저장
        try { 
            sessionStorage.setItem('beautyAI_analysisResults', JSON.stringify(analysisResults)); 
            console.log('✅ 분석 결과 sessionStorage에 저장 완료');
        } catch (e) { 
            console.error('❌ sessionStorage 저장 실패:', e); 
        }
        
        // 분석 결과를 화면에 표시
        displayFullAIResponse(analysisResults);
        
        // 3단계에서 4단계로 자동 이동
        const oldStep = currentStep;
        currentStep = 4;
        showDebugLog(`[AUTO] 단계 전환: ${oldStep} → ${currentStep}`);
        updateProgressSteps();
        showStep(4);
        saveAppState();
        
        // 사용자에게 알림
        const completionMessage = document.documentElement.lang === 'en' ? 'AI analysis completed!' : 'AI 분석이 완료되었습니다!';
        showSuccess(completionMessage);
        
        // GA4: 분석 완료 이벤트
        try { if (typeof gtag === 'function') { gtag('event', 'analysis_completed'); } } catch(e){}
        
    } catch (error) {
        console.error('WebSocket 분석 완료 처리 중 오류:', error);
    }
}

// 메이크업 팁 분석 완료 처리 (WebSocket으로 받은 경우)
function handleMakeupAnalysisComplete(result) {
    console.log('🔔 WebSocket으로 메이크업 팁 분석 완료 처리:', result);
    
    try {
        // 메이크업 팁 결과 저장
        if (result && result.analysis) {
            const makeupTipsResults = { raw_analysis: result.analysis };
            
            // sessionStorage에 저장
            try { 
                sessionStorage.setItem('beautyAI_makeupTipsResults', JSON.stringify(makeupTipsResults)); 
                console.log('✅ 메이크업 팁 결과 sessionStorage에 저장 완료');
            } catch (e) { 
                console.error('❌ sessionStorage 저장 실패:', e); 
            }
            
            // 메이크업 팁 결과 페이지로 이동
            const language = document.documentElement.lang === 'en' ? 'en' : 'ko';
            const resultPage = language === 'en' ? 'makeup-tips-result-en.html' : 'makeup-tips-result.html';
            
            console.log('🔔 메이크업 팁 분석 완료, 결과 페이지로 이동:', resultPage);
            window.location.href = resultPage;
            
        } else {
            console.error('❌ 메이크업 팁 분석 결과 데이터가 올바르지 않음:', result);
        }
        
    } catch (error) {
        console.error('WebSocket 메이크업 팁 분석 완료 처리 중 오류:', error);
    }
}


// 앱 완전 초기화 함수
function resetAppToInitialState() {
    console.log('=== 앱 완전 초기화 시작 ===');
    
    // 전역 변수 초기화
    currentStep = 1;
    uploadedImage = null;
    analysisResults = null;
    feedbackData = null;
    
    // 세션 스토리지 초기화
    sessionStorage.removeItem('beautyAI_currentStep');
    sessionStorage.removeItem('beautyAI_uploadedImages');
    sessionStorage.removeItem('beautyAI_analysisResults');
    sessionStorage.removeItem('beautyAI_feedbackData');
    sessionStorage.removeItem('beautyAI_resultId');
    sessionStorage.removeItem('beautyAI_faceAnalysisResultId');
    
    // 로컬 스토리지 초기화 (필요한 경우)
    localStorage.removeItem('beautyAI_appState');
    
    // WebSocket 연결 상태 초기화
    isWebSocketConnected = false;
    if (window.ws) {
        window.ws.close();
        window.ws = null;
    }
    
    // UI 초기화
    showStep(1);
    updateProgressSteps();
    
    // 동의 체크박스 초기화
    const photoConsent = document.getElementById('photo-consent');
    const serviceTerms = document.getElementById('service-terms');
    if (photoConsent) photoConsent.checked = false;
    if (serviceTerms) serviceTerms.checked = false;
    
    // 이미지 제거
    removeImage();
    
    // 분석 결과 UI 초기화
    const analysisDetails = document.getElementById('analysis-details');
    const improvedPlaceholder = document.getElementById('improved-placeholder');
    const finalImproved = document.getElementById('final-improved');
    
    if (analysisDetails) analysisDetails.style.display = 'none';
    if (improvedPlaceholder) improvedPlaceholder.style.display = 'block';
    if (finalImproved) finalImproved.style.display = 'none';
    
    // 피드백 폼 초기화
    const feedbackForm = document.getElementById('feedback-form');
    if (feedbackForm) {
        feedbackForm.reset();
    }
    
    // 페이지 상단으로 스크롤
    window.scrollTo(0, 0);
    
    console.log('=== 앱 완전 초기화 완료 ===');
}

// 앱 초기화
async function initializeApp() {
    console.log('=== 앱 초기화 시작 ===');
    showDebugLog('=== 앱 초기화 시작 ===');
    
    try {
        // 카카오페이 SDK 초기화
        initializeKakaoPay();
        
        // URL에서 공유 링크 확인
        const pathSegments = window.location.pathname.split('/');
        const shareResultId = pathSegments[pathSegments.length - 1];
        
        if (window.location.pathname.startsWith('/share/') && shareResultId) {
            console.log('공유 링크로 접속됨:', shareResultId);
            loadSharedResult(shareResultId);
            return; // 공유 링크 처리 시 일반 초기화 중단
        }
        
        // 일반 앱 초기화
        console.log('일반 앱 초기화');
        
        // URL 파라미터에서 결제 상태 확인
        checkPaymentStatus();
        
        // 세션 스토리지에서 이전 상태 복원
        console.log('🔄 restoreAppState 호출 시작');
        await restoreAppState();
        console.log('🔄 restoreAppState 호출 완료');
        
        setupEventListeners();
        console.log('이벤트 리스너 설정 완료');
        
        
        // WebSocket 연결 설정
        setupWebSocket();
        
        updateProgressSteps();
        console.log('진행 단계 업데이트 완료');
        
        // 현재 단계 표시
        showCurrentStep();
        
        // 결제 폼 초기화 (결제 단계 삭제로 인해 제거됨)
        
        // 페이지 가시성 변경 감지 설정
        setupVisibilityChangeDetection();
        
        console.log('=== 앱 초기화 완료 ===');
    } catch (error) {
        console.error('앱 초기화 중 오류:', error);
        throw error;
    }
}

// 카카오페이 SDK 초기화
function initializeKakaoPay() {
    try {
        // 카카오페이 JavaScript SDK 초기화
        if (typeof Kakao !== 'undefined') {
            // 실제 앱 키로 교체 필요 (현재는 테스트용)
            Kakao.init('YOUR_KAKAO_APP_KEY');
            console.log('카카오페이 SDK 초기화 완료');
        } else {
            console.warn('카카오페이 SDK를 로드할 수 없습니다.');
        }
    } catch (error) {
        console.error('카카오페이 SDK 초기화 실패:', error);
    }
}

// 결제 상태 확인
function checkPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const payment = urlParams.get('payment');
    const step = urlParams.get('step');
    
    if (payment === 'success') {
        console.log('결제 성공 감지');
        showSuccess('결제가 완료되었습니다!');
        
        // 결제 완료 상태 설정
        window.paymentCompleted = true;
        
        // 지정된 단계로 이동
        if (step) {
            currentStep = parseInt(step);
            updateProgressSteps();
            showCurrentStep();
            saveAppState();
        }
        
        // URL에서 결제 파라미터 제거
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
    } else if (payment === 'cancel') {
        console.log('결제 취소 감지');
        showError('결제가 취소되었습니다.');
        
        // 2단계로 이동
        if (step) {
            currentStep = parseInt(step);
            updateProgressSteps();
            showCurrentStep();
            saveAppState();
        }
        
        // URL에서 결제 파라미터 제거
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
    } else if (payment === 'fail') {
        console.log('결제 실패 감지');
        showError('결제에 실패했습니다. 다시 시도해주세요.');
        
        // 2단계로 이동
        if (step) {
            currentStep = parseInt(step);
            updateProgressSteps();
            showCurrentStep();
            saveAppState();
        }
        
        // URL에서 결제 파라미터 제거
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }
}

// 공유 결과 로드
async function loadSharedResult(resultId) {
    try {
        console.log('공유 결과 로드 시작:', resultId);
        
        // 공유 결과 조회 API 호출
        const response = await fetch(`${getApiBaseUrl()}/api/get-analysis-result/${resultId}`);
        
        if (!response.ok) {
            throw new Error(`API 호출 실패: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('공유 결과 로드 성공:', result.result);
            
            // 결과 데이터 설정
            analysisResults = { raw_analysis: result.result.analysisResult };
            try { sessionStorage.setItem('beautyAI_analysisResults', JSON.stringify(analysisResults)); } catch (e) { console.error('sessionStorage 저장 실패:', e); }
            
            // 이미지 데이터 설정 (base64 데이터가 있는 경우)
            if (result.result.uploadedImages) {
                uploadedImages = result.result.uploadedImages;
            }
            
            // 4단계로 이동하여 결과 표시
            const oldStep = currentStep;
            currentStep = 4;
            showDebugLog(`[AUTO] 단계 전환: ${oldStep} → ${currentStep}`);
            updateProgressSteps();
            showCurrentStep();
            saveAppState();
            
            
            // 공유 링크 표시
            updateShareLink(resultId);
            
            console.log('공유 결과 로드 및 표시 완료');
        } else {
            throw new Error(result.error || '결과를 불러올 수 없습니다.');
        }
        
    } catch (error) {
        console.error('공유 결과 로드 실패:', error);
        
        // 오류 메시지 표시
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="error-container" style="text-align: center; padding: 50px;">
                    <h2>결과를 불러올 수 없습니다</h2>
                    <p style="margin: 20px 0; color: #666;">${error.message}</p>
                    <button class="btn btn-primary" onclick="window.location.href='/'">
                        처음으로 돌아가기
                    </button>
                </div>
            `;
        }
    }
}

// 카카오톡 환경 감지
function isKakaoTalkBrowser() {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes('kakaotalk') || userAgent.includes('kakao');
}

// 모바일 디버깅을 위한 화면 로그 표시 함수 (비활성화)
function showDebugLog(message) {
    // 디버그 로그 비활성화 - 콘솔에만 출력
    console.log('🔍 디버그:', message);
    
    return;
}

// 앱 상태 복원
async function restoreAppState() {
    console.log('=== 앱 상태 복원 시작 ===');
    console.log('카카오톡 환경:', isKakaoTalkBrowser());
    showDebugLog('=== 앱 상태 복원 시작 ===');
    showDebugLog('카카오톡 환경: ' + isKakaoTalkBrowser());
    
    try {
        // 저장된 단계 복원
        const savedStep = sessionStorage.getItem('beautyAI_currentStep');
        console.log('🔍 저장된 단계 (savedStep):', savedStep);
        console.log('🔍 savedStep 타입:', typeof savedStep);
        
        
        if (savedStep) {
            const step = parseInt(savedStep);
            console.log('🔍 파싱된 단계 (step):', step);
            console.log('🔍 step 타입:', typeof step);
            
                    // 단계별 새로고침 처리
        if (step === 2) {
            console.log('2단계(결제)에서 새로고침됨. 1단계로 이동합니다.');
            currentStep = 1;
            sessionStorage.setItem('beautyAI_currentStep', '1');
            // 결제 완료 상태 초기화
            window.paymentCompleted = false;
        } else if (step === 3) {
            console.log('3단계에서 새로고침됨. 3단계에 머뭅니다.');
            currentStep = step;  // ✅ 3단계 유지
            // 이미지 데이터는 그대로 유지
        } else if (step === 4) {
            console.log('4단계에서 새로고침됨. 4단계 유지 (분석 완료된 상태)');
            currentStep = step;  // ✅ 4단계 유지
            
        } else {
            currentStep = step;
            
        }
        }
        
        // 서버에서 분석 결과 로드 시도 (모든 경우에 시도)
        let serverResult = null;
        console.log('🔍 서버에서 분석 결과 로드 시도 중...');
        serverResult = await loadAnalysisFromServer();
        console.log('🔍 서버 로드 결과:', serverResult);
        
        if (serverResult) {
            console.log('🔍 서버 결과 상세:', {
                hasAnalysisResult: !!serverResult.analysisResult,
                analysisResultLength: serverResult.analysisResult ? serverResult.analysisResult.length : 0,
                hasUploadedImages: !!serverResult.uploadedImages,
                currentStep: serverResult.currentStep
            });
            
            analysisResults = { raw_analysis: serverResult.analysisResult };
            try { sessionStorage.setItem('beautyAI_analysisResults', JSON.stringify(analysisResults)); } catch (e) { console.error('sessionStorage 저장 실패:', e); }
            if (serverResult.uploadedImages) {
                uploadedImages = serverResult.uploadedImages;
            }
            // 서버에서 currentStep도 복원
            if (serverResult.currentStep) {
                // 서버에서 4를 반환했거나, 분석 결과가 있으면 4로 설정
                if (serverResult.currentStep === 4 || serverResult.analysisResult) {
                    currentStep = 4;
                    console.log('✅ 서버에서 currentStep 4로 설정 (분석 완료)');
                } else {
                    currentStep = serverResult.currentStep;
                    console.log('✅ 서버에서 currentStep 복원:', currentStep);
                }
            }
            console.log('✅ 서버에서 분석 결과 복원 성공');
            console.log('🔍 복원된 analysisResults:', analysisResults);
        } else {
            console.log('❌ 서버에서 로드 실패, sessionStorage에서 복원 시도');
            // 서버에서 로드 실패 시 sessionStorage에서 복원
            const savedAnalysis = sessionStorage.getItem('beautyAI_analysisResults');
            console.log('저장된 분석 결과 확인:', savedAnalysis ? '있음' : '없음');
            if (savedAnalysis) {
                try {
                    analysisResults = JSON.parse(savedAnalysis);
                    console.log('✅ sessionStorage에서 분석 결과 복원 성공');
                    console.log('🔍 복원된 analysisResults:', analysisResults);
                } catch (e) {
                    console.error('❌ 분석 결과 파싱 실패:', e);
                }
            } else {
                console.log('❌ 저장된 분석 결과가 없습니다');
            }
            
            // 서버 로드 실패 시에만 sessionStorage에서 이미지 복원
            const savedImages = sessionStorage.getItem('beautyAI_uploadedImages');
            if (savedImages) {
                try {
                    uploadedImages = JSON.parse(savedImages);
                    console.log('저장된 이미지들 복원 완료:', Object.keys(uploadedImages));
                } catch (e) {
                    console.error('이미지 데이터 파싱 실패:', e);
                    uploadedImages = { front: null, '45': null, '90': null };
                }
            } else {
                uploadedImages = { front: null, '45': null, '90': null };
            }
        }
        
        // 4단계인 경우 추가로 sessionStorage에서도 복원 시도 (서버 로드 실패 시 대비)
        if (savedStep === '4' && (!analysisResults || !analysisResults.raw_analysis)) {
            console.log('🔍 4단계에서 분석 결과 없음 - sessionStorage에서 추가 복원 시도');
            const savedAnalysis = sessionStorage.getItem('beautyAI_analysisResults');
            if (savedAnalysis) {
                try {
                    analysisResults = JSON.parse(savedAnalysis);
                    console.log('✅ 4단계에서 sessionStorage에서 분석 결과 복원 성공');
                    console.log('🔍 복원된 analysisResults:', analysisResults);
                } catch (e) {
                    console.error('❌ 4단계에서 분석 결과 파싱 실패:', e);
                }
            }
        }
        
        // 4단계에서 새로고침한 경우 추가 처리 없음 (서버에서 이미 로드됨)
        
        // 4단계에서 새로고침한 경우 - 분석 결과 재검증 없이 4단계 유지
        console.log('🔍 4단계 조건 확인: savedStep =', savedStep, ', currentStep =', currentStep);
        console.log('🔍 조건1: savedStep === "4" =', savedStep === '4');
        console.log('🔍 조건2: currentStep === 4 =', currentStep === 4);
        console.log('🔍 조건3: savedStep === "4" || currentStep === 4 =', savedStep === '4' || currentStep === 4);
        
        
        if (savedStep === '4') {
            console.log('✅ 4단계에서 새로고침 - 4단계 유지 (분석 완료된 상태)');
            
            
            // 서버 로드 완료 후 4단계 UI 표시
            console.log('🔍 showStep(4) 호출 시작 (서버 로드 후)');
            showStep(4);
            console.log('🔍 showStep(4) 호출 완료');
            
        } else {
            
            // 4단계가 아닌 경우에만 updateUIAfterRestore 호출
            updateUIAfterRestore();
            console.log('🔍 updateUIAfterRestore 호출 완료');
        }
        
        console.log('=== 앱 상태 복원 완료 ===');
        console.log('복원된 상태:', {
            currentStep,
            hasImages: !!uploadedImages,
            hasAnalysis: !!analysisResults,
        });
        

        
    } catch (error) {
        console.error('앱 상태 복원 중 오류:', error);
        // 오류 발생 시 1단계로 초기화하되 세션은 유지
        currentStep = 1;
        console.log('오류로 인해 1단계로 초기화됨');
    }
}

// 단계별 UI 표시 함수
    function showStep(step) {
        console.log(`=== showStep 함수 호출: 단계 ${step} ===`);
        console.log('🔍 showStep - step 타입:', typeof step);
        console.log('🔍 showStep - step 값:', step);
        console.log('🔍 showStep - currentStep:', currentStep);
        
        // currentStep 업데이트 (중요!)
        currentStep = step;
        sessionStorage.setItem('beautyAI_currentStep', step.toString());
        console.log('🔍 currentStep 업데이트 완료:', currentStep);
        // GA4 SPA page_view 라우팅 추적
        try {
            if (typeof gtag === 'function') {
                const path = `/step-${step}`;
                gtag('event', 'page_view', {
                    page_title: `Step ${step}`,
                    page_location: window.location.origin + path,
                    page_path: path
                });
            }
        } catch (e) { /* no-op */ }
    
    try {
        // 모든 단계 패널 숨기기
        const allSteps = document.querySelectorAll('.step-panel');
        console.log('🔍 찾은 step-panel 개수:', allSteps.length);
        allSteps.forEach(stepPanel => {
            stepPanel.classList.remove('active');
        });
        
        // 모든 단계 표시기 비활성화
        const allStepIndicators = document.querySelectorAll('.progress-steps .step');
        allStepIndicators.forEach(indicator => {
            indicator.classList.remove('active');
        });
        
        // 현재 단계 패널 표시
        const currentStepPanel = document.getElementById(`step-${step}`);
        if (currentStepPanel) {
                currentStepPanel.classList.add('active');
            console.log(`단계 ${step} 패널 활성화 완료`);
            
            
            // 4단계인 경우 분석 결과 및 이미지 표시
            if (step === 4) {
                console.log('🔍 4단계 UI 표시 - 분석 결과와 이미지 표시');
                console.log('🔍 analysisResults 존재:', !!analysisResults);
                console.log('🔍 analysisResults.raw_analysis 존재:', !!(analysisResults && analysisResults.raw_analysis));
                console.log('🔍 uploadedImages 존재:', !!uploadedImages);
                
                // 일반 얼굴분석 결과 표시
                if (analysisResults && analysisResults.raw_analysis) {
                    console.log('🔍 4단계에서 분석 결과 표시 시작');
                    displayFullAIResponse(analysisResults);
                    console.log('🔍 4단계에서 분석 결과 표시 완료');
                    // GA4: 분석결과 표시 이벤트
                    try { if (typeof gtag === 'function') { gtag('event', 'analysis_displayed'); } } catch(e){}
                } else {
                    console.log('🔍 4단계에서 분석 결과 없음 - 로딩 메시지 표시');
                    // 분석 결과가 없을 때 로딩 메시지 표시
                    const analysisContent = document.getElementById('complete-analysis-content');
                    if (analysisContent) {
                        const loadingMessage = document.documentElement.lang === 'en' ? 'Loading analysis results...' : '분석 결과를 불러오는 중...';
                        analysisContent.innerHTML = `<div class="loading-message">${loadingMessage}</div>`;
                    }
                }
                
                // 이미지 표시 (분석 결과와 관계없이)
                if (uploadedImages) {
                    console.log('🔍 4단계에서 이미지 표시 시작');
                    displayStep4Images();
                    console.log('🔍 4단계에서 이미지 표시 완료');
                } else {
                    console.log('🔍 4단계에서 이미지 없음');
                }
            }
        } else {
            console.error(`단계 ${step} 패널을 찾을 수 없습니다`);
        }
        
        // 현재 단계 표시기 활성화
        const currentStepIndicator = document.querySelector(`.progress-steps .step[data-step="${step}"]`);
        if (currentStepIndicator) {
            currentStepIndicator.classList.add('active');
            console.log(`단계 ${step} 표시기 활성화 완료`);
        } else {
            console.error(`단계 ${step} 표시기를 찾을 수 없습니다`);
        }
        
        console.log(`단계 ${step} UI 표시 완료`);
    } catch (error) {
        console.error(`showStep 함수 실행 중 오류:`, error);
    }
}


// 상태 복원 후 UI 업데이트
let isUIUpdating = false; // 중복 호출 방지 플래그

function updateUIAfterRestore() {
    console.log('🔍 updateUIAfterRestore 함수 호출됨');
    console.log('🔍 isUIUpdating:', isUIUpdating);
    console.log('🔍 currentStep:', currentStep);
    
    if (isUIUpdating) {
        console.log('=== UI 업데이트 중복 호출 방지 ===');
        return;
    }
    
    isUIUpdating = true;
    console.log('=== UI 업데이트 시작 ===');
    
    try {
        // 현재 단계에 맞는 UI 표시
        console.log('🔍 showStep 호출: currentStep =', currentStep);
        showStep(currentStep);
        
        // 현재 단계에 맞는 이벤트 리스너 설정
        if (currentStep >= 3) {
            console.log(`현재 단계 ${currentStep}에서 이미지 업로드 이벤트 리스너 설정`);
            setupImageUploadEventListeners();
        } else {
            console.log(`현재 단계 ${currentStep}에서는 이미지 업로드 이벤트 리스너 설정 불필요`);
        }
        
        // 현재 단계가 3 이상일 때만 이미지 관련 UI 표시
        if (currentStep >= 3) {
            // 4단계인 경우 showStep(4)에서 이미 처리되므로 추가 처리 불필요
            if (currentStep === 4) {
                console.log('4단계 UI 복원 - showStep(4)에서 이미 처리됨');
            } else {
                // 3단계인 경우 기존 로직
                if (uploadedImages && (uploadedImages.front || uploadedImages['45'] || uploadedImages['90'])) {
                    if (uploadedImages.front) displayUploadedImage('front');
                    if (uploadedImages['45']) displayUploadedImage('45');
                    if (uploadedImages['90']) displayUploadedImage('90');
                }
                
                // 분석 결과가 있다면 표시
                if (analysisResults) {
                    displayFullAIResponse(analysisResults);
                    // 상태 저장 추가
                    saveAppState();
                }
            }
        } else {
            console.log(`현재 단계 ${currentStep}에서는 이미지 관련 UI 표시 불필요`);
        }
        
        console.log('UI 업데이트 완료');
    } catch (error) {
        console.error('UI 업데이트 중 오류:', error);
    } finally {
        isUIUpdating = false; // 플래그 리셋
    }
}

// 서버 기반 분석 결과 저장
async function saveAnalysisToServer() {
    try {
        console.log('💾 서버에 분석 결과 저장 시도 중...');
        
        if (!analysisResults) {
            console.log('❌ 저장할 분석 결과가 없습니다');
            return null;
        }

        // 네트워크 연결 확인
        if (!navigator.onLine) {
            console.log('❌ 네트워크 연결이 없습니다. 서버 저장 건너뜀');
            return null;
        }

        // 이미지 데이터 준비 (base64 데이터만 포함)
        const imageDataForStorage = {};
        if (uploadedImages.front && uploadedImages.front.dataUrl) {
            imageDataForStorage.front = { dataUrl: uploadedImages.front.dataUrl };
        }
        if (uploadedImages['45'] && uploadedImages['45'].dataUrl) {
            imageDataForStorage['45'] = { dataUrl: uploadedImages['45'].dataUrl };
        }
        if (uploadedImages['90'] && uploadedImages['90'].dataUrl) {
            imageDataForStorage['90'] = { dataUrl: uploadedImages['90'].dataUrl };
        }

        
        // 4단계에서 저장할 때는 currentStep을 4로 강제 설정
        const stepToSave = currentStep === 4 ? 4 : currentStep;
        
        
        console.log('📤 저장할 데이터:', {
            hasAnalysis: !!analysisResults.raw_analysis,
            hasImages: Object.keys(imageDataForStorage).length,
            currentStep: stepToSave
        });

        // 타임아웃 설정 (10초)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const apiUrl = `${getApiBaseUrl()}/api/save-analysis-result`;
        console.log('📡 API URL:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                analysisResult: analysisResults.raw_analysis,
                uploadedImages: imageDataForStorage,
                currentStep: stepToSave
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log('📡 서버 응답 상태:', response.status);

        if (!response.ok) {
            throw new Error(`서버 저장 실패: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ 서버에 분석 결과 저장 완료:', result);
        
        // 결과 ID를 sessionStorage에 저장 (키 이름 변경)
        sessionStorage.setItem('beautyAI_resultId', result.resultId);
        console.log('💾 서버 결과 ID 저장됨:', result.resultId);
        console.log('🔍 저장 후 sessionStorage 확인:', sessionStorage.getItem('beautyAI_resultId'));
        
        
        // 저장 후 즉시 검증
        const verifyResponse = await fetch(`${getApiBaseUrl()}/api/get-analysis-result-server/${result.resultId}`);
        if (verifyResponse.ok) {
            console.log('✅ 서버 저장 검증 성공');
        } else {
            console.error('❌ 서버 저장 검증 실패:', verifyResponse.status);
        }
        
        return result.resultId;
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('❌ 서버 저장 타임아웃:', error);
        } else {
            console.error('❌ 서버 저장 중 오류:', error);
        }
        return null;
    }
}

// 서버에서 분석 결과 로드
async function loadAnalysisFromServer() {
    console.log('🔍 loadAnalysisFromServer 함수 시작');
    try {
        console.log('🔍 sessionStorage 전체 내용:', Object.keys(sessionStorage));
        console.log('🔍 sessionStorage 모든 값:', Object.keys(sessionStorage).map(key => `${key}: ${sessionStorage.getItem(key)}`));
        const resultId = sessionStorage.getItem('beautyAI_resultId');
        console.log('🔍 서버 저장된 분석 결과 ID:', resultId);
        console.log('🔍 resultId 타입:', typeof resultId);
        console.log('🔍 resultId === null:', resultId === null);
        console.log('🔍 resultId === undefined:', resultId === undefined);
        showDebugLog('🔍 서버 ID: ' + (resultId ? resultId.substring(0, 20) + '...' : '없음'));
        
        if (!resultId) {
            console.log('❌ 서버 저장된 분석 결과 ID가 없습니다');
            showDebugLog('❌ 서버 ID가 없습니다');
            return null;
        }

        // 네트워크 연결 확인
        if (!navigator.onLine) {
            console.log('❌ 네트워크 연결이 없습니다. 서버 로드 건너뜀');
            return null;
        }
        
        console.log('🔍 네트워크 상태:', navigator.onLine);
        console.log('🔍 API URL 구성:', `${getApiBaseUrl()}/api/get-analysis-result-server/${resultId}`);
        

        console.log('🌐 서버에서 분석 결과 로드 시도 중...');
        console.log('📡 API URL:', `${getApiBaseUrl()}/api/get-analysis-result-server/${resultId}`);

        // 타임아웃 설정 (15초) - 모바일 네트워크 지연 고려
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${getApiBaseUrl()}/api/get-analysis-result-server/${resultId}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('📡 서버 응답 상태:', response.status);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('❌ 서버에서 분석 결과를 찾을 수 없습니다');
                showDebugLog('❌ 서버에서 분석 결과를 찾을 수 없습니다');
                sessionStorage.removeItem('beautyAI_resultId');
            } else if (response.status === 410) {
                console.log('❌ 분석 결과가 만료되었습니다');
                showDebugLog('❌ 분석 결과가 만료되었습니다');
                sessionStorage.removeItem('beautyAI_resultId');
            } else {
                console.log(`❌ 서버 로드 실패: ${response.status}`);
                showDebugLog(`❌ 서버 로드 실패: ${response.status}`);
                throw new Error(`서버 로드 실패: ${response.status}`);
            }
            return null;
        }

        const result = await response.json();
        console.log('✅ 서버에서 분석 결과 로드 완료:', result);
        console.log('🔍 서버 응답 데이터 구조:', {
            hasResult: !!result.result,
            hasAnalysisResult: !!result.result?.analysisResult,
            hasUploadedImages: !!result.result?.uploadedImages,
            resultKeys: Object.keys(result.result || {})
        });
        
        return result.result;
        
    } catch (error) {
        console.error('❌ 서버 로드 중 오류 발생:', error);
        console.error('❌ 오류 타입:', error.name);
        console.error('❌ 오류 메시지:', error.message);
        
        
        if (error.name === 'AbortError') {
            console.error('❌ 서버 로드 타임아웃:', error);
        } else {
            console.error('❌ 서버 로드 중 오류:', error);
        }
        return null;
    }
}

// 앱 상태 저장 (하이브리드 방식)
let isSaving = false; // 중복 저장 방지 플래그

async function saveAppState() {
    // 중복 저장 방지
    if (isSaving) {
        console.log('이미 저장 중입니다. 중복 호출 무시');
        return;
    }
    
    isSaving = true;
    console.log('=== 앱 상태 저장 시작 ===');
    showDebugLog('=== 앱 상태 저장 시작 ===');
    showDebugLog(`[SAVE] 현재 단계 저장 시도: ${currentStep}`);
    
    
    try {
        // 4단계에서 저장할 때는 currentStep을 4로 강제 설정
        if (currentStep === 4) {
            sessionStorage.setItem('beautyAI_currentStep', '4');
            showDebugLog(`[SAVE] 4단계에서 저장 - currentStep을 4로 강제 설정`);
        } else {
            sessionStorage.setItem('beautyAI_currentStep', currentStep.toString());
            showDebugLog(`[SAVE] 단계 저장 완료: ${currentStep}`);
        }
        
        // 이미지들 데이터 저장 (압축된 버전)
        if (uploadedImages && (uploadedImages.front || uploadedImages['45'] || uploadedImages['90'])) {
            // 이미지는 압축해서 저장
            const compressedImages = compressImagesForStorage(uploadedImages);
            sessionStorage.setItem('beautyAI_uploadedImages', JSON.stringify(compressedImages));
        }
        
        // 분석 결과는 서버에 저장
        if (analysisResults) {
            console.log('분석 결과를 서버에 저장 중...');
            const resultId = await saveAnalysisToServer();
            if (resultId) {
                console.log('서버 저장 성공:', resultId);
            } else {
                console.log('서버 저장 실패, sessionStorage에 폴백 저장');
                // 폴백: sessionStorage에 저장 시도
                try {
            sessionStorage.setItem('beautyAI_analysisResults', JSON.stringify(analysisResults));
                } catch (e) {
                    console.error('sessionStorage 저장도 실패:', e);
                }
            }
        } else {
            console.log('저장할 분석 결과가 없습니다');
        }
        
        console.log('=== 앱 상태 저장 완료 ===');
        console.log('저장된 상태:', {
            currentStep,
            hasImages: !!uploadedImages,
            hasAnalysis: !!analysisResults,
        });
        
    } catch (error) {
        console.error('앱 상태 저장 중 오류:', error);
    } finally {
        isSaving = false; // 플래그 리셋
    }
}

// 이미지 압축 함수 (모바일 최적화)
function compressImagesForStorage(images) {
    const compressed = {};
    
    Object.keys(images).forEach(key => {
        if (images[key] && images[key].dataUrl) {
            // 이미지 품질을 낮춰서 크기 줄이기
            compressed[key] = {
                dataUrl: images[key].dataUrl,
                // 원본 파일 정보는 제거하여 크기 줄이기
                compressed: true
            };
        }
    });
    
    return compressed;
}

// 기본 이벤트 리스너 설정 (1단계에서만 필요한 것들)
function setupEventListeners() {
    console.log('기본 이벤트 리스너 설정 시작...');
    
    try {
        // 동의 체크박스 유효성 검사 (1단계에서 필요)
        setupConsentValidation();
        
        console.log('기본 이벤트 리스너 설정 완료');
    } catch (error) {
        console.error('기본 이벤트 리스너 설정 중 오류:', error);
        // 오류가 발생해도 앱 초기화를 중단하지 않음
        console.log('기본 이벤트 리스너 설정 실패했지만 앱은 계속 실행됩니다.');
    }
}

// 이미지 업로드 관련 이벤트 리스너 설정 (3단계 이상에서만 호출)
function setupImageUploadEventListeners() {
    console.log('이미지 업로드 이벤트 리스너 설정 시작...');
    
    try {
        // 파일 업로드 영역 클릭 이벤트 (3개 영역 모두 설정)
        const uploadZoneFront = document.getElementById('upload-zone-front');
        const uploadZone45 = document.getElementById('upload-zone-45');
        const uploadZone90 = document.getElementById('upload-zone-90');
        
        const photoInputFront = document.getElementById('photo-input-front');
        const photoInput45 = document.getElementById('photo-input-45');
        const photoInput90 = document.getElementById('photo-input-90');
        
        if (!uploadZoneFront || !uploadZone45 || !uploadZone90) {
            throw new Error('upload-zone 요소들을 찾을 수 없습니다');
        }
        if (!photoInputFront || !photoInput45 || !photoInput90) {
            throw new Error('photo-input 요소들을 찾을 수 없습니다');
        }
        
        console.log('업로드 요소들 찾기 완료');
        
        // 각 업로드 영역에 이벤트 리스너 설정 (HTML onclick으로 대체됨)
        // uploadZoneFront.addEventListener('click', () => photoInputFront.click());
        // uploadZone45.addEventListener('click', () => photoInput45.click());
        // uploadZone90.addEventListener('click', () => photoInput90.click());
        
        // 파일 선택 이벤트
        photoInputFront.addEventListener('change', (e) => handleFileUpload(e, 'front'));
        photoInput45.addEventListener('change', (e) => handleFileUpload(e, '45'));
        photoInput90.addEventListener('change', (e) => handleFileUpload(e, '90'));
        
        // 드래그 앤 드롭 이벤트
        uploadZoneFront.addEventListener('dragover', handleDragOver);
        uploadZoneFront.addEventListener('drop', (e) => handleDrop(e, 'front'));
        uploadZone45.addEventListener('dragover', handleDragOver);
        uploadZone45.addEventListener('drop', (e) => handleDrop(e, '45'));
        uploadZone90.addEventListener('dragover', handleDragOver);
        uploadZone90.addEventListener('drop', (e) => handleDrop(e, '90'));
        
        console.log('이미지 업로드 이벤트 리스너 설정 완료');
    } catch (error) {
        console.error('이미지 업로드 이벤트 리스너 설정 중 오류:', error);
        // 오류가 발생해도 앱 실행을 중단하지 않음
        console.log('이미지 업로드 이벤트 리스너 설정 실패했지만 앱은 계속 실행됩니다.');
    }
}

// 동의 체크박스 유효성 검사 설정
function setupConsentValidation() {
    console.log('동의 체크박스 설정 시작...');
    
    
    try {
        const serviceTerms = document.getElementById('service-terms');
        const privacyConsent = document.getElementById('privacy-consent');
        const privacyTransfer = document.getElementById('privacy-transfer');
        
        console.log('체크박스 요소들 찾기 결과:', {
            serviceTerms: !!serviceTerms,
            privacyConsent: !!privacyConsent,
            privacyTransfer: !!privacyTransfer
        });
        
        if (!serviceTerms) {
            throw new Error('service-terms 요소를 찾을 수 없습니다');
        }
        if (!privacyConsent) {
            throw new Error('privacy-consent 요소를 찾을 수 없습니다');
        }
        if (!privacyTransfer) {
            throw new Error('privacy-transfer 요소를 찾을 수 없습니다');
        }
        
        console.log('동의 체크박스 요소들 찾기 완료');
        
        // 실시간 유효성 검사
        [serviceTerms, privacyConsent, privacyTransfer].forEach(element => {
            element.addEventListener('change', function() {
                console.log('체크박스 클릭됨:', element.id);
                console.log('체크박스 상태:', element.checked);
                
                
                try {
                    validateConsent();
                } catch (error) {
                    console.error('validateConsent 오류:', error);
                }
            });
        });
        
        // 초기 유효성 검사 실행
        validateConsent();
        
        console.log('동의 체크박스 설정 완료');
        
    } catch (error) {
        console.error('동의 체크박스 설정 중 오류:', error);
        
        
        throw error;
    }
}

// 사진 활용 동의 유효성 검사
function validateConsent() {
    console.log('=== validateConsent 함수 호출 ===');
    
    try {
        const serviceTerms = document.getElementById('service-terms');
        const privacyConsent = document.getElementById('privacy-consent');
        const privacyTransfer = document.getElementById('privacy-transfer');
        const nextButton = document.getElementById('next-step-2');
        
        console.log('체크박스 요소들:', {
            serviceTerms: !!serviceTerms,
            privacyConsent: !!privacyConsent,
            privacyTransfer: !!privacyTransfer,
            nextButton: !!nextButton
        });
        
        // 요소가 존재하는지 확인
        if (!serviceTerms || !privacyConsent || !privacyTransfer) {
            console.error('체크박스 요소를 찾을 수 없습니다:', {
                serviceTerms: !!serviceTerms,
                privacyConsent: !!privacyConsent,
                privacyTransfer: !!privacyTransfer
            });
            return false;
        }
        
        const allChecked = serviceTerms.checked && privacyConsent.checked && privacyTransfer.checked;
        
        console.log('체크박스 상태:', {
            serviceTerms: serviceTerms.checked,
            privacyConsent: privacyConsent.checked,
            privacyTransfer: privacyTransfer.checked,
            allChecked: allChecked
        });
        
        // 다음 단계 버튼 활성화/비활성화
        if (nextButton) {
            nextButton.disabled = !allChecked;
            console.log('다음 단계 버튼 상태:', allChecked ? '활성화' : '비활성화');
            
        }
        
        return allChecked;
    } catch (error) {
        console.error('validateConsent 함수 오류:', error);
        
        return false;
    }
}

// 결제 관련 함수들 (결제 단계 삭제로 인해 제거됨)

// 카카오페이 결제 처리
function processKakaoPayment() {
    console.log('카카오페이 결제 시작');
    
    try {
        // 카카오페이 SDK가 로드되었는지 확인
        if (typeof Kakao === 'undefined' || !Kakao.isInitialized()) {
            console.error('카카오페이 SDK가 초기화되지 않았습니다.');
            showError('카카오페이 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.');
            return;
        }
        
        // 카카오페이 결제 요청
        Kakao.Pay.request({
            cid: 'TC0ONETIME', // 테스트용 CID
            partner_order_id: 'ORDER_' + Date.now(),
            partner_user_id: 'USER_' + Date.now(),
            item_name: 'AI 외모 진단',
            quantity: 1,
            total_amount: 1490,
            tax_free_amount: 0,
            approval_url: window.location.origin + '/kakao-pay/success',
            cancel_url: window.location.origin + '/kakao-pay/cancel',
            fail_url: window.location.origin + '/kakao-pay/fail'
        }).then(function(response) {
            console.log('카카오페이 결제 요청 성공:', response);
            
            // 결제 페이지로 리다이렉트
            if (response.next_redirect_pc_url) {
                window.location.href = response.next_redirect_pc_url;
            } else {
                throw new Error('결제 URL을 받을 수 없습니다.');
            }
        }).catch(function(error) {
            console.error('카카오페이 결제 요청 실패:', error);
            showError('카카오페이 결제 요청에 실패했습니다. 다시 시도해주세요.');
        });
        
    } catch (error) {
        console.error('카카오페이 결제 처리 중 오류:', error);
        showError('카카오페이 결제 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
}

// 토스페이먼츠 결제 처리
function processTossPayment() {
    console.log('토스페이먼츠 결제 시작');
    showLoading('토스페이먼츠 결제를 진행하고 있습니다...');
    
    // 토스페이먼츠 결제 시뮬레이션
    setTimeout(() => {
        hideLoading();
        showSuccess('토스페이먼츠 결제가 완료되었습니다!');
        
        // 결제 완료 처리
        window.paymentCompleted = true;
        
        // 3단계로 이동
        setTimeout(() => {
            currentStep = 3;
            updateProgressSteps();
            showCurrentStep();
            saveAppState();
        }, 1500);
    }, 2000);
}

// 네이버페이 결제 처리
function processNaverPayment() {
    console.log('네이버페이 결제 시작');
    showLoading('네이버페이 결제를 진행하고 있습니다...');
    
    // 네이버페이 결제 시뮬레이션
    setTimeout(() => {
        hideLoading();
        showSuccess('네이버페이 결제가 완료되었습니다!');
        
        // 결제 완료 처리
        window.paymentCompleted = true;
        
        // 3단계로 이동
        setTimeout(() => {
            currentStep = 3;
            updateProgressSteps();
            showCurrentStep();
            saveAppState();
        }, 1500);
    }, 2000);
}

// 카드 결제 유효성 검사 (테스트용 - 간소화)
function validateCardPayment() {
    const cardNumber = document.getElementById('card-number').value;
    const expiryDate = document.getElementById('expiry-date').value;
    const cvv = document.getElementById('cvv').value;
    const cardHolder = document.getElementById('card-holder').value;
    
    // 테스트용으로 최소한의 검사만 수행
    if (!cardNumber || !expiryDate || !cvv || !cardHolder) {
        showError('모든 카드 정보를 입력해주세요.');
        return false;
    }
    
    // 카드 번호가 4자리씩 입력되었는지 확인
    if (cardNumber.replace(/-/g, '').length < 16) {
        showError('카드 번호를 16자리 입력해주세요.');
        return false;
    }
    
    // 만료일이 입력되었는지 확인
    if (expiryDate.length < 4) {
        showError('만료일을 입력해주세요.');
        return false;
    }
    
    // CVV가 3자리인지 확인
    if (cvv.length < 3) {
        showError('CVV를 3자리 입력해주세요.');
        return false;
    }
    
    return true;
}

// 카드 결제 처리
async function processCardPayment() {
    try {
        // 결제 버튼 비활성화
        const paymentButton = document.getElementById('payment-button');
        paymentButton.disabled = true;
        paymentButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 결제 처리 중...';
        
        // 실제 결제 API 호출 (여기서는 시뮬레이션)
        await simulatePayment();
        
        // 결제 성공
        showSuccess('결제가 완료되었습니다!');
        window.paymentCompleted = true;
        
        // 3단계로 이동
        setTimeout(() => {
            currentStep = 3;
            updateProgressSteps();
            showCurrentStep();
            saveAppState();
        }, 1500);
        
    } catch (error) {
        showError('결제 처리 중 오류가 발생했습니다: ' + error.message);
        
        // 결제 버튼 재활성화
        const paymentButton = document.getElementById('payment-button');
        paymentButton.disabled = false;
        paymentButton.innerHTML = '<i class="fas fa-credit-card"></i> 결제하기';
    }
}

// 계좌이체 처리
function processBankTransfer() {
    showSuccess('계좌이체 정보가 표시되었습니다. 입금 확인 후 서비스가 시작됩니다.');
    
    // 계좌이체 정보를 더 명확하게 표시
    const transferForm = document.getElementById('transfer-payment-form');
    transferForm.style.display = 'block';
    
    // 결제 완료로 처리 (실제로는 입금 확인 후 처리)
    window.paymentCompleted = true;
    
    // 3단계로 이동
    setTimeout(() => {
        currentStep = 3;
        updateProgressSteps();
        showCurrentStep();
        saveAppState();
    }, 2000);
}

// 모바일 결제 처리
function processMobilePayment() {
    showSuccess('모바일 결제가 시작됩니다. 별도 앱에서 결제를 완료해주세요.');
    
    // 모바일 결제 완료로 처리 (실제로는 앱 연동 필요)
    window.paymentCompleted = true;
    
    // 3단계로 이동
    setTimeout(() => {
        currentStep = 3;
        updateProgressSteps();
        showCurrentStep();
        saveAppState();
    }, 2000);
}

// 결제 시뮬레이션 (테스트용 - 항상 성공)
function simulatePayment() {
    return new Promise((resolve) => {
        setTimeout(() => {
            // 테스트용으로 항상 성공
            resolve();
        }, 2000);
    });
}

// 결제 관련 함수들 (결제 단계 삭제로 인해 제거됨)

// 카드 번호 자동 포맷팅
function formatCardNumber(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.replace(/(\d{4})(?=\d)/g, '$1-');
    input.value = value;
}

// 만료일 자동 포맷팅
function formatExpiryDate(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
    }
    input.value = value;
}

// CVV 숫자만 입력
function formatCVV(input) {
    input.value = input.value.replace(/\D/g, '');
}

// 1단계 유효성 검사
function validateStep1() {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const birth = document.getElementById('birth').value;
    const gender = document.getElementById('gender').value;
    const privacyAgreed = document.getElementById('privacy-agree').checked;
    
    const isValid = name && phone && birth && gender && privacyAgreed;
    
    // 전화번호 형식 검사
    const phonePattern = /^01[0-9]-\d{4}-\d{4}$/;
    if (phone && !phonePattern.test(phone)) {
        showError('올바른 전화번호 형식을 입력해주세요 (예: 010-1234-5678)');
        return false;
    }
    
    return isValid;
}

// 다음 단계로 이동
async function nextStep() {
    console.log('=== nextStep 함수 시작 ===');
    console.log('현재 단계:', currentStep);
    console.log('전체 단계 수:', document.querySelectorAll('.step-panel').length);
    console.log('함수 호출 스택:', new Error().stack);
    
    if (currentStep === 1 && !validateConsent()) {
        console.log('1단계 동의 검증 실패');
        showError('모든 필수 동의 항목에 체크해주세요.');
        return;
    }
    
    console.log('1단계 동의 검증 성공, currentStep:', currentStep);
    
    if (currentStep === 3 && !checkAllImagesUploaded()) {
        showError('모든 사진을 업로드해주세요.');
        return;
    }
    
    if (currentStep < 4) {
        // 1단계에서 2단계로 이동할 때 (사진 업로드)
        if (currentStep === 1) {
            console.log('1단계에서 2단계로 이동 시작');
            const oldStep = currentStep;
            currentStep++;
            showDebugLog(`[NEXT] 단계 전환: ${oldStep} → ${currentStep}`);
            console.log('currentStep 업데이트됨:', currentStep);
            updateProgressSteps();
            showCurrentStep();
            
            // 2단계에서 이미지 업로드 이벤트 리스너 설정
            setupImageUploadEventListeners();
            
            // 상태 저장
            saveAppState();
            console.log('1단계에서 2단계로 이동 완료');
        }
        // 2단계에서 3단계로 이동할 때 (AI 분석)
        else if (currentStep === 2) {
            // 모든 사진이 업로드되었는지 확인
            if (!checkAllImagesUploaded()) {
                showError('모든 사진을 업로드해주세요.');
                return;
            }
            
            const oldStep = currentStep;
            currentStep++;
            showDebugLog(`[NEXT] 단계 전환: ${oldStep} → ${currentStep}`);
            updateProgressSteps();
            showCurrentStep();
            
            // 3단계에서 AI 분석 시작 (분석 완료 후 자동으로 4단계로 이동)
            startAnalysis();
            
            // 상태 저장
            saveAppState();
        } else if (currentStep === 3) {
            // 3단계에서 4단계로 이동할 때
            console.log('=== 3단계에서 4단계로 이동 ===');
            
                currentStep = 4;
                updateProgressSteps();
                showStep(4);  // showCurrentStep() 대신 showStep(4) 호출
                
                
                // 상태 저장
                saveAppState();
        } else {
            // 4단계는 마지막 단계
            console.log('=== 4단계는 마지막 단계입니다 ===');
            return;
        }
    }
}

// 이전 단계로 이동
function prevStep() {
    console.log('=== prevStep 함수 시작 ===');
    console.log('현재 단계:', currentStep);
    
    if (currentStep > 1) {
        currentStep--;
        console.log('이전 단계로 이동:', currentStep);
        
        updateProgressSteps();
        showCurrentStep();
        
        // 상태 저장
        saveAppState();
        
        console.log('이전 단계로 이동 완료');
    } else {
        console.log('이미 첫 번째 단계입니다.');
    }
}

// 진행 단계 업데이트
function updateProgressSteps() {
    console.log('진행 단계 업데이트 시작...');
    
    try {
        const steps = document.querySelectorAll('.step');
        console.log(`찾은 단계 요소 개수: ${steps.length}`);
        
        if (steps.length === 0) {
            throw new Error('진행 단계 요소를 찾을 수 없습니다');
        }
        
        steps.forEach((step, index) => {
            const stepNumber = index + 1;
            if (stepNumber <= currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
        
        console.log('진행 단계 업데이트 완료');
    } catch (error) {
        console.error('진행 단계 업데이트 중 오류:', error);
        throw error;
    }
}

// 현재 단계 표시
function showCurrentStep() {
    console.log('showCurrentStep 함수 시작, currentStep:', currentStep);
    
    const panels = document.querySelectorAll('.step-panel');
    console.log('찾은 패널 개수:', panels.length);
    
    panels.forEach((panel, index) => {
        const panelStep = index + 1;
        console.log(`패널 ${panelStep} 처리 중, currentStep: ${currentStep}`);
        
        if (panelStep === currentStep) {
            panel.classList.add('active');
            console.log(`패널 ${panelStep} 활성화됨`);
            
            // 2단계일 때 디버깅 로그
            if (panelStep === 2) {
                console.log('=== 2단계 (결제) 활성화됨 ===');
                console.log('window.paymentCompleted 상태:', window.paymentCompleted);
            }
            
            // 3단계일 때 정면 사진 위치로 스크롤
            if (panelStep === 3) {
                setTimeout(() => {
                    console.log('=== 3단계 활성화 시 정면 사진 위치로 스크롤 ===');
                    
                    // 모바일 환경 감지
                    const isMobile = window.innerWidth <= 768;
                    console.log('모바일 환경:', isMobile);
                    
                    // 정면 사진 업로드 영역 찾기
                    const frontUploadZone = document.querySelector('#upload-zone-front');
                    if (frontUploadZone) {
                        // 모바일에서는 더 부드러운 스크롤 사용
                        if (isMobile) {
                            frontUploadZone.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'center', // 모바일에서는 center로 조정
                                inline: 'nearest'
                            });
                        } else {
                            frontUploadZone.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'start',
                                inline: 'nearest'
                            });
                        }
                        console.log('3단계 정면 사진 위치로 스크롤 완료');
                    } else {
                        // 대안: 정면 사진이 포함된 upload-item 찾기
                        const frontUploadItem = document.querySelector('.upload-item:first-child');
                        if (frontUploadItem) {
                            if (isMobile) {
                                frontUploadItem.scrollIntoView({ 
                                    behavior: 'smooth', 
                                    block: 'center',
                                    inline: 'nearest'
                                });
                            } else {
                                frontUploadItem.scrollIntoView({ 
                                    behavior: 'smooth', 
                                    block: 'start',
                                    inline: 'nearest'
                                });
                            }
                            console.log('3단계 정면 사진 컨테이너로 스크롤 완료');
                        }
                    }
                }, 300); // 모바일에서는 조금 더 늦게 실행
            }
            
            // 4단계일 때 이미지와 포인트 표시
            if (panelStep === 4) {
                setTimeout(() => {
                    console.log('=== 4단계 활성화 시 이미지 표시 ===');
                                    // 4단계에서 업로드된 이미지들 표시 (3장 모두)
                    displayStep4Images();
                

                

                }, 100);
            }
            
            // 4단계일 때 이미지 표시
            if (panelStep === 4) {
                setTimeout(() => {
                    console.log('=== 4단계 활성화 시 이미지 확인 ===');
                    
                    // 4단계에서 업로드된 이미지들 표시 (3장 모두)
                
                    
                    
                    // 4단계로 이동할 때 "분석된 이미지들" 제목으로 스크롤
                    const step4Element = document.getElementById('step-4');
                    if (step4Element) {
                        const analyzedImagesTitle = step4Element.querySelector('h3');
                        if (analyzedImagesTitle) {
                            analyzedImagesTitle.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'start' 
                            });
                            console.log('4단계 "분석된 이미지들" 제목으로 스크롤 완료');
                        } else {
                            console.log('분석된 이미지들 제목을 찾을 수 없어 상단으로 스크롤');
                            step4Element.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'start' 
                            });
                        }
                    }
                }, 100);
            }
        } else {
            panel.classList.remove('active');
            console.log(`패널 ${panelStep} 비활성화됨`);
        }
    });
    
    
    console.log('showCurrentStep 함수 완료');
}

// 3장 사진 업로드 상태 관리
let uploadedImages = {
    front: null,
    '45': null,
    '90': null
};

// 파일 업로드 처리
function handleFileUpload(event, type) {
    const file = event.target.files[0];
    if (file) {
        processImageFile(file, type);
    }
}

// 드래그 앤 드롭 처리
function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.style.borderColor = '#667eea';
    event.currentTarget.style.background = '#f0f4ff';
}

function handleDrop(event, type) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        processImageFile(file, type);
    }
    event.currentTarget.style.borderColor = '#e0e0e0';
    event.currentTarget.style.background = '#f8f9fa';
}

// 이미지 압축 함수 (권장 설정)
function compressImage(file, quality = 0.5, maxSize = 500) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            try {
                // 원본 이미지 크기
                let { width, height } = img;
                console.log(`원본 이미지 크기: ${width}x${height}`);
                
                // 최대 크기 제한 (비율 유지)
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    } else {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                    console.log(`압축된 이미지 크기: ${width}x${height}`);
                }
                
                // 캔버스 설정
                canvas.width = width;
                canvas.height = height;
                
                // 이미지 그리기 (고품질 설정)
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                
                // 압축된 base64 생성 (권장 품질: 0.75)
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                
                // 압축 결과 로그
                const originalSize = file.size;
                const compressedSize = Math.round((compressedDataUrl.length * 3) / 4);
                const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
                
                console.log(`이미지 압축 완료:`);
                console.log(`- 원본 크기: ${(originalSize / 1024).toFixed(1)}KB`);
                console.log(`- 압축 크기: ${(compressedSize / 1024).toFixed(1)}KB`);
                console.log(`- 압축률: ${compressionRatio}%`);
                console.log(`- 품질: ${quality * 100}%`);
                console.log(`- 해상도: ${width}x${height}`);
                
                resolve(compressedDataUrl);
                
            } catch (error) {
                reject(new Error('이미지 압축 중 오류: ' + error.message));
            }
        };
        
        img.onerror = () => {
            reject(new Error('이미지 로드 실패'));
        };
        
        // 파일을 URL로 변환하여 이미지 로드
        const url = URL.createObjectURL(file);
        img.src = url;
        
        // 메모리 정리 (onload 이벤트가 발생한 후)
        img.addEventListener('load', () => {
            URL.revokeObjectURL(url);
        }, { once: true });
    });
}

// 이미지 파일 처리 (압축 적용)
async function processImageFile(file, type) {
    // 파일 크기 검사 (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showError('파일 크기는 10MB 이하여야 합니다.');
        return;
    }
    
    // 파일 형식 검사
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showError('지원하지 않는 파일 형식입니다. JPG, PNG, WEBP 파일을 사용해주세요.');
        return;
    }
    
    try {
        console.log(`${type} 이미지 압축 시작...`);
        
        // 이미지 압축 적용 (권장 설정: 품질 0.75, 최대 크기 800x800)
        const compressedImage = await compressImage(file, 0.5, 500);
        
        uploadedImages[type] = {
            file: file,
            dataUrl: compressedImage
        };
        
        displayUploadedImage(type);
        checkAllImagesUploaded();
        
        // 상태 저장
        saveAppState();
        
        console.log(`${type} 이미지 압축 및 업로드 완료`);
        
    } catch (error) {
        console.error('이미지 압축 중 오류:', error);
        showError('이미지 처리 중 오류가 발생했습니다: ' + error.message);
    }
}

// 업로드된 이미지 표시
function displayUploadedImage(type) {
    try {
    const uploadZone = document.getElementById(`upload-zone-${type}`);
    const uploadedImageDiv = document.getElementById(`uploaded-image-${type}`);
    const previewImage = document.getElementById(`preview-image-${type}`);
    
    if (uploadZone && uploadedImageDiv && previewImage) {
        uploadZone.style.display = 'none';
        uploadedImageDiv.style.display = 'block';
        previewImage.src = uploadedImages[type].dataUrl;
        } else {
            console.log(`이미지 표시 요소를 찾을 수 없음: type=${type}`);
        }
    } catch (error) {
        console.error(`이미지 표시 중 오류 (type: ${type}):`, error);
        // 오류가 발생해도 앱 실행을 중단하지 않음
    }
}

// 이미지 제거
function removeImage(type) {
    uploadedImages[type] = null;
    const uploadZone = document.getElementById(`upload-zone-${type}`);
    const uploadedImageDiv = document.getElementById(`uploaded-image-${type}`);
    const fileInput = document.getElementById(`photo-input-${type}`);
    
    if (uploadZone && uploadedImageDiv && fileInput) {
        uploadZone.style.display = 'block';
        uploadedImageDiv.style.display = 'none';
        fileInput.value = '';
    }
    
    checkAllImagesUploaded();
}

// 모든 사진이 업로드되었는지 확인
function checkAllImagesUploaded() {
    const allUploaded = uploadedImages.front && uploadedImages['45'] && uploadedImages['90'];
    
    // 다음 단계 버튼 활성화/비활성화
    const nextButton = document.getElementById('next-step-3');
    if (nextButton) {
        nextButton.disabled = !allUploaded;
    }
    
    // 업로드 완료 상태 표시 (메시지 없이)
    // if (allUploaded) {
    //     showSuccess('모든 사진이 업로드되었습니다!');
    // }
    
    return allUploaded;
}

// 다음 단계 버튼 활성화
function enableNextStep() {
    const nextButton = document.getElementById('next-step-2');
    if (nextButton) {
        nextButton.disabled = false;
    }
}

// 다음 단계 버튼 비활성화
function disableNextStep() {
    const nextButton = document.getElementById('next-button-2');
    if (nextButton) {
        nextButton.disabled = true;
    }
}

// AI 분석 시작
async function startAnalysis() {
    try {
        // GA4: 분석 시작 이벤트
        try { if (typeof gtag === 'function') { gtag('event', 'analysis_started'); } } catch(e){}
        // 진행률 초기화
        const progressFill = document.getElementById('analysis-progress-fill');
        const progressText = document.getElementById('analysis-progress-text');
        
        // 초기 상태 설정
        progressFill.style.width = '0%';
        // 언어에 따른 메시지 설정
        const currentLanguage = document.documentElement.lang === 'en' ? 'en' : 'ko';
        const preparingMessage = currentLanguage === 'en' ? 'Preparing analysis...' : '분석 준비 중...';
        updateProgressStatusWithRepeatingTyping(preparingMessage, 80);
        
        // 1단계: 이미지 전처리 (10%) - 타이핑 효과와 독립적으로 실행
        progressFill.style.width = '10%';
        const preprocessingMessage = currentLanguage === 'en' ? 'Preprocessing images...' : '이미지 전처리 중...';
        updateProgressStatusWithRepeatingTyping(preprocessingMessage, 80);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // 2단계: 이미지 업로드 (20%) - 타이핑 효과와 독립적으로 실행
        progressFill.style.width = '20%';
        const uploadingMessage = currentLanguage === 'en' ? 'Uploading images...' : '이미지 업로드 중...';
        updateProgressStatusWithRepeatingTyping(uploadingMessage, 80);
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // 3단계: 서버 전송 (30%) - 타이핑 효과와 독립적으로 실행
        progressFill.style.width = '30%';
        const sendingMessage = currentLanguage === 'en' ? 'Sending to server...' : '서버로 전송 중...';
        updateProgressStatusWithRepeatingTyping(sendingMessage, 80);
        await new Promise(resolve => setTimeout(resolve, 500));


        try {
            // 4단계: AI 분석 시작 (40%)
            progressFill.style.width = '40%';
            const aiStartMessage = currentLanguage === 'en' ? 'Starting AI analysis...' : 'AI 분석 시작...';
            updateProgressStatusWithRepeatingTyping(aiStartMessage, 80);
            await new Promise(resolve => setTimeout(resolve, 600));
            
            // 4단계: 백엔드 API 호출 (50%)
            progressFill.style.width = '50%';
            const aiSendingMessage = currentLanguage === 'en' ? 'Sending images to AI model...' : 'AI 모델에 이미지 전송 중...';
            updateProgressStatusWithRepeatingTyping(aiSendingMessage, 80);
            
            const formData = new FormData();
            // 3장 사진을 모두 추가
            if (uploadedImages.front && uploadedImages.front.file) {
                formData.append('front', uploadedImages.front.file);
            }
            if (uploadedImages['45'] && uploadedImages['45'].file) {
                formData.append('side45', uploadedImages['45'].file);
            }
            if (uploadedImages['90'] && uploadedImages['90'].file) {
                formData.append('side90', uploadedImages['90'].file);
            }
            
            // 언어 정보 추가 (현재 페이지의 언어 감지)
            formData.append('language', currentLanguage);
            
            // 세션 ID 추가 (WebSocket에서 생성한 세션 ID 사용)
            if (window.currentSessionId) {
                formData.append('sessionId', window.currentSessionId);
                console.log('클라이언트 세션 ID 전송:', window.currentSessionId);
            } else {
                console.warn('클라이언트 세션 ID가 없습니다.');
            }

            const response = await fetch(`${getApiBaseUrl()}/api/analyze-face`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API 오류 응답:', response.status, errorText);
                throw new Error(`API 호출 실패: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                console.log('🔔 HTTP API 응답 성공:', result);
                console.log('🔍 분석 결과 데이터:', result.analysis);
                console.log('🔍 세션 ID:', result.sessionId);
                
            // WebSocket으로 이미 처리되었는지 확인
            if (analysisResults && analysisResults.raw_analysis) {
                console.log('✅ WebSocket으로 이미 분석 결과 처리됨, HTTP 응답 무시');
                return;
            }
            
            // WebSocket 연결이 실패한 경우 HTTP 폴링으로 대체
            if (!isWebSocketConnected) {
                console.log('⚠️ WebSocket 연결 실패, HTTP 폴링으로 대체');
                if (result.sessionId) {
                    startAnalysisPolling(result.sessionId);
                }
                return;
            }
                
                // 분석 결과가 즉시 반환되었는지 확인
                if (result.analysis && result.analysis.analysis) {
                    console.log('✅ 즉시 분석 결과 반환됨');
                    
                    // 4단계: 분석 완료 (100%)
                    progressFill.style.width = '100%';
                    updateProgressStatusWithRepeatingTyping('분석 완료!', 80);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // 분석 결과 저장 (HTTP API 응답 처리)
                    analysisResults = {
                        raw_analysis: result.analysis.analysis
                    };
                    try { 
                        sessionStorage.setItem('beautyAI_analysisResults', JSON.stringify(analysisResults)); 
                        console.log('✅ HTTP API 분석 결과 sessionStorage에 저장 완료');
                    } catch (e) { 
                        console.error('❌ sessionStorage 저장 실패:', e); 
                    }
                    console.log('🔍 전역 변수에 저장된 데이터:', analysisResults);
                } else {
                    console.log('⏳ 분석 결과가 아직 준비되지 않음, 폴링 시작');
                    // 분석 결과가 아직 준비되지 않은 경우 폴링 시작
                    if (result.sessionId) {
                        startAnalysisPolling(result.sessionId);
                    }
                    return;
                }
                
                // 분석 진행 상태 모니터링 시작
                if (result.sessionId) {
                    // 세션 ID를 세션 스토리지에 저장
                    sessionStorage.setItem('beautyAI_analysisSessionId', result.sessionId);
                    console.log('분석 세션 ID 저장됨:', result.sessionId);
                }
                
                // 상태 저장
                saveAppState();
                
                // 분석 완료 후 4단계로 이동
                console.log('AI 분석 완료! 4단계로 이동합니다.');
                
                // 분석 결과 표시
                displayFullAIResponse(analysisResults);
                
                // 4단계로 자동 이동 (약간의 지연 후)
                setTimeout(() => {
                    console.log('=== AI 분석 완료 후 4단계 자동 이동 ===');
                    const oldStep = currentStep;
                    currentStep = 4;
                    showDebugLog(`[AUTO] 단계 전환: ${oldStep} → ${currentStep}`);
                    updateProgressSteps();
                    showStep(4);
                    saveAppState();
                    
                    // 성공 메시지 표시
                    const completionMessage = document.documentElement.lang === 'en' ? 'AI analysis completed!' : 'AI 분석이 완료되었습니다!';
                    showSuccess(completionMessage);
                }, 1000); // 1초 후 이동
                // GA4: 분석 완료 이벤트
                try { if (typeof gtag === 'function') { gtag('event', 'analysis_completed'); } } catch(e){}
                
                console.log('4단계로 이동 완료');
            } else {
                // AI 거부 응답인지 확인
                if (result.error === 'ai_refusal') {
                    showAIRefusalMessage(result.details || {});
                } else {
                    throw new Error(result.error || '분석에 실패했습니다.');
                }
            }
        } catch (apiError) {
            // 오류 발생 시 진행률 표시
            progressFill.style.width = '100%';
            progressText.textContent = '분석 오류 발생';
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.error('분석 처리 중 오류 발생:', apiError);
            console.error('오류 상세 정보:', {
                message: apiError.message,
                stack: apiError.stack,
                name: apiError.name
            });
            
            // 네트워크 오류인 경우 더 구체적인 메시지 표시
            if (apiError.message.includes('Failed to fetch') || apiError.message.includes('ERR_CONNECTION_RESET')) {
                showError('서버에 연결할 수 없습니다. 네트워크 연결을 확인하고 다시 시도해주세요.');
            } else {
                const processingErrorMessage = document.documentElement.lang === 'en' ? `Error occurred during analysis processing: ${apiError.message}` : `분석 처리 중 오류가 발생했습니다: ${apiError.message}`;
                showError(processingErrorMessage);
            }
        }

    } catch (error) {
        // 오류 발생 시 진행률 표시
        progressFill.style.width = '100%';
        const errorOccurredMessage = document.documentElement.lang === 'en' ? 'Analysis error occurred' : '분석 오류 발생';
        progressText.textContent = errorOccurredMessage;
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.error('분석 오류:', error);
        const generalErrorMessage = document.documentElement.lang === 'en' ? `An error occurred during analysis: ${error.message}` : `분석 중 오류가 발생했습니다: ${error.message}`;
        showError(generalErrorMessage);
    }
}

// 분석 결과 폴링 함수
async function startAnalysisPolling(sessionId) {
    console.log('🔄 분석 결과 폴링 시작:', sessionId);
    
    const pollInterval = 5000; // 5초마다 폴링
    const maxAttempts = 24; // 최대 2분 (24 * 5초)
    let attempts = 0;
    
    const poll = async () => {
        try {
            attempts++;
            console.log(`🔄 폴링 시도 ${attempts}/${maxAttempts}`);
            
            const response = await fetch(`${getApiBaseUrl()}/api/get-analysis-result/${sessionId}`);
            
            if (response.ok) {
                const result = await response.json();
                console.log('🔍 폴링 응답:', result);
                
                if (result.success && result.analysis && result.analysis.analysis) {
                    console.log('✅ 폴링으로 분석 결과 획득');
                    
                    // 분석 결과 저장
                    analysisResults = {
                        raw_analysis: result.analysis.analysis
                    };
                    
                    try { 
                        sessionStorage.setItem('beautyAI_analysisResults', JSON.stringify(analysisResults)); 
                        console.log('✅ 폴링 분석 결과 sessionStorage에 저장 완료');
                    } catch (e) { 
                        console.error('❌ sessionStorage 저장 실패:', e); 
                    }
                    
                    // 진행률 업데이트
                    const progressFill = document.getElementById('analysis-progress-fill');
                    const progressText = document.getElementById('analysis-progress-text');
                    progressFill.style.width = '100%';
                    updateProgressStatusWithRepeatingTyping('분석 완료!', 80);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // 분석 결과 표시
                    displayFullAIResponse(analysisResults);
                    
                    // 4단계로 자동 이동
                    setTimeout(() => {
                        console.log('=== 폴링으로 분석 완료 후 4단계 자동 이동 ===');
                        const oldStep = currentStep;
                        currentStep = 4;
                        showDebugLog(`[POLLING] 단계 전환: ${oldStep} → ${currentStep}`);
                        updateProgressSteps();
                        showStep(4);
                        saveAppState();
                        
                        // 성공 메시지 표시
                        const completionMessage = document.documentElement.lang === 'en' ? 'AI analysis completed!' : 'AI 분석이 완료되었습니다!';
                        showSuccess(completionMessage);
                    }, 1000);
                    
                    return; // 폴링 종료
                }
            }
            
            // 최대 시도 횟수에 도달했거나 오류 발생
            if (attempts >= maxAttempts) {
                console.error('❌ 폴링 최대 시도 횟수 초과');
                const errorMessage = document.documentElement.lang === 'en' ? 'Analysis timeout. Please try again.' : '분석 시간이 초과되었습니다. 다시 시도해주세요.';
                showError(errorMessage);
                return;
            }
            
            // 다음 폴링 예약
            setTimeout(poll, pollInterval);
            
        } catch (error) {
            console.error('❌ 폴링 중 오류:', error);
            const errorMessage = document.documentElement.lang === 'en' ? 'Error occurred during analysis polling.' : '분석 폴링 중 오류가 발생했습니다.';
            showError(errorMessage);
        }
    };
    
    // 첫 번째 폴링 시작
    setTimeout(poll, pollInterval);
}

// 4단계에서 이미지 표시하는 함수
function displayStep4Images() {
    console.log('=== 4단계 이미지 표시 함수 호출 ===');
    
    if (!uploadedImages) {
        console.log('업로드된 이미지 데이터가 없습니다.');
        return;
    }
    
    // 정면 이미지 표시
    if (uploadedImages.front && uploadedImages.front.dataUrl) {
        const step4ImageFront = document.getElementById('step4-uploaded-image-front');
        if (step4ImageFront) {
            step4ImageFront.src = uploadedImages.front.dataUrl;
            console.log('4단계 정면 이미지 표시 완료');
        }
    }
    
    // 45도 측면 이미지 표시
    if (uploadedImages['45'] && uploadedImages['45'].dataUrl) {
        const step4Image45 = document.getElementById('step4-uploaded-image-45');
        if (step4Image45) {
            step4Image45.src = uploadedImages['45'].dataUrl;
            console.log('4단계 45도 측면 이미지 표시 완료');
        }
    }
    
    // 90도 측면 이미지 표시
    if (uploadedImages['90'] && uploadedImages['90'].dataUrl) {
        const step4Image90 = document.getElementById('step4-uploaded-image-90');
        if (step4Image90) {
            step4Image90.src = uploadedImages['90'].dataUrl;
            console.log('4단계 90도 측면 이미지 표시 완료');
        }
    }
    
    console.log('4단계 이미지 표시 완료');
}

// GPT-4o 전체 응답을 표시하는 함수
function displayFullAIResponse(analysisResults) {
    console.log('displayFullAIResponse 함수 호출됨:', analysisResults);
    
    // 분석 결과가 없는 경우 처리
    if (!analysisResults) {
        console.error('분석 결과가 없습니다.');
        showError('분석 결과를 가져올 수 없습니다.');
        return;
    }
    
    // AI 응답을 표시 (raw_analysis 필드 사용)
    let displayContent = '';
    
    // raw_analysis 필드에서 AI 응답 추출
    if (analysisResults && analysisResults.raw_analysis) {
        displayContent = analysisResults.raw_analysis;
        console.log('AI 응답 추출 성공:', displayContent.substring(0, 100) + '...');
    } else {
        displayContent = 'AI 분석 결과를 가져올 수 없습니다.';
        console.log('AI 응답 추출 실패. analysisResults:', analysisResults);
    }
    
    // 새로운 구조화된 분석 결과 표시
    const formattedContent = formatAnalysisResult(displayContent);
    
    // 전체 분석 결과 표시 (중복 컨테이너 제거)
    const analysisContentElement = document.getElementById('complete-analysis-content');
    if (analysisContentElement) {
        analysisContentElement.innerHTML = formattedContent;
        console.log('분석 결과 화면에 표시 완료');
    } else {
        console.error('complete-analysis-content 요소를 찾을 수 없습니다');
    }
}

// 줄바꿈 문자를 HTML <br> 태그로 변환하는 함수
function convertNewlinesToHtml(text) {
    if (!text) return '';
    return text.replace(/\n/g, '<br>');
}

// 피드백 표시
function showFeedback() {
    // 분석 결과가 없는 경우 처리
    if (!analysisResults) {
        console.error('분석 결과가 없습니다.');
        showError('분석 결과를 가져올 수 없습니다.');
        return;
    }
    
    // GPT-4o 분석 결과를 기반으로 피드백 표시
    feedbackData = analysisResults;
    
    // 포인트 표시 (이미 completeAnalysis에서 표시됨)
    // displayPoint();
    
    // 분석 결과는 이미 4단계에서 표시되었으므로 추가 표시 불필요
    console.log('피드백 표시 완료');
    
    // 이 함수는 더 이상 사용되지 않음 (nextStep에서 직접 처리)
}

// AI 응답을 적절한 형식으로 변환하는 함수 (raw_analysis 필드 사용)
function formatAnalysisContent(analysisResults) {
    if (!analysisResults) return '';
    
    // raw_analysis 필드가 있으면 줄바꿈을 포함하여 반환
    const content = analysisResults.raw_analysis || 'AI 분석 결과를 가져올 수 없습니다.';
    return convertNewlinesToHtml(content);
}

// 포인트 표시 함수
function displayPoint() {
    const pointDisplay = document.getElementById('point-display');
    
    if (!analysisResults || !pointDisplay) {
        console.log('displayPoint: analysisResults 또는 pointDisplay 없음');
        return;
    }
    
    let point = '';
    let pointLabel = '포인트';
    
    // 분석 결과에서 포인트 추출 (JSON 응답과 자연어 응답 모두 처리)
    if (typeof analysisResults === 'object' && analysisResults !== null) {
        if (analysisResults && analysisResults.raw_analysis) {
            const content = analysisResults.raw_analysis;
            console.log('displayPoint: raw_analysis 내용:', content.substring(0, 100) + '...');
            
            // 1단계: "포인트: [등급]" 패턴에서 추출 (새로운 프롬프트 형식)
            let pointMatch = content.match(/포인트:\s*([A-Z][+-]?)/i);
            if (pointMatch) {
                point = pointMatch[1];
                console.log('새로운 프롬프트 형식에서 포인트 추출 성공:', point);
            }
            
            // 2단계: 기존 패턴들로 추출 시도
            if (!point) {
                // "포인트 [등급]" 패턴
                pointMatch = content.match(/포인트\s+([A-Z][+-]?)/i);
                if (pointMatch) {
                    point = pointMatch[1];
                    console.log('기존 패턴에서 포인트 추출 성공:', point);
                }
            }
            
            // 3단계: 등급만 있는 패턴 찾기
            if (!point) {
                const gradePattern = /([A-Z][+-]?)\s*(?:포인트|등급|입니다|입니다\.)/i;
                pointMatch = content.match(gradePattern);
                if (pointMatch) {
                    point = pointMatch[1];
                    console.log('등급 패턴에서 포인트 추출 성공:', point);
                }
            }
            
            // 4단계: 마지막 등급 찾기 (문서 끝 부분에서)
            if (!point) {
                const lines = content.split('\n');
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    const gradeMatch = line.match(/([A-Z][+-]?)/);
                    if (gradeMatch && ['S+', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D'].includes(gradeMatch[1])) {
                        point = gradeMatch[1];
                        console.log('문서 끝에서 포인트 추출 성공:', point);
                        break;
                    }
                }
            }
            
            if (point) {
                console.log('최종 포인트 추출 성공:', point);
            } else {
                console.log('모든 패턴에서 포인트 추출 실패. content:', content.substring(0, 200) + '...');
            }
        }
    }
    
    if (point) {
        pointDisplay.innerHTML = `
            <div class="point-value">${point}</div>
            <div class="point-label">${pointLabel}</div>
        `;
        console.log('포인트 표시 완료:', point);
    } else {
        pointDisplay.innerHTML = `
            <div class="point-value">-</div>
            <div class="point-label">포인트 없음</div>
        `;
        console.log('포인트 표시 완료: 포인트 없음');
    }
}








// 공유 링크 설정
function setupShareLink() {
    const shareLinkInput = document.getElementById('share-link');
    if (shareLinkInput) {
        shareLinkInput.value = window.location.href;
        console.log('공유 링크 설정 완료:', window.location.href);
    }
}

// 분석 결과를 이미지로 저장
async function saveAnalysisResult() {
    try {
        console.log('분석 결과 이미지 저장 시작...');
        
        // 분석 결과 텍스트 길이 계산
        const analysisText = analysisResults?.raw_analysis || '분석 결과를 불러올 수 없습니다.';
        
        // 개선된 높이 계산 함수 사용
        const calculatedHeight = calculateOptimalHeight(analysisText, 400, 4000);
        
        console.log('분석 결과 높이 계산 완료:', calculatedHeight);
        
        // 4단계 내용을 캡처할 요소 생성
        const captureElement = document.createElement('div');
        captureElement.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            width: 800px;
            height: ${calculatedHeight}px;
            background: white;
            padding: 40px;
            border-radius: 15px;
            border: 2px solid #D45858;
            font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
            color: #333;
            overflow: hidden;
        `;
        
        // 분석 결과 내용 구성
        const analysisContent = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="font-size: 2.5em; margin: 0;">AI 브랜딩 실장이 바라본 당신의 얼굴</h1>
            </div>
            
            <div style="margin-bottom: 30px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 4em; font-weight: bold; margin-bottom: 10px;">
                        ${document.querySelector('.point-value')?.textContent || 'B'}
                    </div>
                    <div style="font-size: 1.2em; color: #666;">포인트</div>
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; border: 1px solid #e9ecef;">
                <div style="line-height: 1.8; font-size: 1.1em; white-space: pre-line; word-wrap: break-word;">
                    ${analysisText}
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #666; font-size: 0.9em;">
                Better Me - AI 외모 분석 결과
            </div>
        `;
        
        captureElement.innerHTML = analysisContent;
        document.body.appendChild(captureElement);
        
        // html2canvas로 이미지 생성
        const canvas = await html2canvas(captureElement, {
            width: 800,
            height: calculatedHeight,
            backgroundColor: 'white',
            scale: 2,
            useCORS: true,
            allowTaint: true
        });
        
        // 이미지 다운로드
        const link = document.createElement('a');
        link.download = `AI_외모분석결과_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        // 임시 요소 제거
        document.body.removeChild(captureElement);
        
        console.log('분석 결과 이미지 저장 완료');
        
    } catch (error) {
        console.error('분석 결과 이미지 저장 실패:', error);
        
    }
}


// 반복 타이핑 효과 함수
function startRepeatingTypeWriter(element, text, speed = 80) {
    let isRunning = true;
    
    function typeWriter() {
        if (!isRunning) return;
        
        let i = 0;
        element.innerHTML = '';
        
        function type() {
            if (!isRunning) return;
            
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                i++;
                setTimeout(type, speed);
            } else {
                // 타이핑 완료 후 잠시 대기 후 다시 시작
                setTimeout(() => {
                    if (isRunning) {
                        typeWriter();
                    }
                }, 1000); // 1초 대기 후 반복
            }
        }
        
        type();
    }
    
    // 타이핑 시작
    typeWriter();
    
    // 정지 함수 반환 (필요시 사용)
    return {
        stop: () => {
            isRunning = false;
        }
    };
}

// 반복 타이핑 효과가 있는 진행 상태 업데이트
function updateProgressStatusWithRepeatingTyping(text, speed = 80) {
    const progressText = document.getElementById('analysis-progress-text');
    if (progressText) {
        // 이전 타이핑 효과 정지
        if (window.currentTypeWriter) {
            window.currentTypeWriter.stop();
        }
        
        // 새로운 반복 타이핑 효과 시작
        window.currentTypeWriter = startRepeatingTypeWriter(progressText, text, speed);
    }
}

// 텍스트 길이에 따른 정확한 높이 계산 함수
function calculateOptimalHeight(text, baseHeight, maxHeight = 3000) {
    if (!text) return baseHeight;
    
    // 텍스트 줄 수 계산
    const lines = text.split('\n').length;
    
    // 줄당 높이 (line-height: 1.8 * font-size: 1.1em)
    const lineHeight = 28;
    
    // 계산된 높이
    let calculatedHeight = baseHeight + (lines * lineHeight) + 100;
    
    // 최소/최대 높이 제한
    calculatedHeight = Math.max(calculatedHeight, baseHeight + 200);
    calculatedHeight = Math.min(calculatedHeight, maxHeight);
    
    console.log('높이 계산 상세:', {
        textLength: text.length,
        lines,
        baseHeight,
        calculatedHeight,
        maxHeight
    });
    
    return calculatedHeight;
}

// 분석 결과를 서버에 저장
async function saveAnalysisResultToServer(isAutoSave = false) {
    try {
        console.log('분석 결과 서버 저장 시작');
        
        if (!analysisResults) {
            console.log('저장할 분석 결과가 없습니다.');
            return;
        }
        
        // 이미지 데이터 준비 (base64 데이터만 포함)
        const imageDataForStorage = {};
        if (uploadedImages.front && uploadedImages.front.dataUrl) {
            imageDataForStorage.front = { dataUrl: uploadedImages.front.dataUrl };
        }
        if (uploadedImages['45'] && uploadedImages['45'].dataUrl) {
            imageDataForStorage['45'] = { dataUrl: uploadedImages['45'].dataUrl };
        }
        if (uploadedImages['90'] && uploadedImages['90'].dataUrl) {
            imageDataForStorage['90'] = { dataUrl: uploadedImages['90'].dataUrl };
        }
        
        const response = await fetch(`${getApiBaseUrl()}/api/save-analysis-result`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                analysisResult: analysisResults.raw_analysis,
                uploadedImages: imageDataForStorage
            })
        });
        
        if (!response.ok) {
            throw new Error(`API 호출 실패: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('분석 결과 저장 성공:', result.resultId);
            
            // 공유 링크 업데이트
            updateShareLink(result.resultId);
            
            // 자동 저장이 아닌 경우에만 성공 메시지 표시
            if (!isAutoSave) {
                showSuccess('분석 결과가 저장되었습니다. 링크를 복사하여 공유할 수 있습니다!');
            }
        } else {
            throw new Error(result.error || '저장에 실패했습니다.');
        }
        
    } catch (error) {
        console.error('분석 결과 저장 실패:', error);
        // 오류가 발생해도 앱은 계속 작동
    }
}

// ChatGPT 응답을 4단계와 동일한 구조로 변환

// 분석 결과를 Figma 디자인에 맞게 구조화된 HTML로 변환
function formatAnalysisResult(text) {
    if (!text) return '';
    
    // 텍스트를 줄 단위로 분할
    const lines = text.split('\n').filter(line => line.trim());
    let html = '';
    let currentSection = '';
    let sectionContent = '';
    
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        
        // 숫자로 시작하는 제목 (1. 2. 3. 등) - Figma 디자인의 메인 제목
        if (/^\d+\./.test(trimmedLine)) {
            // 이전 섹션 닫기
            if (currentSection) {
                html += `<div class="section">
                    <div class="main-title">${currentSection}</div>
                    <div class="content-text">${sectionContent}</div>
                    <div class="divider"></div>
                </div>`;
                sectionContent = '';
            }
            
            // 제목을 Figma 디자인에 맞게 구성
            const sectionNumber = trimmedLine.match(/^(\d+)\./)[1];
            const iconMap = {
                '1': '👤', '2': '📏', '3': '✨', '4': '👁️', '5': '👃', '6': '👄', '7': '🏆', '8': '⭐'
            };
            const icon = iconMap[sectionNumber] || '📋';
            const titleText = trimmedLine.replace(/^\d+\.\s*/, '');
            currentSection = `${icon} ${sectionNumber}. ${titleText}`;
        }
        // 콜론으로 끝나는 소제목 (정면기준:, 45도/90도 기준: 등)
        else if (trimmedLine.includes(':') && !trimmedLine.includes('**')) {
            sectionContent += `<div class="subtitle">${trimmedLine}</div>`;
        }
        // 강조 텍스트 (**텍스트**)
        else if (trimmedLine.includes('**')) {
            const formattedLine = trimmedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            sectionContent += `<div class="content-line">${formattedLine}</div>`;
        }
        // 빈 줄이 아닌 일반 텍스트
        else if (trimmedLine.length > 0) {
            sectionContent += `<div class="content-line">${trimmedLine}</div>`;
        }
        
        // 마지막 줄인 경우 섹션 닫기
        if (index === lines.length - 1) {
            if (currentSection) {
                html += `<div class="section">
                    <div class="main-title">${currentSection}</div>
                    <div class="content-text">${sectionContent}</div>
                </div>`;
            }
        }
    });
    
    // 전체를 Figma 디자인 컨테이너로 감싸기
    return `<div class="analysis-result-container">${html}</div>`;
}

// 페이지 가시성 변경 감지 설정
function setupVisibilityChangeDetection() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log('페이지가 다시 보임 - 분석 상태 확인');
            
            // 4단계에서 분석 중인 경우 진행 상태 확인
            if (currentStep === 4) {
                const savedSessionId = sessionStorage.getItem('beautyAI_analysisSessionId');
                if (savedSessionId) {
                    console.log('저장된 세션 ID로 진행 상태 확인:', savedSessionId);
                    checkAnalysisProgress(savedSessionId);
                }
            }
            
        }
    });
}

// 분석 진행 상태 확인 함수
async function checkAnalysisProgress(sessionId) {
    try {
        const response = await fetch(`${getApiBaseUrl()}/api/analysis-progress/${sessionId}`);
        
        if (!response.ok) {
            console.log('진행 상태 조회 실패');
            return;
        }
        
        const result = await response.json();
        
        if (result.success) {
            const progress = result.progress;
            console.log('현재 분석 진행 상태:', progress);
            
            if (progress.status === 'completed') {
                // AI 분석이 완료된 경우 4단계로 자동 이동
                console.log('AI 분석 완료되어 4단계로 자동 이동');
                const oldStep = currentStep;
                currentStep = 4;
                showDebugLog(`[AUTO] 단계 전환: ${oldStep} → ${currentStep}`);
                updateProgressSteps();
                showStep(4);  // showCurrentStep() 대신 showStep(4) 호출
                saveAppState();
                
                // 세션 ID 제거
                sessionStorage.removeItem('beautyAI_analysisSessionId');
                
                    const completionMessage = document.documentElement.lang === 'en' ? 'AI analysis completed!' : 'AI 분석이 완료되었습니다!';
                    showSuccess(completionMessage);
                
            } else if (progress.status === 'failed') {
                // 분석이 실패한 경우 오류 메시지 표시
                console.log('분석 실패:', progress.message);
                const errorMessage = document.documentElement.lang === 'en' ? 'AI analysis failed: ' + progress.message : 'AI 분석에 실패했습니다: ' + progress.message;
                showError(errorMessage);
                
                // 세션 ID 제거
                sessionStorage.removeItem('beautyAI_analysisSessionId');
            }
            // 'analyzing' 상태는 계속 진행
        }
        
    } catch (error) {
        console.error('분석 진행 상태 확인 오류:', error);
    }
}

// 분석 진행 상태 모니터링 함수




// 공유 링크 업데이트
function updateShareLink(resultId) {
    const shareInput = document.getElementById('share-link');
    if (shareInput) {
        const shareUrl = `${getApiBaseUrl()}/share/${resultId}`;
        shareInput.value = shareUrl;
        console.log('공유 링크 업데이트:', shareUrl);
    }
}

// 공유 링크 복사
function copyShareLink() {
    const shareLinkInput = document.getElementById('share-link');
    if (shareLinkInput) {
        shareLinkInput.select();
        shareLinkInput.setSelectionRange(0, 99999); // 모바일 지원
        
        try {
            document.execCommand('copy');
            
        } catch (err) {
            // 최신 브라우저용 Clipboard API 사용
            navigator.clipboard.writeText(shareLinkInput.value).then(() => {
                
            }).catch(() => {
                
            });
        }
    }
}

// 이 함수는 더 이상 사용하지 않음 (제거됨)

// 이 함수들은 더 이상 사용하지 않음 (제거됨)

// 적용된 개선사항 표시
function displayAppliedImprovements() {
    const appliedImprovements = document.getElementById('applied-improvements');
    appliedImprovements.innerHTML = '';
    
    // 실제 AI 분석 결과가 있는 경우 해당 결과 사용
    if (analysisResults && analysisResults.analysis) {
        const content = analysisResults.analysis;
        
        // AI 응답에서 개선사항 추출 (간단한 키워드 기반)
        const improvements = [];
        
        if (content.includes('피부') || content.includes('skin')) {
            improvements.push('피부 톤 개선 및 균일화');
        }
        if (content.includes('컨투어') || content.includes('윤곽')) {
            improvements.push('자연스러운 컨투어링 적용');
        }
        if (content.includes('화장') || content.includes('메이크업')) {
            improvements.push('메이크업 기법 적용');
        }
        if (content.includes('헤어') || content.includes('hair')) {
            improvements.push('헤어스타일 최적화');
        }
        
        // 기본 개선사항 추가
        if (improvements.length === 0) {
            improvements.push('AI 분석 기반 개선사항 적용');
        }
        
        improvements.forEach(improvement => {
            const item = document.createElement('div');
            item.className = 'applied-item';
            item.textContent = improvement;
            appliedImprovements.appendChild(item);
        });
    } else {
        // AI 분석 결과가 없는 경우 기본 메시지
        const item = document.createElement('div');
        item.className = 'applied-item';
        const waitingMessage = document.documentElement.lang === 'en' ? 'Waiting for AI analysis results...' : 'AI 분석 결과를 기다리는 중...';
        item.textContent = waitingMessage;
        appliedImprovements.appendChild(item);
    }
}

// 이미지 다운로드
function downloadImage() {
    const improvedImage = document.getElementById('final-improved');
    if (improvedImage.src) {
        const link = document.createElement('a');
        link.download = 'improved-image.jpg';
        link.href = improvedImage.src;
        link.click();
    }
}

// 프로세스 재시작
function restartProcess() {
    currentStep = 1;
    uploadedImage = null;
    analysisResults = null;
    feedbackData = null;
    
    // 모든 단계 패널 숨기기
    document.querySelectorAll('.step-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // 첫 번째 단계 표시
    document.getElementById('step-1').classList.add('active');
    
    // 진행 단계 업데이트
    updateProgressSteps();
    
    // 동의 체크박스 초기화
    document.getElementById('photo-consent').checked = false;
    document.getElementById('service-terms').checked = false;
    
    // 이미지 제거
    removeImage();
    
    // 분석 결과 초기화
    document.getElementById('analysis-details').style.display = 'none';
    document.getElementById('improved-placeholder').style.display = 'block';
    document.getElementById('final-improved').style.display = 'none';
    
    // 페이지 상단으로 스크롤
    window.scrollTo(0, 0);
}

// 로딩 모달 표시
function showLoadingModal(message) {
    const modal = document.getElementById('loading-modal');
    const modalMessage = document.getElementById('modal-message');
    
    modalMessage.textContent = message;
    modal.style.display = 'flex';
}

// 로딩 모달 숨기기
function hideLoadingModal() {
    const modal = document.getElementById('loading-modal');
    modal.style.display = 'none';
}

// 에러 메시지 표시
function showError(message) {
    
}

// 성공 메시지 표시
function showSuccess(message) {
    
}

// AI 거부 메시지 표시
function showAIRefusalMessage(details) {
    const refusalMessage = `🤖 AI가 이미지 분석을 거부했습니다

📸 **거부 원인:**
${details.reason || 'AI 모델 정책상 분석할 수 없습니다'}

💡 **해결 방법:**
• 더 명확한 얼굴 사진을 업로드해주세요
• 선글라스나 모자 등 가림이 없는 사진을 사용해주세요
• 밝은 조명에서 정면을 향한 사진을 촬영해주세요
• 사진을 다시 업로드해주세요

🔄 **다시 시도하기** 버튼을 클릭하여 새로운 사진을 업로드해주세요.`;
    
    
}

// 키보드 단축키
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && currentStep < 5) {
        nextStep();
    } else if (e.key === 'Escape') {
        hideLoadingModal();
    }
});

// 이미지 다운로드 함수
function downloadImage(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    console.log('이미지 다운로드 완료:', filename);
}


// 4단계만 저장하는 함수
async function saveStep4AsImage() {
    try {
        console.log('=== 4단계 이미지 저장 시작 ===');
        
        // 현재 날짜와 시간으로 파일명 생성
        const now = new Date();
        const dateString = now.toISOString().slice(0, 19).replace(/[:-]/g, '');
        
        // 4단계 캡처
        console.log('4단계 캡처 시작...');
        const step4Element = document.getElementById('step-4');
        console.log('4단계 요소 찾기 결과:', step4Element);
        
        
        if (step4Element) {
            // html2canvas 라이브러리 확인
            if (typeof html2canvas === 'undefined') {
                console.error('html2canvas 라이브러리가 로드되지 않았습니다.');
                showError('이미지 저장을 위한 라이브러리가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
                return;
            }
            console.log('html2canvas 라이브러리 확인 완료');
            
            // 4단계 이미지들이 제대로 로드되었는지 확인
            const step4Images = step4Element.querySelectorAll('img[id*="step4-uploaded-image"]');
            console.log('4단계에서 찾은 이미지 개수:', step4Images.length);
            
            // 이미지 로딩 상태 확인 및 강제 로딩
            let allImagesLoaded = true;
            for (let img of step4Images) {
                console.log(`이미지 확인:`, img.id, 'src:', img.src, 'complete:', img.complete);
                
                if (img.src && img.src !== '') {
                    // 이미지가 로드되지 않았다면 강제로 로드
                    if (!img.complete) {
                        console.log(`${img.id} 이미지 로딩 대기 중...`);
                        await new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => {
                                console.warn(`${img.id} 이미지 로딩 타임아웃`);
                                resolve();
                            }, 2000);
                            
                            img.onload = () => {
                                clearTimeout(timeout);
                                console.log(`${img.id} 이미지 로딩 완료`);
                                resolve();
                            };
                            
                            img.onerror = () => {
                                clearTimeout(timeout);
                                console.error(`${img.id} 이미지 로딩 실패`);
                                allImagesLoaded = false;
                                resolve();
                            };
                        });
                    }
    } else {
                    console.warn(`${img.id} 이미지 src가 비어있음`);
                    allImagesLoaded = false;
                }
            }
            
            console.log('모든 이미지 로딩 상태:', allImagesLoaded);
            
            // 4단계를 현재 화면에 표시된 상태로 캡처
            const canvas4 = await html2canvas(step4Element, {
                scale: 2, // 고해상도로 설정
                useCORS: true,
                allowTaint: true,
                logging: true, // 디버깅을 위해 로깅 활성화
                removeContainer: false,
                imageTimeout: 5000, // 이미지 로딩 대기 시간 증가
                foreignObjectRendering: false,
                backgroundColor: '#ffffff' // 배경색 설정
            });
            
            console.log('4단계 캔버스 크기:', canvas4.width, 'x', canvas4.height);
            
            // 4단계 이미지 다운로드
            const fileName4 = `beauty-ai-step4-${dateString}.png`;
            downloadImage(canvas4, fileName4);
            console.log('4단계 이미지 저장 완료:', fileName4);
            
            // 성공 메시지
            showSuccess('4단계 이미지가 성공적으로 저장되었습니다!');
            
        } else {
            console.error('4단계 요소를 찾을 수 없습니다.');
            showError('4단계 요소를 찾을 수 없습니다.');
        }
        
    } catch (error) {
        console.error('4단계 이미지 저장 중 오류 발생:', error);
        showError('4단계 이미지 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 업로드 옵션 모달은 제거됨 - 기본 파일 선택 다이얼로그 사용

// 갤러리 선택 함수는 제거됨 - 직접 input 클릭으로 대체

// 카메라 선택 함수는 제거됨 - 기본 파일 선택 다이얼로그 사용

// 카메라 모달 관련 함수들은 제거됨 - 이제 직접 input[type="file"] 사용

// 업로드 옵션 모달 닫기 함수는 제거됨


// 함수들을 전역 스코프에 등록
window.saveAsImages = saveAsImages;
window.saveStep4AsImage = saveStep4AsImage;
// 모달 관련 전역 함수들은 제거됨

// 결제 페이지로 이동하는 함수
function goToPayment() {
    const currentLang = document.documentElement.lang || 'ko';
    const paymentUrl = currentLang === 'en' ? 'payment-en.html' : 'payment.html';
    window.location.href = paymentUrl;
}
window.goToPayment = goToPayment;

// 페이지 새로고침 시 경고
window.addEventListener('beforeunload', function(e) {
    if (currentStep > 1) {
        e.preventDefault();
        e.returnValue = '새로고침시 처음부터 다시 진행하셔야 합니다. 정말로 새로고침 하시겠습니까?';
    }
});






