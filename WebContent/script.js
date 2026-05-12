// 全局变量
let currentFilter = 'active';
let editingTaskId = null;

// DOM 元素
const taskInput = document.getElementById('taskInput');
const categorySelect = document.getElementById('categorySelect');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const editModal = document.getElementById('editModal');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    loadStats();
    setupFilterButtons();
    setupEventListeners();
});

// 设置事件监听
function setupEventListeners() {
    addTaskBtn.onclick = addTask;

    // 回车添加
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    // 清空已完成
    document.getElementById('clearCompletedBtn').onclick = clearCompleted;
}

// 设置筛选按钮
function setupFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            loadTasks();
        };
    });
}

// 加载任务
function loadTasks() {
    fetch(`tasks?filter=${currentFilter}`)
        .then(res => res.json())
        .then(tasks => {
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
        })
        .catch(err => console.error('加载任务失败:', err));
}

// 创建任务元素
function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = `task-item priority-${getPriorityClass(task.priority)} ${task.completed ? 'completed' : ''}`;
    li.dataset.id = task.id;

    const priorityText = task.priority === 3 ? '高' : task.priority === 2 ? '中' : '低';
    const categoryText = getCategoryText(task.category);
    const categoryClass = `tag-${task.category || 'other'}`;

    li.innerHTML = `
        <div class="task-info">
            <div class="task-name">${escapeHtml(task.name)}</div>
            <div class="task-meta">
                <span class="task-tag ${categoryClass}">${categoryText}</span>
                <span><i class="iconfont icon-shichang"></i> ${task.time} 分钟</span>
                <span><i class="iconfont icon-dengpao"></i> ${priorityText}</span>
            </div>
        </div>
        <div class="task-actions">
            ${!task.completed ? `<button class="btn-complete" onclick="completeTask(${task.id})"><i class="iconfont icon-icon"></i> 完成</button>` : ''}
            <button class="btn-edit" onclick="editTask(${task.id}, '${escapeHtml(task.name)}', ${task.time})"><i class="iconfont icon-a-bijibenbiji"></i> 编辑</button>
            <button class="btn-delete" onclick="deleteTask(${task.id})"><i class="iconfont icon-qingkong"></i> 删除</button>
        </div>
    `;

    return li;
}

// 获取优先级样式
function getPriorityClass(priority) {
    if (priority === 3) return 'high';
    if (priority === 2) return 'medium';
    return 'low';
}

// 获取分类文本
function getCategoryText(category) {
    const categories = {
        'programming': '<i class="iconfont icon-a-bijibenbiji"></i> 编程',
        'english': '<i class="iconfont icon-a-bijibenbiji"></i> 英语',
        'math': '<i class="iconfont icon-a-bijibenbiji"></i> 数学',
        'lab': '<i class="iconfont icon-a-bijibenbiji"></i> 实验',
        'other': '<i class="iconfont icon-a-bijibenbiji"></i> 其他'
    };
    return categories[category] || '<i class="iconfont icon-a-bijibenbiji"></i> 其他';
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 加载统计信息
function loadStats() {
    fetch('tasks?action=stats')
        .then(res => res.json())
        .then(stats => {
            document.getElementById('totalTasks').textContent = stats.total || 0;
            document.getElementById('totalTime').textContent = stats.totalTime || 0;
            document.getElementById('completedTime').textContent = stats.completedTime || 0;

            const progress = stats.totalTime > 0 ?
                Math.round((stats.completedTime / stats.totalTime) * 100) : 0;
            document.getElementById('progress').textContent = progress + '%';
        })
        .catch(err => console.error('加载统计失败:', err));
}

// 添加任务
function addTask() {
    const name = taskInput.value.trim();
    const category = categorySelect.value;

    if (!name) {
        showNotification('请输入任务名称', 'warning');
        return;
    }

    fetch('tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `taskName=${encodeURIComponent(name)}&category=${encodeURIComponent(category)}`
    })
    .then(response => {
        if (response.ok) {
            taskInput.value = '';
            categorySelect.value = '';
            loadTasks();
            loadStats();
            showNotification('任务添加成功！', 'success');
        } else {
            showNotification('添加失败，请重试', 'warning');
        }
    })
    .catch(err => {
        console.error('请求错误:', err);
        showNotification('网络请求异常', 'warning');
    });
}

// 快速添加
function quickAdd(taskName) {
    taskInput.value = taskName;
    addTask();
}

// 完成任务
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
            showCelebration();
            showNotification('恭喜！任务完成！', 'success');
        }
    })
    .catch(err => console.error('完成失败:', err));
}

// 编辑任务
function editTask(id, name, time) {
    editingTaskId = id;
    document.getElementById('editTaskName').value = name;
    document.getElementById('editTaskTime').value = time;
    editModal.classList.add('show');
}

// 保存编辑
function saveEdit() {
    const newName = document.getElementById('editTaskName').value.trim();
    const newTime = document.getElementById('editTaskTime').value;

    if (!newName || !newTime) {
        showNotification('请填写完整信息', 'warning');
        return;
    }

    fetch(`tasks?action=edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `taskId=${editingTaskId}&taskName=${encodeURIComponent(newName)}&time=${newTime}`
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

// 关闭弹窗
function closeModal() {
    editModal.classList.remove('show');
    editingTaskId = null;
}

// 删除任务
function deleteTask(taskId) {
    if (!confirm('确定要删除这个任务吗？')) return;

    fetch(`tasks?taskId=${taskId}`, { method: 'DELETE' })
    .then(response => {
        if (response.ok) {
            loadTasks();
            loadStats();
            showNotification('任务已删除', 'delete');
        }
    })
    .catch(err => console.error('删除失败:', err));
}

// 清空已完成
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

// 显示庆祝动画
function showCelebration() {
    const celebration = document.getElementById('celebration');
    const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd'];

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.width = Math.random() * 10 + 5 + 'px';
        confetti.style.height = Math.random() * 10 + 5 + 'px';
        celebration.appendChild(confetti);
    }

    setTimeout(() => {
        celebration.innerHTML = '';
    }, 2000);
}

// 显示通知 (已替换为 iconfont)
function showNotification(message, type = 'success') {
    const icons = {
        success: 'icon-trues',
        delete: 'icon-qingkong',
        edit: 'icon-a-bijibenbiji',
        warning: 'icon-dengpao'
    };
    const iconClass = icons[type] || 'icon-icon';

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `<i class="iconfont ${iconClass}"></i> ${message}`;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// 添加通知动画样式
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        z-index: 3000;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideInRight 0.3s ease;
        font-size: 1em;
        color: #333;
    }
    .notification .iconfont {
        font-size: 1.5em;
        color: #667eea;
    }
    .notification.fade-out {
        opacity: 0;
        transform: translateX(100px);
        transition: all 0.3s ease;
    }
    @keyframes slideInRight {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
    }
`;
document.head.appendChild(style);
