/**
 * 二等無人航空機操縦士 学科試験 対策アプリ
 * メインJavaScriptファイル
 * 基準文書: 無人航空機の飛行の安全に関する教則（令和7年2月1日 第4版）
 * 
 * 完成版: 450問のコア問題データベース対応 + Googleスプレッドシート連携
 * - 第3章: 200問 (無人航空機に関する規則)
 * - 第4章: 100問 (無人航空機のシステム)
 * - 第5章: 70問 (無人航空機の操縦者及び運航体制)
 * - 第6章: 80問 (運航上のリスク管理)
 * - クラウド連携: Googleスプレッドシートによる苦手問題管理
 */

// === クラウド連携設定 ===
const GAS_URL = 'https://script.google.com/macros/s/AKfycby548XePFj_lElTyU0pPJdDPfUfbJxOXRMhd-UJhbs4B_oVA_tPK-NUVfxFqwtvGis5/exec';
let currentUser = null;
let userMistakes = [];

// === グローバル変数 ===
let masterQuestions = [];
let currentExamQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let examTimer = null;
let examStartTime = null;
let isDataLoaded = false;

// === 定数 ===
const EXAM_CONFIG = {
    TIME_LIMIT_MINUTES: 30,
    TOTAL_QUESTIONS: 50,
    PASSING_SCORE_PERCENTAGE: 80,
    WARNING_TIME_SECONDS: 300 // 5分
};

const CORE_DATA_FILES = [
    'problems_03_kisoku_core.json',
    'problems_04_system_core.json',
    'problems_05_soujusha_core.json', 
    'problems_06_risk_core.json'
];

// === アプリケーション初期化 ===
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    console.log('UAV試験対策アプリを初期化中...');
    setupEventListeners();
    hideAllImageElements();  // 画像表示エリアを完全に非表示
    
    // ユーザー認証とデータ読み込み
    await initializeUser();
    
    showLoadingScreen();
    await loadAllQuestions();
    hideLoadingScreen();
    showScreen('top-screen');
}

function hideAllImageElements() {
    // 全ての画像表示エリアを非表示にする
    const imageElements = [
        'question-image',
        'category-question-image'
    ];
    
    imageElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
        }
    });
}

// === ユーザー管理機能 ===
async function initializeUser() {
    // LocalStorageからユーザー名を確認
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedUser) {
        currentUser = savedUser;
        console.log(`👤 ユーザー: ${currentUser} でログイン`);
        await loadMistakes(currentUser);
    } else {
        // ユーザー名入力モーダルを表示
        await showUserNameModal();
    }
}

function showUserNameModal() {
    return new Promise((resolve) => {
        // ユーザー名入力モーダルを動的生成
        const modalHTML = `
            <div id="user-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
                    <div class="p-6">
                        <h2 class="text-xl font-bold text-gray-800 mb-4">ユーザー名を入力してください</h2>
                        <p class="text-gray-600 mb-6 text-sm">
                            学習進捗を記録するため、お名前を入力してください。
                        </p>
                        <input type="text" id="user-name-input" 
                               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" 
                               placeholder="例: 山田太郎" maxlength="20">
                        <div class="mt-6 text-center">
                            <button id="confirm-user-btn" 
                                    class="bg-blue-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                                開始する
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const input = document.getElementById('user-name-input');
        const confirmBtn = document.getElementById('confirm-user-btn');
        
        // Enterキーでも送信可能
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmUser();
            }
        });
        
        confirmBtn.addEventListener('click', confirmUser);
        
        // フォーカス
        input.focus();
        
        function confirmUser() {
            const userName = input.value.trim();
            if (!userName) {
                alert('ユーザー名を入力してください。');
                return;
            }
            
            currentUser = userName;
            localStorage.setItem('currentUser', currentUser);
            
            // モーダル削除
            document.getElementById('user-modal').remove();
            
            console.log(`👤 新規ユーザー: ${currentUser} を登録`);
            
            // 苦手問題データを読み込み
            loadMistakes(currentUser).then(() => {
                resolve();
            });
        }
    });
}

// === データベース通信機能 ===
async function loadMistakes(userId) {
    try {
        console.log(`📊 ${userId} の苦手問題データを読み込み中...`);
        
        const response = await fetch(`${GAS_URL}?userId=${encodeURIComponent(userId)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && Array.isArray(data.mistakes)) {
            userMistakes = data.mistakes;
            console.log(`✅ 苦手問題データ読み込み完了: ${userMistakes.length}問`);
        } else {
            userMistakes = [];
            console.log('📝 新規ユーザー: 苦手問題データを初期化');
        }
        
        // データ読み込み完了後に苦手克服ボタンの表示を更新
        setTimeout(() => updateWeaknessButtonCount(), 100);
        
    } catch (error) {
        console.error('❌ 苦手問題データ読み込みエラー:', error);
        userMistakes = [];
        
        // ネットワークエラーでもアプリは継続
        showNotification('ネットワーク接続を確認してください。オフラインモードで開始します。', 'warning');
    }
}

async function saveMistakes() {
    try {
        console.log(`💾 ${currentUser} の苦手問題データを保存中...`);
        
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser,
                mistakeData: userMistakes
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result && result.success) {
            console.log(`✅ 苦手問題データ保存完了: ${userMistakes.length}問`);
            updateWeaknessButtonCount(); // 苦手問題数の表示を更新
        } else {
            console.error('❌ 保存応答エラー:', result);
        }
        
    } catch (error) {
        console.error('❌ 苦手問題データ保存エラー:', error);
        showNotification('データ保存に失敗しました。ネットワーク接続を確認してください。', 'error');
    }
}

function showNotification(message, type = 'info') {
    // 通知表示の実装
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
        type === 'error' ? 'bg-red-100 border border-red-500 text-red-700' :
        type === 'warning' ? 'bg-yellow-100 border border-yellow-500 text-yellow-700' :
        'bg-blue-100 border border-blue-500 text-blue-700'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 5秒後に自動削除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// === データベース読み込み処理 ===
async function loadAllQuestions() {
    try {
        console.log('コア問題データベースを並列読み込み中...');
        showLoadingProgress('データベースを読み込み中...');
        
        // 4つのコア問題ファイルを並列で非同期読み込み（UTF-8エンコーディング明示）
        const responses = await Promise.all(
            CORE_DATA_FILES.map(fileName => fetch(fileName, {
                headers: {
                    'Accept': 'application/json; charset=utf-8'
                }
            }))
        );

        // レスポンスの検証とJSONパース
        const allDatasets = await Promise.all(
            responses.map(async (response, index) => {
                if (!response.ok) {
                    throw new Error(`ファイル読み込みエラー: ${CORE_DATA_FILES[index]} (${response.status})`);
                }
                return response.json();
            })
        );

        // マスター問題配列への結合
        masterQuestions = [];
        let totalQuestionsLoaded = 0;

        allDatasets.forEach((dataset, index) => {
            if (dataset.questions && Array.isArray(dataset.questions)) {
                const fileName = CORE_DATA_FILES[index];
                const chapterInfo = getChapterInfo(fileName);
                
                // 各問題にチャプター情報を付与（画像は無視）
                const questionsWithChapter = dataset.questions.map(question => {
                    return {
                        ...question,
                        chapterCode: chapterInfo.code,
                        chapterName: chapterInfo.name
                        // imageキーは意図的に除外してテキストのみ表示
                    };
                });
                
                masterQuestions = masterQuestions.concat(questionsWithChapter);
                totalQuestionsLoaded += dataset.questions.length;
                
                console.log(`✓ ${fileName}: ${dataset.questions.length}問読み込み完了`);
            } else {
                console.warn(`⚠ ${CORE_DATA_FILES[index]}: 問題データの形式が不正です`);
            }
        });

        // 読み込み結果の検証
        if (masterQuestions.length === 0) {
            throw new Error('問題データが1問も読み込まれませんでした');
        }

        isDataLoaded = true;
        showLoadingProgress('読み込み完了！');
        
        console.log(`🎉 コア問題データベース読み込み完了: 合計${totalQuestionsLoaded}問`);
        console.log('📊 章別内訳:', getChapterBreakdown());
        
    } catch (error) {
        console.error('❌ 問題データの読み込みに失敗:', error);
        showLoadingError(error.message);
        isDataLoaded = false;
    }
}

function getChapterInfo(fileName) {
    const chapterMap = {
        'problems_03_kisoku_core.json': { code: '03', name: '無人航空機に関する規則' },
        'problems_04_system_core.json': { code: '04', name: '無人航空機のシステム' },
        'problems_05_soujusha_core.json': { code: '05', name: '無人航空機の操縦者及び運航体制' },
        'problems_06_risk_core.json': { code: '06', name: '運航上のリスク管理' }
    };
    return chapterMap[fileName] || { code: 'XX', name: '不明な章' };
}

function getChapterBreakdown() {
    const breakdown = {};
    masterQuestions.forEach(question => {
        const key = `第${question.chapterCode}章`;
        breakdown[key] = (breakdown[key] || 0) + 1;
    });
    return breakdown;
}

// === 模擬試験モード ===
function startMockExam() {
    if (!validateDataLoaded()) return;
    
    console.log('🎯 模擬試験を開始');
    
    // 450問からランダムに50問を重複なく抽出
    currentExamQuestions = selectRandomQuestions(masterQuestions, EXAM_CONFIG.TOTAL_QUESTIONS);
    currentQuestionIndex = 0;
    userAnswers = new Array(EXAM_CONFIG.TOTAL_QUESTIONS).fill(null);
    examStartTime = Date.now();
    
    showScreen('exam-screen');
    startTimer();
    displayCurrentQuestion();
}

function selectRandomQuestions(allQuestions, count) {
    if (allQuestions.length < count) {
        console.warn(`利用可能な問題数(${allQuestions.length})が要求数(${count})を下回っています`);
        return [...allQuestions];
    }
    
    // Fisher-Yatesアルゴリズムでランダムシャッフル
    const shuffled = [...allQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled.slice(0, count);
}

// === タイマー機能 ===
function startTimer() {
    let timeRemaining = EXAM_CONFIG.TIME_LIMIT_MINUTES * 60;
    const timerElement = document.getElementById('timer');
    
    examTimer = setInterval(() => {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        
        timerElement.textContent = `残り時間: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // 警告表示（残り5分）
        if (timeRemaining <= EXAM_CONFIG.WARNING_TIME_SECONDS && timeRemaining > 0) {
            timerElement.classList.add('timer-warning');
        }
        
        // 時間切れ
        if (timeRemaining <= 0) {
            console.log('⏰ 制限時間終了');
            finishExam();
            return;
        }
        
        timeRemaining--;
    }, 1000);
}

function stopTimer() {
    if (examTimer) {
        clearInterval(examTimer);
        examTimer = null;
    }
}

// === 問題表示 ===
function displayCurrentQuestion() {
    const question = currentExamQuestions[currentQuestionIndex];
    
    // UI要素の取得
    const questionNumber = document.getElementById('question-number');
    const questionText = document.getElementById('question-text');
    const questionImage = document.getElementById('question-image');
    const optionsContainer = document.getElementById('options-container');
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');
    
    // 基本情報の表示
    questionNumber.textContent = `問題 ${currentQuestionIndex + 1}`;
    
    // 問題文をクリーンアップし、テキストのみ表示
    const cleanQuestion = cleanText(question.question);
    
    // textContentを使用して文字化けを防止
    questionText.innerHTML = '';
    const questionSpan = document.createElement('span');
    questionSpan.textContent = cleanQuestion;
    
    const chapterInfo = document.createElement('small');
    chapterInfo.className = 'text-gray-500';
    chapterInfo.textContent = `（第${question.chapterCode}章: ${question.chapterName}）`;
    
    questionText.appendChild(questionSpan);
    questionText.appendChild(document.createElement('br'));
    questionText.appendChild(chapterInfo);
    
    // 画像表示を無効化（テキストのみ表示）
    if (questionImage) {
        questionImage.style.display = 'none';
    }
    
    // 選択肢の表示
    displayQuestionOptions(optionsContainer, question);
    
    // プログレスバーの更新
    updateProgress(progressText, progressBar);
    
    // ナビゲーションボタンの制御
    updateNavigationButtons();
}

// 画像表示機能を完全に削除（テキストのみ表示）
// function displayQuestionImage は削除されました

function displayQuestionOptions(container, question) {
    container.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const optionDiv = createOptionElement(option, index);
        container.appendChild(optionDiv);
    });
}

function createOptionElement(option, index) {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'option-hover border border-gray-300 rounded-lg p-4 cursor-pointer transition-all duration-200';
    
    const optionInput = document.createElement('input');
    optionInput.type = 'radio';
    optionInput.name = 'answer';
    optionInput.value = index;
    optionInput.id = `option-${index}`;
    optionInput.className = 'mr-3';
    
    // 既に選択されている場合は復元
    if (userAnswers[currentQuestionIndex] === index) {
        optionInput.checked = true;
        optionDiv.classList.add('option-selected');
    }
    
    const optionLabel = document.createElement('label');
    optionLabel.htmlFor = `option-${index}`;
    // 選択肢をクリーンアップしてテキストのみ表示
    const cleanOption = cleanText(option);
    optionLabel.textContent = cleanOption;
    optionLabel.className = 'cursor-pointer flex-1';
    
    optionDiv.appendChild(optionInput);
    optionDiv.appendChild(optionLabel);
    
    // クリックイベント
    optionDiv.addEventListener('click', () => selectAnswer(index, optionDiv, optionInput));
    
    return optionDiv;
}

function selectAnswer(answerIndex, optionDiv, optionInput) {
    // 現在の回答を記録
    userAnswers[currentQuestionIndex] = answerIndex;
    
    // UI更新
    document.querySelectorAll('.option-hover').forEach(opt => {
        opt.classList.remove('option-selected');
    });
    optionDiv.classList.add('option-selected');
    optionInput.checked = true;
}

function updateProgress(progressText, progressBar) {
    const current = currentQuestionIndex + 1;
    const total = currentExamQuestions.length;
    
    progressText.textContent = `問題 ${current} / ${total}`;
    const progressPercentage = (current / total) * 100;
    progressBar.style.width = `${progressPercentage}%`;
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-exam-btn');
    
    prevBtn.disabled = currentQuestionIndex === 0;
    
    if (currentQuestionIndex === currentExamQuestions.length - 1) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'inline-block';
    } else {
        nextBtn.style.display = 'inline-block';
        submitBtn.style.display = 'none';
    }
}

// === ナビゲーション ===
function showPreviousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayCurrentQuestion();
    }
}

function showNextQuestion() {
    if (currentQuestionIndex < currentExamQuestions.length - 1) {
        currentQuestionIndex++;
        displayCurrentQuestion();
    }
}

// === 試験終了処理 ===
function finishExam() {
    stopTimer();
    
    const examDuration = Math.round((Date.now() - examStartTime) / 1000);
    console.log(`📋 試験終了 - 所要時間: ${Math.floor(examDuration / 60)}分${examDuration % 60}秒`);
    
    calculateAndDisplayResults();
    showScreen('result-screen');
}

function calculateAndDisplayResults() {
    let correctCount = 0;
    const wrongQuestions = [];
    
    currentExamQuestions.forEach((question, index) => {
        const userAnswer = userAnswers[index];
        const isCorrect = userAnswer === question.correctAnswer;
        
        if (isCorrect) {
            correctCount++;
        } else {
            // 間違えた問題をuserMistakes配列に追加（重複回避）
            if (question.id && !userMistakes.includes(question.id)) {
                userMistakes.push(question.id);
                console.log(`📝 苦手問題追加: ID ${question.id}`);
            }
            
            wrongQuestions.push({
                questionNumber: index + 1,
                question: question.question,
                chapterInfo: `第${question.chapterCode}章: ${question.chapterName}`,
                userAnswer: userAnswer !== null ? question.options[userAnswer] : '未回答',
                correctAnswer: question.options[question.correctAnswer],
                explanation: question.explanation,
                reference: question.reference
            });
        }
    });
    
    const scorePercentage = Math.round((correctCount / currentExamQuestions.length) * 100);
    const isPassed = scorePercentage >= EXAM_CONFIG.PASSING_SCORE_PERCENTAGE;
    
    displayResults(correctCount, scorePercentage, isPassed, wrongQuestions);
    
    // 苦手問題データを保存
    if (userMistakes.length > 0) {
        saveMistakes();
    }
}

function displayResults(correctCount, scorePercentage, isPassed, wrongQuestions) {
    const scoreDisplay = document.getElementById('score-display');
    const scoreDetail = document.getElementById('score-detail');
    const passStatus = document.getElementById('pass-status');
    const wrongQuestionsContainer = document.getElementById('wrong-questions-container');
    
    // スコア表示
    scoreDisplay.textContent = `${scorePercentage}%`;
    scoreDetail.textContent = `${currentExamQuestions.length}問中${correctCount}問正解`;
    
    // 合否表示
    if (isPassed) {
        passStatus.textContent = '🎉 合格';
        passStatus.className = 'mt-4 text-2xl font-bold text-green-600';
    } else {
        passStatus.textContent = '❌ 不合格';
        passStatus.className = 'mt-4 text-2xl font-bold text-red-600';
    }
    
    // 間違えた問題の詳細表示
    displayWrongQuestions(wrongQuestionsContainer, wrongQuestions);
    
    console.log(`📊 試験結果 - 正答率: ${scorePercentage}%, 合否: ${isPassed ? '合格' : '不合格'}`);
}

function displayWrongQuestions(container, wrongQuestions) {
    container.innerHTML = '';
    
    if (wrongQuestions.length === 0) {
        const perfectDiv = document.createElement('div');
        perfectDiv.className = 'text-center py-8';
        perfectDiv.innerHTML = `
            <div class="text-6xl mb-4">🎉</div>
            <div class="text-xl font-bold text-green-600 mb-2">全問正解！</div>
            <div class="text-gray-600">素晴らしい成績です。</div>
        `;
        container.appendChild(perfectDiv);
        return;
    }
    
    // ヘッダー
    const headerDiv = document.createElement('div');
    headerDiv.className = 'mb-6 p-4 bg-red-50 border border-red-200 rounded-lg';
    headerDiv.innerHTML = `
        <h3 class="text-lg font-bold text-red-800 mb-2">間違えた問題の解説</h3>
        <p class="text-red-700">以下の${wrongQuestions.length}問を復習しましょう：</p>
    `;
    container.appendChild(headerDiv);
    
    // 各問題の詳細を安全な方法で構築
    wrongQuestions.forEach(wrongQ => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'border-l-4 border-red-500 bg-red-50 p-6 mb-6 rounded-r-lg';
        
        // 問題番号・章情報
        const headerDiv = document.createElement('div');
        headerDiv.className = 'font-bold text-gray-800 mb-3';
        headerDiv.textContent = `問題 ${wrongQ.questionNumber} `;
        const chapterSpan = document.createElement('span');
        chapterSpan.className = 'text-sm font-normal text-gray-600 ml-2';
        chapterSpan.textContent = wrongQ.chapterInfo;
        headerDiv.appendChild(chapterSpan);
        questionDiv.appendChild(headerDiv);
        
        // 問題文
        const questionTextDiv = document.createElement('div');
        questionTextDiv.className = 'text-gray-700 mb-4 leading-relaxed';
        questionTextDiv.textContent = cleanText(wrongQ.question);
        questionDiv.appendChild(questionTextDiv);
        
        // 回答比較
        const answerCompareDiv = document.createElement('div');
        answerCompareDiv.className = 'bg-white p-4 rounded-lg mb-4';
        const gridDiv = document.createElement('div');
        gridDiv.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 text-sm';
        
        // あなたの回答
        const userAnswerDiv = document.createElement('div');
        const userAnswerLabel = document.createElement('strong');
        userAnswerLabel.className = 'text-red-600';
        userAnswerLabel.textContent = '❌ あなたの回答:';
        userAnswerDiv.appendChild(userAnswerLabel);
        userAnswerDiv.appendChild(document.createElement('br'));
        const userAnswerSpan = document.createElement('span');
        userAnswerSpan.className = 'text-red-700';
        userAnswerSpan.textContent = cleanText(wrongQ.userAnswer);
        userAnswerDiv.appendChild(userAnswerSpan);
        gridDiv.appendChild(userAnswerDiv);
        
        // 正解
        const correctAnswerDiv = document.createElement('div');
        const correctAnswerLabel = document.createElement('strong');
        correctAnswerLabel.className = 'text-green-600';
        correctAnswerLabel.textContent = '✓ 正解:';
        correctAnswerDiv.appendChild(correctAnswerLabel);
        correctAnswerDiv.appendChild(document.createElement('br'));
        const correctAnswerSpan = document.createElement('span');
        correctAnswerSpan.className = 'text-green-700 font-semibold';
        correctAnswerSpan.textContent = cleanText(wrongQ.correctAnswer);
        correctAnswerDiv.appendChild(correctAnswerSpan);
        gridDiv.appendChild(correctAnswerDiv);
        
        answerCompareDiv.appendChild(gridDiv);
        questionDiv.appendChild(answerCompareDiv);
        
        // 解説
        const explanationDiv = document.createElement('div');
        explanationDiv.className = 'bg-blue-50 p-4 rounded-lg';
        const explanationInnerDiv = document.createElement('div');
        explanationInnerDiv.className = 'text-sm';
        const explanationLabel = document.createElement('strong');
        explanationLabel.className = 'text-blue-800';
        explanationLabel.textContent = '💡 解説:';
        explanationInnerDiv.appendChild(explanationLabel);
        explanationInnerDiv.appendChild(document.createElement('br'));
        const explanationSpan = document.createElement('span');
        explanationSpan.className = 'text-blue-700 leading-relaxed';
        explanationSpan.textContent = cleanText(wrongQ.explanation);
        explanationInnerDiv.appendChild(explanationSpan);
        explanationDiv.appendChild(explanationInnerDiv);
        
        // 参考文献
        if (wrongQ.reference) {
            const referenceDiv = document.createElement('div');
            referenceDiv.className = 'text-xs text-blue-600 mt-2';
            referenceDiv.textContent = `📚 参考: ${cleanText(wrongQ.reference)}`;
            explanationDiv.appendChild(referenceDiv);
        }
        
        questionDiv.appendChild(explanationDiv);
        container.appendChild(questionDiv);
    });
}

// === UI制御 ===
function showScreen(screenName) {
    const screens = ['top-screen', 'exam-screen', 'result-screen'];
    
    screens.forEach(screen => {
        const element = document.getElementById(screen);
        if (element) {
            element.style.display = screen === screenName ? 'block' : 'none';
        }
    });
    
    // トップ画面に戻る際のリセット処理
    if (screenName === 'top-screen') {
        resetExamState();
    }
}

function resetExamState() {
    currentQuestionIndex = 0;
    userAnswers = [];
    currentExamQuestions = [];
    stopTimer();
    
    // タイマー表示のリセット
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.classList.remove('timer-warning');
        timerElement.textContent = '';
    }
}

// === ローディング画面 ===
function showLoadingScreen() {
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.className = 'fixed inset-0 bg-gray-50 flex items-center justify-center z-50';
    loadingScreen.innerHTML = `
        <div class="text-center max-w-md">
            <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
            <h2 class="text-xl font-bold text-gray-800 mb-2">コア問題データベースを読み込み中...</h2>
            <div id="loading-progress" class="text-gray-600 mb-4">初期化中...</div>
            <div class="text-sm text-gray-500">
                <div>📚 第3章: 200問（無人航空機に関する規則）</div>
                <div>🔧 第4章: 100問（無人航空機のシステム）</div>
                <div>👨‍✈️ 第5章: 70問（操縦者及び運航体制）</div>
                <div>⚠️ 第6章: 80問（運航上のリスク管理）</div>
                <div class="mt-2 font-semibold">合計: 450問</div>
            </div>
        </div>
    `;
    document.body.appendChild(loadingScreen);
}

function showLoadingProgress(message) {
    const progressElement = document.getElementById('loading-progress');
    if (progressElement) {
        progressElement.textContent = message;
    }
}

function showLoadingError(errorMessage) {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div class="text-center max-w-md">
                <div class="text-6xl mb-4">❌</div>
                <h2 class="text-xl font-bold text-red-600 mb-4">データ読み込みエラー</h2>
                <div class="text-gray-700 mb-6">${errorMessage}</div>
                <button onclick="location.reload()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    ページを再読み込み
                </button>
            </div>
        `;
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.remove();
    }
}

// === ユーティリティ関数 ===
function validateDataLoaded() {
    if (!isDataLoaded || masterQuestions.length === 0) {
        alert('問題データが読み込まれていません。ページを再読み込みしてください。');
        return false;
    }
    return true;
}

function cleanText(text) {
    if (!text) return '';
    
    let cleanedText = text;
    
    // 画像データURL形式を除去（日本語文字を保護）
    cleanedText = cleanedText.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{50,}/g, '');
    
    // HTMLタグを除去（ただし、日本語文字は保護）
    cleanedText = cleanedText.replace(/<[^>]*>/g, '');
    
    // 画像関連の属性を除去
    cleanedText = cleanedText.replace(/src\s*=\s*["'][^"']*["']/gi, '');
    cleanedText = cleanedText.replace(/alt\s*=\s*["'][^"']*["']/gi, '');
    
    // 明らかにbase64データっぽい非常に長い英数字文字列のみ除去
    // 日本語文字、記号、通常の英数字は保護
    cleanedText = cleanedText.replace(/\b[A-Za-z0-9+/=]{200,}\b/g, '');
    
    // 複数の空白や改行をクリーンアップ
    cleanedText = cleanedText.replace(/\s{2,}/g, ' ').trim();
    
    return cleanedText;
}

// === イベントリスナー設定 ===
function setupEventListeners() {
    // 模擬試験開始ボタン
    const startMockExamBtn = document.getElementById('start-mock-exam-btn');
    if (startMockExamBtn) {
        startMockExamBtn.addEventListener('click', startMockExam);
    }
    
    // 分野別学習開始ボタン
    const startCategoryExamBtn = document.getElementById('start-category-exam-btn');
    if (startCategoryExamBtn) {
        startCategoryExamBtn.addEventListener('click', startCategoryStudy);
    }
    
    // 苦手克服モード開始ボタン（動的追加）
    addWeaknessOvercomeModeButton();
    
    // 分野選択モーダルのイベント
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const categoryCode = btn.dataset.category.split('_')[0]; // "03_kisoku" -> "03"
            startCategoryExam(categoryCode);
        });
    });
    
    // モーダル閉じるボタン
    const closeCategoryModal = document.getElementById('close-category-modal');
    if (closeCategoryModal) {
        closeCategoryModal.addEventListener('click', () => {
            document.getElementById('category-modal').classList.add('hidden');
        });
    }
    
    // 分野別学習のボタン
    const categorySubmitBtn = document.getElementById('category-submit-btn');
    if (categorySubmitBtn) {
        categorySubmitBtn.addEventListener('click', submitCategoryAnswer);
    }
    
    const categoryNextBtn = document.getElementById('category-next-btn');
    if (categoryNextBtn) {
        categoryNextBtn.addEventListener('click', showNextCategoryQuestion);
    }
    
    const exitCategoryStudyBtn = document.getElementById('exit-category-study-btn');
    if (exitCategoryStudyBtn) {
        exitCategoryStudyBtn.addEventListener('click', () => {
            if (confirm('分野別学習を終了してトップに戻りますか？')) {
                exitCategoryStudy();
            }
        });
    }
    
    // トップに戻るボタン
    const backToTopBtn = document.getElementById('back-to-top-btn');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            if (confirm('試験を終了してトップに戻りますか？')) {
                showScreen('top-screen');
            }
        });
    }
    
    // ナビゲーションボタン
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    if (prevBtn) prevBtn.addEventListener('click', showPreviousQuestion);
    if (nextBtn) nextBtn.addEventListener('click', showNextQuestion);
    
    // 試験終了ボタン
    const submitExamBtn = document.getElementById('submit-exam-btn');
    if (submitExamBtn) {
        submitExamBtn.addEventListener('click', () => {
            if (confirm('試験を終了して結果を表示しますか？')) {
                finishExam();
            }
        });
    }
    
    // 結果画面からのナビゲーション
    const backToTopFromResultBtn = document.getElementById('back-to-top-from-result-btn');
    if (backToTopFromResultBtn) {
        backToTopFromResultBtn.addEventListener('click', () => {
            showScreen('top-screen');
        });
    }
    
    const retryExamBtn = document.getElementById('retry-exam-btn');
    if (retryExamBtn) {
        retryExamBtn.addEventListener('click', startMockExam);
    }
}

// === 分野別学習機能 ===
let categoryStudyData = {
    questions: [],
    currentIndex: 0,
    selectedCategory: null,
    userAnswer: null,
    isAnswered: false
};

function startCategoryStudy() {
    if (!validateDataLoaded()) return;
    
    console.log('🎯 分野別学習モーダルを表示');
    document.getElementById('category-modal').classList.remove('hidden');
}

function startCategoryExam(categoryCode) {
    console.log(`📚 分野別学習開始: ${categoryCode}`);
    
    // カテゴリ別問題を抽出
    categoryStudyData.questions = masterQuestions.filter(q => q.chapterCode === categoryCode);
    categoryStudyData.currentIndex = 0;
    categoryStudyData.selectedCategory = categoryCode;
    categoryStudyData.userAnswer = null;
    categoryStudyData.isAnswered = false;
    
    if (categoryStudyData.questions.length === 0) {
        alert('選択された分野の問題が見つかりません。');
        return;
    }
    
    // モーダルを閉じて分野別学習画面を表示
    document.getElementById('category-modal').classList.add('hidden');
    showCategoryStudyScreen();
    displayCategoryQuestion();
}

function showCategoryStudyScreen() {
    // 全画面を非表示
    const screens = ['top-screen', 'exam-screen', 'result-screen'];
    screens.forEach(screen => {
        const element = document.getElementById(screen);
        if (element) element.style.display = 'none';
    });
    
    // 分野別学習画面を表示
    const categoryScreen = document.getElementById('category-study-screen');
    if (categoryScreen) {
        categoryScreen.classList.remove('hidden');
        categoryScreen.style.display = 'block';
    }
}

function displayCategoryQuestion() {
    if (!categoryStudyData.questions[categoryStudyData.currentIndex]) return;
    
    const question = categoryStudyData.questions[categoryStudyData.currentIndex];
    const categoryNames = {
        '03': '無人航空機に関する規則',
        '04': '無人航空機のシステム', 
        '05': '無人航空機の操縦者及び運航体制',
        '06': '運航上のリスク管理'
    };
    
    // UI要素の更新
    document.getElementById('category-title').textContent = categoryNames[categoryStudyData.selectedCategory] || '分野別学習';
    document.getElementById('category-progress').textContent = 
        `問題 ${categoryStudyData.currentIndex + 1} / ${categoryStudyData.questions.length}`;
    document.getElementById('category-question-number').textContent = 
        `問題 ${categoryStudyData.currentIndex + 1}`;
    // 問題文をクリーンアップ
    const cleanCategoryQuestion = cleanText(question.question);
    
    document.getElementById('category-question-text').textContent = cleanCategoryQuestion;
    
    // 画像表示を無効化（テキストのみ表示）
    const imageElement = document.getElementById('category-question-image');
    if (imageElement) {
        imageElement.style.display = 'none';
    }
    
    // 選択肢表示
    displayCategoryOptions(question);
    
    // ボタン状態をリセット
    resetCategoryAnswerState();
}

function displayCategoryOptions(question) {
    const container = document.getElementById('category-options-container');
    container.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'category-option border border-gray-300 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:bg-gray-50';
        optionDiv.dataset.optionIndex = index;
        
        const optionInput = document.createElement('input');
        optionInput.type = 'radio';
        optionInput.name = 'category-answer';
        optionInput.value = index;
        optionInput.id = `category-option-${index}`;
        optionInput.className = 'mr-3';
        
        const optionLabel = document.createElement('label');
        optionLabel.htmlFor = `category-option-${index}`;
        // 選択肢をクリーンアップしてテキストのみ表示
        const cleanCategoryOption = cleanText(option);
        optionLabel.textContent = cleanCategoryOption;
        optionLabel.className = 'cursor-pointer flex-1';
        
        optionDiv.appendChild(optionInput);
        optionDiv.appendChild(optionLabel);
        
        // クリックイベント
        optionDiv.addEventListener('click', () => selectCategoryAnswer(index, optionDiv, optionInput));
        
        container.appendChild(optionDiv);
    });
}

function selectCategoryAnswer(answerIndex, optionDiv, optionInput) {
    if (categoryStudyData.isAnswered) return;
    
    categoryStudyData.userAnswer = answerIndex;
    
    // UI更新
    document.querySelectorAll('.category-option').forEach(opt => {
        opt.classList.remove('option-selected');
    });
    optionDiv.classList.add('option-selected');
    optionInput.checked = true;
}

function submitCategoryAnswer() {
    if (categoryStudyData.userAnswer === null) {
        alert('選択肢を選んでください。');
        return;
    }
    
    categoryStudyData.isAnswered = true;
    const question = categoryStudyData.questions[categoryStudyData.currentIndex];
    const isCorrect = categoryStudyData.userAnswer === question.correctAnswer;
    
    // 間違えた場合は苦手問題に追加
    if (!isCorrect && question.id && !userMistakes.includes(question.id)) {
        userMistakes.push(question.id);
        console.log(`📝 苦手問題追加 (分野別学習): ID ${question.id}`);
        saveMistakes(); // 即座に保存
    }
    
    // 結果表示
    showCategoryAnswerResult(isCorrect, question);
    
    // ボタン切り替え
    document.getElementById('category-submit-btn').classList.add('hidden');
    document.getElementById('category-next-btn').classList.remove('hidden');
}

function showCategoryAnswerResult(isCorrect, question) {
    const resultDiv = document.getElementById('category-answer-result');
    const statusDiv = document.getElementById('category-answer-status');
    const explanationDiv = document.getElementById('category-answer-explanation');
    
    // 選択肢の色付け
    document.querySelectorAll('.category-option').forEach((opt, index) => {
        if (index === question.correctAnswer) {
            opt.classList.add('bg-green-100', 'border-green-500');
        } else if (index === categoryStudyData.userAnswer && !isCorrect) {
            opt.classList.add('bg-red-100', 'border-red-500');
        }
        opt.classList.remove('cursor-pointer');
        opt.style.pointerEvents = 'none';
    });
    
    // 結果表示
    if (isCorrect) {
        statusDiv.textContent = '✅ 正解です！';
        statusDiv.className = 'font-bold mb-2 text-green-600';
    } else {
        statusDiv.textContent = '❌ 不正解です';
        statusDiv.className = 'font-bold mb-2 text-red-600';
    }
    
    // 解説表示を安全な方法で構築
    explanationDiv.innerHTML = '';
    
    // 正解表示
    const correctDiv = document.createElement('div');
    correctDiv.className = 'text-sm text-gray-700 mb-2';
    const correctLabel = document.createElement('strong');
    correctLabel.textContent = '正解: ';
    const correctText = document.createTextNode(cleanText(question.options[question.correctAnswer]));
    correctDiv.appendChild(correctLabel);
    correctDiv.appendChild(correctText);
    explanationDiv.appendChild(correctDiv);
    
    // 解説表示
    const explanationTextDiv = document.createElement('div');
    explanationTextDiv.className = 'text-sm text-gray-700';
    const explanationLabel = document.createElement('strong');
    explanationLabel.textContent = '解説: ';
    const explanationText = document.createTextNode(cleanText(question.explanation));
    explanationTextDiv.appendChild(explanationLabel);
    explanationTextDiv.appendChild(explanationText);
    explanationDiv.appendChild(explanationTextDiv);
    
    // 参考文献表示
    if (question.reference) {
        const referenceDiv = document.createElement('div');
        referenceDiv.className = 'text-xs text-gray-500 mt-2';
        referenceDiv.textContent = `参考: ${cleanText(question.reference)}`;
        explanationDiv.appendChild(referenceDiv);
    }
    
    resultDiv.classList.remove('hidden');
}

function showNextCategoryQuestion() {
    categoryStudyData.currentIndex++;
    
    if (categoryStudyData.currentIndex >= categoryStudyData.questions.length) {
        // 分野別学習完了
        alert('この分野の学習が完了しました！');
        exitCategoryStudy();
        return;
    }
    
    // 次の問題へ
    displayCategoryQuestion();
}

function resetCategoryAnswerState() {
    categoryStudyData.userAnswer = null;
    categoryStudyData.isAnswered = false;
    
    document.getElementById('category-answer-result').classList.add('hidden');
    document.getElementById('category-submit-btn').classList.remove('hidden');
    document.getElementById('category-next-btn').classList.add('hidden');
}

function exitCategoryStudy() {
    // 分野別学習画面を非表示
    document.getElementById('category-study-screen').classList.add('hidden');
    document.getElementById('category-study-screen').style.display = 'none';
    
    // トップ画面に戻る
    showScreen('top-screen');
    
    // データリセット
    categoryStudyData = {
        questions: [],
        currentIndex: 0,
        selectedCategory: null,
        userAnswer: null,
        isAnswered: false
    };
}

// === 苦手克服モード ===
function addWeaknessOvercomeModeButton() {
    // 苦手克服モードボタンをHTMLに動的追加
    const menuContainer = document.querySelector('.grid.gap-4.md\\:grid-cols-2');
    if (menuContainer) {
        const weaknessButton = document.createElement('div');
        weaknessButton.className = 'bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow';
        weaknessButton.innerHTML = `
            <h3 class="text-lg font-bold text-gray-800 mb-3">苦手克服モード</h3>
            <p class="text-gray-600 mb-4 text-sm">
                あなたが間違えた問題を集中的に復習できます。
            </p>
            <div class="mb-3">
                <span id="weakness-count" class="text-sm font-medium text-blue-600">
                    苦手問題: ${userMistakes.length}問
                </span>
            </div>
            <button id="start-weakness-mode-btn" class="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors">
                苦手克服を始める
            </button>
        `;
        
        // メニューコンテナに追加
        menuContainer.appendChild(weaknessButton);
        
        // イベントリスナー追加
        const startWeaknessModeBtn = document.getElementById('start-weakness-mode-btn');
        startWeaknessModeBtn.addEventListener('click', startWeaknessOvercomeMode);
    }
}

function updateWeaknessButtonCount() {
    const countElement = document.getElementById('weakness-count');
    if (countElement) {
        countElement.textContent = `苦手問題: ${userMistakes.length}問`;
    }
}

function startWeaknessOvercomeMode() {
    if (!validateDataLoaded()) return;
    
    if (userMistakes.length === 0) {
        showNotification('苦手問題がありません。まずは試験や学習を行ってください。', 'info');
        return;
    }
    
    console.log(`🎯 苦手克服モード開始: ${userMistakes.length}問対象`);
    
    // userMistakes配列の問題IDに基づいて問題を抽出
    const weaknessQuestions = masterQuestions.filter(question => 
        question.id && userMistakes.includes(question.id)
    );
    
    if (weaknessQuestions.length === 0) {
        showNotification('苦手問題が見つかりませんでした。', 'warning');
        return;
    }
    
    // 苦手問題をシャッフル
    const shuffledWeaknessQuestions = shuffleArray([...weaknessQuestions]);
    
    // 模擬試験と同じ形式で出題（最大30問）
    currentExamQuestions = shuffledWeaknessQuestions.slice(0, Math.min(30, shuffledWeaknessQuestions.length));
    currentQuestionIndex = 0;
    userAnswers = new Array(currentExamQuestions.length).fill(null);
    examStartTime = Date.now();
    
    showScreen('exam-screen');
    startTimer();
    displayCurrentQuestion();
    
    // ヘッダーのタイトルを変更
    const examTitle = document.querySelector('#exam-screen header h1');
    if (examTitle) {
        examTitle.textContent = '苦手克服モード';
    }
    
    showNotification(`苦手問題${currentExamQuestions.length}問での復習を開始します`, 'info');
}

function shuffleArray(array) {
    // Fisher-Yatesアルゴリズムでシャッフル
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// === エクスポート（デバッグ用）===
window.DEBUG_UAV_APP = {
    masterQuestions,
    currentExamQuestions,
    getChapterBreakdown,
    validateDataLoaded,
    categoryStudyData,
    userMistakes,
    currentUser,
    loadMistakes,
    saveMistakes
};

console.log('🚁 UAV試験対策アプリ初期化完了（クラウド連携対応）');