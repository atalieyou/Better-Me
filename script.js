// 전역 변수
let currentStep = 1;
let uploadedImage = null;
let analysisResults = null;
let feedbackData = null;

// API URL을 동적으로 가져오는 함수
function getApiBaseUrl() {
    return window.location.hostname === 'localhost' 
        ? 'http://localhost:3000' 
        : `https://${window.location.hostname}`;
}

// WebSocket 관련 전역 변수
let ws = null;
let sessionId = null;
let isWebSocketConnected = false;

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM이 로드되었습니다. 앱을 초기화합니다...');
    try {
        initializeApp();
        console.log('앱 초기화 완료');
    } catch (error) {
        console.error('앱 초기화 중 오류 발생:', error);
    }
});

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
                        
                    case 'makeup_tips_ready':
                        // 메이크업 팁 생성 완료 알림
                        handleMakeupTipsReady(data.tips);
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
        
        // 4단계에서 5단계로 자동 이동
        currentStep = 5;
        updateProgressSteps();
        showCurrentStep();
        
        // 분석 결과 표시
        displayFullGPTResponse(analysisResults);
        
        // 상태 저장
        saveAppState();
        
        // 사용자에게 알림
        showSuccess('AI 분석이 완료되었습니다!');
        
    } catch (error) {
        console.error('분석 완료 처리 중 오류:', error);
    }
}

// 메이크업 팁 준비 완료 처리
function handleMakeupTipsReady(tips) {
    console.log('메이크업 팁 준비 완료 처리:', tips);
    
    try {
        // 메이크업 팁 저장
        window.makeupTips = tips;
        
        // 현재 단계에 따라 적절한 단계로 이동
        if (currentStep === 4) {
            // 4단계에서 5단계로 자동 이동
            console.log('4단계에서 5단계로 자동 이동');
            currentStep = 5;
            updateProgressSteps();
            showCurrentStep();
            
            // 5단계에서 메이크업 팁 표시
            displayMakeupTips();
        } else if (currentStep === 5) {
        // 5단계에서 6단계로 자동 이동
            console.log('5단계에서 6단계로 자동 이동');
        currentStep = 6;
        updateProgressSteps();
        showCurrentStep();
        
            // 6단계에서 메이크업 팁 표시
        displayMakeupTips();
        }
        
        // 상태 저장
        saveAppState();
        
        console.log('메이크업 팁 준비 완료 - 자동 진행됨');
        
    } catch (error) {
        console.error('메이크업 팁 준비 완료 처리 중 오류:', error);
    }
}

// 앱 초기화
function initializeApp() {
    console.log('=== 앱 초기화 시작 ===');
    
    try {
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
        
        // 세션 스토리지에서 이전 상태 복원
        restoreAppState();
        
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
            window.makeupTips = result.result.makeupTips;
            
            // 이미지 데이터 설정 (base64 데이터가 있는 경우)
            if (result.result.uploadedImages) {
                uploadedImages = result.result.uploadedImages;
            }
            
            // 6단계로 이동하여 결과 표시
            currentStep = 6;
            updateProgressSteps();
            showCurrentStep();
            
            // 메이크업 팁 표시
            displayMakeupTips();
            
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

// 앱 상태 복원
function restoreAppState() {
    console.log('=== 앱 상태 복원 시작 ===');
    
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
            console.log('5단계에서 새로고침됨. 5단계에 머뭅니다.');
            currentStep = step;
        } else if (step === 6) {
            console.log('6단계에서 새로고침됨. 6단계에 머뭅니다.');
            currentStep = step;
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
        if (savedAnalysis) {
            try {
                analysisResults = JSON.parse(savedAnalysis);
                console.log('저장된 분석 결과 복원 완료');
            } catch (e) {
                console.error('분석 결과 파싱 실패:', e);
            }
        }
        
        // 저장된 메이크업 팁 복원
        const savedMakeupTips = sessionStorage.getItem('beautyAI_makeupTips');
        if (savedMakeupTips) {
            try {
                window.makeupTips = JSON.parse(savedMakeupTips);
                console.log('저장된 메이크업 팁 복원 완료');
            } catch (e) {
                console.error('메이크업 팁 파싱 실패:', e);
            }
        }
        
        console.log('=== 앱 상태 복원 완료 ===');
        console.log('복원된 상태:', {
            currentStep,
            hasImages: !!uploadedImages,
            hasAnalysis: !!analysisResults,
            hasMakeupTips: !!window.makeupTips
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
                displayFullGPTResponse(analysisResults);
                // 상태 저장 추가
                saveAppState();
            }
            
            // 메이크업 팁이 있다면 표시
            if (window.makeupTips) {
                displayMakeupTips();
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

// 앱 상태 저장
function saveAppState() {
    console.log('=== 앱 상태 저장 시작 ===');
    
    try {
        // 현재 단계 저장
        sessionStorage.setItem('beautyAI_currentStep', currentStep.toString());
        
        // 이미지들 데이터 저장
        if (uploadedImages && (uploadedImages.front || uploadedImages['45'] || uploadedImages['90'])) {
            sessionStorage.setItem('beautyAI_uploadedImages', JSON.stringify(uploadedImages));
        }
        
        // 분석 결과 저장
        if (analysisResults) {
            sessionStorage.setItem('beautyAI_analysisResults', JSON.stringify(analysisResults));
        }
        
        // 메이크업 팁 저장
        if (window.makeupTips) {
            sessionStorage.setItem('beautyAI_makeupTips', JSON.stringify(window.makeupTips));
        }
        
        console.log('=== 앱 상태 저장 완료 ===');
        console.log('저장된 상태:', {
            currentStep,
            hasImages: !!uploadedImages,
            hasAnalysis: !!analysisResults,
            hasMakeupTips: !!window.makeupTips
        });
        
    } catch (error) {
        console.error('앱 상태 저장 중 오류:', error);
    }
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
    const photoConsent = document.getElementById('photo-consent').checked;
    const serviceTerms = document.getElementById('service-terms').checked;
    
    return photoConsent && serviceTerms;
}

// 결제 관련 함수들
function processPayment() {
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    
    if (paymentMethod === 'card') {
        if (validateCardPayment()) {
            processCardPayment();
        }
    } else if (paymentMethod === 'transfer') {
        processBankTransfer();
    } else if (paymentMethod === 'mobile') {
        processMobilePayment();
    }
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
    document.getElementById('card-payment-form').style.display = 'none';
    document.getElementById('transfer-payment-form').style.display = 'none';
    document.getElementById('mobile-payment-form').style.display = 'none';
    
    // 선택된 결제 방법에 따라 폼 표시
    if (paymentMethod === 'card') {
        document.getElementById('card-payment-form').style.display = 'block';
        // 테스트용 샘플 데이터 자동 입력
        fillTestCardData();
    } else if (paymentMethod === 'transfer') {
        document.getElementById('transfer-payment-form').style.display = 'block';
    } else if (paymentMethod === 'mobile') {
        document.getElementById('mobile-payment-form').style.display = 'block';
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
    
    if (currentStep < 6) {
        // 1단계에서 2단계로 이동할 때
        if (currentStep === 1) {
            console.log('1단계에서 2단계로 이동 시작');
            currentStep++;
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
            
            currentStep++;
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
            currentStep++;
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
                
            // 5단계에서 메이크업 팁 표시 (있는 경우)
            if (window.makeupTips && window.makeupTips.length > 0) {
                displayMakeupTips();
            }
                
                // 상태 저장
                saveAppState();
        } else if (currentStep === 5) {
            // 5단계에서 6단계로 이동할 때
            console.log('=== 5단계에서 6단계로 이동 시도 ===');
            console.log('이동 전 currentStep:', currentStep);
            
            currentStep = 6;
            console.log('이동 후 currentStep:', currentStep);
            
            console.log('진행 단계 업데이트 시작...');
            updateProgressSteps();
            console.log('진행 단계 업데이트 완료');
            
            console.log('현재 단계 표시 시작...');
            showCurrentStep();
            console.log('현재 단계 표시 완료');
            
            // 6단계에서 메이크업 팁 표시
            console.log('메이크업 팁 표시 시작...');
            displayMakeupTips();
            console.log('메이크업 팁 표시 완료');
            
            // 분석 결과 저장 API 호출 (자동 저장 - 메시지 없음)
            console.log('분석 결과 자동 저장 시작...');
            saveAnalysisResultToServer(true); // 자동 저장 플래그 전달
            console.log('분석 결과 자동 저장 완료');
            
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
            
            // 5단계일 때 이미지와 메이크업 팁 표시
            if (panelStep === 5) {
                setTimeout(() => {
                    console.log('=== 5단계 활성화 시 이미지 및 메이크업 팁 확인 ===');
                    
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
                
                    console.log('window.makeupTips 상태:', window.makeupTips);
                    console.log('window.makeupTips 타입:', typeof window.makeupTips);
                    console.log('window.makeupTips 길이:', window.makeupTips ? window.makeupTips.length : 'undefined');
                    
                    // 메이크업 팁이 있으면 표시
                    if (window.makeupTips && window.makeupTips.length > 0) {
                        console.log('5단계에서 메이크업 팁 표시 시작');
                        displayMakeupTips();
                    } else {
                        console.log('5단계에서 메이크업 팁이 아직 생성되지 않았습니다.');
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
function compressImage(file, quality = 0.75, maxSize = 800) {
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
        const compressedImage = await compressImage(file, 0.75, 800);
        
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
                throw new Error(`API 호출 실패: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                // 6단계: 분석 완료 (100%)
                progressFill.style.width = '100%';
                updateProgressStatusWithRepeatingTyping('분석 완료!', 80);
                await new Promise(resolve => setTimeout(resolve, 500));
                
                console.log('서버 응답 성공:', result);
                console.log('분석 결과 데이터:', result.analysis);
                console.log('세션 ID:', result.sessionId);
                
                // 서버에서 보내는 구조: { analysis: { analysis: raw_analysis } }
                analysisResults = {
                    raw_analysis: result.analysis.analysis
                };
                console.log('전역 변수에 저장된 데이터:', analysisResults);
                
                // 분석 진행 상태 모니터링 시작
                if (result.sessionId) {
                    // 세션 ID를 세션 스토리지에 저장
                    sessionStorage.setItem('beautyAI_analysisSessionId', result.sessionId);
                    console.log('분석 세션 ID 저장됨:', result.sessionId);
                    
                    // WebSocket으로 진행 상황 모니터링 (폴링 제거)
                    console.log('WebSocket으로 진행 상황 모니터링 시작');
                }
                
                // 상태 저장
                saveAppState();
                
                completeAnalysis();
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
            
            console.error('분석 처리 중 오류 발생:', apiError.message);
            showError('분석 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
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

// 분석 완료
async function completeAnalysis() {
    console.log('completeAnalysis 함수 호출됨');
    console.log('현재 analysisResults:', analysisResults);
    
    // 분석 결과가 없는 경우 처리
    if (!analysisResults) {
        console.error('분석 결과가 없습니다.');
        showError('분석 결과를 가져올 수 없습니다.');
        return;
    }
    
    console.log('분석 완료 성공, 분석 결과를 화면에 표시');
    
    // 분석 결과를 화면에 표시
    displayFullGPTResponse(analysisResults);
    
    // AI 분석 완료 후 자동으로 메이크업 팁 생성 시작
    console.log('AI 분석 완료! 메이크업 팁 자동 생성 시작...');
    
    // 3단계에서 "메이크업 팁 생성 중..." 메시지 표시
    const progressText = document.getElementById('analysis-progress-text');
    if (progressText) {
        updateProgressStatusWithRepeatingTyping('메이크업 팁 생성 중...', 80);
    }
    
    // WebSocket을 통해 메이크업 팁 생성 요청
    try {
        console.log('WebSocket을 통해 메이크업 팁 생성 요청...');
        
        if (window.ws && window.ws.readyState === WebSocket.OPEN) {
            // WebSocket으로 메이크업 팁 생성 요청
            const message = {
                type: 'request_makeup_tips',
                analysisResult: analysisResults.raw_analysis
            };
            
            window.ws.send(JSON.stringify(message));
            console.log('WebSocket 메이크업 팁 생성 요청 전송 완료');
                
                // 진행률 텍스트 업데이트
                if (progressText) {
                updateProgressStatusWithRepeatingTyping('메이크업 팁 분석 중...', 80);
                }
            } else {
            console.error('WebSocket 연결이 없습니다. 일반 API로 메이크업 팁 생성...');
            
            // WebSocket이 없으면 일반 API 사용
            const result = await generateMakeupTipsOnly();
            
            if (result && result.success && result.makeupTips && result.makeupTips.length > 0) {
                console.log('일반 API로 메이크업 팁 생성 완료!');
                window.makeupTips = result.makeupTips;
                saveAppState();
                
                // 4단계에서 5단계로 자동 이동
                currentStep = 5;
                updateProgressSteps();
                showCurrentStep();
                displayMakeupTips();
                
                if (progressText) {
                    updateProgressStatusWithRepeatingTyping('메이크업 팁 생성 완료!', 100);
                }
            }
        }
        
    } catch (error) {
        console.error('메이크업 팁 생성 중 오류:', error);
        
        // 진행률 텍스트 요소 가져오기
        const progressText = document.getElementById('analysis-progress-text');
        
        // 오류 발생 시 진행률 텍스트 업데이트
        if (progressText) {
            updateProgressStatusWithRepeatingTyping('메이크업 팁 생성 실패', 80);
        }
        
        // 오류 발생 시 사용자에게 알림
        alert('메이크업 팁 생성에 실패했습니다: ' + error.message);
        
        // 오류 발생 시에도 텍스트 숨김
        setTimeout(() => {
            if (progressText) {
                progressText.style.display = 'none';
            }
        }, 3000); // 3초 후 텍스트 숨김
    }
}



// GPT-4o 전체 응답을 표시하는 함수
function displayFullGPTResponse(analysisResults) {
    console.log('displayFullGPTResponse 함수 호출됨:', analysisResults);
    
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



// 메이크업 팁 가져오기 및 피드백 적용 결과 표시
async function generateImprovedImage() {
    console.log('메이크업 팁 생성 시작...');
    console.log('analysisResults:', analysisResults);
    
    try {
        // 원본 이미지를 최종 표시 영역에 복사 (정면 사진)
        const finalOriginalImg = document.getElementById('final-original');
        if (finalOriginalImg && uploadedImages.front && uploadedImages.front.dataUrl) {
            finalOriginalImg.src = uploadedImages.front.dataUrl;
            console.log('원본 이미지 복사 완료');
        }
        
        // 기존 외모 분석 결과 확인
        if (!analysisResults || !analysisResults.raw_analysis) {
            throw new Error('외모 분석 결과가 없습니다. 먼저 얼굴 분석을 완료해주세요.');
        }
        
        console.log('분석 결과 확인됨, 메이크업 팁 요청 시작...');
        
        // 메이크업 팁 API 호출
        const response = await fetch(`${getApiBaseUrl()}/api/get-makeup-tips`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                analysisResult: analysisResults.raw_analysis
            })
        });

        console.log('API 응답 상태:', response.status);
        console.log('API 응답 헤더:', response.headers);

        if (!response.ok) {
            throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
        }

        const responseText = await response.text();
        console.log('API 응답 텍스트:', responseText.substring(0, 200) + '...');

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON 파싱 오류:', parseError);
            throw new Error('서버에서 잘못된 응답을 받았습니다: ' + responseText.substring(0, 100));
        }
        
        if (result.success) {
            console.log('메이크업 팁 생성 성공!');
            console.log('메이크업 팁 내용:', result.makeupTips.substring(0, 200) + '...');
            
            // 메이크업 팁 저장
            window.makeupTips = result.makeupTips;
            
            console.log('showFeedbackApplicationResult 호출 전');
            // 피드백 적용 결과 페이지로 이동
            showFeedbackApplicationResult();
            console.log('showFeedbackApplicationResult 호출 후');
        } else {
            console.error('메이크업 팁 생성 실패:', result);
            throw new Error(result.reason || '메이크업 팁을 가져올 수 없습니다.');
        }
        
    } catch (error) {
        console.error('메이크업 팁 가져오기 오류:', error);
        
        // 사용자에게 더 명확한 오류 메시지 표시
        let errorMessage = '메이크업 팁을 가져오는 중 오류가 발생했습니다.\n\n';
        
        if (error.message.includes('서버 오류')) {
            errorMessage += '서버 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('외모 분석 결과가 없습니다')) {
            errorMessage += '먼저 얼굴 분석을 완료해주세요.';
        } else if (error.message.includes('JSON 파싱')) {
            errorMessage += '서버 응답에 문제가 있습니다. 잠시 후 다시 시도해주세요.';
        } else {
            errorMessage += error.message;
        }
        
        alert(errorMessage);
        
        // 오류 발생 시 4단계로 돌아가기
        currentStep = 4;
        updateProgressSteps();
        showCurrentStep();
    }
}

// 새로운 통합 함수: AI 분석과 메이크업 팁을 함께 처리
async function generateAnalysisAndMakeupTips() {
    console.log('=== generateAnalysisAndMakeupTips 함수 시작 ===');
    
    try {
        // 1단계: AI 외모 분석 시작
        console.log('1단계: AI 외모 분석 시작...');
        await startAnalysis();
        console.log('1단계: AI 외모 분석 완료');
        
        // 2단계: 메이크업 팁 생성
        console.log('2단계: 메이크업 팁 생성 시작...');
        
        // 원본 이미지를 최종 표시 영역에 복사
        const finalOriginalImg = document.getElementById('final-original');
        if (finalOriginalImg && uploadedImage && uploadedImage.dataUrl) {
            finalOriginalImg.src = uploadedImage.dataUrl;
            console.log('원본 이미지 복사 완료');
        }
        
        // 분석 결과 확인
        console.log('분석 결과 확인:', analysisResults);
        if (!analysisResults || !analysisResults.raw_analysis) {
            throw new Error('외모 분석 결과가 없습니다.');
        }
        
        console.log('메이크업 팁 API 호출 시작...');
        // 메이크업 팁 API 호출
        const response = await fetch(`${getApiBaseUrl()}/api/get-makeup-tips`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                analysisResult: analysisResults.raw_analysis
            })
        });

        console.log('메이크업 팁 API 응답 상태:', response.status);

        if (!response.ok) {
            throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('메이크업 팁 API 응답:', result);
        
        if (result.success) {
            console.log('메이크업 팁 생성 성공!');
            console.log('메이크업 팁 내용:', result.makeupTips.substring(0, 200) + '...');
            
            // 메이크업 팁 저장
            window.makeupTips = result.makeupTips;
            console.log('window.makeupTips 저장 완료:', window.makeupTips);
            
            console.log('=== AI 분석과 메이크업 팁 모두 완료! ===');
        } else {
            throw new Error(result.reason || '메이크업 팁을 가져올 수 없습니다.');
        }
        
    } catch (error) {
        console.error('=== 통합 처리 오류 ===:', error);
        
        // 오류 발생 시 사용자에게 알림
        alert('처리 중 오류가 발생했습니다: ' + error.message);
        
        // 오류 발생 시 3단계로 돌아가기
        currentStep = 3;
        updateProgressSteps();
        showCurrentStep();
    }
}

// 메이크업 팁만 생성하는 함수 (AI 분석 완료 후 사용)
// 전역 변수로 중복 호출 방지 플래그 설정
window.isGeneratingMakeupTips = window.isGeneratingMakeupTips || false;

async function generateMakeupTipsOnly() {
    // 중복 호출 방지
    if (window.isGeneratingMakeupTips) {
        console.log('=== 이미 메이크업 팁 생성 중입니다. 중복 호출 무시 ===');
        return;
    }
    
    window.isGeneratingMakeupTips = true; // 생성 시작 플래그 설정
    console.log('=== generateMakeupTipsOnly 함수 시작 ===');
    console.log('현재 시간:', new Date().toISOString());
    

    
    try {
        // 분석 결과 확인
        console.log('분석 결과 확인:', analysisResults);
        if (!analysisResults || !analysisResults.raw_analysis) {
            throw new Error('외모 분석 결과가 없습니다.');
        }
        
        console.log('분석 결과 내용 (처음 200자):', analysisResults.raw_analysis.substring(0, 200));
        
        console.log('메이크업 팁 API 호출 시작...');
        console.log('API 엔드포인트:', `${getApiBaseUrl()}/api/get-makeup-tips`);
        
        // 메이크업 팁 API 호출 (타임아웃 설정)
        console.log('=== fetch 요청 시작 ===');
        
        // AbortController를 사용한 타임아웃 설정 (10분)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000); // 10분(600초) 타임아웃
        
        try {
            const response = await fetch(`${getApiBaseUrl()}/api/get-makeup-tips`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    analysisResult: analysisResults.raw_analysis,
                    background: false,  // ✅ 기본값: false
                    timestamp: Date.now()
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId); // 타임아웃 취소

            console.log('=== fetch 응답 받음 ===');
            console.log('메이크업 팁 API 응답 상태:', response.status);
            console.log('응답 헤더:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API 오류 응답 내용:', errorText);
                throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
            }

            console.log('=== JSON 파싱 시작 ===');
            const result = await response.json();
            console.log('=== JSON 파싱 완료 ===');
            console.log('메이크업 팁 API 응답:', result);
            console.log('result 타입:', typeof result);
            console.log('result.success:', result.success);
            console.log('result.makeupTips:', result.makeupTips);
            
            if (result.success) {
                console.log('메이크업 팁 생성 성공!');
                console.log('메이크업 팁 내용 (처음 200자):', result.makeupTips.substring(0, 200) + '...');
                console.log('메이크업 팁 전체 길이:', result.makeupTips.length);
                
                // 메이크업 팁 저장
                window.makeupTips = result.makeupTips;
                console.log('window.makeupTips 저장 완료:', window.makeupTips);
                console.log('window.makeupTips 타입:', typeof window.makeupTips);
                console.log('window.makeupTips 길이:', window.makeupTips ? window.makeupTips.length : 'undefined');
                
                console.log('=== 메이크업 팁 생성 완료! ===');
                
                // 상태 저장
                saveAppState();
                
                // 성공 시 플래그 리셋
                window.isGeneratingMakeupTips = false;
                

                
                // 성공 결과 반환
                return {
                    success: true,
                    makeupTips: result.makeupTips,
                    message: '메이크업 팁 생성 완료'
                };
            } else {
                console.error('API 응답에서 success가 false:', result);
                throw new Error(result.reason || '메이크업 팁을 가져올 수 없습니다.');
            }
            
        } catch (fetchError) {
            clearTimeout(timeoutId); // 타임아웃 정리
            
            // 네트워크 일시 중단 오류인 경우 백그라운드에서 계속 시도
            if (fetchError.message.includes('Failed to fetch') || 
                fetchError.message.includes('ERR_NETWORK_IO_SUSPENDED') ||
                fetchError.name === 'TypeError') {
                console.log('=== 네트워크 일시 중단 감지, 백그라운드에서 계속 시도 ===');
                
                // WebSocket으로 메이크업 팁 생성 상태 모니터링 (폴링 제거)
                console.log('WebSocket으로 메이크업 팁 생성 상태 모니터링 시작');
                console.log('WebSocket으로 메이크업 팁 생성 상태 모니터링 완료');
                
                // 백그라운드 처리 시작 후 백그라운드 상태로 반환
                return {
                    success: true,
                    makeupTips: null,
                    message: '백그라운드에서 메이크업 팁 생성 중...',
                    background: true,
                    status: 'background_processing'
                };
            }
            
            // 기타 모든 오류도 백그라운드 처리로 전환
            console.log('=== 기타 오류 감지, 백그라운드에서 계속 시도 ===');
            console.log('오류 타입:', fetchError.constructor.name);
            console.log('오류 메시지:', fetchError.message);
            
                            // WebSocket으로 메이크업 팁 생성 상태 모니터링 (폴링 제거)
                console.log('WebSocket으로 메이크업 팁 생성 상태 모니터링 시작');
                console.log('WebSocket으로 메이크업 팁 생성 상태 모니터링 완료');
            
            // 백그라운드 처리 시작 후 성공으로 반환하여 오류 처리 방지
            return {
                success: true,
                makeupTips: null,
                message: '백그라운드에서 메이크업 팁 생성 중...',
                background: true
            };
            
            if (fetchError.name === 'AbortError') {
                console.error('=== 메이크업 팁 생성 타임아웃 (10분 초과) ===');
                throw new Error('메이크업 팁 생성 시간이 10분을 초과했습니다. 다시 시도해주세요.');
            }
            
            console.error('=== 메이크업 팁 생성 오류 ===:', fetchError);
            console.error('오류 스택:', fetchError.stack);
            
            // 오류 발생 시 플래그 리셋
            window.isGeneratingMakeupTips = false;
            
            // 오류를 상위로 전파하여 nextStep에서 처리
            throw fetchError;
        }
        
    } catch (error) {
        console.error('=== 메이크업 팁 생성 최종 오류 ===:', error);
        console.error('오류 스택:', error.stack);
        
        // 오류 발생 시 플래그 리셋
        window.isGeneratingMakeupTips = false;
        
        // 오류를 상위로 전파
        throw error;
    }
}

// 기존 메이크업 팁 생성 함수 (별도 사용을 위해 유지)
async function generateMakeupTips() {
    console.log('generateMakeupTips 함수 시작');
    
    try {
        // 3장 사진을 모두 최종 표시 영역에 복사
        if (uploadedImages.front && uploadedImages.front.dataUrl) {
            const finalOriginalImgFront = document.getElementById('final-original-front');
            if (finalOriginalImgFront) {
                finalOriginalImgFront.src = uploadedImages.front.dataUrl;
                console.log('정면 이미지 복사 완료');
            }
        }
        if (uploadedImages['45'] && uploadedImages['45'].dataUrl) {
            const finalOriginalImg45 = document.getElementById('final-original-45');
            if (finalOriginalImg45) {
                finalOriginalImg45.src = uploadedImages['45'].dataUrl;
                console.log('45도 측면 이미지 복사 완료');
            }
        }
        if (uploadedImages['90'] && uploadedImages['90'].dataUrl) {
            const finalOriginalImg90 = document.getElementById('final-original-90');
            if (finalOriginalImg90) {
                finalOriginalImg90.src = uploadedImages['90'].dataUrl;
                console.log('90도 측면 이미지 복사 완료');
            }
        }
        
        // 기존 외모 분석 결과 확인
        if (!analysisResults || !analysisResults.raw_analysis) {
            throw new Error('외모 분석 결과가 없습니다. 먼저 얼굴 분석을 완료해주세요.');
        }
        
        console.log('분석 결과 확인됨, 메이크업 팁 요청 시작...');
        
        // 메이크업 팁 API 호출 (3분 타임아웃 + 재시도 로직)
        let retryCount = 0;
        const maxRetries = 3;
        const timeoutDuration = 180000; // 3분(180초) 타임아웃
        
        while (retryCount < maxRetries) {
            try {
                console.log(`=== 메이크업 팁 생성 시도 ${retryCount + 1}/${maxRetries} ===`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
                
                const response = await fetch(`${getApiBaseUrl()}/api/get-makeup-tips`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        analysisResult: analysisResults.raw_analysis
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId); // 타임아웃 취소

                console.log('API 응답 상태:', response.status);

                if (!response.ok) {
                    throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
                }

                const result = await response.json();
                
                if (result.success) {
                    console.log('메이크업 팁 생성 성공!');
                    console.log('메이크업 팁 내용:', result.makeupTips.substring(0, 200) + '...');
                    
                    // 메이크업 팁 저장
                    window.makeupTips = result.makeupTips;
                    
                    // 메이크업 팁 표시
                    displayMakeupTips();
                    console.log('메이크업 팁 표시 완료');
                    
                    // 성공 시 루프 종료
                    break;
                } else {
                    throw new Error(result.reason || '메이크업 팁을 가져올 수 없습니다.');
                }
                
            } catch (fetchError) {
                clearTimeout(timeoutId); // 타임아웃 정리
                
                if (fetchError.name === 'AbortError') {
                    console.error(`=== 메이크업 팁 생성 타임아웃 (${timeoutDuration/1000}초 초과) ===`);
                    if (retryCount < maxRetries - 1) {
                        console.log(`${retryCount + 1}번째 시도 실패, 재시도 중...`);
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기 후 재시도
                        continue;
                    } else {
                        throw new Error(`메이크업 팁 생성 시간이 ${timeoutDuration/1000}초를 초과했습니다. 다시 시도해주세요.`);
                    }
                }
                
                // 네트워크 오류인 경우 재시도
                if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('ERR_NETWORK_IO_SUSPENDED')) {
                    console.error(`=== 네트워크 오류 발생 (${retryCount + 1}/${maxRetries}) ===`);
                    if (retryCount < maxRetries - 1) {
                        console.log('네트워크 오류로 재시도 중...');
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 대기 후 재시도
                        continue;
                    } else {
                        throw new Error('네트워크 연결에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.');
                    }
                }
                
                // 기타 오류는 즉시 던지기
                throw fetchError;
            }
        }
        
    } catch (error) {
        console.error('메이크업 팁 가져오기 오류:', error);
        
        // 오류 메시지를 더 친화적으로 표시
        let userMessage = '메이크업 팁을 가져오는 중 오류가 발생했습니다.';
        
        if (error.message.includes('타임아웃')) {
            userMessage = '메이크업 팁 생성이 시간 초과되었습니다. 다시 시도해주세요.';
        } else if (error.message.includes('네트워크')) {
            userMessage = '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.';
        } else if (error.message.includes('서버 오류')) {
            userMessage = '서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
        }
        
        // 사용자에게 오류 안내 및 재시도 옵션 제공
        const shouldRetry = confirm(`${userMessage}\n\n재시도하시겠습니까?`);
        
        if (shouldRetry) {
            console.log('사용자가 재시도를 선택했습니다.');
            // 4단계로 돌아가서 다시 시도할 수 있도록
            currentStep = 4;
            updateProgressSteps();
            showCurrentStep();
        } else {
            // 사용자가 재시도를 원하지 않으면 4단계에 머무름
            console.log('사용자가 재시도를 선택하지 않았습니다. 4단계에 머무릅니다.');
            
            // 메이크업 팁 생성 상태를 확인하고 안내
            const progressText = document.getElementById('analysis-progress-text');
            if (progressText) {
                progressText.style.display = 'block';
                if (window.makeupTips && window.makeupTips.length > 0) {
                    updateProgressStatusWithRepeatingTyping('메이크업 팁 생성 완료! 다음 단계로 진행할 수 있습니다.', 80);
                } else {
                    updateProgressStatusWithRepeatingTyping('메이크업 팁 생성 중...', 80);
                }
            }
        }
    }
}

// 피드백 적용 결과 표시
function showFeedbackApplicationResult() {
    console.log('showFeedbackApplicationResult 함수 시작');
    console.log('현재 단계:', currentStep);
    
    // 5단계로 이동 (메이크업 팁 결과 표시)
    currentStep = 5;
    console.log('단계를 5로 변경:', currentStep);
    
    updateProgressSteps();
    console.log('진행 단계 업데이트 완료');
    
    showCurrentStep();
    console.log('현재 단계 표시 완료');
    
    // 메이크업 팁 표시
    displayMakeupTips();
    console.log('showFeedbackApplicationResult 함수 완료');
}

// 메이크업 팁을 6단계 구조에 맞게 표시
function displayMakeupTips() {
    console.log('=== displayMakeupTips 함수 시작 ===');
    console.log('현재 시간:', new Date().toISOString());
    
    // 1. 6단계 이미지들 표시
    if (uploadedImages.front && uploadedImages.front.dataUrl) {
        const step6FrontImg = document.getElementById('step6-uploaded-image-front');
        if (step6FrontImg) {
            step6FrontImg.src = uploadedImages.front.dataUrl;
            console.log('6단계 정면 이미지 표시 완료');
        }
    }
    if (uploadedImages['45'] && uploadedImages['45'].dataUrl) {
        const step645Img = document.getElementById('step6-uploaded-image-45');
        if (step645Img) {
            step645Img.src = uploadedImages['45'].dataUrl;
            console.log('6단계 45도 측면 이미지 표시 완료');
        }
    }
    if (uploadedImages['90'] && uploadedImages['90'].dataUrl) {
        const step690Img = document.getElementById('step6-uploaded-image-90');
        if (step690Img) {
            step690Img.src = uploadedImages['90'].dataUrl;
            console.log('6단계 90도 측면 이미지 표시 완료');
        }
    }
    
    // 2. 메이크업 팁 표시
    console.log('=== 메이크업 팁 상태 확인 ===');
    console.log('window.makeupTips:', window.makeupTips);
    console.log('window.makeupTips 타입:', typeof window.makeupTips);
    console.log('window.makeupTips 길이:', window.makeupTips ? window.makeupTips.length : 'undefined');
    
    if (!window.makeupTips) {
        console.error('=== 메이크업 팁이 없습니다! ===');
        console.error('현재 전역 변수 상태:');
        console.error('- window.makeupTips:', window.makeupTips);
        console.error('- analysisResults:', analysisResults);
        console.error('- uploadedImage:', uploadedImage);
        console.error('메이크업 팁 생성 과정을 확인해주세요.');
        
        // 메이크업 팁이 없는 경우 적절한 안내 메시지 표시
        const makeupTipsContent = document.getElementById('makeup-tips-content');
        if (makeupTipsContent) {
            makeupTipsContent.innerHTML = `
                <div class="loading-message">
                    <div class="loading-title">
                        <i class="fas fa-clock"></i> 메이크업 팁 생성 중...
                    </div>
                    <div class="loading-description">
                        AI가 분석 결과를 바탕으로 맞춤형 메이크업 팁을 생성하고 있습니다.<br>
                        잠시만 기다려주세요.
                    </div>
                    <div class="loading-status">
                        <div class="status-title">현재 상태:</div>
                        <div class="status-content">
                            • 외모 분석 완료 ✓<br>
                            • 메이크업 팁 생성 중... ⏳
                        </div>
                    </div>
                    <div class="loading-info">
                        <i class="fas fa-info-circle"></i> 
                        메이크업 팁 생성이 완료되면 자동으로 표시됩니다.
                    </div>
                </div>
            `;
        }
        
        // WebSocket으로 메이크업 팁 생성 상태 모니터링 (폴링 제거)
        console.log('WebSocket으로 메이크업 팁 생성 상태 모니터링 중...');
        
        return;
    }

    console.log('메이크업 팁 내용:', window.makeupTips.substring(0, 200) + '...');

    const makeupTipsContent = document.getElementById('makeup-tips-content');
    if (!makeupTipsContent) {
        console.error('makeup-tips-content 요소를 찾을 수 없습니다.');
        return;
    }

    console.log('makeup-tips-content 요소 찾음');

    // 새로운 구조화된 메이크업 팁 표시
    console.log('=== formatMakeupTips 호출 전 ===');
    console.log('입력 텍스트 샘플:', window.makeupTips.substring(0, 500));
    
    const formattedTips = formatMakeupTips(window.makeupTips);
    
    console.log('=== formatMakeupTips 결과 ===');
    console.log('생성된 HTML 샘플:', formattedTips.substring(0, 500));
    
    // 중복 컨테이너 제거 - 기존 컨테이너에 직접 내용 삽입 (제목 제거)
    const makeupTipsHtml = formattedTips;
    
    makeupTipsContent.innerHTML = makeupTipsHtml;
    
    console.log('메이크업 팁 표시 완료');
    
    // 메이크업 팁 포인트 표시 (선택사항)
    const makeupPointDisplay = document.getElementById('makeup-point-display');
    if (makeupPointDisplay) {
        makeupPointDisplay.innerHTML = `
            <div class="point-value">💄</div>
            <div class="point-label">메이크업 팁</div>
        `;
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
        alert('이미지 저장에 실패했습니다: ' + error.message);
    }
}

// 메이크업 팁을 이미지로 저장
async function saveMakeupTips() {
    try {
        console.log('메이크업 팁 이미지 저장 시작...');
        
        // 메이크업 팁 텍스트 길이 계산
        const makeupTipsText = window.makeupTips || '메이크업 팁 생성 중...';
        
        // 개선된 높이 계산 함수 사용
        const calculatedHeight = calculateOptimalHeight(makeupTipsText, 500, 4000);
        
        console.log('메이크업 팁 높이 계산 완료:', calculatedHeight);
        
        // 5단계 내용을 캡처할 요소 생성
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
        
        // 메이크업 팁 내용 구성
        const makeupTipsContent = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="font-size: 2.5em; margin: 0;">AI 메이크업 실장의 맞춤형 조언</h1>
            </div>
            
            <div style="margin-bottom: 30px; text-align: center;">
                <img src="${uploadedImage?.dataUrl || ''}" style="max-width: 300px; max-height: 300px; border-radius: 10px; border: 2px solid #D45858;" alt="분석된 이미지">
                <p style="margin-top: 15px; color: #666; font-size: 1.1em;">분석된 이미지</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; border: 1px solid #e9ecef;">
                <h3 style="margin-bottom: 15px;">맞춤형 메이크업 조언</h3>
                <div style="line-height: 1.8; font-size: 1.1em; white-space: pre-line; word-wrap: break-word;">
                    ${makeupTipsText}
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #666; font-size: 0.9em;">
                Better Me - AI 메이크업 팁
            </div>
        `;
        
        captureElement.innerHTML = makeupTipsContent;
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
        link.download = `AI_메이크업팁_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        // 임시 요소 제거
        document.body.removeChild(captureElement);
        
        console.log('메이크업 팁 이미지 저장 완료');
        
    } catch (error) {
        console.error('메이크업 팁 이미지 저장 실패:', error);
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
        
        if (!analysisResults || !window.makeupTips) {
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
                makeupTips: window.makeupTips,
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
function formatMakeupTips(text) {
    if (!text) return '';
    
    console.log('=== formatMakeupTips 함수 시작 ===');
    console.log('입력 텍스트:', text.substring(0, 200) + '...');
    
    // 텍스트를 줄 단위로 분할
    const lines = text.split('\n').filter(line => line.trim());
    console.log('분할된 줄 수:', lines.length);
    
    let html = '';
    let currentSection = '';
    let sectionContent = '';
    
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        console.log(`줄 ${index + 1}:`, trimmedLine);
        
        // 숫자로 시작하는 제목 (1. 2. 3. 등) - 5단계와 동일한 main-title 구조
        if (/^\d+\./.test(trimmedLine)) {
            console.log('제목 발견:', trimmedLine);
            
            // 이전 섹션 닫기
            if (currentSection) {
                html += `<div class="section">
                    <div class="main-title">${currentSection}</div>
                    <div class="content-text">${sectionContent}</div>
                    <div class="divider"></div>
                </div>`;
                sectionContent = '';
            }
            
            // 제목을 5단계와 동일한 구조로 구성
            const sectionNumber = trimmedLine.match(/^(\d+)\./)[1];
            const iconMap = {
                '1': '👁️', '2': '👃', '3': '👄', '4': '✨', '5': '🎨', '6': '💉', '7': '📺'
            };
            const icon = iconMap[sectionNumber] || '📋';
            const titleText = trimmedLine.replace(/^\d+\.\s*/, '');
            currentSection = `${icon} ${sectionNumber}. ${titleText}`;
            
            console.log('새 섹션 시작:', currentSection);
        }
        // 링크가 포함된 텍스트 (콜론 기준으로 분리하여 하이퍼링크 생성) - 먼저 처리
        else if (trimmedLine.includes('http')) {
            console.log('링크 포함 텍스트 발견:', trimmedLine);
            
            // 콜론(:)을 기준으로 분리
            const colonIndex = trimmedLine.indexOf(':');
            if (colonIndex !== -1) {
                const titleText = trimmedLine.substring(0, colonIndex).trim();
                const descriptionAndUrl = trimmedLine.substring(colonIndex + 1).trim();
                
                // URL 추출 (watch?v= 또는 results?search_query= 패턴 모두 지원)
                const urlMatch = descriptionAndUrl.match(/((?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:watch\?v=|results\?search_query=)[^\s\)\]\}\.,;:!?]+)/);
                if (urlMatch) {
                    let url = urlMatch[0];
                    // https://가 없으면 추가
                    if (!url.startsWith('http')) {
                        url = 'https://' + url;
                    }
                    const descriptionText = descriptionAndUrl.replace(urlMatch[0], '').trim();
                    
                    console.log('제목 텍스트:', titleText);
                    console.log('설명 텍스트:', descriptionText);
                    console.log('원본 URL:', url);
                    
                    // URL이 잘못되었을 가능성을 고려하여 YouTube 검색 링크로 대체
                    // 제목과 설명을 조합하여 검색어 생성
                    const searchQuery = encodeURIComponent(`${titleText} ${descriptionText} 메이크업`);
                    const fallbackUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
                    
                    console.log('대체 URL (YouTube 검색):', fallbackUrl);
                    
                    // 제목은 그대로 두고 설명 부분만 하이퍼링크로 만들고 URL은 제거
                    const formattedLine = `${titleText}: <a href="${fallbackUrl}" target="_blank">${descriptionText}</a>`;
                    sectionContent += `<div class="content-line">${formattedLine}</div>`;
            } else {
                    // URL이 없는 경우 YouTube 검색 링크 생성
                    const descriptionText = descriptionAndUrl.trim();
                    const searchQuery = encodeURIComponent(`${titleText} ${descriptionText} 메이크업`);
                    const fallbackUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
                    
                    console.log('URL 없음 - YouTube 검색 링크 생성:', fallbackUrl);
                    
                    // 제목은 그대로 두고 설명 부분만 하이퍼링크로 만들기
                    const formattedLine = `${titleText}: <a href="${fallbackUrl}" target="_blank">${descriptionText}</a>`;
                    sectionContent += `<div class="content-line">${formattedLine}</div>`;
                }
            } else {
                // 콜론이 없는 경우 기존 방식으로 처리
            const urlRegex = /(https?:\/\/[^\s\)\]\}\.,;:!?]+)/g;
            let lastIndex = 0;
            let result;
            let formattedLine = '';
            while ((result = urlRegex.exec(trimmedLine)) !== null) {
                const url = result[0];
                const urlIndex = result.index;
                formattedLine += trimmedLine.substring(lastIndex, urlIndex);
                formattedLine += `<a href="${url}" target="_blank">${url}</a>`;
                lastIndex = urlIndex + url.length;
            }
            formattedLine += trimmedLine.substring(lastIndex);
                sectionContent += `<div class="content-line">${formattedLine}</div>`;
            }
        }
        // 하이픈(-)으로 시작하는 소제목들
        else if (trimmedLine.startsWith('-')) {
            console.log('소제목 발견:', trimmedLine);
            
            // 강조 텍스트 처리
            const formattedLine = trimmedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            sectionContent += `<div class="subtitle">${formattedLine}</div>`;
        }
        // 들여쓰기된 세부 내용들 (앞에 공백이 있는 줄들)
        else if (trimmedLine.startsWith('  -') || trimmedLine.startsWith('  •')) {
            console.log('세부 내용 발견:', trimmedLine);
            
            // 강조 텍스트 처리
            const formattedLine = trimmedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            sectionContent += `<div class="content-line">${formattedLine}</div>`;
        }
        // 빈 줄이 아닌 일반 텍스트
        else if (trimmedLine.length > 0) {
            console.log('일반 텍스트 발견:', trimmedLine);
            
            // 강조 텍스트 처리
            const formattedLine = trimmedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            sectionContent += `<div class="content-line">${formattedLine}</div>`;
        }
        
        // 마지막 줄인 경우 마지막 섹션 닫기
        if (index === lines.length - 1 && currentSection) {
            html += `<div class="section">
                <div class="main-title">${currentSection}</div>
                <div class="content-text">${sectionContent}</div>
                <div class="divider"></div>
            </div>`;
        }
    });
    
    console.log('=== 최종 HTML 결과 ===');
    console.log('생성된 HTML 길이:', html.length);
    console.log('HTML 샘플:', html.substring(0, 500) + '...');
    
    return html;
}

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
            
            // 백그라운드 메이크업 팁 생성 상태 확인
            if (window.backgroundMakeupTipsGeneration) {
                console.log('백그라운드 메이크업 팁 생성 상태 확인');
                
                // 백그라운드에서 성공했는지 확인
                if (window.makeupTips) {
                    console.log('백그라운드에서 메이크업 팁 생성 완료!');
                    window.backgroundMakeupTipsGeneration = false;
                    window.backgroundMakeupTipsStartTime = null;
                    
                    // showSuccess('메이크업 팁이 생성되었습니다!'); // 제거됨
                    
                                            // 즉시 5단계로 진행 (3초 대기 없음)
                        console.log('페이지 가시성 변경 시 백그라운드 성공 확인 후 즉시 5단계로 진행');
                        currentStep = 5;
                        updateProgressSteps();
                        showCurrentStep();
                        displayMakeupTips();
                        saveAppState();
                        
                        // 5단계로 이동 완료 알림 (제거됨)
                        // setTimeout(() => {
                        //     showSuccess('5단계로 이동했습니다!');
                        // }, 1000);
                } else {
                    console.log('백그라운드에서 메이크업 팁 생성 중...');
                    showSuccess('백그라운드에서 메이크업 팁 생성을 계속 시도하고 있습니다...');
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
                // 메이크업 팁까지 완료되었는지 확인
                if (window.makeupTips && window.makeupTips.length > 0) {
                    // AI 분석 및 메이크업 팁이 모두 완료된 경우 5단계로 자동 이동
                    console.log('AI 분석 및 메이크업 팁 완료되어 5단계로 자동 이동');
                currentStep = 5;
                updateProgressSteps();
                showCurrentStep();
                displayMakeupTips();
                
                // 세션 ID 제거
                sessionStorage.removeItem('beautyAI_analysisSessionId');
                
                    showSuccess('AI 분석 및 메이크업 팁 생성이 완료되었습니다!');
                } else {
                    // AI 얼굴 분석만 완료, 메이크업 팁 생성 대기 중
                    console.log('AI 얼굴 분석만 완료, 메이크업 팁 생성 대기 중...');
                    showSuccess('AI 얼굴 분석이 완료되었습니다! 메이크업 팁을 생성하고 있습니다...');
                    // 4단계에 머무름 (currentStep = 4 유지)
                }
                
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
    window.makeupTips = null;
    
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

// 6단계만 저장하는 함수
async function saveAsImages() {
    console.log('=== 6단계 이미지 저장 시작 ===');
    
    try {
        // 로딩 표시
        showLoadingModal('이미지 생성 중...');
        
        const dateString = new Date().toISOString().split('T')[0];
        

        
        // 6단계 캡처
        console.log('6단계 캡처 시작...');
        const step6Element = document.getElementById('step-6');
        if (step6Element) {
            const canvas6 = await html2canvas(step6Element, {
                scale: 2, // 고해상도로 설정
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                removeContainer: true,
                imageTimeout: 0,
                foreignObjectRendering: false
            });
            
            console.log('6단계 캔버스 크기:', canvas6.width, 'x', canvas6.height);
            
            // 6단계 이미지 다운로드
            const fileName6 = `beauty-ai-step6-${dateString}.png`;
            downloadImage(canvas6, fileName6);
            console.log('6단계 이미지 저장 완료');
        }
        
        // 로딩 숨김
        hideLoadingModal();
        
        // 성공 메시지
        showSuccess('6단계 이미지가 성공적으로 저장되었습니다!');
        
    } catch (error) {
        console.error('이미지 저장 중 오류:', error);
        hideLoadingModal();
        showError('6단계 이미지 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
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





