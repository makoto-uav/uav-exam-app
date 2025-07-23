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
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxJt0qiE2P4y9MLPZ61tyrBHIqiMwIKHZ1B_BeixnkxYPhCJs1xQnJUWivtAbxOPekC/exec';
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
let examHistory = []; // 試験履歴記録

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
        await loadExamHistory(currentUser);
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
            
            // 苦手問題データと試験履歴を読み込み
            Promise.all([
                loadMistakes(currentUser),
                loadExamHistory(currentUser)
            ]).then(() => {
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
        
        // LocalStorageからのフォールバック読み込み
        try {
            const localData = localStorage.getItem(`userMistakes_${userId}`);
            if (localData) {
                userMistakes = JSON.parse(localData);
                console.log(`📱 LocalStorageから苦手問題を読み込み: ${userMistakes.length}問`);
            } else {
                userMistakes = [];
                console.log('📝 新規ユーザー: 苦手問題データを初期化');
            }
        } catch (localError) {
            console.error('❌ LocalStorage読み込みエラー:', localError);
            userMistakes = [];
        }
        
        // データ読み込み完了後に苦手克服ボタンの表示を更新
        setTimeout(() => updateWeaknessButtonCount(), 100);
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
        
        // LocalStorageにもバックアップ保存
        localStorage.setItem(`userMistakes_${currentUser}`, JSON.stringify(userMistakes));
        
    } catch (error) {
        console.error('❌ 苦手問題データ保存エラー:', error);
        
        // 外部保存が失敗してもLocalStorageには保存
        try {
            localStorage.setItem(`userMistakes_${currentUser}`, JSON.stringify(userMistakes));
            console.log(`📱 LocalStorageに苦手問題をバックアップ保存: ${userMistakes.length}問`);
            updateWeaknessButtonCount(); // 苦手問題数の表示を更新
        } catch (localError) {
            console.error('❌ LocalStorageバックアップ保存エラー:', localError);
        }
    }
}

// === 試験履歴管理機能 ===
async function loadExamHistory(userId) {
    try {
        console.log(`📊 ${userId} の試験履歴を読み込み中...`);
        
        const savedHistory = localStorage.getItem(`examHistory_${userId}`);
        if (savedHistory) {
            examHistory = JSON.parse(savedHistory);
            console.log(`✅ 試験履歴読み込み完了: ${examHistory.length}件`);
        } else {
            examHistory = [];
            console.log('📝 新規ユーザー: 試験履歴を初期化');
        }
        
    } catch (error) {
        console.error('❌ 試験履歴読み込みエラー:', error);
        examHistory = [];
    }
}

function saveExamHistory(examResult) {
    try {
        examHistory.unshift(examResult); // 新しい結果を先頭に追加
        
        // 履歴は最大20件まで保持
        if (examHistory.length > 20) {
            examHistory = examHistory.slice(0, 20);
        }
        
        localStorage.setItem(`examHistory_${currentUser}`, JSON.stringify(examHistory));
        console.log(`💾 試験履歴保存完了: ${examHistory.length}件`);
        
    } catch (error) {
        console.error('❌ 試験履歴保存エラー:', error);
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
            CORE_DATA_FILES.map(async fileName => {
                try {
                    const response = await fetch(fileName, {
                        headers: {
                            'Accept': 'application/json; charset=utf-8'
                        }
                    });
                    return { response, fileName, success: response.ok };
                } catch (error) {
                    console.warn(`⚠ ファイル読み込み失敗: ${fileName} - ${error.message}`);
                    return { response: null, fileName, success: false, error: error.message };
                }
            })
        );

        // 成功したレスポンスのみ処理
        const successfulResponses = responses.filter(item => item.success);
        
        if (successfulResponses.length === 0) {
            throw new Error('すべての問題データファイルの読み込みに失敗しました。ローカルサーバーが起動しているか確認してください。');
        }

        // レスポンスの検証とJSONパース
        const allDatasets = await Promise.all(
            successfulResponses.map(async (item) => {
                try {
                    return await item.response.json();
                } catch (error) {
                    console.warn(`⚠ JSON解析失敗: ${item.fileName} - ${error.message}`);
                    return null;
                }
            })
        );

        // 有効なデータセットのみフィルタ
        const validDatasets = allDatasets.filter(dataset => dataset !== null);

        // マスター問題配列への結合
        masterQuestions = [];
        let totalQuestionsLoaded = 0;

        validDatasets.forEach((dataset, index) => {
            if (dataset && dataset.questions && Array.isArray(dataset.questions)) {
                const fileName = successfulResponses[index].fileName;
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
            }
        });

        // 読み込み結果の検証
        if (masterQuestions.length === 0) {
            throw new Error('問題データが1問も読み込まれませんでした。ローカルサーバー（python -m http.server 8000）が起動しているか確認してください。');
        }

        isDataLoaded = true;
        showLoadingProgress('読み込み完了！');
        
        const loadedFiles = successfulResponses.length;
        const totalFiles = CORE_DATA_FILES.length;
        console.log(`🎉 コア問題データベース読み込み完了: ${loadedFiles}/${totalFiles}ファイル, 合計${totalQuestionsLoaded}問`);
        console.log('📊 章別内訳:', getChapterBreakdown());
        
    } catch (error) {
        console.error('❌ 問題データの読み込みに失敗:', error);
        showLoadingError(`データ読み込みエラー: ${error.message}\n\n解決方法:\n1. ローカルサーバーを起動してください: python -m http.server 8000\n2. ブラウザでhttp://localhost:8000にアクセスしてください`);
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
    createAnswerStatusGrid();
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
    
    // 回答状況グリッドの更新
    updateAnswerStatusGrid();
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
    
    // 回答状況グリッドの更新
    updateAnswerStatusGrid();
    
    // ナビゲーションボタンの更新（選択肢を選んだ時）
    updateNavigationButtons();
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
    
    // 全問題に回答済みかどうかをチェック
    const allAnswered = checkAllQuestionsAnswered();
    
    if (currentQuestionIndex === currentExamQuestions.length - 1) {
        // 最後の問題の場合
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'inline-block';
        submitBtn.textContent = '試験終了';
    } else if (allAnswered) {
        // 全問題に回答済みで、かつ最後の問題ではない場合
        nextBtn.style.display = 'inline-block';
        submitBtn.style.display = 'inline-block';
        submitBtn.textContent = '試験終了';
    } else {
        // 未回答の問題がある場合
        nextBtn.style.display = 'inline-block';
        submitBtn.style.display = 'none';
    }
}

function checkAllQuestionsAnswered() {
    for (let i = 0; i < currentExamQuestions.length; i++) {
        if (userAnswers[i] === null || userAnswers[i] === undefined) {
            return false;
        }
    }
    return true;
}

// === 回答状況グリッド管理 ===
function createAnswerStatusGrid() {
    const grid = document.getElementById('answer-status-grid');
    if (!grid || !currentExamQuestions.length) return;
    
    grid.innerHTML = '';
    
    currentExamQuestions.forEach((_, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'answer-status-item cursor-pointer p-2 rounded transition-all duration-200 border-2 border-gray-200 hover:shadow-md';
        
        const questionNumber = document.createElement('div');
        questionNumber.className = 'text-xs font-bold text-center mb-1';
        questionNumber.textContent = `Q${index + 1}`;
        
        const answerChoice = document.createElement('div');
        answerChoice.className = 'text-lg font-bold text-center min-h-6';
        answerChoice.id = `answer-choice-${index}`;
        answerChoice.textContent = '-';
        
        questionDiv.appendChild(questionNumber);
        questionDiv.appendChild(answerChoice);
        
        questionDiv.addEventListener('click', () => goToQuestion(index));
        
        grid.appendChild(questionDiv);
    });
}

function updateAnswerStatusGrid() {
    const grid = document.getElementById('answer-status-grid');
    if (!grid) return;
    
    const questionItems = grid.children;
    
    for (let i = 0; i < questionItems.length; i++) {
        const questionDiv = questionItems[i];
        const questionNumber = questionDiv.children[0];
        const answerChoice = questionDiv.children[1];
        
        // スタイルをリセット
        questionDiv.className = 'answer-status-item cursor-pointer p-2 rounded transition-all duration-200 border-2 hover:shadow-md';
        questionNumber.className = 'text-xs font-bold text-center mb-1';
        answerChoice.className = 'text-lg font-bold text-center min-h-6';
        
        // 選択肢を表示
        if (userAnswers[i] !== null && userAnswers[i] !== undefined) {
            const choiceLabels = ['A', 'B', 'C', 'D', 'E'];
            answerChoice.textContent = choiceLabels[userAnswers[i]] || '-';
        } else {
            answerChoice.textContent = '-';
        }
        
        if (i === currentQuestionIndex) {
            // 現在の問題
            questionDiv.classList.add('border-blue-600', 'bg-blue-50');
            questionNumber.classList.add('text-blue-700');
            answerChoice.classList.add('text-blue-600');
        } else if (userAnswers[i] !== null && userAnswers[i] !== undefined) {
            // 回答済み
            questionDiv.classList.add('border-green-500', 'bg-green-50');
            questionNumber.classList.add('text-green-700');
            answerChoice.classList.add('text-green-600');
        } else {
            // 未回答
            questionDiv.classList.add('border-gray-300', 'bg-gray-50', 'hover:bg-gray-100');
            questionNumber.classList.add('text-gray-600');
            answerChoice.classList.add('text-gray-400');
        }
    }
}

function goToQuestion(questionIndex) {
    if (questionIndex >= 0 && questionIndex < currentExamQuestions.length) {
        currentQuestionIndex = questionIndex;
        displayCurrentQuestion();
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
    const correctQuestions = [];
    const detailedAnswers = [];
    
    currentExamQuestions.forEach((question, index) => {
        const userAnswer = userAnswers[index];
        const isCorrect = userAnswer === question.correctAnswer;
        
        // 詳細な回答記録を作成
        detailedAnswers.push({
            questionId: question.id,
            questionText: question.question,
            chapterCode: question.chapterCode,
            chapterName: question.chapterName,
            options: question.options,
            userAnswer: userAnswer,
            correctAnswer: question.correctAnswer,
            isCorrect: isCorrect,
            explanation: question.explanation,
            reference: question.reference
        });
        
        if (isCorrect) {
            correctCount++;
            
            // 正解した問題も記録
            correctQuestions.push({
                questionNumber: index + 1,
                question: question.question,
                chapterInfo: `第${question.chapterCode}章: ${question.chapterName}`,
                userAnswer: userAnswer !== null ? question.options[userAnswer] : '未回答',
                correctAnswer: question.options[question.correctAnswer],
                explanation: question.explanation,
                reference: question.reference,
                isCorrect: true
            });
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
                reference: question.reference,
                isCorrect: false
            });
        }
    });
    
    const scorePercentage = Math.round((correctCount / currentExamQuestions.length) * 100);
    const isPassed = scorePercentage >= EXAM_CONFIG.PASSING_SCORE_PERCENTAGE;
    const examDuration = Math.round((Date.now() - examStartTime) / 1000);
    
    // 試験結果を履歴に保存
    const examResult = {
        id: Date.now(),
        date: new Date().toISOString(),
        dateString: new Date().toLocaleString('ja-JP'),
        totalQuestions: currentExamQuestions.length,
        correctCount: correctCount,
        scorePercentage: scorePercentage,
        isPassed: isPassed,
        duration: examDuration,
        answers: detailedAnswers,
        examType: document.querySelector('#exam-screen header h1')?.textContent || '模擬試験'
    };
    
    saveExamHistory(examResult);
    
    displayResults(correctCount, scorePercentage, isPassed, wrongQuestions, correctQuestions);
    
    // 苦手問題データを保存
    if (userMistakes.length > 0) {
        saveMistakes();
    }
    
    // UI更新（試験完了後）
    setTimeout(() => {
        updateWeaknessButtonCount(); // 苦手問題数と履歴数を更新
    }, 100);
}

function displayResults(correctCount, scorePercentage, isPassed, wrongQuestions, correctQuestions) {
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
    
    // 結果表を表示（新しい表形式システム）
    displayResultsTable(wrongQuestions, correctQuestions);
    
    console.log(`📊 試験結果 - 正答率: ${scorePercentage}%, 合否: ${isPassed ? '合格' : '不合格'}`);
}

// グローバル変数として現在の問題結果を保存
let currentAllQuestions = [];

// 新しい表形式結果表示システム
function displayResultsTable(wrongQuestions, correctQuestions) {
    // 全問題を結合して問題番号順にソート
    currentAllQuestions = [...correctQuestions, ...wrongQuestions]
        .sort((a, b) => a.questionNumber - b.questionNumber);
    
    const tableBody = document.getElementById('results-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    currentAllQuestions.forEach(question => {
        const isCorrect = question.isCorrect !== false;
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 cursor-pointer';
        row.onclick = () => showQuestionDetail(question);
        
        // 問題番号
        const questionCell = document.createElement('td');
        questionCell.className = 'border border-gray-300 px-4 py-2 font-medium';
        questionCell.textContent = `問題${question.questionNumber}`;
        row.appendChild(questionCell);
        
        // 結果
        const resultCell = document.createElement('td');
        resultCell.className = 'border border-gray-300 px-4 py-2 text-center';
        const resultSpan = document.createElement('span');
        resultSpan.className = `inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`;
        resultSpan.textContent = isCorrect ? '○' : '×';
        resultCell.appendChild(resultSpan);
        row.appendChild(resultCell);
        
        // 章
        const chapterCell = document.createElement('td');
        chapterCell.className = 'border border-gray-300 px-4 py-2 text-sm';
        chapterCell.textContent = question.chapterInfo.replace('第', '').replace('章:', '章');
        row.appendChild(chapterCell);
        
        // あなたの回答
        const userAnswerCell = document.createElement('td');
        userAnswerCell.className = `border border-gray-300 px-4 py-2 text-sm ${isCorrect ? 'text-green-700' : 'text-red-700'}`;
        userAnswerCell.textContent = cleanText(question.userAnswer);
        row.appendChild(userAnswerCell);
        
        // 正解
        const correctAnswerCell = document.createElement('td');
        correctAnswerCell.className = 'border border-gray-300 px-4 py-2 text-sm text-green-700 font-medium';
        correctAnswerCell.textContent = cleanText(question.correctAnswer);
        row.appendChild(correctAnswerCell);
        
        tableBody.appendChild(row);
    });
    
    // モーダルのイベントリスナーを設定
    setupQuestionModal();
}

// 問題詳細モーダルを設定
function setupQuestionModal() {
    const modal = document.getElementById('question-detail-modal');
    const closeBtn = document.getElementById('close-question-modal');
    
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.classList.add('hidden');
        };
    }
    
    // モーダル背景クリックで閉じる
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        };
    }
}

// 問題詳細を表示
function showQuestionDetail(question) {
    const modal = document.getElementById('question-detail-modal');
    const title = document.getElementById('modal-question-title');
    const content = document.getElementById('modal-question-content');
    
    if (!modal || !title || !content) return;
    
    const isCorrect = question.isCorrect !== false;
    
    // タイトル設定
    title.textContent = `問題 ${question.questionNumber}`;
    title.appendChild(document.createElement('span')).textContent = ` - ${question.chapterInfo}`;
    title.lastChild.className = 'text-sm font-normal text-gray-600 ml-2';
    
    // コンテンツをクリア
    content.innerHTML = '';
    
    // 問題文
    const questionDiv = document.createElement('div');
    questionDiv.className = 'mb-6';
    const questionLabel = document.createElement('h3');
    questionLabel.className = 'text-lg font-semibold text-gray-800 mb-3';
    questionLabel.textContent = '問題文';
    questionDiv.appendChild(questionLabel);
    const questionText = document.createElement('div');
    questionText.className = 'text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg';
    questionText.textContent = cleanText(question.question);
    questionDiv.appendChild(questionText);
    content.appendChild(questionDiv);
    
    // 回答状況
    const answerDiv = document.createElement('div');
    answerDiv.className = 'mb-6';
    const answerLabel = document.createElement('h3');
    answerLabel.className = 'text-lg font-semibold text-gray-800 mb-3';
    answerLabel.textContent = '回答状況';
    answerDiv.appendChild(answerLabel);
    
    const answerGrid = document.createElement('div');
    answerGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
    
    // あなたの回答
    const userAnswerDiv = document.createElement('div');
    userAnswerDiv.className = `p-4 rounded-lg border-2 ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`;
    const userAnswerHeader = document.createElement('div');
    userAnswerHeader.className = `font-semibold mb-2 ${isCorrect ? 'text-green-700' : 'text-red-700'}`;
    userAnswerHeader.textContent = isCorrect ? '✓ あなたの回答（正解）' : '❌ あなたの回答（不正解）';
    userAnswerDiv.appendChild(userAnswerHeader);
    const userAnswerText = document.createElement('div');
    userAnswerText.className = isCorrect ? 'text-green-700' : 'text-red-700';
    userAnswerText.textContent = cleanText(question.userAnswer);
    userAnswerDiv.appendChild(userAnswerText);
    answerGrid.appendChild(userAnswerDiv);
    
    // 正解
    const correctAnswerDiv = document.createElement('div');
    correctAnswerDiv.className = 'p-4 rounded-lg border-2 border-green-200 bg-green-50';
    const correctAnswerHeader = document.createElement('div');
    correctAnswerHeader.className = 'font-semibold text-green-700 mb-2';
    correctAnswerHeader.textContent = '✓ 正解';
    correctAnswerDiv.appendChild(correctAnswerHeader);
    const correctAnswerText = document.createElement('div');
    correctAnswerText.className = 'text-green-700 font-medium';
    correctAnswerText.textContent = cleanText(question.correctAnswer);
    correctAnswerDiv.appendChild(correctAnswerText);
    answerGrid.appendChild(correctAnswerDiv);
    
    answerDiv.appendChild(answerGrid);
    content.appendChild(answerDiv);
    
    // 解説
    const explanationDiv = document.createElement('div');
    explanationDiv.className = 'mb-4';
    const explanationLabel = document.createElement('h3');
    explanationLabel.className = 'text-lg font-semibold text-gray-800 mb-3';
    explanationLabel.textContent = '💡 解説';
    explanationDiv.appendChild(explanationLabel);
    const explanationText = document.createElement('div');
    explanationText.className = 'text-gray-700 leading-relaxed bg-blue-50 p-4 rounded-lg';
    explanationText.textContent = cleanText(question.explanation);
    explanationDiv.appendChild(explanationText);
    content.appendChild(explanationDiv);
    
    // 参考文献（画像名を除去済み）
    if (question.reference && cleanText(question.reference).trim()) {
        const referenceDiv = document.createElement('div');
        referenceDiv.className = 'mb-4';
        const referenceLabel = document.createElement('h3');
        referenceLabel.className = 'text-sm font-semibold text-blue-800 mb-2';
        referenceLabel.textContent = '📚 参考';
        referenceDiv.appendChild(referenceLabel);
        const referenceText = document.createElement('div');
        referenceText.className = 'text-blue-700 text-sm';
        referenceText.textContent = cleanText(question.reference);
        referenceDiv.appendChild(referenceText);
        content.appendChild(referenceDiv);
    }
    
    // モーダルを表示
    modal.classList.remove('hidden');
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
    
    // 回答状況グリッドをクリア
    const grid = document.getElementById('answer-status-grid');
    if (grid) {
        grid.innerHTML = '';
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
    
    // 画像ファイル名（章番号_ページ番号_説明.png等）を除去
    cleanedText = cleanedText.replace(/chapter\d+_page\d+_[a-z_]+\.png/gi, '');
    cleanedText = cleanedText.replace(/images\/[^"'\s]*\.(png|jpg|jpeg|gif)/gi, '');
    
    // 出典情報を除去
    cleanedText = cleanedText.replace(/（出典：[^）]*）/g, '');
    cleanedText = cleanedText.replace(/\(出典：[^)]*\)/g, '');
    cleanedText = cleanedText.replace(/（出典：）/g, '');
    cleanedText = cleanedText.replace(/\(出典：\)/g, '');
    
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
        
        // 試験履歴ボタンも追加
        const historyButton = document.createElement('div');
        historyButton.className = 'bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow';
        historyButton.innerHTML = `
            <h3 class="text-lg font-bold text-gray-800 mb-3">試験履歴</h3>
            <p class="text-gray-600 mb-4 text-sm">
                過去の試験結果を確認し、回答を修正できます。
            </p>
            <div class="mb-3">
                <span id="history-count" class="text-sm font-medium text-purple-600">
                    保存済み: ${examHistory.length}回
                </span>
            </div>
            <button id="show-exam-history-btn" class="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors">
                履歴を見る
            </button>
        `;
        
        // メニューコンテナに追加
        menuContainer.appendChild(weaknessButton);
        menuContainer.appendChild(historyButton);
        
        // イベントリスナー追加
        const startWeaknessModeBtn = document.getElementById('start-weakness-mode-btn');
        startWeaknessModeBtn.addEventListener('click', startWeaknessOvercomeMode);
        
        const showExamHistoryBtn = document.getElementById('show-exam-history-btn');
        showExamHistoryBtn.addEventListener('click', showExamHistoryModal);
    }
}

function updateWeaknessButtonCount() {
    const countElement = document.getElementById('weakness-count');
    if (countElement) {
        countElement.textContent = `苦手問題: ${userMistakes.length}問`;
    }
    
    const historyCountElement = document.getElementById('history-count');
    if (historyCountElement) {
        historyCountElement.textContent = `保存済み: ${examHistory.length}回`;
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
    createAnswerStatusGrid();
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

// === 試験履歴表示機能 ===
function showExamHistoryModal() {
    if (examHistory.length === 0) {
        showNotification('まだ試験履歴がありません。', 'info');
        return;
    }
    
    const modalHTML = `
        <div id="history-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
                <div class="p-6 border-b">
                    <div class="flex justify-between items-center">
                        <h2 class="text-xl font-bold text-gray-800">試験履歴</h2>
                        <button id="close-history-modal" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                    </div>
                </div>
                <div class="p-6 overflow-y-auto max-h-96">
                    <div id="history-list" class="space-y-4">
                        <!-- JavaScriptで動的生成 -->
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 履歴リストを生成
    const historyList = document.getElementById('history-list');
    examHistory.forEach((result, index) => {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'bg-gray-50 rounded-lg p-4 border hover:shadow-md transition-shadow cursor-pointer';
        
        const passClass = result.isPassed ? 'text-green-600' : 'text-red-600';
        const passText = result.isPassed ? '合格' : '不合格';
        
        resultDiv.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <div class="font-semibold text-gray-800">${result.examType}</div>
                    <div class="text-sm text-gray-600">${result.dateString}</div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold ${passClass}">${result.scorePercentage}%</div>
                    <div class="text-sm ${passClass}">${passText}</div>
                </div>
            </div>
            <div class="text-sm text-gray-600">
                ${result.correctCount}/${result.totalQuestions}問正解 • 
                所要時間: ${Math.floor(result.duration / 60)}分${result.duration % 60}秒
            </div>
        `;
        
        resultDiv.addEventListener('click', () => {
            showExamDetail(result);
        });
        
        historyList.appendChild(resultDiv);
    });
    
    // モーダル閉じるイベント
    document.getElementById('close-history-modal').addEventListener('click', () => {
        document.getElementById('history-modal').remove();
    });
}

function showExamDetail(examResult) {
    // 履歴モーダルを閉じる
    document.getElementById('history-modal').remove();
    
    const modalHTML = `
        <div id="exam-detail-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-lg max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden">
                <div class="p-6 border-b">
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-xl font-bold text-gray-800">${examResult.examType} - 詳細結果</h2>
                            <div class="text-sm text-gray-600 mt-1">${examResult.dateString}</div>
                        </div>
                        <div class="flex space-x-3">
                            <button id="back-to-history" class="bg-gray-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-600 transition-colors">履歴に戻る</button>
                            <button id="close-exam-detail-modal" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                        </div>
                    </div>
                </div>
                <div class="p-6 overflow-y-auto" style="max-height: calc(90vh - 160px);">
                    <div id="exam-detail-content">
                        <!-- JavaScriptで動的生成 -->
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 詳細内容を生成
    const content = document.getElementById('exam-detail-content');
    
    // サマリー表示
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'bg-blue-50 rounded-lg p-4 mb-6';
    const passClass = examResult.isPassed ? 'text-green-600' : 'text-red-600';
    const passText = examResult.isPassed ? '合格' : '不合格';
    
    summaryDiv.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
                <div class="text-2xl font-bold ${passClass}">${examResult.scorePercentage}%</div>
                <div class="text-sm text-gray-600">正答率</div>
            </div>
            <div>
                <div class="text-2xl font-bold text-blue-600">${examResult.correctCount}/${examResult.totalQuestions}</div>
                <div class="text-sm text-gray-600">正解数</div>
            </div>
            <div>
                <div class="text-2xl font-bold text-purple-600">${Math.floor(examResult.duration / 60)}:${String(examResult.duration % 60).padStart(2, '0')}</div>
                <div class="text-sm text-gray-600">所要時間</div>
            </div>
            <div>
                <div class="text-2xl font-bold ${passClass}">${passText}</div>
                <div class="text-sm text-gray-600">結果</div>
            </div>
        </div>
    `;
    content.appendChild(summaryDiv);
    
    // 問題ごとの詳細
    examResult.answers.forEach((answer, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = `border rounded-lg p-4 mb-4 ${answer.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`;
        
        const statusIcon = answer.isCorrect ? '✅' : '❌';
        const statusColor = answer.isCorrect ? 'text-green-600' : 'text-red-600';
        
        // 問題番号・章情報・ステータス
        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex justify-between items-start mb-3';
        headerDiv.innerHTML = `
            <div>
                <div class="font-bold text-gray-800">問題 ${index + 1}</div>
                <div class="text-sm text-gray-600">第${answer.chapterCode}章: ${answer.chapterName}</div>
            </div>
            <div class="${statusColor} text-2xl">${statusIcon}</div>
        `;
        questionDiv.appendChild(headerDiv);
        
        // 問題文
        const questionTextDiv = document.createElement('div');
        questionTextDiv.className = 'text-gray-700 mb-4 leading-relaxed';
        questionTextDiv.textContent = cleanText(answer.questionText);
        questionDiv.appendChild(questionTextDiv);
        
        // 回答選択肢
        const answersDiv = document.createElement('div');
        answersDiv.className = 'space-y-2 mb-4';
        answer.options.forEach((option, optionIndex) => {
            const optionDiv = document.createElement('div');
            let optionClass = 'p-2 rounded border text-sm';
            
            if (optionIndex === answer.correctAnswer) {
                optionClass += ' bg-green-100 border-green-300 text-green-800';
            } else if (optionIndex === answer.userAnswer && !answer.isCorrect) {
                optionClass += ' bg-red-100 border-red-300 text-red-800';
            } else {
                optionClass += ' bg-gray-50 border-gray-200 text-gray-700';
            }
            
            optionDiv.className = optionClass;
            
            let prefix = '';
            if (optionIndex === answer.correctAnswer) prefix = '✓ ';
            else if (optionIndex === answer.userAnswer && !answer.isCorrect) prefix = '✗ ';
            
            optionDiv.textContent = prefix + cleanText(option);
            answersDiv.appendChild(optionDiv);
        });
        questionDiv.appendChild(answersDiv);
        
        // 解説
        if (!answer.isCorrect && answer.explanation) {
            const explanationDiv = document.createElement('div');
            explanationDiv.className = 'bg-blue-50 border border-blue-200 rounded p-3';
            explanationDiv.innerHTML = `
                <div class="font-semibold text-blue-800 mb-1">解説:</div>
                <div class="text-blue-700 text-sm">${cleanText(answer.explanation)}</div>
                ${answer.reference ? `<div class="text-blue-600 text-xs mt-2">参考: ${cleanText(answer.reference)}</div>` : ''}
            `;
            questionDiv.appendChild(explanationDiv);
        }
        
        content.appendChild(questionDiv);
    });
    
    // イベントリスナー
    document.getElementById('close-exam-detail-modal').addEventListener('click', () => {
        document.getElementById('exam-detail-modal').remove();
    });
    
    document.getElementById('back-to-history').addEventListener('click', () => {
        document.getElementById('exam-detail-modal').remove();
        showExamHistoryModal();
    });
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
    saveMistakes,
    examHistory,
    loadExamHistory,
    saveExamHistory,
    showExamHistoryModal
};

console.log('🚁 UAV試験対策アプリ初期化完了（クラウド連携対応）');