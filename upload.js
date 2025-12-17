// upload.js (帶有輪詢機制的後端壓縮版)

const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app'; 
let selectedFiles = []; 
let activeTaskIds = []; // 追蹤所有正在處理的任務 ID
let pollingInterval = null; // 輪詢計時器

// DOM 元素
const uploadButton = document.getElementById('uploadButton');
const compressionProgressDiv = document.getElementById('compressionProgress'); // 恢復此 div (但用途改變)
const progressList = document.getElementById('progressList');


// ----------------------------------------------------
// showMessage 函式 (保持不變)
// ----------------------------------------------------
function showMessage(type, content) {
    const msg = document.getElementById('message');
    msg.className = `message-box ${type}`;
    msg.innerHTML = content;
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
}
window.showMessage = showMessage;

// ----------------------------------------------------
// 載入相簿選單 (保持不變)
// ----------------------------------------------------
async function fetchAlbumsForSelect() {
    // ... (fetchAlbumsForSelect 邏輯保持不變)
    const select = document.getElementById('targetAlbumSelect');
    try {
        const res = await fetch(`${BACKEND_URL}/api/albums`); 
        const albums = await res.json();
        select.innerHTML = '';
        
        if (albums.length === 0) {
            select.innerHTML = '<option>無相簿</option>';
            return;
        }

        albums.forEach(album => {
            const opt = document.createElement('option');
            opt.value = album._id;
            opt.textContent = album.name;
            if (album.name === '未分類相簿') opt.selected = true;
            select.appendChild(opt);
        });
    } catch (e) { 
        console.error(e); 
        showMessage('error', '載入相簿清單失敗。');
    }
}

// ----------------------------------------------------
// 任務狀態追蹤與輪詢
// ----------------------------------------------------

/**
 * 更新任務進度列表的 UI
 */
function updateProgressUI() {
    progressList.innerHTML = '';
    let allCompleted = true;

    activeTaskIds.forEach(taskId => {
        const task = mediaTasks[taskId];

        if (!task) return; // 任務已被清理或未找到

        const statusClass = {
            'PENDING': 'progress-pending',
            'PROCESSING': 'progress-processing',
            'COMPLETED': 'progress-success',
            'FAILED': 'progress-error'
        }[task.status] || 'progress-pending';

        const icon = {
            'PENDING': '⏳',
            'PROCESSING': '⚙️',
            'COMPLETED': '✅',
            'FAILED': '❌'
        }[task.status] || '❓';

        if (task.status !== 'COMPLETED' && task.status !== 'FAILED') {
            allCompleted = false;
        }

        const listItem = document.createElement('div');
        listItem.className = `progress-item ${statusClass}`;
        
        // 顯示原始檔名和狀態訊息
        listItem.innerHTML = `${icon} <strong>${task.originalFileName}</strong>: ${task.message}`;
        progressList.appendChild(listItem);
    });

    if (activeTaskIds.length > 0) {
        compressionProgressDiv.style.display = 'block';
    } else {
        compressionProgressDiv.style.display = 'none';
    }

    if (allCompleted && activeTaskIds.length > 0) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        
        // 標記所有相簿數據可能已變更
        localStorage.setItem('albums_data_changed', 'true');
        
        // 顯示總結訊息
        const failedCount = activeTaskIds.filter(id => mediaTasks[id] && mediaTasks[id].status === 'FAILED').length;
        if (failedCount === activeTaskIds.length) {
            showMessage('error', `❌ ${failedCount} 個檔案處理失敗，請檢查日誌。`);
        } else if (failedCount > 0) {
            showMessage('warning', `⚠️ 處理完成。${activeTaskIds.length - failedCount} 個成功，${failedCount} 個失敗。`);
        } else {
            showMessage('success', `✅ 所有 ${activeTaskIds.length} 個檔案處理完成！請查看相簿。`);
        }
        
        // 10 秒後清除任務列表
        setTimeout(() => {
            activeTaskIds = [];
            compressionProgressDiv.style.display = 'none';
        }, 10000); 

        // 恢復上傳按鈕
        uploadButton.disabled = false;
        uploadButton.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:white;"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" /></svg> <span>上傳</span>`;
    }
}


/**
 * 輪詢伺服器以檢查所有任務的狀態
 */
async function pollTaskStatus() {
    if (activeTaskIds.length === 0) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        return;
    }

    // 複製一份任務 ID 列表，以防在迴圈中發生變化
    const idsToPoll = [...activeTaskIds]; 
    const tasks = {}; // 暫存任務狀態

    for (const taskId of idsToPoll) {
        try {
            const res = await fetch(`${BACKEND_URL}/api/tasks/status/${taskId}`);
            if (res.ok) {
                const taskStatus = await res.json();
                tasks[taskId] = { ...mediaTasks[taskId], ...taskStatus };
            } else {
                // 如果任務在伺服器端被刪除或找不到，將其標記為已清理 (FAILED)
                tasks[taskId] = { status: 'FAILED', message: '任務在伺服器端已過期或不存在。', originalFileName: '未知檔案' };
            }
        } catch (e) {
            console.error(`輪詢任務 ${taskId} 失敗:`, e);
            tasks[taskId] = { status: 'FAILED', message: '網路連線錯誤', originalFileName: '未知檔案' };
        }
    }
    
    // 將輪詢結果合併回全域的 mediaTasks 
    idsToPoll.forEach(taskId => {
        if (tasks[taskId]) {
            mediaTasks[taskId] = tasks[taskId];
        }
    });

    updateProgressUI();
}


// ----------------------------------------------------
// 上傳照片函式 (使用新 API)
// ----------------------------------------------------
async function uploadPhoto() {
    if (selectedFiles.length === 0) return;

    uploadButton.disabled = true;
    uploadButton.innerHTML = '正在提交...'; 

    const targetAlbumId = document.getElementById('targetAlbumSelect').value;
    
    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('photos', file); 
    });
    formData.append('targetAlbumId', targetAlbumId); 

    try {
        // ⭐ 使用新 API: /api/tasks/submit-upload
        const res = await fetch(`${BACKEND_URL}/api/tasks/submit-upload`, { 
            method: 'POST',
            body: formData,
        });

        const result = await res.json();
        
        if (res.ok) {
            const newTasks = result.taskIds;
            if (newTasks && newTasks.length > 0) {
                // 將新任務添加到追蹤列表
                activeTaskIds.push(...newTasks);
                // 初始化前端的任務狀態
                newTasks.forEach((taskId, index) => {
                    mediaTasks[taskId] = {
                        status: 'PENDING',
                        message: '等待伺服器回應...',
                        originalFileName: selectedFiles[index].name,
                    };
                });
                
                // 清空選取並更新 UI
                selectedFiles = [];
                document.getElementById('previewGrid').innerHTML = '';
                document.getElementById('emptyState').style.display = 'block';

                showMessage('info', `✅ ${newTasks.length} 個檔案已提交到伺服器背景處理。`);
                
                // 啟動輪詢
                if (!pollingInterval) {
                    pollingInterval = setInterval(pollTaskStatus, 5000); // 每 5 秒輪詢一次
                }
                updateProgressUI(); // 立即更新一次 UI
            }
        } else {
            showMessage('error', `提交失敗: ${result.error}`);
        }
    } catch (e) {
        showMessage('error', '上傳發生網路錯誤');
    } finally {
        // 按鈕狀態會在輪詢結束時恢復
    }
}


// ----------------------------------------------------
// DOMContentLoaded
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // ... (其他 DOM 邏輯保持不變)
    window.uploadPhoto = uploadPhoto;
    fetchAlbumsForSelect(); 

    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('photoFile');

    // 拖曳上傳與點擊選取邏輯 (保持不變)
    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('drag-over');
    });
    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('drag-over');
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag-over');
        if (e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
        }
    });

    // 檔案選取事件
    fileInput.addEventListener('change', (e) => {
        if (e.target.files) {
            handleFiles(e.target.files);
        }
        e.target.value = ''; // 重設 input 讓使用者可以選取相同檔案
    });
    
    // 初始化 UI
    updateProgressUI();
});
// ... (handleFiles 邏輯保持不變)