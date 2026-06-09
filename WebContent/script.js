// ============================================
// Procrastination Helper — Main Script
// ============================================

// --- Global State ---
let currentFilter = 'active';
let currentCategory = 'all';
let editingTaskId = null;
let pendingTask = null;
let streakDays = 0;
let allTasks = [];
let deleteTimeout = null;
let pendingDeleteData = null; // stores task data for undo

// Pomodoro state
let pomodoroInterval = null;
let pomodoroSeconds = 25 * 60;
let pomodoroTotal = 25 * 60;
let pomodoroRunning = false;
let pomodoroIsBreak = false;
let pomodoroTaskId = null;

// --- DOM Elements ---
const taskInput = document.getElementById('taskInput');
const categorySelect = document.getElementById('categorySelect');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const editModal = document.getElementById('editModal');
const previewModal = document.getElementById('previewModal');
const pomodoroModal = document.getElementById('pomodoroModal');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const sortSelect = document.getElementById('sortSelect');

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    // 检测是否通过服务器访问
    if (window.location.protocol === 'file:') {
        document.body.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                background:#0f172a;color:#f1f5f9;font-family:'Microsoft YaHei',sans-serif;text-align:center">
                <div>
                    <div style="font-size:4em;margin-bottom:20px">⚠️</div>
                    <h1 style="color:#06b6d4;margin-bottom:12px">请通过服务器访问</h1>
                    <p style="color:#94a3b8;margin-bottom:8px">当前为本地文件打开，后端 API 不可用</p>
                    <p style="font-size:1.2em;margin:16px 0">
                        请访问 👉 <a href="http://localhost:8080/ProcrastinationHelper/"
                        style="color:#06b6d4;font-weight:bold">http://localhost:8080/ProcrastinationHelper/</a>
                    </p>
                    <p style="color:#64748b;font-size:0.85em;margin-top:24px">启动命令：mvn tomcat7:run</p>
                </div>
            </div>`;
        return;
    }

    loadTasks();
    loadStats();
    setupFilterButtons();
    setupCategoryFilterButtons();
    setupEventListeners();
    setupSearch();
    setupSort();
    loadStreak();
    updateStreakUI();
});

// ========== Event Listeners ==========

function setupEventListeners() {
    addTaskBtn.onclick = () => {
        const smartBreakdown = document.getElementById('smartBreakdown').checked;
        if (smartBreakdown) {
            previewBreakdown();
        } else {
            addTask();
        }
    };

    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const smartBreakdown = document.getElementById('smartBreakdown').checked;
            if (smartBreakdown) {
                previewBreakdown();
            } else {
                addTask();
            }
        }
    });

    document.getElementById('clearCompletedBtn').onclick = clearCompleted;

    // Close modals on background click
    editModal.addEventListener('click', (e) => { if (e.target === editModal) closeModal(); });
    previewModal.addEventListener('click', (e) => { if (e.target === previewModal) closePreview(); });
    pomodoroModal.addEventListener('click', (e) => { if (e.target === pomodoroModal) closePomodoro(); });
}

function setupSearch() {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            searchClear.style.display = searchInput.value ? 'block' : 'none';
            renderFilteredTasks();
        }, 250);
    });
    searchClear.onclick = () => {
        searchInput.value = '';
        searchClear.style.display = 'none';
        renderFilteredTasks();
        searchInput.focus();
    };
}

function setupSort() {
    sortSelect.addEventListener('change', () => {
        renderFilteredTasks();
    });
}

// ========== Filter Buttons ==========

function setupFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderFilteredTasks();
        };
    });
}

function setupCategoryFilterButtons() {
    document.querySelectorAll('.cat-filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.cat-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.cat;
            renderFilteredTasks();
        };
    });
}

// ========== Data Loading ==========

function loadTasks() {
    fetch(`tasks?filter=${currentFilter}`)
        .then(res => res.json())
        .then(tasks => {
            allTasks = tasks;
            renderFilteredTasks();
        })
        .catch(err => {
            console.error('加载任务失败:', err);
            showNotification('无法连接服务器，请确认后端已启动', 'warning');
        });
}

function renderFilteredTasks() {
    let tasks = [...allTasks];

    // Apply category filter
    if (currentCategory !== 'all') {
        tasks = tasks.filter(t => t.category === currentCategory);
    }

    // Apply search filter
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (searchTerm) {
        tasks = tasks.filter(t => t.name.toLowerCase().includes(searchTerm));
    }

    // Apply sort
    const sortBy = sortSelect.value;
    tasks.sort((a, b) => {
        switch (sortBy) {
            case 'deadline':
                if (!a.deadline && !b.deadline) return 0;
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return a.deadline.localeCompare(b.deadline);
            case 'time':
                return b.time - a.time;
            case 'name':
                return a.name.localeCompare(b.name);
            case 'priority':
            default:
                return b.priority - a.priority;
        }
    });

    taskList.innerHTML = '';

    if (tasks.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    tasks.forEach(task => {
        const li = createTaskElement(task);
        taskList.appendChild(li);
    });
}

function loadStats() {
    fetch('tasks?action=stats')
        .then(res => res.json())
        .then(stats => {
            animateValue('totalTasks', parseInt(stats.total) || 0);
            animateValue('totalTime', parseInt(stats.totalTime) || 0);
            animateValue('completedTime', parseInt(stats.completedTime) || 0);

            const progress = stats.totalTime > 0
                ? Math.round((stats.completedTime / stats.totalTime) * 100) : 0;
            document.getElementById('progress').textContent = progress + '%';
            document.getElementById('progressFill').style.width = progress + '%';
        })
        .catch(err => console.error('加载统计失败:', err));
}

// Animated number counter
function animateValue(elementId, target) {
    const el = document.getElementById(elementId);
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;

    const duration = 400;
    const start = performance.now();

    function step(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(current + (target - current) * eased);
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

// ========== Task Element Creation ==========

function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = `task-item priority-${getPriorityClass(task.priority)} ${task.completed ? 'completed' : ''}`;
    li.dataset.id = task.id;
    li.draggable = !task.completed;

    // Drag events
    li.addEventListener('dragstart', (e) => {
        if (task.completed) { e.preventDefault(); return; }
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
    });
    li.addEventListener('dragend', () => { li.classList.remove('dragging'); });
    li.addEventListener('dragover', (e) => {
        e.preventDefault();
        li.classList.add('drag-over');
    });
    li.addEventListener('dragleave', () => { li.classList.remove('drag-over'); });
    li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over');
        const fromId = e.dataTransfer.getData('text/plain');
        if (fromId !== String(task.id)) {
            showNotification('拖拽排序功能已记录', 'edit');
        }
    });

    const priorityText = task.priority === 3 ? '高' : task.priority === 2 ? '中' : '低';
    const categoryText = getCategoryText(task.category);
    const categoryClass = `tag-${task.category || 'other'}`;

    // Deadline display
    let deadlineHTML = '';
    if (task.deadline) {
        const daysLeft = getDaysLeft(task.deadline);
        let deadlineClass = 'deadline-ok';
        let deadlineText = `${daysLeft} 天`;
        if (daysLeft <= 1) {
            deadlineClass = 'deadline-urgent';
            deadlineText = daysLeft === 0 ? '今天截止!' : '明天截止!';
        } else if (daysLeft <= 3) {
            deadlineClass = 'deadline-soon';
        }
        deadlineHTML = `<span class="deadline-badge ${deadlineClass}">📅 ${deadlineText}</span>`;
    }

    li.innerHTML = `
        <div class="task-info">
            <div class="task-name">${escapeHtml(task.name)}</div>
            <div class="task-meta">
                <span class="task-tag ${categoryClass}">${categoryText}</span>
                <span><i class="iconfont icon-shumiao"></i> ${task.time} 分钟</span>
                <span>⚡ ${priorityText}优先级</span>
                ${deadlineHTML}
            </div>
        </div>
        <div class="task-actions">
            ${!task.completed ? `<button class="btn-complete" onclick="completeTask(${task.id})"><i class="iconfont icon-gongxi"></i> 完成</button>` : ''}
            ${!task.completed ? `<button class="btn-pomodoro" onclick="openPomodoro(${task.id}, '${escapeHtml(task.name)}')">⏱</button>` : ''}
            <button class="btn-edit" onclick="editTask(${task.id}, '${escapeHtml(task.name)}', ${task.time}, '${task.deadline || ''}')"><i class="iconfont icon-wodebiji"></i> 编辑</button>
            <button class="btn-delete" onclick="deleteTask(${task.id})"><i class="iconfont icon-cuowu"></i> 删除</button>
        </div>
    `;

    return li;
}

function getPriorityClass(priority) {
    if (priority === 3) return 'high';
    if (priority === 2) return 'medium';
    return 'low';
}

function getCategoryText(category) {
    const categories = {
        'programming': '💻 编程',
        'english': '📝 英语',
        'math': '📐 数学',
        'lab': '🔬 实验',
        'other': '📌 其他'
    };
    return categories[category] || '📌 其他';
}

function getDaysLeft(deadlineStr) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const deadline = new Date(deadlineStr);
    deadline.setHours(0, 0, 0, 0);
    return Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== Task CRUD ==========

function addTask() {
    const name = taskInput.value.trim();
    const category = categorySelect.value;
    const deadline = document.getElementById('deadlineInput').value;

    if (!name) {
        showNotification('请输入任务名称', 'warning');
        return;
    }

    let body = `taskName=${encodeURIComponent(name)}&category=${encodeURIComponent(category)}&smartBreakdown=false`;
    if (deadline) {
        body += `&deadline=${encodeURIComponent(deadline)}`;
    }

    fetch('tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
    })
    .then(response => {
        if (response.ok) {
            taskInput.value = '';
            categorySelect.value = '';
            document.getElementById('deadlineInput').value = '';
            loadTasks();
            loadStats();
            updateStreak();
            showNotification('任务添加成功！', 'success');
        } else {
            showNotification('添加失败，请重试', 'warning');
        }
    })
    .catch(err => {
        console.error('请求错误:', err);
        showNotification('添加失败：请确认后端服务已启动 (mvn tomcat7:run)', 'warning');
    });
}

function quickAdd(taskName) {
    taskInput.value = taskName;
    document.getElementById('smartBreakdown').checked = true;
    previewBreakdown();
}

function completeTask(taskId) {
    fetch('complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `taskId=${taskId}`
    })
    .then(response => {
        if (response.ok) {
            loadTasks();
            loadStats();
            updateStreak();
            showCelebration();
            showNotification('恭喜！任务完成！🎉', 'success');
        }
    })
    .catch(err => console.error('完成失败:', err));
}

function editTask(id, name, time, deadline) {
    editingTaskId = id;
    document.getElementById('editTaskName').value = name;
    document.getElementById('editTaskTime').value = time;
    document.getElementById('editTaskDeadline').value = deadline || '';
    editModal.classList.add('show');
}

function saveEdit() {
    const newName = document.getElementById('editTaskName').value.trim();
    const newTime = document.getElementById('editTaskTime').value;
    const newDeadline = document.getElementById('editTaskDeadline').value;

    if (!newName || !newTime) {
        showNotification('请填写完整信息', 'warning');
        return;
    }

    let body = `action=edit&taskId=${editingTaskId}&taskName=${encodeURIComponent(newName)}&time=${newTime}`;
    if (newDeadline) {
        body += `&deadline=${encodeURIComponent(newDeadline)}`;
    }

    fetch('tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
    })
    .then(response => {
        if (response.ok) {
            closeModal();
            loadTasks();
            showNotification('任务已更新', 'edit');
        }
    })
    .catch(err => console.error('编辑失败:', err));
}

function closeModal() {
    editModal.classList.remove('show');
    editingTaskId = null;
}

// ========== Delete with Undo ==========

function deleteTask(taskId) {
    if (deleteTimeout) {
        clearTimeout(deleteTimeout);
        deleteTimeout = null;
        pendingDeleteData = null;
    }

    // Find and store task data for undo BEFORE deleting
    const task = allTasks.find(t => t.id === taskId);
    if (task) {
        pendingDeleteData = {
            name: task.name,
            time: task.time,
            priority: task.priority,
            category: task.category || 'other',
            deadline: task.deadline || null
        };
    }
    const taskName = task ? task.name : '任务';

    fetch(`tasks?taskId=${taskId}`, { method: 'DELETE' })
    .then(response => {
        if (response.ok) {
            loadTasks();
            loadStats();
            showUndoNotification(taskName, taskId);
        }
    })
    .catch(err => console.error('删除失败:', err));
}

function showUndoNotification(taskName, taskId) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="iconfont icon-cuowu"></i>
        已删除「${taskName}」
        <span class="undo-link" onclick="undoDelete(${taskId}, this.parentElement)">撤销</span>
    `;

    document.body.appendChild(notification);

    deleteTimeout = setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
            deleteTimeout = null;
            pendingDeleteData = null;
        }, 300);
    }, 5000);
}

function undoDelete(taskId, notificationEl) {
    if (deleteTimeout) {
        clearTimeout(deleteTimeout);
        deleteTimeout = null;
    }

    if (!pendingDeleteData) {
        showNotification('无法撤销，数据已丢失', 'warning');
        return;
    }

    // Re-create the task with the stored data
    let body = `taskName=${encodeURIComponent(pendingDeleteData.name)}`
        + `&category=${encodeURIComponent(pendingDeleteData.category)}`
        + `&smartBreakdown=false`;
    if (pendingDeleteData.deadline) {
        body += `&deadline=${encodeURIComponent(pendingDeleteData.deadline)}`;
    }

    fetch('tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
    })
    .then(response => {
        if (response.ok) {
            notificationEl.remove();
            pendingDeleteData = null;
            loadTasks();
            loadStats();
            showNotification('已撤销删除', 'edit');
        } else {
            showNotification('撤销失败', 'warning');
        }
    })
    .catch(err => {
        console.error('撤销失败:', err);
        showNotification('撤销失败', 'warning');
    });
}

function clearCompleted() {
    if (!confirm('确定要清空所有已完成的任务吗？')) return;

    fetch('tasks?taskId=clearCompleted', { method: 'DELETE' })
    .then(response => {
        if (response.ok) {
            loadTasks();
            loadStats();
            showNotification('已清空完成任务', 'delete');
        }
    })
    .catch(err => console.error('清空失败:', err));
}

// ========== Preview & Smart Breakdown ==========

function previewBreakdown() {
    const name = taskInput.value.trim();
    if (!name) {
        showNotification('请输入任务名称', 'warning');
        return;
    }

    const category = categorySelect.value;
    const deadline = document.getElementById('deadlineInput').value;
    pendingTask = { name, category, deadline };

    fetch(`tasks?action=suggest&taskName=${encodeURIComponent(name)}`)
        .then(res => res.json())
        .then(suggestions => {
            const previewList = document.getElementById('previewList');
            previewList.innerHTML = '';

            suggestions.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.innerHTML = `
                    <span class="preview-number">${index + 1}</span>
                    <span class="preview-name">${escapeHtml(item.name)}</span>
                    <span class="preview-time">⏱ ${item.time}分钟</span>
                    <span class="preview-priority priority-${item.priority === 3 ? 'high' : item.priority === 2 ? 'medium' : 'low'}">
                        ${item.priority === 3 ? '高' : item.priority === 2 ? '中' : '低'}
                    </span>
                `;
                previewList.appendChild(div);
            });

            previewModal.classList.add('show');
        })
        .catch(err => {
            console.error('获取拆解建议失败:', err);
            showNotification('拆解失败，将直接添加任务', 'warning');
            addTask();
        });
}

function confirmAdd() {
    if (!pendingTask) return;

    let body = `taskName=${encodeURIComponent(pendingTask.name)}&category=${encodeURIComponent(pendingTask.category)}&smartBreakdown=true`;
    if (pendingTask.deadline) {
        body += `&deadline=${encodeURIComponent(pendingTask.deadline)}`;
    }

    fetch('tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
    })
    .then(response => {
        if (response.ok) {
            taskInput.value = '';
            categorySelect.value = '';
            document.getElementById('deadlineInput').value = '';
            closePreview();
            loadTasks();
            loadStats();
            updateStreak();
            showNotification('任务拆解成功！', 'success');
        } else {
            showNotification('添加失败，请重试', 'warning');
        }
    })
    .catch(err => {
        console.error('请求错误:', err);
        showNotification('添加失败：请确认后端服务已启动', 'warning');
    });
}

function closePreview() {
    previewModal.classList.remove('show');
    pendingTask = null;
}

// ========== Pomodoro Timer ==========

function openPomodoro(taskId, taskName) {
    pomodoroTaskId = taskId || null;
    document.getElementById('pomodoroTaskName').textContent = taskName ? `— ${taskName}` : '';
    pomodoroModal.classList.add('show');
    resetPomodoro();
}

function closePomodoro() {
    if (pomodoroRunning) {
        if (!confirm('番茄钟正在运行，确定要关闭吗？')) return;
    }
    stopPomodoro();
    pomodoroModal.classList.remove('show');
    pomodoroTaskId = null;
}

function togglePomodoro() {
    if (pomodoroRunning) {
        pausePomodoro();
    } else {
        startPomodoro();
    }
}

function startPomodoro() {
    pomodoroRunning = true;
    const btn = document.getElementById('pomodoroStart');
    btn.innerHTML = '<i class="iconfont icon-jixuxuexi"></i> 暂停';
    btn.classList.add('btn-warning');

    pomodoroInterval = setInterval(() => {
        pomodoroSeconds--;
        updatePomodoroDisplay();

        if (pomodoroSeconds <= 0) {
            pomodoroComplete();
        }
    }, 1000);
}

function pausePomodoro() {
    pomodoroRunning = false;
    const btn = document.getElementById('pomodoroStart');
    btn.innerHTML = '<i class="iconfont icon-xuexi"></i> 继续';
    btn.classList.remove('btn-warning');
    clearInterval(pomodoroInterval);
}

function stopPomodoro() {
    pomodoroRunning = false;
    clearInterval(pomodoroInterval);
}

function resetPomodoro() {
    stopPomodoro();
    pomodoroIsBreak = false;
    pomodoroSeconds = 25 * 60;
    pomodoroTotal = 25 * 60;
    updatePomodoroDisplay();
    document.getElementById('pomodoroLabel').textContent = '专注时间';
    document.getElementById('pomodoroRing').classList.remove('break');
    const btn = document.getElementById('pomodoroStart');
    btn.innerHTML = '<i class="iconfont icon-xuexi"></i> 开始';
    btn.classList.remove('btn-warning');
}

function pomodoroComplete() {
    stopPomodoro();

    if (!pomodoroIsBreak) {
        // Focus session complete → start break
        pomodoroIsBreak = true;
        pomodoroSeconds = 5 * 60;
        pomodoroTotal = 5 * 60;
        document.getElementById('pomodoroLabel').textContent = '休息时间 ☕';
        document.getElementById('pomodoroRing').classList.add('break');
        showNotification('专注时间结束！休息一下吧 ☕', 'success');
        updatePomodoroDisplay();

        const btn = document.getElementById('pomodoroStart');
        btn.innerHTML = '<i class="iconfont icon-xuexi"></i> 开始休息';
        btn.classList.remove('btn-warning');

        // Auto-start break after 2 seconds
        setTimeout(() => {
            if (pomodoroModal.classList.contains('show')) {
                startPomodoro();
            }
        }, 2000);
    } else {
        // Break complete → back to focus
        pomodoroIsBreak = false;
        pomodoroSeconds = 25 * 60;
        pomodoroTotal = 25 * 60;
        document.getElementById('pomodoroLabel').textContent = '专注时间';
        document.getElementById('pomodoroRing').classList.remove('break');
        showNotification('休息结束，继续专注！💪', 'success');
        updatePomodoroDisplay();

        const btn = document.getElementById('pomodoroStart');
        btn.innerHTML = '<i class="iconfont icon-xuexi"></i> 开始';
        btn.classList.remove('btn-warning');
    }
}

function updatePomodoroDisplay() {
    const mins = Math.floor(pomodoroSeconds / 60);
    const secs = pomodoroSeconds % 60;
    document.getElementById('pomodoroTime').textContent =
        String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

    // Update ring
    const circumference = 565.48;
    const progress = pomodoroSeconds / pomodoroTotal;
    const offset = circumference * (1 - progress);
    document.getElementById('pomodoroRing').style.strokeDashoffset = offset;
}

// ========== Streak System ==========

function loadStreak() {
    const streak = localStorage.getItem('studyStreak');
    const lastDate = localStorage.getItem('lastStudyDate');
    const today = new Date().toDateString();

    if (lastDate === today) {
        streakDays = parseInt(streak) || 0;
    } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastDate === yesterday.toDateString()) {
            streakDays = parseInt(streak) || 0;
        } else {
            streakDays = 0;
        }
    }
}

function updateStreak() {
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem('lastStudyDate');

    if (lastDate !== today) {
        streakDays++;
        localStorage.setItem('studyStreak', streakDays);
        localStorage.setItem('lastStudyDate', today);
        updateStreakUI();

        if (streakDays === 7) {
            showNotification('🔥 连续学习 7 天！太棒了！保持下去！', 'success');
            showCelebration();
        } else if (streakDays === 30) {
            showNotification('👑 连续学习 30 天！你是拖延症克星！', 'success');
            showCelebration();
        }
    }
}

function updateStreakUI() {
    document.getElementById('streakCount').textContent = streakDays;
}

// ========== Celebration ==========

function showCelebration() {
    const celebration = document.getElementById('celebration');
    const colors = ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];

    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.6 + 's';
        confetti.style.width = Math.random() * 10 + 6 + 'px';
        confetti.style.height = Math.random() * 10 + 6 + 'px';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        celebration.appendChild(confetti);
    }

    setTimeout(() => {
        celebration.innerHTML = '';
    }, 2500);
}

// ========== Notifications ==========

function showNotification(message, type = 'success') {
    const icons = {
        success: 'icon-gongxidacheng',
        delete: 'icon-cuowu',
        edit: 'icon-wodebiji',
        warning: 'icon-xuexi'
    };
    const iconClass = icons[type] || 'icon-gongxi';

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `<i class="iconfont ${iconClass}"></i> ${message}`;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
