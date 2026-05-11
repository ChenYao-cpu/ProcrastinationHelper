// DOM
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const totalTasks = document.getElementById('totalTasks');

// 读取本地存储任务
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

// 示例任务模板（Planner Agent）
const templates = {
    "完成数据库课设": ["建数据库表", "写登录接口", "测试增删改查", "写报告"],
    "写英语论文": ["查找资料", "写初稿", "修改初稿", "提交论文"],
    "复习操作系统": ["读教材", "做练习题", "整理笔记"]
};

// 生成子任务
function generateSubTasks(taskName) {
    return templates[taskName] || [taskName]; // 没有模板就直接用原任务
}

// 随机时间估算（Time Agent）
function estimateTime(taskName) {
    return Math.floor(Math.random() * 60) + 15; // 15~75 分钟
}

// 优先级排序（Priority Agent）- 简单随机示意
function sortTasks(taskArray) {
    return taskArray.sort((a, b) => b.priority - a.priority);
}

// 渲染任务
function renderTasks() {
    taskList.innerHTML = '';

    // 按优先级排序
    const sortedTasks = sortTasks(tasks);

    sortedTasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.textContent = `${task.name}（${task.time} 分钟）`;

        // 完成按钮
        const completeBtn = document.createElement('span');
        completeBtn.textContent = '完成';
        completeBtn.classList.add('complete-btn');
        completeBtn.onclick = () => {
            tasks.splice(index, 1);
            localStorage.setItem('tasks', JSON.stringify(tasks));
            renderTasks();
        };

        li.appendChild(completeBtn);
        taskList.appendChild(li);
    });

    totalTasks.textContent = `总任务：${tasks.length}`;
}

// 添加任务按钮
addTaskBtn.addEventListener('click', () => {
    const input = taskInput.value.trim();
    if (!input) {
        alert("请输入任务内容");
        return;
    }

    const subTasks = generateSubTasks(input);

    subTasks.forEach(sub => {
        const newTask = {
            name: sub,
            time: estimateTime(sub),
            priority: Math.floor(Math.random() * 3) + 1 // 1~3
        };
        tasks.push(newTask);
    });

    localStorage.setItem('tasks', JSON.stringify(tasks));
    taskInput.value = '';
    renderTasks();
});

// 页面加载渲染
renderTasks();