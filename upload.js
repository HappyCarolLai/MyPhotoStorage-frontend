// upload.js (帶有輪詢機制的後端壓縮版，已恢復影片預覽)

const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app'; 
let selectedFiles = []; 
let activeTaskIds = []; // 追蹤所有正在處理的任務 ID
let pollingInterval = null; // 輪詢計時器
let mediaTasks = {}; // 全域任務追蹤物件

// DOM 元素
const uploadButton = document.getElementById('uploadButton');
const compressionProgressDiv = document.getElementById('compressionProgress'); 
const progressList = document.getElementById('progressList');
const previewGrid = document.getElementById('previewGrid'); 
const emptyState = document.getElementById('emptyState'); 

// ----------------------------------------------------
// showMessage 函式
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
// 載入相簿選單
// ----------------------------------------------------
async function fetchAlbumsForSelect() {
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
        if (selectedFiles.length > 0) {
            uploadButton.disabled = false;
        }
    } catch (e) { 
        console.error(e); 
        showMessage('error', '載入相簿清單失敗。');
    }
}

// ----------------------------------------------------
// 輔助函式：渲染預覽圖 (已更新影片預覽邏輯)
// ----------------------------------------------------
function renderPreview(file) {
    const reader = new FileReader();
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    previewItem.dataset.name = file.name;
    
    // 移除按鈕
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        selectedFiles = selectedFiles.filter(f => f.name !== file.name);
        previewItem.remove();
        if (selectedFiles.length === 0) {
            emptyState.style.display = 'block';
            uploadButton.disabled = true;
        }
    };

    reader.onload = (e) => {
        let content;
        
        if (file.type.startsWith('image/')) {
            // 圖片：正常顯示
            content = `<img src="${e.target.result}" alt="${file.name}">`;
        } else if (file.type.startsWith('video/')) {
            // ⭐ 影片：使用 <video> 標籤並設定 preload="metadata" 讓瀏覽器只載入最小預覽
            const videoSizeMB = (file.size / 1024 / 1024).toFixed(1);
            content = `
                <video controls muted preload="metadata" src="${e.target.result}" class="video-preview">
                    您的瀏覽器不支援影片播放。
                </video>
                <div class="video-info">🎬 ${videoSizeMB}MB</div>
            `;
        } else {
            // 其他：顯示問號佔位符
            content = `<div class="file-placeholder">❓ ${file.name}</div>`;
        }

        previewItem.innerHTML = content;
        previewItem.appendChild(removeBtn);
        previewGrid.appendChild(previewItem);
    };

    reader.readAsDataURL(file);
}


// ----------------------------------------------------
// 輔助函式：處理檔案選取
// ----------------------------------------------------
function handleFiles(files) {
    if (files.length === 0) return;

    // 清空舊檔案
    selectedFiles = []; 
    previewGrid.innerHTML = '';
    
    // 處理新選取的檔案
    Array.from(files).forEach(file => {
        const mime = file.type;
        const name = file.name.toLowerCase();
        if (
            mime.startsWith('image/') || 
            mime.startsWith('video/') ||
            name.endsWith('.heic') ||
            name.endsWith('.heif') ||
            name.endsWith('.mov')
        ) {
            selectedFiles.push(file);
            renderPreview(file);
        } else {
            showMessage('warning', `檔案 ${file.name} 格式不支援，已跳過。`);
        }
    });

    if (selectedFiles.length > 0) {
        emptyState.style.display = 'none';
        uploadButton.disabled = false;
    } else {
        emptyState.style.display = 'block';
        uploadButton.disabled = true;
    }
}


// ----------------------------------------------------
// 任務狀態追蹤與輪詢
// ----------------------------------------------------

function updateProgressUI() {
    progressList.innerHTML = '';
    let allCompleted = true;

    const activeTasks = activeTaskIds.map(id => mediaTasks[id]).filter(task => task && task.status !== 'CLEANED');
    
    activeTasks.forEach(task => {

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
        
        localStorage.setItem('albums_data_changed', 'true');
        
        const totalCount = activeTaskIds.length;
        const failedCount = activeTaskIds.filter(id => mediaTasks[id] && mediaTasks[id].status === 'FAILED').length;
        
        if (failedCount === totalCount) {
            showMessage('error', `❌ 所有 ${totalCount} 個檔案處理失敗，請檢查日誌。`);
        } else if (failedCount > 0) {
            showMessage('warning', `⚠️ 處理完成。${totalCount - failedCount} 個成功，${failedCount} 個失敗。`);
        } else {
            showMessage('success', `✅ 所有 ${totalCount} 個檔案處理完成！請查看相簿。`);
        }
        
        setTimeout(() => {
            activeTaskIds.forEach(id => {
                if (mediaTasks[id]) {
                    mediaTasks[id].status = 'CLEANED';
                }
            });
            activeTaskIds = []; 
            compressionProgressDiv.style.display = 'none';
        }, 10000); 

        uploadButton.disabled = false;
        uploadButton.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:white;"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" /></svg> <span>上傳</span>`;
    }
}


async function pollTaskStatus() {
    if (activeTaskIds.length === 0) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        return;
    }

    const idsToPoll = [...activeTaskIds]; 
    const tasks = {}; 

    for (const taskId of idsToPoll) {
        try {
            const res = await fetch(`${BACKEND_URL}/api/tasks/status/${taskId}`);
            if (res.ok) {
                const taskStatus = await res.json();
                tasks[taskId] = { ...mediaTasks[taskId], ...taskStatus };
            } else {
                tasks[taskId] = { status: 'FAILED', message: '任務在伺服器端已過期或不存在。', originalFileName: mediaTasks[taskId] ? mediaTasks[taskId].originalFileName : '未知檔案' };
            }
        } catch (e) {
            console.error(`輪詢任務 ${taskId} 失敗:`, e);
            tasks[taskId] = { status: 'FAILED', message: '網路連線錯誤', originalFileName: mediaTasks[taskId] ? mediaTasks[taskId].originalFileName : '未知檔案' };
        }
    }
    
    idsToPoll.forEach(taskId => {
        if (tasks[taskId]) {
            mediaTasks[taskId] = tasks[taskId];
        }
    });

    updateProgressUI();
}


// ----------------------------------------------------
// 上傳照片函式
// ----------------------------------------------------
async function uploadPhoto() {
    if (selectedFiles.length === 0) {
        showMessage('warning', '請先選取檔案');
        return;
    }

    uploadButton.disabled = true;
    uploadButton.innerHTML = '正在提交...'; 

    const targetAlbumId = document.getElementById('targetAlbumSelect').value;
    
    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('photos', file, file.name); 
    });
    formData.append('targetAlbumId', targetAlbumId); 

    try {
        const res = await fetch(`${BACKEND_URL}/api/tasks/submit-upload`, { 
            method: 'POST',
            body: formData,
        });

        const result = await res.json();
        
        if (res.ok) {
            const newTasks = result.taskIds;
            if (newTasks && newTasks.length > 0) {
                
                newTasks.forEach((taskId, index) => {
                    activeTaskIds.push(taskId); 
                    mediaTasks[taskId] = {
                        status: 'PENDING',
                        message: '等待伺服器資源進行媒體處理...',
                        originalFileName: selectedFiles[index] ? selectedFiles[index].name : '未知檔案', 
                    };
                });
                
                selectedFiles = [];
                previewGrid.innerHTML = '';
                emptyState.style.display = 'block';

                showMessage('info', `✅ ${newTasks.length} 個檔案已提交到伺服器背景處理。`);
                
                if (!pollingInterval) {
                    pollingInterval = setInterval(pollTaskStatus, 5000); 
                }
                updateProgressUI(); 
            }
        } else {
            showMessage('error', `提交失敗: ${result.error}`);
            uploadButton.disabled = false;
            uploadButton.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:white;"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" /></svg> <span>上傳</span>`;
        }
    } catch (e) {
        showMessage('error', '上傳發生網路錯誤');
        uploadButton.disabled = false;
        uploadButton.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:white;"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" /></svg> <span>上傳</span>`;
    }
}


// ----------------------------------------------------
// DOMContentLoaded
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    window.uploadPhoto = uploadPhoto;
    window.handleFiles = handleFiles; 
    fetchAlbumsForSelect(); 

    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('photoFile');

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

    fileInput.addEventListener('change', (e) => {
        if (e.target.files) {
            handleFiles(e.target.files);
        }
        e.target.value = ''; 
    });
    
    updateProgressUI();
});