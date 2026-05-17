// --- Levenshtein Distance (for fuzzy matching) ---
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,      // deletion
                dp[i][j - 1] + 1,      // insertion
                dp[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return dp[m][n];
}

// --- Global State ---
let currentQuizData = [];
let currentQuestionIndex = 0;
let score = 0;
let quizType = 'mc'; // 'mc' for multiple choice, 'id' for identification, 'fitb' for fill in the blanks
let difficulty = 'easy'; // easy=3, medium=2, hard=1, extreme=0
const DIFFICULTY_THRESHOLD = { easy: 3, medium: 2, hard: 1, extreme: 0 };
let userAnswers = []; // Store answers for each question: { answer: 'A' or string, submitted: bool }
let shuffledChoices = []; // Store shuffled choices per question so they stay consistent

// --- DOM Elements ---
const generateBtn = document.getElementById('generate-btn');
const csvTextArea = document.getElementById('csv-text');
const uploadBtn = document.getElementById('upload-btn');
const csvFileInput = document.getElementById('csv-file-input');
const saveCsvBtn = document.getElementById('save-csv-btn');
const actionBtn = document.getElementById('action-btn');
const scoreDisplay = document.getElementById('score-display');
const quizContainer = document.getElementById('quiz-container');
const quizArea = document.getElementById('quiz-area');
const copyBtn = document.getElementById('copy-btn');
const aiPromptMC = document.getElementById('ai-prompt');
const aiPromptID = document.getElementById('ai-prompt-id');
const aiPromptFITB = document.getElementById('ai-prompt-fitb');
const aiPromptTF = document.getElementById('ai-prompt-tf');
const aiPromptMixed = document.getElementById('ai-prompt-mixed');

// Sections to toggle
const promptSection = document.querySelector('.prompt-section');
const inputSection = document.getElementById('input-section');
const typeSection = document.getElementById('type-section');
const difficultySection = document.getElementById('difficulty-section');
const newQuizBtn = document.getElementById('new-quiz-btn');

// Navigation elements
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const homeBtn = document.getElementById('home-btn');
const progressIndicator = document.getElementById('progress-indicator');

// Quiz type selector elements
const typeRadios = document.querySelectorAll('input[name="quiz-type"]');
const typeMCLabel = document.getElementById('type-mc-label');
const typeIDLabel = document.getElementById('type-id-label');
const typeFITBLabel = document.getElementById('type-fitb-label');
const typeTFLabel = document.getElementById('type-tf-label');
const typeMixedLabel = document.getElementById('type-mixed-label');

// Placeholders for each quiz type
const MC_PLACEHOLDER = "Question Text,Correct Answer\nWhat is the chemical symbol for Gold?,Au|Ag|Gd|Go\nWhich planet is known as the Red Planet?,Mars|Venus|Jupiter|Saturn";
const ID_PLACEHOLDER = "Question Text,Correct Answer\nWhat is the chemical symbol for Gold?,Au\nWhat planet is known as the Red Planet?,Mars";
const FITB_PLACEHOLDER = "Question Text,Correct Answer\nThe ___ is the powerhouse of the cell.,mitochondria\nThe sky is ___ and the grass is ___.,blue|green\ndef greet():\n    return ___ + \"world\",\"Hello, \"";
const TF_PLACEHOLDER = "Question Text,Correct Answer\nThe sky is blue.,True\nThe earth is flat.,False";
const MIXED_PLACEHOLDER = "Question Text,Correct Answer\nWhat is the chemical symbol for Gold?,Au|Ag|Gd|Go\nThe earth is flat.,False\nWhat planet is known as the Red Planet?,Mars\nThe ___ is the powerhouse of the cell.,mitochondria";

function getQType(q) {
    if (quizType !== 'mixed') return quizType;
    const ans = (q['Correct Answer'] || '').trim().toLowerCase();
    if (ans === 'true' || ans === 'false') return 'tf';
    if ((q['Question Text'] || '').includes('___')) return 'fitb';
    if ((q['Correct Answer'] || '').includes('|')) return 'mc';
    return 'id';
}

// =====================
// Quiz Type Switching
// =====================
typeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        quizType = e.target.value;

        typeMCLabel.classList.toggle('selected', quizType === 'mc');
        typeIDLabel.classList.toggle('selected', quizType === 'id');
        typeFITBLabel.classList.toggle('selected', quizType === 'fitb');
        typeTFLabel.classList.toggle('selected', quizType === 'tf');
        typeMixedLabel.classList.toggle('selected', quizType === 'mixed');

        // Show/hide difficulty selector (ID, FITB, Mixed)
        difficultySection.style.display = (quizType === 'id' || quizType === 'fitb' || quizType === 'mixed') ? 'block' : 'none';

        aiPromptMC.style.display = 'none';
        aiPromptID.style.display = 'none';
        aiPromptFITB.style.display = 'none';
        aiPromptTF.style.display = 'none';
        aiPromptMixed.style.display = 'none';

        if (quizType === 'mc') aiPromptMC.style.display = '';
        else if (quizType === 'id') aiPromptID.style.display = '';
        else if (quizType === 'fitb') aiPromptFITB.style.display = '';
        else if (quizType === 'tf') aiPromptTF.style.display = '';
        else aiPromptMixed.style.display = '';

        if (quizType === 'mc') {
            csvTextArea.placeholder = MC_PLACEHOLDER;
        } else if (quizType === 'id') {
            csvTextArea.placeholder = ID_PLACEHOLDER;
        } else if (quizType === 'fitb') {
            csvTextArea.placeholder = FITB_PLACEHOLDER;
        } else if (quizType === 'tf') {
            csvTextArea.placeholder = TF_PLACEHOLDER;
        } else {
            csvTextArea.placeholder = MIXED_PLACEHOLDER;
        }

        // Default to Extreme when switching to id, fitb or mixed
        if (quizType === 'id' || quizType === 'fitb' || quizType === 'mixed') {
            difficulty = 'extreme';
            document.querySelector('input[name="difficulty"][value="extreme"]').checked = true;
            diffOptions.forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.diff === 'extreme');
            });
        }
    });
});

// =====================
// Difficulty Switching
// =====================
const diffRadios = document.querySelectorAll('input[name="difficulty"]');
const diffOptions = document.querySelectorAll('.diff-option');

diffRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        difficulty = e.target.value;
        diffOptions.forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.diff === difficulty);
        });
    });
});

// =====================
// Copy Prompt
// =====================
copyBtn.addEventListener('click', () => {
    let activePrompt;
    if (quizType === 'mc') activePrompt = aiPromptMC;
    else if (quizType === 'id') activePrompt = aiPromptID;
    else if (quizType === 'fitb') activePrompt = aiPromptFITB;
    else if (quizType === 'tf') activePrompt = aiPromptTF;
    else activePrompt = aiPromptMixed;
    navigator.clipboard.writeText(activePrompt.textContent).then(() => {
        copyBtn.textContent = 'Copied!';
        copyBtn.style.backgroundColor = '#28a745';
        setTimeout(() => {
            copyBtn.textContent = 'Copy Prompt';
            copyBtn.style.backgroundColor = '#007bff';
        }, 2000);
    });
});

// =====================
// Save Modal Elements
// =====================
const saveModalOverlay = document.getElementById('save-modal-overlay');
const saveFilenameInput = document.getElementById('save-filename');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalSkipBtn = document.getElementById('modal-skip-btn');

// Pending CSV data waiting for modal decision
let pendingCSV = '';

// =====================
// File Upload Logic
// =====================
if (uploadBtn && csvFileInput) {
    uploadBtn.addEventListener('click', () => {
        csvFileInput.click();
    });

    csvFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            csvTextArea.value = event.target.result;
        };
        reader.onerror = () => {
            alert("Failed to read the file.");
        };
        reader.readAsText(file);
        
        // Reset value so the same file can be selected again if needed
        e.target.value = '';
    });
}

// =====================
// Generate Quiz
// =====================
generateBtn.addEventListener('click', () => {
    const csvDataString = csvTextArea.value.trim();

    if (!csvDataString) {
        alert("Please paste your CSV data into the box first!");
        return;
    }

    startQuiz(csvDataString);
});

// =====================
// Save Quiz as CSV
// =====================
saveCsvBtn.addEventListener('click', () => {
    const csvDataString = csvTextArea.value.trim();

    if (!csvDataString) {
        alert("Please paste your CSV data into the box first!");
        return;
    }

    // Store the CSV and show the save modal
    pendingCSV = csvDataString;
    saveFilenameInput.value = '';
    saveModalOverlay.style.display = 'flex';
    saveFilenameInput.focus();
});

// Close modal on overlay click (outside the box)
saveModalOverlay.addEventListener('click', (e) => {
    if (e.target === saveModalOverlay) {
        saveModalOverlay.style.display = 'none';
    }
});

// Allow Enter key to trigger save
saveFilenameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        modalSaveBtn.click();
    }
});

// Save Modal: Save action
modalSaveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    let filename = saveFilenameInput.value.trim();
    if (!filename) {
        filename = 'quiz_' + new Date().toISOString().slice(0, 10);
    }
    // Sanitize
    filename = filename.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');

    // Trigger download via a sandboxed iframe to prevent page navigation
    downloadCSV(pendingCSV, filename + '.csv');

    saveModalOverlay.style.display = 'none';
});

// Download helper — uses an isolated approach so the main page never navigates
function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);

    // Create an invisible iframe to isolate the download from the main page
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Write a tiny HTML doc into the iframe that auto-clicks a download link
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
        <html><body>
        <a id="dl" href="${blobUrl}" download="${fileName}">download</a>
        <script>document.getElementById('dl').click();<\/script>
        </body></html>
    `);
    iframeDoc.close();

    // Clean up after a delay
    setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        document.body.removeChild(iframe);
    }, 10000);
}

// Save Modal: Cancel action
modalSkipBtn.addEventListener('click', () => {
    saveModalOverlay.style.display = 'none';
});

// =====================
// Start Quiz (extracted)
// =====================
function startQuiz(csvDataString) {
    Papa.parse(csvDataString, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            currentQuizData = results.data;

            // Shuffle the questions randomly
            for (let i = currentQuizData.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [currentQuizData[i], currentQuizData[j]] = [currentQuizData[j], currentQuizData[i]];
            }

            currentQuestionIndex = 0;
            score = 0;

            // Initialize answer tracking
            userAnswers = currentQuizData.map(() => ({ answer: null, submitted: false, correct: null }));

            // Pre-shuffle choices for MC so navigation keeps them consistent
            shuffledChoices = currentQuizData.map(q => {
                const qType = getQType(q);
                if (qType === 'mc') {
                    // New format: Correct Answer column = "CorrectAnswer|WrongA|WrongB|WrongC"
                    // First pipe-value is always the correct answer
                    const parts = q['Correct Answer'].split('|').map(s => s.trim());
                    const choices = parts.map(text => ({ text }));
                    for (let i = choices.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [choices[i], choices[j]] = [choices[j], choices[i]];
                    }
                    return choices;
                }
                return null;
            });

            scoreDisplay.style.display = 'none';

            // Hide setup, show quiz
            promptSection.style.display = 'none';
            inputSection.style.display = 'none';
            typeSection.style.display = 'none';
            difficultySection.style.display = 'none';
            quizArea.style.display = 'block';
            newQuizBtn.style.display = 'none';

            renderQuestion();
        },
        error: function (err) {
            console.error("Error parsing CSV text:", err);
            alert("There was a problem reading your CSV format. Please check for errors.");
        }
    });
}

// =====================
// Update Navigation State
// =====================
function updateNavigation() {
    const total = currentQuizData.length;
    const idx = currentQuestionIndex;

    // Progress indicator
    progressIndicator.textContent = `Question ${idx + 1} of ${total}`;

    // Previous button
    prevBtn.disabled = idx === 0;

    // Next button – enabled if this question has been submitted OR if user has already visited
    nextBtn.disabled = idx >= total - 1 && !userAnswers[idx].submitted;
    // Always allow next if question is submitted (except on last question when not all submitted)
    if (idx < total - 1) {
        nextBtn.disabled = false;
    }

    // Action button state
    if (userAnswers[idx].submitted) {
        if (idx === total - 1) {
            // Last question and already submitted – check if all are submitted
            const allSubmitted = userAnswers.every(a => a.submitted);
            if (allSubmitted) {
                actionBtn.textContent = 'Finish Quiz';
                actionBtn.dataset.state = 'finish';
            } else {
                actionBtn.textContent = 'Submitted ✓';
                actionBtn.dataset.state = 'done';
                actionBtn.disabled = true;
            }
        } else {
            actionBtn.textContent = 'Submitted ✓';
            actionBtn.dataset.state = 'done';
            actionBtn.disabled = true;
        }
    } else {
        actionBtn.textContent = 'Submit Answer';
        actionBtn.dataset.state = 'submit';
        actionBtn.disabled = false;
    }

    // If all questions submitted, always show Finish on current question
    const allSubmitted = userAnswers.every(a => a.submitted);
    if (allSubmitted) {
        actionBtn.textContent = 'Finish Quiz';
        actionBtn.dataset.state = 'finish';
        actionBtn.disabled = false;
    }
}

// =====================
// Render Question
// =====================
function renderQuestion() {
    quizContainer.innerHTML = '';

    const q = currentQuizData[currentQuestionIndex];
    const state = userAnswers[currentQuestionIndex];
    const qType = getQType(q);
    const card = document.createElement('div');
    card.className = 'question-card';

    if (qType === 'mc') {
        // --- Multiple Choice ---
        // New format: first pipe-value in 'Correct Answer' is the correct answer
        const correctText = q['Correct Answer'].split('|')[0].trim();
        const choices = shuffledChoices[currentQuestionIndex];

        const choicesHTML = choices.map(c => {
            const checked = state.answer === c.text ? 'checked' : '';
            const disabled = state.submitted ? 'disabled' : '';
            return `<label class="option-label"><input type="radio" name="q" value="${c.text}" ${checked} ${disabled}> ${c.text}</label>`;
        }).join('');

        card.innerHTML = `
            <div class="question-text">${q['Question Text']}</div>
            ${choicesHTML}
            <div id="feedback" style="margin-top: 15px; font-weight: bold;"></div>
        `;
    } else if (qType === 'tf') {
        // --- True or False ---
        const choices = [{ text: 'True' }, { text: 'False' }];
        const choicesHTML = choices.map(c => {
            const checked = state.answer === c.text ? 'checked' : '';
            const disabled = state.submitted ? 'disabled' : '';
            return `<label class="option-label"><input type="radio" name="q" value="${c.text}" ${checked} ${disabled}> ${c.text}</label>`;
        }).join('');

        card.innerHTML = `
            <div class="question-text">${q['Question Text']}</div>
            ${choicesHTML}
            <div id="feedback" style="margin-top: 15px; font-weight: bold;"></div>
        `;
    } else if (qType === 'fitb') {
        // --- Fill in the Blanks (supports multiple blanks via | separator, and \n for code) ---
        const correctAnswers = q['Correct Answer'].split('|').map(a => a.trim());
        const savedAnswers = Array.isArray(state.answer) ? state.answer : correctAnswers.map(() => '');
        const disabled = state.submitted ? 'disabled' : '';

        // Support literal \n escape sequences (useful for single-line CSV cells with code)
        const rawText = q['Question Text'].replace(/\\n/g, '\n');
        const isCode = rawText.includes('\n');

        // HTML-escape a string (so code characters render safely)
        const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        // Split on ___ and interleave with inline inputs
        const parts = rawText.split('___');
        let blankIdx = 0;
        const questionHTML = parts.map((part, i) => {
            const escaped = esc(part);
            if (i < parts.length - 1) {
                const val = esc(savedAnswers[blankIdx] || '');
                const input = `<input type="text" id="fitb-blank-${blankIdx}" class="fitb-inline-input${isCode ? ' fitb-inline-input--code' : ''}" placeholder="?" autocomplete="off" value="${val}" ${disabled}>`;
                blankIdx++;
                return escaped + input;
            }
            return escaped;
        }).join('');

        if (isCode) {
            card.innerHTML = `
                <pre class="fitb-code-question">${questionHTML}</pre>
                <div id="feedback" style="margin-top: 15px; font-weight: bold;"></div>
            `;
        } else {
            card.innerHTML = `
                <div class="question-text fitb-question">${questionHTML}</div>
                <div id="feedback" style="margin-top: 15px; font-weight: bold;"></div>
            `;
        }
    } else {
        // --- Identification ---
        const savedValue = state.answer || '';
        const disabled = state.submitted ? 'disabled' : '';
        card.innerHTML = `
            <div class="question-text">${q['Question Text']}</div>
            <input type="text" id="id-answer" class="identification-input" placeholder="Type your answer here..." autocomplete="off" value="${savedValue}" ${disabled}>
            <div id="feedback" style="margin-top: 15px; font-weight: bold;"></div>
        `;
    }

    quizContainer.appendChild(card);

    // Restore feedback if already submitted
    if (state.submitted) {
        const feedbackDiv = document.getElementById('feedback');
        if (qType === 'fitb' && state.blankResults) {
            renderFITBFeedback(feedbackDiv, state.blankResults);
        } else if (state.correct) {
            feedbackDiv.style.color = '#28a745';
            if (state.closeMatch) {
                const correctText = qType === 'mc'
                    ? q['Correct Answer'].split('|')[0].trim()
                    : q['Correct Answer'].trim();
                feedbackDiv.textContent = `✅ Close enough! The exact answer was "${correctText}".`;
            } else {
                feedbackDiv.textContent = '✅ Correct!';
            }
        } else {
            feedbackDiv.style.color = '#dc3545';
            if (qType === 'mc') {
                const correctText = q['Correct Answer'].split('|')[0].trim();
                feedbackDiv.textContent = `❌ Incorrect. The correct answer was ${correctText}.`;
            } else if (qType === 'tf') {
                feedbackDiv.textContent = `❌ Incorrect. The correct answer was ${q['Correct Answer'].trim()}.`;
            } else {
                feedbackDiv.textContent = `❌ Incorrect. The correct answer was "${q['Correct Answer'].trim()}".`;
            }
        }
    }

    // Focus and Enter for identification
    if (qType === 'id' && !state.submitted) {
        const idInput = document.getElementById('id-answer');
        if (idInput) {
            idInput.focus();
            idInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && actionBtn.dataset.state === 'submit') actionBtn.click();
            });
        }
    }

    // Focus and Enter for FITB (inline inputs)
    if (qType === 'fitb' && !state.submitted) {
        const firstBlank = document.getElementById('fitb-blank-0');
        if (firstBlank) firstBlank.focus();
        document.querySelectorAll('.fitb-inline-input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && actionBtn.dataset.state === 'submit') actionBtn.click();
            });
        });
    }

    // Save answer on change (MC and TF) — store the text of the selected choice
    if ((qType === 'mc' || qType === 'tf') && !state.submitted) {
        document.querySelectorAll('input[name="q"]').forEach(radio => {
            radio.addEventListener('change', () => {
                userAnswers[currentQuestionIndex].answer = radio.value;
            });
        });
    }

    // Save answer on input (ID)
    if (qType === 'id' && !state.submitted) {
        const idInput = document.getElementById('id-answer');
        if (idInput) {
            idInput.addEventListener('input', () => {
                userAnswers[currentQuestionIndex].answer = idInput.value;
            });
        }
    }

    // Save answer on input (FITB — store as array)
    if (qType === 'fitb' && !state.submitted) {
        document.querySelectorAll('.fitb-inline-input').forEach((input, idx) => {
            input.addEventListener('input', () => {
                if (!Array.isArray(userAnswers[currentQuestionIndex].answer)) {
                    userAnswers[currentQuestionIndex].answer = [];
                }
                userAnswers[currentQuestionIndex].answer[idx] = input.value;
            });
        });
    }

    updateNavigation();
}

// =====================
// FITB Feedback Helper
// =====================
function renderFITBFeedback(feedbackDiv, blankResults) {
    if (blankResults.length === 1) {
        // Single blank – simple one-liner feedback
        const r = blankResults[0];
        if (r.correct) {
            feedbackDiv.style.color = '#28a745';
            feedbackDiv.textContent = r.closeMatch
                ? `\u2705 Close enough! The exact answer was "${r.expected}".`
                : '\u2705 Correct!';
        } else {
            feedbackDiv.style.color = '#dc3545';
            feedbackDiv.textContent = `\u274c Incorrect. The blank should be "${r.expected}".`;
        }
    } else {
        // Multiple blanks – per-blank list
        feedbackDiv.innerHTML = blankResults.map((r, i) => {
            if (r.correct) {
                const msg = r.closeMatch
                    ? `\u2705 Blank ${i + 1}: Close! Expected "<strong>${r.expected}</strong>"`
                    : `\u2705 Blank ${i + 1}: Correct!`;
                return `<div style="color:#28a745">${msg}</div>`;
            } else {
                return `<div style="color:#dc3545">\u274c Blank ${i + 1}: "<em>${r.user || '(empty)'}</em>" \u2192 should be "<strong>${r.expected}</strong>"</div>`;
            }
        }).join('');
    }
}

actionBtn.addEventListener('click', () => {
    const q = currentQuizData[currentQuestionIndex];
    const feedbackDiv = document.getElementById('feedback');
    const state = userAnswers[currentQuestionIndex];
    const qType = getQType(q);

    if (actionBtn.dataset.state === 'submit') {

        if (qType === 'mc' || qType === 'tf') {
            const selectedOption = document.querySelector('input[name="q"]:checked');
            if (!selectedOption) {
                alert("Please select an answer!");
                return;
            }
            document.querySelectorAll('input[name="q"]').forEach(radio => radio.disabled = true);

            const correctText = qType === 'tf' ? q['Correct Answer'].trim() : q['Correct Answer'].split('|')[0].trim();
            state.answer = selectedOption.value;
            state.submitted = true;
            state.correct = selectedOption.value.toLowerCase() === correctText.toLowerCase();

        } else if (qType === 'fitb') {
            // --- Fill in the Blanks (multi-blank) ---
            const correctAnswers = q['Correct Answer'].split('|').map(a => a.trim());
            const blankInputs = document.querySelectorAll('.fitb-inline-input');
            const userAnswers_arr = Array.from(blankInputs).map(inp => inp.value.trim());

            if (userAnswers_arr.some(a => !a)) {
                alert("Please fill in all the blanks!");
                return;
            }
            blankInputs.forEach(inp => inp.disabled = true);

            const threshold = DIFFICULTY_THRESHOLD[difficulty];
            const blankResults = correctAnswers.map((correct, i) => {
                const user = userAnswers_arr[i] || '';
                const dist = levenshtein(user.toLowerCase(), correct.toLowerCase());
                return {
                    correct: dist <= threshold,
                    closeMatch: dist > 0 && dist <= threshold,
                    user,
                    expected: correct
                };
            });

            state.answer = userAnswers_arr;
            state.submitted = true;
            state.correct = blankResults.every(r => r.correct);
            state.closeMatch = blankResults.some(r => r.closeMatch) && state.correct;
            state.blankResults = blankResults;

        } else {
            // --- Identification ---
            const idInput = document.getElementById('id-answer');
            const userAnswer = idInput.value.trim();
            if (!userAnswer) {
                alert("Please type your answer!");
                return;
            }
            idInput.disabled = true;

            const correctAnswer = q['Correct Answer'].trim();
            const distance = levenshtein(userAnswer.toLowerCase(), correctAnswer.toLowerCase());
            state.answer = userAnswer;
            state.submitted = true;
            const threshold = DIFFICULTY_THRESHOLD[difficulty];
            state.correct = distance <= threshold;
            state.closeMatch = distance > 0 && distance <= threshold;
        }

        // Update score
        if (state.correct) {
            score++;
            if (qType === 'fitb' && state.blankResults) {
                renderFITBFeedback(feedbackDiv, state.blankResults);
            } else {
                feedbackDiv.style.color = '#28a745';
                if (state.closeMatch) {
                    const correctText = qType === 'mc'
                        ? q['Correct Answer'].split('|')[0].trim()
                        : q['Correct Answer'].trim();
                    feedbackDiv.textContent = `✅ Close enough! The exact answer was "${correctText}".`;
                } else {
                    feedbackDiv.textContent = '✅ Correct!';
                }
            }
        } else {
            if (qType === 'fitb' && state.blankResults) {
                renderFITBFeedback(feedbackDiv, state.blankResults);
            } else {
                feedbackDiv.style.color = '#dc3545';
                if (qType === 'mc') {
                    const correctText = q['Correct Answer'].split('|')[0].trim();
                    feedbackDiv.textContent = `❌ Incorrect. The correct answer was ${correctText}.`;
                } else {
                    feedbackDiv.textContent = `❌ Incorrect. The correct answer was "${q['Correct Answer'].trim()}".`;
                }
            }
        }

        updateNavigation();

        // Auto-advance to next question on correct answer
        if (state.correct && currentQuestionIndex < currentQuizData.length - 1) {
            setTimeout(() => {
                currentQuestionIndex++;
                renderQuestion();
            }, 800);
        }

    } else if (actionBtn.dataset.state === 'finish') {
        // Show final score
        quizArea.style.display = 'none';
        scoreDisplay.innerHTML = `🎉 You scored ${score} out of ${currentQuizData.length}!`;
        scoreDisplay.style.display = 'block';
        newQuizBtn.style.display = 'block';

        // Build review section for wrong & close-match answers
        const reviewItems = [];
        userAnswers.forEach((state, i) => {
            if (!state.correct || state.closeMatch) {
                const q = currentQuizData[i];
                const correctAnswer = q['Correct Answer'].trim();
                let userDisplay = state.answer || '(no answer)';
                const qType = getQType(q);

                if (qType === 'mc' || qType === 'tf') {
                    // New format: first pipe-value in 'Correct Answer' is the correct answer text
                    const correctText = qType === 'tf' ? q['Correct Answer'].trim() : q['Correct Answer'].split('|')[0].trim();
                    reviewItems.push({
                        question: q['Question Text'],
                        yourAnswer: userDisplay,
                        correctAnswer: correctText,
                        closeMatch: false
                    });
                } else if (qType === 'fitb') {
                    const correctParts = correctAnswer.split('|').map(a => a.trim());
                    const userParts = Array.isArray(state.answer) ? state.answer : [state.answer || '(no answer)'];
                    reviewItems.push({
                        question: q['Question Text'],
                        yourAnswer: userParts.join(' | '),
                        correctAnswer: correctParts.join(' | '),
                        closeMatch: !!state.closeMatch,
                        isFITB: true,
                        blankResults: state.blankResults || null
                    });
                } else {
                    reviewItems.push({
                        question: q['Question Text'],
                        yourAnswer: userDisplay,
                        correctAnswer: correctAnswer,
                        closeMatch: !!state.closeMatch
                    });
                }
            }
        });

        if (reviewItems.length > 0) {
            let reviewHTML = `<div class="review-section">`;
            reviewHTML += `<h2 class="review-title">📝 Review — Items to Study</h2>`;
            reviewItems.forEach((item, idx) => {
                const tag = item.closeMatch ? '<span class="review-tag close">Close Match</span>' : '<span class="review-tag wrong">Incorrect</span>';
                const correctLabel = item.isFITB ? 'Missing word:' : 'Correct answer:';
                let questionHTML;
                if (item.isFITB) {
                    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const rawQ = item.question.replace(/\\n/g, '\n');
                    const isCode = rawQ.includes('\n');
                    const markedParts = rawQ.split('___').map((p, i, arr) =>
                        i < arr.length - 1 ? esc(p) + '<span class="fitb-blank-review">___</span>' : esc(p)
                    ).join('');
                    questionHTML = isCode
                        ? `<pre class="fitb-code-question fitb-code-review">${markedParts}</pre>`
                        : markedParts;
                } else {
                    questionHTML = item.question;
                }
                reviewHTML += `
                    <div class="review-card">
                        <div class="review-question">${idx + 1}. ${questionHTML}</div>
                        <div class="review-answers">
                            <div class="review-your"><strong>Your answer:</strong> ${item.yourAnswer} ${tag}</div>
                            <div class="review-correct"><strong>${correctLabel}</strong> ${item.correctAnswer}</div>
                        </div>
                    </div>`;
            });
            reviewHTML += `</div>`;
            scoreDisplay.innerHTML += reviewHTML;
        }
    }
});

// =====================
// Previous / Next Navigation
// =====================
prevBtn.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
});

nextBtn.addEventListener('click', () => {
    if (currentQuestionIndex < currentQuizData.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    }
});

// =====================
// Home Button
// =====================
homeBtn.addEventListener('click', () => {
    if (!confirm("Return home? Your current quiz progress will be lost.")) return;
    goHome();
});

// =====================
// New Quiz Button
// =====================
newQuizBtn.addEventListener('click', () => {
    goHome();
});

// =====================
// Go Home (shared reset)
// =====================
function goHome() {
    // Show setup sections
    promptSection.style.display = 'block';
    inputSection.style.display = 'block';
    typeSection.style.display = 'block';
    difficultySection.style.display = (quizType === 'id' || quizType === 'fitb' || quizType === 'mixed') ? 'block' : 'none';

    // Hide quiz
    quizArea.style.display = 'none';
    scoreDisplay.style.display = 'none';
    newQuizBtn.style.display = 'none';

    // Reset state
    currentQuizData = [];
    userAnswers = [];
    shuffledChoices = [];
    currentQuestionIndex = 0;
    score = 0;
    csvTextArea.value = '';
}
