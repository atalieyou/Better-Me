const OpenAI = require('openai');
const fs = require('fs');
const axios = require('axios');

// WebSocket 클라이언트 전역 변수 (서버에서 주입)
let clients = null;

// WebSocket 클라이언트 설정 함수
function setWebSocketClients(wsClients) {
    clients = wsClients;
}

// 진행 상황 전송 함수
function sendProgressUpdate(sessionId, progress, message) {
    if (clients) {
        const client = clients.get(sessionId);
        if (client && client.readyState === 1) { // WebSocket.OPEN = 1
            client.send(JSON.stringify({
                type: 'analysis_progress',
                progress: progress,
                message: message,
                sessionId: sessionId
            }));
            console.log(`WebSocket 진행 상황 전송: ${sessionId} - ${progress}% - ${message}`);
        } else {
            console.log(`WebSocket 클라이언트를 찾을 수 없음: ${sessionId}`);
        }
    }
}

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * ChatGPT 5 Thinking을 사용하여 얼굴 이미지 분석 (3장 이미지 지원)
 * @param {Array<string>} imagePaths - 분석할 이미지 파일 경로 배열 [정면, 45도측면, 90도측면]
 * @param {string} sessionId - 분석 세션 ID (진행 상태 추적용)
 * @param {string} language - 언어 설정 ('ko' 또는 'en')
 * @returns {Promise<Object>} 분석 결과
 */
async function analyzeFaceWithChatGPT5(imagePaths, sessionId, language = 'ko') {
    try {
        // 진행 상황 전송: 분석 시작 (10%)
        sendProgressUpdate(sessionId, 10, '이미지 인코딩 중...');
        
        // 3장 이미지를 모두 base64로 인코딩
        const base64Images = [];
        for (const imagePath of imagePaths) {
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');
            base64Images.push(base64Image);
        }
        
        console.log(`3장 이미지 인코딩 완료: ${base64Images.length}장`);
        console.log(`🌍 언어 설정: ${language}`);
        
        // 진행 상황 전송: 이미지 인코딩 완료 (20%)
        sendProgressUpdate(sessionId, 20, 'AI 모델에 전송 중...');

        // 언어에 따른 프롬프트 설정
        const systemPrompt = language === 'en' ? 
        `You are a personal branding consultant. The customer wants you to analyze their appearance.

**Important: Analyze all 3 images.**
- **Front Photo**: Overall face shape and balance analysis
- **45-degree Side Photo**: Side profile and nose, mouth side features analysis  
- **90-degree Side Photo**: Complete side profile and ear, jawline analysis

Please provide a comprehensive and objective analysis of their current appearance.

**Response Format:**
Clearly separate each item and **bold** important information.

**1. Face Shape**
- Which face shape category: oval, round, heart, square, diamond, or oblong
- Face length: long or short (e.g., long oval, short square)

**2. Face Proportions**
- Upper, middle, lower face ratio analysis
- Overall balance assessment

**3. Skin Condition**
- Acne, scars, pore size, oiliness, skin tone, etc.
- Wrinkle analysis such as nasolabial folds
- Clear classification of skin type and condition

**4. Eyes**
- Double eyelid presence, eye size, inner/outer corner degree
- Eye corner angle, distance between eyes, eye size
- Size of aegyo-sal (under-eye fat)

**5. Eyebrows**
- Eyebrow shape
- Eyelid width

**5. Nose**
- Nose length, width, nostril and nose tip ratio
- Overall nose balance and features

**6. Mouth**
- Lip thickness, mouth size, mouth corner position
- Mouth protrusion
- Harmony with overall face

**7. Conclusion**
- Atmosphere the face creates (elegant, cute, chic, calm, sophisticated, etc.)
- Suitable makeup keywords: juicy makeup, glow makeup, MLBB makeup, etc.
- Suitable hairstyle keywords: layered cut, wave perm, pomade, etc.

**Rating Criteria:**
 **A+**: Perfect harmony and proportions, skin condition, meets all popular/international beauty standards
 **A**: Very excellent level
 **A-**: Upper tier with slight room for improvement
 **B+**: Above average
 **B**: Average
 **C**: Below average
 **D**: Significantly deviates from standards in harmony or proportions

Example: Cha Eun-woo would receive **A+** points.

**Important:** Clearly separate each item in English, avoid unnecessary repetition or lengthy explanations. Maintain an objective and professional tone.

Finally, don't ask me any more questions or make recommendations, just finish.

**CRITICAL LANGUAGE REQUIREMENT: You must respond entirely in English.**` :

        `이제부터 너가 퍼스널 브랜딩 상담 실장이야. 고객이 자신의 외모를 분석해주기를 원하고 있어. 

**중요: 3장의 이미지를 모두 분석해주세요.**
- **정면 사진**: 전체적인 얼굴형과 균형감 분석
- **45도 측면 사진**: 측면 윤곽과 코, 입의 측면 특징 분석  
- **90도 측면 사진**: 완전한 측면 윤곽과 귀, 턱선 분석

너가 아주 구체적이고 객관적으로 현재 외모 상태를 종합적으로 분석해줘.

**답변 형식:**
각 항목은 명확하게 구분하고, 중요한 정보는 **굵게** 표시해주세요.

**1. 얼굴형**
- 고객의 얼굴형이 달걀형, 둥근형, 땅콩형, 마름모형, 하트형, 육각형 중에 어느 얼굴형에 속하는지
- 얼굴 길이가 긴지 짧은지 (예: 긴 달걀형, 짧은 마름모형)

**2. 얼굴 비율**
- 상안부, 중안부, 하안부의 비율 분석
- 전체적인 균형감 평가

**3. 피부 상태**
- 여드름, 흉터, 모공크기, 유분기, 피부 색감 등
- 팔자주름 등 주름 분석
- 피부 타입과 상태를 명확하게 분류

**4. 눈**
- 쌍커풀 유무, 눈동자 크기, 앞/뒤 트임 정도
- 눈꼬리 각도, 눈과 눈 사이 거리, 눈 크기
- 애교살의 크기

**5. 눈썹**
- 눈썹 모양
- 눈두덩이 넓이

**5. 코**
- 코 길이, 너비, 콧망울과 콧볼의 비율
- 코의 전체적인 균형과 특징

**6. 입**
- 입술 두께, 입 크기, 입꼬리 위치
- 입의 돌출여부
- 얼굴 전체와의 조화도

**7. 결론**
- 해당 얼굴이 자아내는 분위기 (우아함, 귀여움, 도도함, 차분함, 시크함 등)
- 과즙 메이크업, 글로우 메이크업, MLBB 메이크업 등 어울리는 메이크업 키워드 1개
- 레이어드컷, 물결펌, 포마드 등 어울리는 헤어 스타일 키워드 1개
-**등급 기준:**
 **A+**: 극소수의 완벽한 조화와 비율, 피부 상태, 대중적/국제적 미 기준 모두 충족
 **A**: 매우 뛰어난 수준
 **A-**: 상위권이나 약간의 개선 여지가 있는 경우
 **B대**: 평균 이상
 **C대**: 평균 이하
 **D**: 기준 대비 조화나 비율에서 크게 벗어나는 경우

예시: 차은우는 **A+** 포인트를 받게 됩니다.

**중요:** 각 항목은 한국어로 명확하게 구분하고, 불필요한 반복이나 장황한 설명은 피해주세요. 객관적이고 전문적인 톤을 유지해주세요.

마지막으로 더이상 나에게 권유나 질문을 하지말고 마무리해줘`;

        // 모델별 시도 함수
        async function tryModel(modelName) {
            try {
                console.log(`모델 ${modelName} 시도 중...`);
                // 모델별 파라미터 설정
                const params = {
                    model: modelName,
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: language === 'en' ? 
                                        "Please comprehensively analyze all 3 images below according to the rules mentioned above. Analyze by reflecting all the characteristics of each image." :
                                        "아래 3장의 이미지를 모두 참고하여 앞서 말한 규칙대로 종합적으로 분석해주세요. 각 이미지의 특징을 모두 반영하여 분석해주세요."
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:image/jpeg;base64,${base64Images[0]}`,
                                        detail: "high"
                                    }
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:image/jpeg;base64,${base64Images[1]}`,
                                        detail: "high"
                                    }
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:image/jpeg;base64,${base64Images[2]}`,
                                        detail: "high"
                                    }
                                }
                            ]
                        }
                    ]
                };

                // gpt-5 모델은 max_completion_tokens만, 다른 모델은 temperature와 max_tokens 사용
                if (modelName === "gpt-5") {
                    // gpt-5는 max_completion_tokens 파라미터 지원 안함
                    // gpt-5는 temperature 파라미터 지원 안함
                    // gpt-5에서는 max_tokens 파라미터를 설정하지 않음
                } else {
                    params.temperature = 0.7;
                    params.max_tokens = 4000; // gpt-4 모델들의 제한에 맞춤
                }

                const response = await openai.chat.completions.create(params);

                const content = response.choices[0]?.message?.content;
                // 더 유연한 거부 감지 (JSON 형식이 아니어도 분석 내용이 있으면 성공으로 간주)
                if (content && 
                    !content.includes("I'm sorry") && 
                    !content.includes("can't assist") &&
                    !content.includes("I'm unable") &&
                    !content.includes("unable to analyze") &&
                    !content.includes("죄송하지만") &&
                    !content.includes("분석할 수 없습니다") &&
                    content.length > 50) {  // 최소 50자 이상의 내용이 있어야 함
                    console.log(`모델 ${modelName} 성공!`);
                    return response;
                } else {
                    console.log(`모델 ${modelName} 거부됨:`, content);
                    return null;
                }
            } catch (error) {
                console.log(`모델 ${modelName} 오류:`, error.message);
                // API 할당량 초과 에러는 다시 던지기
                if (error.message.includes('429') || error.message.includes('quota')) {
                    throw error;
                }
                return null;
            }
        }

        // 진행 상황 전송: AI 분석 시작 (30%)
        sendProgressUpdate(sessionId, 30, 'AI 모델에서 분석 중...');
        
        // 모델들을 순서대로 시도 (ChatGPT 5 모델 우선, gpt-4o 제거)
        const models = ["gpt-5", "gpt-4-turbo"];
        let response = null;
        let quotaExceeded = false;
        
        for (const model of models) {
            try {
                // 진행 상황 전송: 모델 시도 중
                sendProgressUpdate(sessionId, 40, 'AI 모델에서 분석 중...');
                
                response = await tryModel(model);
                if (response) {
                    // 진행 상황 전송: 분석 완료
                    sendProgressUpdate(sessionId, 80, '분석 결과 처리 중...');
                    break;
                }
            } catch (error) {
                // API 할당량 초과 에러 확인
                if (error.message.includes('429') || error.message.includes('quota')) {
                    quotaExceeded = true;
                    console.log(`모델 ${model} 할당량 초과:`, error.message);
                }
            }
        }
        
        if (!response) {
            if (quotaExceeded) {
                console.log('API 할당량이 초과되었습니다.');
                throw new Error('API 할당량이 초과되었습니다. OpenAI 계정의 결제 정보를 확인해주세요.');
            } else {
                console.log('모든 모델이 거부됨. AI 거부 응답 생성...');
                // AI 거부 응답 생성
                const refusalResponse = {
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                error: "ai_refusal",
                                reason: "모든 AI 모델이 이미지 분석을 거부했습니다",
                                details: {
                                    reason: "이미지 품질이 낮거나 AI 모델 정책상 분석할 수 없습니다",
                                    suggestions: [
                                        "더 명확한 얼굴 사진을 업로드해주세요",
                                        "선글라스나 모자 등 가림이 없는 사진을 사용해주세요",
                                        "밝은 조명에서 정면을 향한 사진을 촬영해주세요"
                                    ]
                                }
                            })
                        }
                    }]
                };
                
                return {
                    raw_analysis: refusalResponse.choices[0].message.content,
                    point: '분석 불가'
                };
            }
        }

        // 성공적인 응답 처리
        const rawAnalysis = response.choices[0].message.content;
        console.log('AI 분석 완료:', rawAnalysis);

        // 진행 상황 전송: 포인트 추출 중 (90%)
        sendProgressUpdate(sessionId, 90, '분석 결과 정리 중...');

        // 포인트 추출 (JSON 형식이 아닌 경우를 대비)
        let point = '분석 불가';
        try {
            // JSON 형식인지 확인
            if (rawAnalysis.includes('"point"') || rawAnalysis.includes('"포인트"')) {
                const jsonMatch = rawAnalysis.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    point = parsed.point || parsed.포인트 || '분석 불가';
                }
            } else {
                // 자연어에서 포인트 추출
                const pointMatch = rawAnalysis.match(/포인트:\s*([A-Z][+-]?)/i);
                if (pointMatch) {
                    point = pointMatch[1];
                }
            }
        } catch (e) {
            console.log('포인트 추출 실패, 기본값 사용:', e.message);
        }

        // 진행 상황 전송: 완료 (100%)
        sendProgressUpdate(sessionId, 100, '분석 완료!');

        return {
            raw_analysis: rawAnalysis,
            point: point
        };

    } catch (error) {
        console.error('얼굴 분석 중 오류:', error);
        throw error;
    }
}


/**
 * 메이크업 팁 분석 함수 (얼굴분석 결과 기반)
 * @param {Array} imagePaths - 분석할 이미지 경로 배열 (참고용)
 * @param {string} sessionId - 세션 ID
 * @param {string} language - 언어 설정 ('ko' 또는 'en')
 * @param {string} faceAnalysisResult - 기존 얼굴분석 결과
 * @returns {Promise<Object>} 메이크업 팁 분석 결과
 */
async function analyzeMakeupTipsWithImages(imagePaths, sessionId, language = 'ko', faceAnalysisResult = null) {
    try {
        console.log('메이크업 팁 분석 시작...');
        console.log(`🌍 언어 설정: ${language}`);
        
        // 진행 상황 전송: 메이크업 팁 분석 시작 (10%)
        sendProgressUpdate(sessionId, 10, '얼굴분석 결과 확인 중...');
        console.log(`📋 얼굴분석 결과 제공 여부: ${faceAnalysisResult ? '있음' : '없음'}`);
        
        // 얼굴분석 결과가 없으면 오류
        if (!faceAnalysisResult) {
            const errorMessage = language === 'en' 
                ? 'Face analysis results are required. Please complete face analysis first.'
                : '얼굴분석 결과가 필요합니다. 먼저 얼굴분석을 완료해주세요.';
            throw new Error(errorMessage);
        }
        
        // 진행 상황 전송: 얼굴분석 결과 확인 완료 (20%)
        sendProgressUpdate(sessionId, 20, '메이크업 팁 생성 중...');
        
        console.log('얼굴분석 결과를 기반으로 메이크업 팁 생성');
        
        // 언어에 따른 시스템 프롬프트 설정
        const systemPrompt = language === 'en' ?
            `You are now a makeup director. I will provide you with detailed facial analysis results from a personal branding consultant. Based on this analysis, provide makeup and styling tips that are optimized for the face, complementing weaknesses and highlighting strengths, rather than giving generic advice.

**Response Format:**
Clearly separate each item and provide onlypractical tips in detail based on both the images and facial analysis results to complement strengths and weaknesses.

**1. Eyes**
- Makeup tips to complement the eye shape and strengths/weaknesses that can be confirmed from the images and analysis content
- Treatment tips to complement the eye shape and strengths/weaknesses that can be confirmed from the images and analysis content (say "none" if there are none)

**2. Nose**
- Makeup tips to complement the nose shape and strengths/weaknesses that can be confirmed from the images and analysis content
- Treatment tips to complement the nose shape and strengths/weaknesses that can be confirmed from the images and analysis content (say "none" if there are none)

**3. Lips**
- Treatment tips to complement the lip shape and strengths/weaknesses that can be confirmed from the images and analysis content (say "none" if there are none)

**4. Skin**
- Base makeup tips for the skin type and characteristics mentioned in the analysis
- Concealer tips for any skin concerns identified
- Treatment tips to complement the skin strengths/weaknesses that can be confirmed from the images and analysis content (say "none" if there are none)

**5. Contouring/Face Proportions**
- Contouring tips for face shape and proportions that can be confirmed from the images and analysis content
- Highlighter and shading placement that can be confirmed from the images and analysis content
- Treatment tips to complement the facial contour and proportions strengths/weaknesses that can be confirmed from the images and analysis content (say "none" if there are none)

**7. Hairstyling Tips**
- 3 suitable hairstyles based on face shape and features from the analysis and reasons

**Important:** Write each item specifically and practically based on the facial analysis results. Focus on core tips that directly address the analyzed features.

Finally, don't ask me any more questions or make recommendations, just finish.` :
            `이제는 너가 메이크업 실장님이야. 퍼스널브랜딩 상담 실장의 상세한 얼굴분석 결과를 제공할 거야. 이 분석 결과를 바탕으로 뻔한 얘기 말고 얼굴에 최적화된 단점을 보완하고 장점을 강조하는 메이크업 및 스타일링 팁을 제공해줘.

**답변 형식:**
각 항목은 명확하게 구분하고, 이미지와 얼굴분석 결과를 기반으로 장단점을 보완할 수 있는 실용적인 팁만을 매우 구체적으로 제공해주세요.

**1. 눈**
- 이미지와 분석 내용에서 확인할 수 있는 눈의 모양과 장단점을 보완할 수 있는 메이크업 팁
- 이미지와 분석 내용에서 확인할 수 있는 눈의 모양과 장단점을 보완하는 시술 팁

**2. 코**
- 이미지와 분석 내용에서 확인할 수 있는 코의 모양과 장단점을 보완할 수 있는 메이크업 팁
- 이미지와 분석 내용에서 확인할 수 있는 코의 모양과 장단점을 보완하는 시술 팁

**3. 입**
- 이미지와 분석 내용에서 확인할 수 있는 입술의 모양과 장단점을 보완할 수 있는 메이크업 팁
- 이미지와 분석 내용에서 확인할 수 있는 압술의 모양과 장단점을 보완하는 시술 팁

**4. 피부**
- 분석에서 언급된 피부 타입과 특징에 맞는 베이스 메이크업 팁
- 분석에서 식별된 피부 고민에 대한 컨실러 활용 팁
- 이미지와 분석 내용에서 확인할 수 있는 피부 장단점을 보완하는 시술 팁

**5. 윤곽/얼굴비율**
- 이미지와 분석 내용에서 확인할 수 있는 얼굴형, 얼굴비율에 맞는 컨투어링 팁
- 이미지와 분석 내용에서 확인할 수 있는 하이라이터와 섀딩 위치
- 이미지와 분석 내용에서 확인할 수 있는 윤곽 및 얼굴비율을 장단점을 보완하는 시술 팁(없으면 없다고 해줘)

**7. 헤어스타일링 팁**
- 얼굴분석에서 나온 얼굴형과 특징을 바탕으로 한 헤어스타일 3가지 및 이유

**중요:** 각 항목은 얼굴분석 결과를 바탕으로 구체적이고 실용적으로 작성해주세요. 분석된 특징을 직접적으로 해결하는 핵심 팁에 집중해주세요.

마지막으로 더이상 나에게 권유나 질문을 하지말고 마무리해줘`;

        // 이미지 인코딩 함수
        const encodeImage = (imagePath) => {
            try {
                const imageBuffer = fs.readFileSync(imagePath);
                const base64Image = imageBuffer.toString('base64');
                return `data:image/jpeg;base64,${base64Image}`;
            } catch (error) {
                console.error('이미지 인코딩 오류:', error);
                return null;
            }
        };

        // 3장 이미지 인코딩
        console.log('3장 이미지 인코딩 시작...');
        const encodedImages = imagePaths.map((path, index) => {
            const encoded = encodeImage(path);
            if (encoded) {
                console.log(`이미지 ${index + 1} 인코딩 완료`);
            } else {
                console.error(`이미지 ${index + 1} 인코딩 실패:`, path);
            }
            return encoded;
        }).filter(img => img !== null);

        console.log(`3장 이미지 인코딩 완료: ${encodedImages.length}장`);

        // 모델별 시도 함수
        const tryModel = async (modelName) => {
            console.log(`모델 ${modelName} 시도 중...`);
            
            // 이미지가 포함된 메시지 구성
            const userMessage = {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: language === 'en' ?
                            `Based on the following detailed facial analysis results and the provided images, please provide personalized makeup and styling tips:

${faceAnalysisResult}

Please analyze the facial features, face shape, and characteristics from both the analysis and the images to provide specific makeup and hairstyling recommendations.` :
                            `다음의 상세한 얼굴분석 결과와 제공된 이미지를 바탕으로 맞춤형 메이크업 및 스타일링 팁을 제공해주세요:

${faceAnalysisResult}

분석 결과와 이미지에서 얼굴 특징, 얼굴형, 특성들을 종합적으로 분석하여 구체적인 메이크업과 헤어스타일링 추천을 제공해주세요.`
                    }
                ]
            };

            // 인코딩된 이미지들을 메시지에 추가
            encodedImages.forEach((encodedImage, index) => {
                const imageType = index === 0 ? '정면' : index === 1 ? '45도 측면' : '90도 측면';
                userMessage.content.push({
                    type: "image_url",
                    image_url: {
                        url: encodedImage,
                        detail: "high"
                    }
                });
            });

            const params = {
                model: modelName,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    userMessage
                ],
                max_tokens: 4000,
                temperature: 0.7
            };

            const response = await axios.post('https://api.openai.com/v1/chat/completions', params, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;
        };

        // 진행 상황 전송: AI 모델 호출 시작 (30%)
        sendProgressUpdate(sessionId, 30, 'AI 모델에 요청 전송 중...');
        
        // 모델 순서대로 시도
        const models = ["gpt-5", "gpt-4-turbo"];
        let result = null;
        
        for (const model of models) {
            try {
                // 진행 상황 전송: 모델 시도 중
                sendProgressUpdate(sessionId, 40, 'AI 모델에서 팁 생성 중...');
                
                result = await tryModel(model);
                console.log(`모델 ${model} 성공!`);
                
                // 진행 상황 전송: 팁 생성 완료
                sendProgressUpdate(sessionId, 80, '메이크업 팁 정리 중...');
                break;
            } catch (error) {
                console.log(`모델 ${model} 실패:`, error.message);
                if (model === models[models.length - 1]) {
                    throw error;
                }
            }
        }

        if (!result) {
            throw new Error('모든 모델에서 분석 실패');
        }

        console.log('메이크업 팁 분석 완료');
        
        // 진행 상황 전송: 완료 (100%)
        sendProgressUpdate(sessionId, 100, '메이크업 팁 생성 완료!');
        
        return {
            analysis: result,
            sessionId: sessionId,
            language: language
        };

    } catch (error) {
        console.error('메이크업 팁 분석 중 오류:', error);
        throw error;
    }
}

module.exports = {
    analyzeFaceWithChatGPT5,
    analyzeMakeupTipsWithImages,
    setWebSocketClients
};
