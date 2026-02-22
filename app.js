// CONFIG
const APP_KEY = 'consistency_engine_v1';
const AUTH_PASSCODE = '1234'; 

// STATE MANAGEMENT
let state = {
    user: { settings: { theme: 'light' } },
    habits: [],
    logs: {}, // "YYYY-MM-DD": { habitId: true/false, mood: int }
};

let currentDateOffset = 0; // 0 = Today, -1 = Yesterday

// --- UTILS ---
const $ = (id) => document.getElementById(id);
const getTargetDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + currentDateOffset);
    return d.toISOString().split('T')[0];
};
const getDisplayDate = () => {
    if (currentDateOffset === 0) return 'Today';
    if (currentDateOffset === -1) return 'Yesterday';
    const d = new Date();
    d.setDate(d.getDate() + currentDateOffset);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

// --- INIT ---
function init() {
    loadData();
    applyTheme();
    setupEventListeners();
    
    // Check if auth is needed (session based for now)
    const isAuth = sessionStorage.getItem('is_auth');
    if (isAuth) {
        unlockApp();
    }
}

// --- DATA ---
function loadData() {
    const raw = localStorage.getItem(APP_KEY);
    if (raw) {
        state = JSON.parse(raw);
    } else {
        // Default Seed
        state.habits = [
            { id: 170921, name: 'Drink 2L Water', created: getTargetDate() },
            { id: 170922, name: 'Read 15 Mins', created: getTargetDate() },
            { id: 170923, name: 'No Sugar', created: getTargetDate() }
        ];
        saveData();
    }
}

function saveData() {
    localStorage.setItem(APP_KEY, JSON.stringify(state));
    updateUI();
}

// --- UI UPDATES ---
function updateUI() {
    $('current-date-display').textContent = getDisplayDate();
    
    // Disable "Next Day" if it's tomorrow
    $('next-day').disabled = currentDateOffset >= 0;
    $('next-day').style.opacity = currentDateOffset >= 0 ? 0.3 : 1;

    renderHabits();
    renderMood();
    if($('view-settings').classList.contains('active-view')) renderManageList();
}

// --- HABITS ---
function renderHabits() {
    const list = $('habits-list');
    list.innerHTML = '';
    const dateKey = getTargetDate();
    const todaysLog = state.logs[dateKey] || {};

    state.habits.forEach(habit => {
        const isDone = todaysLog[habit.id] === true;
        const streakData = calculateStreak(habit.id);
        
        const card = document.createElement('div');
        card.className = 'habit-card';
        card.innerHTML = `
            <div class="habit-info">
                <h4>${habit.name}</h4>
                <span class="streak-badge ${streakData > 0 ? 'active-streak' : ''}">
                    🔥 ${streakData} day streak
                </span>
            </div>
            <div class="check-circle ${isDone ? 'completed' : ''}" 
                 onclick="toggleHabit(${habit.id})">
                ${isDone ? '✓' : ''}
            </div>
        `;
        list.appendChild(card);
    });
}

function toggleHabit(id) {
    const dateKey = getTargetDate();
    if (!state.logs[dateKey]) state.logs[dateKey] = {};
    
    if (state.logs[dateKey][id]) {
        delete state.logs[dateKey][id];
    } else {
        state.logs[dateKey][id] = true;
    }
    saveData();
}

function calculateStreak(habitId) {
    let streak = 0;
    // Streak only calculated relative to TODAY, regardless of view
    let d = new Date(); 
    let missesAllowed = 0; // Implement "Freeze" logic later here

    while (true) {
        const dateStr = d.toISOString().split('T')[0];
        
        // If data exists for this day
        if (state.logs[dateStr] && state.logs[dateStr][habitId]) {
            streak++;
        } else {
            // Stop if no entry found for today (unless we are just starting check)
            // For simplicity in V1: strict streaks
            if (dateStr !== new Date().toISOString().split('T')[0]) break;
        }
        d.setDate(d.getDate() - 1);
        // Safety break
        if (streak > 365) break; 
    }
    return streak;
}

// --- MOOD ---
function renderMood() {
    const dateKey = getTargetDate();
    const currentMood = state.logs[dateKey]?.mood || 0;
    
    document.querySelectorAll('.mood-selector span').forEach(span => {
        span.classList.remove('selected');
        if (parseInt(span.dataset.val) === currentMood) {
            span.classList.add('selected');
        }
    });
}

document.querySelectorAll('.mood-selector span').forEach(span => {
    span.addEventListener('click', function() {
        const val = parseInt(this.dataset.val);
        const dateKey = getTargetDate();
        if (!state.logs[dateKey]) state.logs[dateKey] = {};
        
        // Toggle off if clicking same mood
        if (state.logs[dateKey].mood === val) {
            delete state.logs[dateKey].mood;
        } else {
            state.logs[dateKey].mood = val;
        }
        saveData();
    });
});

// --- ANALYTICS ---
function renderAnalytics() {
    renderHeatmap();
    renderChart();
}

function renderHeatmap() {
    const grid = $('heatmap-grid');
    grid.innerHTML = '';
    
    // Last 49 days (7 weeks)
    for (let i = 48; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const log = state.logs[dateStr];
        let count = 0;
        if (log) count = Object.keys(log).filter(k => k !== 'mood').length;
        
        const total = state.habits.length || 1;
        let intensity = 0;
        if (count > 0) intensity = Math.ceil((count / total) * 4); // 1-4 scale

        const box = document.createElement('div');
        box.className = `heat-box level-${intensity}`;
        box.title = `${dateStr}: ${count} habits`;
        grid.appendChild(box);
    }
}

let myChart = null;
function renderChart() {
    const ctx = $('weeklyChart').getContext('2d');
    
    // Get last 7 days data
    const labels = [];
    const dataPoints = [];
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        
        labels.push(dayName);
        
        const log = state.logs[dateStr];
        let count = 0;
        if (log) count = Object.keys(log).filter(k => k !== 'mood').length;
        dataPoints.push(count);
    }

    if (myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Habits Completed',
                data: dataPoints,
                borderColor: '#4caf50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --- SETTINGS ---
$('toggle-theme').addEventListener('click', () => {
    state.user.settings.theme = state.user.settings.theme === 'light' ? 'dark' : 'light';
    saveData();
    applyTheme();
});

function applyTheme() {
    if (state.user.settings.theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

// Add Habit
$('add-habit-btn').addEventListener('click', () => {
    const name = $('new-habit-name').value.trim();
    if (name) {
        state.habits.push({ id: Date.now(), name: name, created: getTargetDate() });
        $('new-habit-name').value = '';
        saveData();
        renderManageList();
    }
});

function renderManageList() {
    const ul = $('manage-habit-list');
    ul.innerHTML = '';
    state.habits.forEach(h => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${h.name}</span>
            <button onclick="deleteHabit(${h.id})" style="color:red; border:none; background:none;">✕</button>
        `;
        ul.appendChild(li);
    });
}

window.deleteHabit = (id) => {
    if(confirm('Delete this habit? History will remain but it wont show on list.')) {
        state.habits = state.habits.filter(h => h.id !== id);
        saveData();
        renderManageList();
    }
};

$('export-data').addEventListener('click', () => {
    let csv = "Date,HabitID,Status\n";
    for (const [date, data] of Object.entries(state.logs)) {
        for (const [habit, status] of Object.entries(data)) {
            if(habit !== 'mood') csv += `${date},${habit},${status}\n`;
        }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'consistency_data.csv';
    a.click();
});

// --- NAVIGATION & AUTH ---
function unlockApp() {
    $('auth-screen').classList.remove('active');
    $('app-container').classList.remove('hidden');
    sessionStorage.setItem('is_auth', 'true');
    updateUI();
}

$('login-btn').addEventListener('click', () => {
    if ($('passcode-input').value === AUTH_PASSCODE) {
        unlockApp();
    } else {
        alert('Wrong Code');
        $('passcode-input').value = '';
    }
});

$('prev-day').addEventListener('click', () => { currentDateOffset--; updateUI(); });
$('next-day').addEventListener('click', () => { 
    if(currentDateOffset < 0) { currentDateOffset++; updateUI(); } 
});

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Handle icon clicks bubbling up
        const targetBtn = e.target.closest('.nav-btn');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        targetBtn.classList.add('active');
        
        const viewId = targetBtn.dataset.target;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
        $(viewId).classList.add('active-view');
        
        if (viewId === 'view-analytics') renderAnalytics();
    });
});

init();
