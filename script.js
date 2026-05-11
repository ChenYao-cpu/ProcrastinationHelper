// 获取 DOM 元素
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');

// 从 localStorage 读取任务
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

// 渲染任务
function renderTasks() {
    taskList.innerHTML = '';
    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.textContent = task;

        const completeBtn = document.createElement('span');
        completeBtn.textContent = '完成';
        completeBtn.classList.add('complete-btn');
        completeBtn.onclick = () => {
            tasks.splice(index, 1);
            localStorage.setItem('tasks', JSON.stringify(tasks));
            renderTasks();
        }

        li.appendChild(completeBtn);
        taskList.appendChild(li);
    });
}

// 添加任务
addTaskBtn.addEventListener('click', () => {
    const task = taskInput.value.trim();
    if (task === '') {
        alert('请输入任务内容');
        return;
    }
    tasks.push(task);
    localStorage.setItem('tasks', JSON.stringify(tasks));
    taskInput.value = '';
    renderTasks();
});

// 页面加载时渲染任务
renderTasks();