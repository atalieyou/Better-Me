// 전역 변수
let currentStep = 1;
let uploadedImage = null;
let analysisResults = null;
let feedbackData = null;

// API URL을 동적으로 가져오는 함수
function getApiBaseUrl() {
    const hostname = window.location.hostname;
    const port = window.location.port || '3000';
    
    // localhost나 로컬 IP인 경우 HTTP 사용
    if (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
        return `http://${hostname}:${port}`;
    }
    
    // 외부 도메인인 경우 HTTPS 사용
    return `https://${hostname}`;
}

// WebSocket 관련 전역 변수
let ws = null;
let sessionId = null;
let isWebSocketConnected = false;

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM이 로드되었습니다. 앱을 초기화합니다...');
    try {
        await initializeApp();
        setupRealTimeValidation();
        checkUrlHash();
        console.log('앱 초기화 완료');
    } catch (error) {
        console.error('앱 초기화 중 오류 발생:', error);
    }
});

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
    
    const nextButton = document.getElementById('next-to-payment');
    
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
        // WebSocket 서버 URL 설정 (개발 환경)
        const wsUrl = 'ws://localhost:3000/ws';
        
        // WebSocket 연결 생성
        const ws = new WebSocket(wsUrl);
        
        // 연결 성공 시
        ws.onopen = function() {
            console.log('WebSocket 연결 성공');
            
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
                        
                        
                    case 'error':
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
            // 오류가 발생해도 앱 실행을 중단하지 않음
            console.log('WebSocket 연결 실패했지만 앱은 계속 실행됩니다.');
        };
        
        // 연결 종료 시
        ws.onclose = function(event) {
            console.log('WebSocket 연결 종료:', event.code, event.reason);
            
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

// AI 분석 완료 처리
function handleAnalysisComplete(result) {
    console.log('AI 분석 완료 처리:', result);
    
    try {
        // 분석 결과 저장
        analysisResults = result;
        
        // 분석 결과를 화면에 표시
        displayFullAIResponse(analysisResults);
        
        // 4단계에서 5단계로 자동 이동
        currentStep = 5;
        updateProgressSteps();
        showCurrentStep();
        
        // 상태 저장
        saveAppState();
        
        // 사용자에게 알림
        showSuccess('AI 분석이 완료되었습니다!');
        
    } catch (error) {
        console.error('분석 완료 처리 중 오류:', error);
    }
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
        await restoreAppState();
        
        setupEventListeners();
        console.log('이벤트 리스너 설정 완료');
        
        // WebSocket 연결 설정
        setupWebSocket();
        
        updateProgressSteps();
        console.log('진행 단계 업데이트 완료');
        
        // 현재 단계 표시
        showCurrentStep();
        
        // 결제 폼 초기화
        togglePaymentForm();
        
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
            
            // 이미지 데이터 설정 (base64 데이터가 있는 경우)
            if (result.result.uploadedImages) {
                uploadedImages = result.result.uploadedImages;
            }
            
            // 5단계로 이동하여 결과 표시
            currentStep = 5;
            updateProgressSteps();
            showCurrentStep();
            
            
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

// 모바일 디버깅을 위한 화면 로그 표시 함수 (개발 환경에서만)
function showDebugLog(message) {
    // 개발 환경에서만 표시 (localhost 또는 로컬 IP)
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname.startsWith('192.168.') ||
                         window.location.hostname.startsWith('10.') ||
                         window.location.hostname.startsWith('172.');
    
    // 디버그 정보 표시
    console.log('🔍 디버그 로그 호출:', {
        hostname: window.location.hostname,
        isDevelopment: isDevelopment,
        message: message
    });
    
    if (!isDevelopment) {
        console.log('❌ 프로덕션 환경이므로 디버그 로그 숨김');
        return; // 프로덕션 환경에서는 표시하지 않음
    }
    
    // 디버그 로그 컨테이너가 없으면 생성
    let debugContainer = document.getElementById('debug-log-container');
    if (!debugContainer) {
        debugContainer = document.createElement('div');
        debugContainer.id = 'debug-log-container';
        debugContainer.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 10000;
            max-height: 200px;
            overflow-y: auto;
            font-family: monospace;
        `;
        document.body.appendChild(debugContainer);
    }
    
    // 로그 메시지 추가
    const logEntry = document.createElement('div');
    logEntry.textContent = new Date().toLocaleTimeString() + ': ' + message;
    logEntry.style.marginBottom = '2px';
    debugContainer.appendChild(logEntry);
    
    // 최대 10개 로그만 유지
    while (debugContainer.children.length > 10) {
        debugContainer.removeChild(debugContainer.firstChild);
    }
    
    // 자동 스크롤
    debugContainer.scrollTop = debugContainer.scrollHeight;
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
        if (savedStep) {
            const step = parseInt(savedStep);
            console.log('저장된 단계 복원:', step);
            
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
            console.log('4단계에서 새로고침됨. 3단계로 이동합니다.');
            currentStep = 3;  // ✅ 4단계는 3단계로 이동
            sessionStorage.setItem('beautyAI_currentStep', '3');
            // 업로드된 이미지들은 유지 (3단계에서 필요)
            // uploadedImages 초기화하지 않음
        } else if (step === 5) {
            console.log('=== 5단계에서 새로고침됨 ===');
            console.log('서버에서 분석 결과 확인 중...');
            
            // 모바일 디버깅을 위한 화면 로그 표시
            showDebugLog('=== 5단계에서 새로고침됨 ===');
            showDebugLog('서버에서 분석 결과 확인 중...');
            
            // 서버에서 분석 결과 로드 시도
            const serverResult = await loadAnalysisFromServer();
            console.log('서버 로드 결과:', serverResult);
            showDebugLog('서버 로드 결과: ' + (serverResult ? '성공' : '실패'));
            
            if (serverResult) {
                console.log('✅ 서버에서 분석 결과 복원 성공:', serverResult);
                showDebugLog('✅ 서버에서 분석 결과 복원 성공');
                
                // 분석 결과 복원
                analysisResults = { raw_analysis: serverResult.analysisResult };
                
                // 이미지 데이터 복원
                if (serverResult.uploadedImages) {
                    uploadedImages = serverResult.uploadedImages;
                }
                
                console.log('✅ 분석 결과 유효. 5단계 유지');
                showDebugLog('✅ 분석 결과 유효. 5단계 유지');
                currentStep = step;
            } else {
                // 서버에서 로드 실패 시 sessionStorage 폴백 시도
                console.log('❌ 서버 로드 실패, sessionStorage 폴백 시도...');
                showDebugLog('❌ 서버 로드 실패, sessionStorage 폴백 시도...');
                const savedAnalysis = sessionStorage.getItem('beautyAI_analysisResults');
                console.log('sessionStorage 분석 결과:', savedAnalysis ? '있음' : '없음');
                showDebugLog('sessionStorage 분석 결과: ' + (savedAnalysis ? '있음' : '없음'));
                
                if (savedAnalysis) {
                    try {
                        analysisResults = JSON.parse(savedAnalysis);
                        console.log('✅ sessionStorage에서 분석 결과 복원 성공');
                        
                        if (analysisResults && analysisResults.raw_analysis) {
                            console.log('✅ 분석 결과 유효. 5단계 유지');
                            currentStep = step;
                        } else {
                            console.log('❌ 분석 결과가 유효하지 않음. 3단계로 이동');
                            currentStep = 3;
                            sessionStorage.setItem('beautyAI_currentStep', '3');
                        }
                    } catch (e) {
                        console.error('❌ 분석 결과 파싱 실패:', e);
                        console.log('❌ 분석 결과 없음. 3단계로 이동');
                        currentStep = 3;
                        sessionStorage.setItem('beautyAI_currentStep', '3');
                    }
                } else {
                    console.log('❌ 분석 결과 없음. 3단계로 이동');
                    currentStep = 3;
                    sessionStorage.setItem('beautyAI_currentStep', '3');
                }
            }
        } else {
            currentStep = step;
        }
        }
        
        // 저장된 이미지들 복원
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
        
        // 저장된 분석 결과 복원
        const savedAnalysis = sessionStorage.getItem('beautyAI_analysisResults');
        console.log('저장된 분석 결과 확인:', savedAnalysis ? '있음' : '없음');
        if (savedAnalysis) {
            try {
                analysisResults = JSON.parse(savedAnalysis);
                console.log('저장된 분석 결과 복원 완료:', analysisResults);
            } catch (e) {
                console.error('분석 결과 파싱 실패:', e);
            }
        } else {
            console.log('저장된 분석 결과가 없습니다');
        }
        
        
        console.log('=== 앱 상태 복원 완료 ===');
        console.log('복원된 상태:', {
            currentStep,
            hasImages: !!uploadedImages,
            hasAnalysis: !!analysisResults,
        });
        
        // 상태 복원 후 UI 업데이트
        updateUIAfterRestore();
        

        
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
    
    try {
        // 모든 단계 패널 숨기기
        const allSteps = document.querySelectorAll('.step-panel');
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
            
            // 5단계인 경우 분석 결과 검증 (restoreAppState에서 이미 검증했으므로 제거)
            // if (step === 5) {
            //     if (!analysisResults || !analysisResults.raw_analysis) {
            //         console.log('5단계에서 분석 결과 없음. 3단계로 이동');
            //         currentStep = 3;
            //         sessionStorage.setItem('beautyAI_currentStep', '3');
            //         showStep(3);
            //         return;
            //     }
            // }
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
    if (isUIUpdating) {
        console.log('=== UI 업데이트 중복 호출 방지 ===');
        return;
    }
    
    isUIUpdating = true;
    console.log('=== UI 업데이트 시작 ===');
    
    try {
        // 현재 단계에 맞는 UI 표시
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
            // 이미지가 있다면 이미지 표시 (기존 함수 활용)
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

        console.log('📤 저장할 데이터:', {
            hasAnalysis: !!analysisResults.raw_analysis,
            hasImages: Object.keys(imageDataForStorage).length,
            currentStep: currentStep
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
                currentStep: currentStep
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
        
        // 결과 ID를 sessionStorage에 저장
        sessionStorage.setItem('beautyAI_serverResultId', result.resultId);
        console.log('💾 서버 결과 ID 저장됨:', result.resultId);
        
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
    try {
        const resultId = sessionStorage.getItem('beautyAI_serverResultId');
        console.log('🔍 서버 저장된 분석 결과 ID:', resultId);
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

        console.log('🌐 서버에서 분석 결과 로드 시도 중...');
        console.log('📡 API URL:', `${getApiBaseUrl()}/api/get-analysis-result-server/${resultId}`);

        // 타임아웃 설정 (5초)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${getApiBaseUrl()}/api/get-analysis-result-server/${resultId}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('📡 서버 응답 상태:', response.status);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('❌ 서버에서 분석 결과를 찾을 수 없습니다');
                sessionStorage.removeItem('beautyAI_serverResultId');
            } else if (response.status === 410) {
                console.log('❌ 분석 결과가 만료되었습니다');
                sessionStorage.removeItem('beautyAI_serverResultId');
            } else {
                throw new Error(`서버 로드 실패: ${response.status}`);
            }
            return null;
        }

        const result = await response.json();
        console.log('✅ 서버에서 분석 결과 로드 완료:', result);
        
        return result.result;
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('❌ 서버 로드 타임아웃:', error);
        } else {
            console.error('❌ 서버 로드 중 오류:', error);
        }
        return null;
    }
}

// 앱 상태 저장 (하이브리드 방식)
async function saveAppState() {
    console.log('=== 앱 상태 저장 시작 ===');
    showDebugLog('=== 앱 상태 저장 시작 ===');
    showDebugLog(`[SAVE] 현재 단계 저장 시도: ${currentStep}`);
    
    try {
        // 현재 단계 저장
        sessionStorage.setItem('beautyAI_currentStep', currentStep.toString());
        showDebugLog(`[SAVE] 단계 저장 완료: ${currentStep}`);
        
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
        const photoConsent = document.getElementById('photo-consent');
        const serviceTerms = document.getElementById('service-terms');
        
        if (!photoConsent) {
            throw new Error('photo-consent 요소를 찾을 수 없습니다');
        }
        if (!serviceTerms) {
            throw new Error('service-terms 요소를 찾을 수 없습니다');
        }
        
        console.log('동의 체크박스 요소들 찾기 완료');
        
        // 실시간 유효성 검사
        [photoConsent, serviceTerms].forEach(element => {
            element.addEventListener('change', validateConsent);
        });
        
        console.log('동의 체크박스 설정 완료');
    } catch (error) {
        console.error('동의 체크박스 설정 중 오류:', error);
        throw error;
    }
}

// 사진 활용 동의 유효성 검사
function validateConsent() {
    const serviceTerms = document.getElementById('service-terms');
    const privacyConsent = document.getElementById('privacy-consent');
    const privacyTransfer = document.getElementById('privacy-transfer');
    
    // 요소가 존재하는지 확인
    if (!serviceTerms || !privacyConsent || !privacyTransfer) {
        console.error('체크박스 요소를 찾을 수 없습니다:', {
            serviceTerms: !!serviceTerms,
            privacyConsent: !!privacyConsent,
            privacyTransfer: !!privacyTransfer
        });
        return false;
    }
    
    return serviceTerms.checked && privacyConsent.checked && privacyTransfer.checked;
}

// 결제 관련 함수들
function processPayment() {
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    
    if (paymentMethod === 'kakao') {
        processKakaoPayment();
    } else if (paymentMethod === 'toss') {
        processTossPayment();
    } else if (paymentMethod === 'naver') {
        processNaverPayment();
    } else if (paymentMethod === 'card') {
        if (validateCardPayment()) {
            processCardPayment();
        }
    }
}

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

// 결제 방법 변경 시 폼 표시/숨김
function togglePaymentForm() {
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    
    // 모든 결제 폼 숨김
    document.getElementById('kakao-payment-form').style.display = 'none';
    document.getElementById('toss-payment-form').style.display = 'none';
    document.getElementById('naver-payment-form').style.display = 'none';
    document.getElementById('card-payment-form').style.display = 'none';
    
    // 선택된 결제 방법에 따라 폼 표시
    if (paymentMethod === 'kakao') {
        document.getElementById('kakao-payment-form').style.display = 'block';
    } else if (paymentMethod === 'toss') {
        document.getElementById('toss-payment-form').style.display = 'block';
    } else if (paymentMethod === 'naver') {
        document.getElementById('naver-payment-form').style.display = 'block';
    } else if (paymentMethod === 'card') {
        document.getElementById('card-payment-form').style.display = 'block';
        // 테스트용 샘플 데이터 자동 입력
        fillTestCardData();
    }
}

// 테스트용 카드 데이터 자동 입력
function fillTestCardData() {
    document.getElementById('card-number').value = '1234-5678-9012-3456';
    document.getElementById('expiry-date').value = '12/25';
    document.getElementById('cvv').value = '123';
    document.getElementById('card-holder').value = '홍길동';
}

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
    
    if (currentStep < 5) {
        // 1단계에서 2단계로 이동할 때
        if (currentStep === 1) {
            console.log('1단계에서 2단계로 이동 시작');
            const oldStep = currentStep;
            currentStep++;
            showDebugLog(`[NEXT] 단계 전환: ${oldStep} → ${currentStep}`);
            console.log('currentStep 업데이트됨:', currentStep);
            updateProgressSteps();
            showCurrentStep();
            
            // 상태 저장
            saveAppState();
            console.log('1단계에서 2단계로 이동 완료');
        }
        // 2단계에서 3단계로 이동할 때 (결제 완료 확인)
        else if (currentStep === 2) {
            // 결제 완료 여부 확인
            if (!window.paymentCompleted) {
                showError('결제를 먼저 완료해주세요.');
                return;
            }
            
            const oldStep = currentStep;
            currentStep++;
            showDebugLog(`[NEXT] 단계 전환: ${oldStep} → ${currentStep}`);
            updateProgressSteps();
            showCurrentStep();
            
            // 3단계에서 이미지 업로드 이벤트 리스너 설정
            setupImageUploadEventListeners();
            
            // 상태 저장
            saveAppState();
        } else if (currentStep === 3) {
            // 3단계에서 4단계로 이동할 때
            // 모든 사진이 업로드되었는지 확인
            if (!checkAllImagesUploaded()) {
                showError('모든 사진을 업로드해주세요.');
                return;
            }
            
            // 4단계로 이동
            const oldStep = currentStep;
            currentStep++;
            showDebugLog(`[NEXT] 단계 전환: ${oldStep} → ${currentStep}`);
            updateProgressSteps();
            showCurrentStep();
            
            // 4단계에서 AI 분석 시작 (분석 완료 후 자동으로 5단계로 이동)
            startAnalysis();
            
            // 상태 저장
            saveAppState();
        } else if (currentStep === 4) {
            // 4단계에서 5단계로 이동할 때
            console.log('=== 4단계에서 5단계로 이동 ===');
            
                currentStep = 5;
                updateProgressSteps();
                showCurrentStep();
                
                
                // 상태 저장
                saveAppState();
        } else if (currentStep === 5) {
            
            // 상태 저장
            console.log('상태 저장 시작...');
            saveAppState();
            console.log('상태 저장 완료');
            
            console.log('5단계에서 6단계로 이동 완료');
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
                if (uploadedImages.front && uploadedImages.front.dataUrl) {
                    const step4ImageFront = document.getElementById('step4-uploaded-image-front');
                    if (step4ImageFront) {
                        step4ImageFront.src = uploadedImages.front.dataUrl;
                        console.log('4단계 정면 이미지 표시 완료');
                    }
                }
                if (uploadedImages['45'] && uploadedImages['45'].dataUrl) {
                    const step4Image45 = document.getElementById('step4-uploaded-image-45');
                    if (step4Image45) {
                        step4Image45.src = uploadedImages['45'].dataUrl;
                        console.log('4단계 45도 측면 이미지 표시 완료');
                    }
                }
                if (uploadedImages['90'] && uploadedImages['90'].dataUrl) {
                    const step4Image90 = document.getElementById('step4-uploaded-image-90');
                    if (step4Image90) {
                        step4Image90.src = uploadedImages['90'].dataUrl;
                        console.log('4단계 90도 측면 이미지 표시 완료');
                    }
                }
                

                

                }, 100);
            }
            
            // 5단계일 때 이미지 표시
            if (panelStep === 5) {
                setTimeout(() => {
                    console.log('=== 5단계 활성화 시 이미지 확인 ===');
                    
                    // 5단계에서 업로드된 이미지들 표시 (3장 모두)
                if (uploadedImages.front && uploadedImages.front.dataUrl) {
                    const step5ImageFront = document.getElementById('step5-uploaded-image-front');
                    if (step5ImageFront) {
                        step5ImageFront.src = uploadedImages.front.dataUrl;
                        console.log('5단계 정면 이미지 표시 완료');
                    }
                }
                if (uploadedImages['45'] && uploadedImages['45'].dataUrl) {
                    const step5Image45 = document.getElementById('step5-uploaded-image-45');
                    if (step5Image45) {
                        step5Image45.src = uploadedImages['45'].dataUrl;
                        console.log('5단계 45도 측면 이미지 표시 완료');
                    }
                }
                if (uploadedImages['90'] && uploadedImages['90'].dataUrl) {
                    const step5Image90 = document.getElementById('step5-uploaded-image-90');
                    if (step5Image90) {
                        step5Image90.src = uploadedImages['90'].dataUrl;
                        console.log('5단계 90도 측면 이미지 표시 완료');
                    }
                }
                
                    
                    
                    // 5단계로 이동할 때 "분석된 이미지들" 제목으로 스크롤
                    const step5Element = document.getElementById('step-5');
                    if (step5Element) {
                        const analyzedImagesTitle = step5Element.querySelector('h3');
                        if (analyzedImagesTitle) {
                            analyzedImagesTitle.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'start' 
                            });
                            console.log('5단계 "분석된 이미지들" 제목으로 스크롤 완료');
                        } else {
                            console.log('분석된 이미지들 제목을 찾을 수 없어 상단으로 스크롤');
                            step5Element.scrollIntoView({ 
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
        // 진행률 초기화
        const progressFill = document.getElementById('analysis-progress-fill');
        const progressText = document.getElementById('analysis-progress-text');
        
        // 초기 상태 설정
        progressFill.style.width = '0%';
        updateProgressStatusWithRepeatingTyping('분석 준비 중...', 80);
        
        // 1단계: 이미지 전처리 (10%) - 타이핑 효과와 독립적으로 실행
        progressFill.style.width = '10%';
        updateProgressStatusWithRepeatingTyping('이미지 전처리 중...', 80);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // 2단계: 이미지 업로드 (20%) - 타이핑 효과와 독립적으로 실행
        progressFill.style.width = '20%';
        updateProgressStatusWithRepeatingTyping('이미지 업로드 중...', 80);
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // 3단계: 서버 전송 (30%) - 타이핑 효과와 독립적으로 실행
        progressFill.style.width = '30%';
        updateProgressStatusWithRepeatingTyping('서버로 전송 중...', 80);
        await new Promise(resolve => setTimeout(resolve, 500));


        try {
            // 4단계: AI 분석 시작 (40%)
            progressFill.style.width = '40%';
            updateProgressStatusWithRepeatingTyping('AI 분석 시작...', 80);
            await new Promise(resolve => setTimeout(resolve, 600));
            
            // 5단계: 백엔드 API 호출 (50%)
            progressFill.style.width = '50%';
            updateProgressStatusWithRepeatingTyping('AI 모델에 이미지 전송 중...', 80);
            
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
                // 5단계: 분석 완료 (100%)
                progressFill.style.width = '100%';
                updateProgressStatusWithRepeatingTyping('분석 완료!', 80);
                await new Promise(resolve => setTimeout(resolve, 500));
                
                console.log('서버 응답 성공:', result);
                console.log('분석 결과 데이터:', result.analysis);
                console.log('세션 ID:', result.sessionId);
                
                // 분석 결과 저장
                analysisResults = {
                    raw_analysis: result.analysis.analysis
                };
                console.log('전역 변수에 저장된 데이터:', analysisResults);
                
                // 분석 진행 상태 모니터링 시작
                if (result.sessionId) {
                    // 세션 ID를 세션 스토리지에 저장
                    sessionStorage.setItem('beautyAI_analysisSessionId', result.sessionId);
                    console.log('분석 세션 ID 저장됨:', result.sessionId);
                }
                
                // 상태 저장
                saveAppState();
                
                // 분석 완료 후 5단계로 이동
                console.log('AI 분석 완료! 5단계로 이동합니다.');
                
                // 5단계로 자동 이동
                currentStep = 5;
                updateProgressSteps();
                showCurrentStep();
                
                // 분석 결과 표시
                displayFullAIResponse(analysisResults);
                
                console.log('5단계로 이동 완료');
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
            showError(`분석 처리 중 오류가 발생했습니다: ${apiError.message}`);
        }

    } catch (error) {
        // 오류 발생 시 진행률 표시
        progressFill.style.width = '100%';
        progressText.textContent = '분석 오류 발생';
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.error('분석 오류:', error);
        showError(`분석 중 오류가 발생했습니다: ${error.message}`);
    }
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
                <h3 style="margin-bottom: 15px;">전체 분석 결과</h3>
                <div style="line-height: 1.8; font-size: 1.1em; white-space: pre-line; word-wrap: break-word;">
                    ${analysisText}
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #666; font-size: 0.9em;">
                Better me - AI 외모 분석 결과
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
        alert('이미지 저장에 실패했습니다: ' + error.message);
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

// ChatGPT 응답을 5단계와 동일한 구조로 변환

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
                // AI 분석이 완료된 경우 5단계로 자동 이동
                console.log('AI 분석 완료되어 5단계로 자동 이동');
                currentStep = 5;
                updateProgressSteps();
                showCurrentStep();
                
                // 세션 ID 제거
                sessionStorage.removeItem('beautyAI_analysisSessionId');
                
                    showSuccess('AI 분석이 완료되었습니다!');
                
            } else if (progress.status === 'failed') {
                // 분석이 실패한 경우 오류 메시지 표시
                console.log('분석 실패:', progress.message);
                showError('AI 분석에 실패했습니다: ' + progress.message);
                
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
            alert('링크가 클립보드에 복사되었습니다!');
        } catch (err) {
            // 최신 브라우저용 Clipboard API 사용
            navigator.clipboard.writeText(shareLinkInput.value).then(() => {
                alert('링크가 클립보드에 복사되었습니다!');
            }).catch(() => {
                alert('링크 복사에 실패했습니다. 수동으로 복사해주세요.');
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
        item.textContent = 'AI 분석 결과를 기다리는 중...';
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
    alert(message); // 실제 앱에서는 더 세련된 에러 표시 방식 사용
}

// 성공 메시지 표시
function showSuccess(message) {
    alert(message); // 실제 앱에서는 더 세련된 성공 표시 방식 사용
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
    
    alert(refusalMessage);
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


// 5단계만 저장하는 함수
async function saveStep5AsImage() {
    try {
        console.log('=== 5단계 이미지 저장 시작 ===');
        
        // 현재 날짜와 시간으로 파일명 생성
        const now = new Date();
        const dateString = now.toISOString().slice(0, 19).replace(/[:-]/g, '');
        
        // 5단계 캡처
        console.log('5단계 캡처 시작...');
        const step5Element = document.getElementById('step-5');
        console.log('5단계 요소 찾기 결과:', step5Element);
        
        if (step5Element) {
            // 5단계 이미지들이 제대로 로드되었는지 확인
            const step5Images = step5Element.querySelectorAll('img[id*="step5-uploaded-image"]');
            console.log('5단계에서 찾은 이미지 개수:', step5Images.length);
            
            // 이미지 로딩 상태 확인 및 강제 로딩
            let allImagesLoaded = true;
            for (let img of step5Images) {
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
            
            // 5단계를 현재 화면에 표시된 상태로 캡처
            const canvas5 = await html2canvas(step5Element, {
                scale: 2, // 고해상도로 설정
                useCORS: true,
                allowTaint: true,
                logging: true, // 디버깅을 위해 로깅 활성화
                removeContainer: false,
                imageTimeout: 5000, // 이미지 로딩 대기 시간 증가
                foreignObjectRendering: false,
                backgroundColor: '#ffffff' // 배경색 설정
            });
            
            console.log('5단계 캔버스 크기:', canvas5.width, 'x', canvas5.height);
            
            // 5단계 이미지 다운로드
            const fileName5 = `beauty-ai-step5-${dateString}.png`;
            downloadImage(canvas5, fileName5);
            console.log('5단계 이미지 저장 완료:', fileName5);
            
            // 성공 메시지
            showSuccess('5단계 이미지가 성공적으로 저장되었습니다!');
            
        } else {
            console.error('5단계 요소를 찾을 수 없습니다.');
            showError('5단계 요소를 찾을 수 없습니다.');
        }
        
    } catch (error) {
        console.error('5단계 이미지 저장 중 오류 발생:', error);
        showError('5단계 이미지 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 업로드 옵션 모달은 제거됨 - 기본 파일 선택 다이얼로그 사용

// 갤러리 선택 함수는 제거됨 - 직접 input 클릭으로 대체

// 카메라 선택 함수는 제거됨 - 기본 파일 선택 다이얼로그 사용

// 카메라 모달 관련 함수들은 제거됨 - 이제 직접 input[type="file"] 사용

// 업로드 옵션 모달 닫기 함수는 제거됨

// 함수들을 전역 스코프에 등록
window.saveAsImages = saveAsImages;
window.saveStep5AsImage = saveStep5AsImage;
// 모달 관련 전역 함수들은 제거됨

// 페이지 새로고침 시 경고
window.addEventListener('beforeunload', function(e) {
    if (currentStep > 1) {
        e.preventDefault();
        e.returnValue = '새로고침시 처음부터 다시 진행하셔야 합니다. 정말로 새로고침 하시겠습니까?';
    }
});





