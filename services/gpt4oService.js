const OpenAI = require('openai');
const fs = require('fs');

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * ChatGPT 5 Thinking을 사용하여 얼굴 이미지 분석 (3장 이미지 지원)
 * @param {Array<string>} imagePaths - 분석할 이미지 파일 경로 배열 [정면, 45도측면, 90도측면]
 * @param {string} sessionId - 분석 세션 ID (진행 상태 추적용)
 * @returns {Promise<Object>} 분석 결과
 */
async function analyzeFaceWithChatGPT5(imagePaths, sessionId) {
    try {
        // 3장 이미지를 모두 base64로 인코딩
        const base64Images = [];
        for (const imagePath of imagePaths) {
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');
            base64Images.push(base64Image);
        }
        
        console.log(`3장 이미지 인코딩 완료: ${base64Images.length}장`);

        // ChatGPT 5 Thinking API 요청을 위한 프롬프트 (3장 이미지 분석)
        const systemPrompt = `이제부터 너가 퍼스널 브랜딩 상담 실장이야. 고객이 자신의 외모를 분석해주기를 원하고 있어. 

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
- 피부 타입과 상태를 명확하게 분류

**4. 눈**
- 쌍커풀 유무, 눈동자 크기, 앞/뒤 트임 정도
- 눈꼬리 위치, 눈과 눈 사이 거리
- 전체적인 눈의 인상과 특징

**5. 코**
- 코 길이, 너비, 콧망울과 콧볼의 비율
- 코의 전체적인 균형과 특징

**6. 입**
- 입술 두께, 입 크기, 입꼬리 위치
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

**중요:** 각 항목은 명확하게 구분하고, 불필요한 반복이나 장황한 설명은 피해주세요. 객관적이고 전문적인 톤을 유지해주세요.

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
                                    text: "아래 3장의 이미지를 모두 참고하여 앞서 말한 규칙대로 종합적으로 분석해주세요. 각 이미지의 특징을 모두 반영하여 분석해주세요."
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

        // 모델들을 순서대로 시도 (ChatGPT 5 모델 우선, gpt-4o 제거)
        const models = ["gpt-5", "gpt-4-turbo"];
        let response = null;
        let quotaExceeded = false;
        
        for (const model of models) {
            try {
                response = await tryModel(model);
                if (response) break;
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
 * ChatGPT 5 Thinking을 사용하여 메이크업 팁 생성
 * @param {string} analysisResult - 얼굴 분석 결과
 * @returns {Promise<Object>} 메이크업 팁 결과
 */
async function getMakeupTips(analysisResult) {
    try {
        console.log('메이크업 팁 생성 시작...');

        // 메이크업 팁 생성 프롬프트
        const makeupSystemPrompt = `이제는 너가 메이크업 실장님이야. 앞서 퍼스널브랜딩 상담 실장이 분석한 결과를 토대로 나에게 맞춤형 메이크업 및 시술 팁을 알려줘.

**답변 형식:**
각 항목은 명확하게 구분하고, 실용적인 팁을 제공해주세요.

**1. 눈**
- 눈 모양에 맞는 아이메이크업 기법
- 추천 색상과 브랜드
- 쌍커풀, 눈매 교정 팁

**2. 코**
- 코 윤곽 교정 기법
- 하이라이터와 섀딩 활용법
- 코 길이/너비 조절 팁

**3. 입**
- 입술 모양에 맞는 립 메이크업
- 립 라이너 활용법
- 추천 립스틱 색상

**4. 피부**
- 피부 타입별 베이스 메이크업
- 프라이머와 파운데이션 선택법
- 컨실러 활용 팁

**5. 윤곽**
- 얼굴형에 맞는 컨투어링
- 하이라이터와 섀딩 위치
- 브론저 활용법

**6. 시술 팁**
- 전문적인 시술 추천
- 주의사항과 관리법
- 예상 비용 범위

**7. 유튜브 영상 링크**
- 단계별 메이크업 튜토리얼
- 전문가 추천 영상

**중요:** 각 항목은 구체적이고 실용적으로 작성해주세요. 불필요한 설명은 피하고 핵심 팁에 집중해주세요.

마지막으로 더이상 나에게 권유나 질문을 하지말고 마무리해줘`;

        // 모델별 시도 함수
        async function tryModel(modelName) {
            try {
                console.log(`메이크업 팁 모델 ${modelName} 시도 중...`);
                // 모델별 파라미터 설정
                const params = {
                    model: modelName,
                    messages: [
                        {
                            role: "system",
                            content: makeupSystemPrompt
                        },
                        {
                            role: "user",
                            content: `앞서 분석한 결과는 다음과 같습니다: ${analysisResult}`
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
                    console.log(`메이크업 팁 모델 ${modelName} 성공!`);
                    return response;
                } else {
                    console.log(`메이크업 팁 모델 ${modelName} 거부됨:`, content);
                    return null;
                }
            } catch (error) {
                console.log(`메이크업 팁 모델 ${modelName} 오류:`, error.message);
                // API 할당량 초과 에러는 다시 던지기
                if (error.message.includes('429') || error.message.includes('quota')) {
                    throw error;
                }
                return null;
            }
        }

        // 모델들을 순서대로 시도 (ChatGPT 5 모델 우선, gpt-4o 제거)
        const models = ["gpt-5", "gpt-4-turbo"];
        let response = null;
        let quotaExceeded = false;
        
        for (const model of models) {
            try {
                response = await tryModel(model);
                if (response) break;
            } catch (error) {
                // API 할당량 초과 에러 확인
                if (error.message.includes('429') || error.message.includes('quota')) {
                    quotaExceeded = true;
                    console.log(`메이크업 팁 모델 ${model} 할당량 초과:`, error.message);
                }
            }
        }
        
        if (!response) {
            if (quotaExceeded) {
                console.log('메이크업 팁 API 할당량이 초과되었습니다.');
                throw new Error('API 할당량이 초과되었습니다. OpenAI 계정의 결제 정보를 확인해주세요.');
            } else {
                console.log('모든 모델이 메이크업 팁 생성을 거부함. AI 거부 응답 생성...');
                // AI 거부 응답 생성
                const refusalResponse = {
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                error: "ai_refusal",
                                reason: "모든 AI 모델이 메이크업 팁 생성을 거부했습니다",
                                details: {
                                    reason: "분석 결과가 부족하거나 AI 모델 정책상 팁을 생성할 수 없습니다",
                                    suggestions: [
                                        "더 자세한 얼굴 분석을 먼저 진행해주세요",
                                        "분석 결과를 다시 확인해주세요"
                                    ]
                                }
                            })
                        }
                    }]
                };
                
                return {
                    raw_makeup_tips: refusalResponse.choices[0].message.content
                };
            }
        }

        // 성공적인 응답 처리
        const rawMakeupTips = response.choices[0].message.content;
        console.log('메이크업 팁 생성 완료:', rawMakeupTips);

        return {
            raw_makeup_tips: rawMakeupTips
        };

    } catch (error) {
        console.error('메이크업 팁 생성 중 오류:', error);
        throw error;
    }
}

module.exports = {
    analyzeFaceWithChatGPT5,
    getMakeupTips
};
