// upload.js (專門用於處理上傳邏輯)

// ✨ ✨ ✨ 這裡是你後端服務的公開網址！ ✨ ✨ ✨
const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app'; // <--- 請替換成您的實際網址！

let selectedFiles = []; // 儲存待上傳檔案

// ----------------------------------------------------
// 輔助與訊息顯示函式
// ----------------------------------------------------

/** 顯示訊息，3秒後自動隱藏 */
function showMessage(type, content) {
    const messageElement = document.getElementById('message');
    if (!messageElement) return; 
    
    messageElement.className = `message-box ${type}`;
    messageElement.innerHTML = content;
    messageElement.style.display = 'block';
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 3000);
}

// ----------------------------------------------------
// 相簿列表載入 (僅用於填充下拉選單)
// ----------------------------------------------------

/** 取得並渲染所有相簿列表 (僅填充下拉選單) */
async function fetchAlbumsForSelect() {
    const targetAlbumSelect = document.getElementById('targetAlbumSelect');
    
    if (!targetAlbumSelect) return;

    try {
        targetAlbumSelect.innerHTML = '<option>載入中...</option>';
        const response = await fetch(`${BACKEND_URL}/api/albums`);
        const albums = await response.json();

        targetAlbumSelect.innerHTML = ''; // 清空下拉選單
        
        if (albums.length === 0) {
            targetAlbumSelect.innerHTML = '<option>尚未建立任何留影簿</option>';
            document.getElementById('uploadButton').disabled = true;
            return;
        }

        albums.forEach(album => {
            const option = document.createElement('option');
            option.value = album._id;
            option.textContent = album.name;
            if (album.name === '未分類相簿') {
                option.selected = true;
            }
            targetAlbumSelect.appendChild(option);
        });

    } catch (error) {
        console.error('載入相簿列表失敗:', error);
        showMessage('error', '🚨 無法載入留影簿列表，請檢查後端服務是否正常。');
    }
}


// ----------------------------------------------------
// 批次上傳邏輯
// ----------------------------------------------------

function handleFiles(files) {
    // 過濾非圖片檔案，但這裡是前端，先保持原本邏輯
    selectedFiles = Array.from(files);
    updateFileListDisplay();
}

/** 更新檔案列表顯示 */
function updateFileListDisplay() {
    const fileListElement = document.getElementById('fileList');
    const uploadButton = document.getElementById('uploadButton');
    if (!fileListElement || !uploadButton) return;
    
    if (selectedFiles.length === 0) {
        fileListElement.style.display = 'none'; 
        uploadButton.disabled = true;
        return;
    }
    fileListElement.style.display = 'block';
    uploadButton.disabled = false;
    
    let listHTML = `<p>已選取 **${selectedFiles.length}** 個留影檔案：</p><ul>`;
    selectedFiles.forEach(file => {
        listHTML += `<li>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</li>`;
    });
    listHTML += '</ul>';
    fileListElement.innerHTML = listHTML;
}

/** 執行上傳 (新增目標相簿 ID) */
async function uploadPhoto() {
    const uploadButton = document.getElementById('uploadButton');
    const targetAlbumSelect = document.getElementById('targetAlbumSelect');
    const fileInput = document.getElementById('photoFile'); 

    if (!uploadButton || !targetAlbumSelect || !fileInput) return;

    if (selectedFiles.length === 0) {
        showMessage('error', '❌ 請先選擇檔案！');
        return;
    }

    uploadButton.disabled = true;
    showMessage('loading', `🚀 正在上傳 **${selectedFiles.length}** 個留影檔案，請稍候...`);
    
    const targetAlbumId = targetAlbumSelect.value; 

    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('photos', file); 
    });
    formData.append('targetAlbumId', targetAlbumId); 

    try {
        const response = await fetch(`${BACKEND_URL}/upload`, {
            method: 'POST',
            body: formData 
        });
        
        const result = await response.json();
        
        if (response.ok) {
            let successCount = result.results.filter(item => item.status === 'success').length;
            
            let successHTML = `✅ **上傳成功！** 成功上傳 ${successCount} 個檔案。<br><hr>`;
            result.results.forEach(item => {
                const statusText = item.status === 'success' ? '✔️ 成功' : `❌ 失敗：${item.error}`;
                successHTML += `<div>${statusText} - ${item.fileName}</div>`;
            });
            showMessage('success', successHTML);
            
            // ⭐ 核心：通知主頁面刷新，因為數據已改變
            localStorage.setItem('albums_data_changed', 'true'); 
            
            selectedFiles = [];
            fileInput.value = ''; // 強制清空檔案輸入欄位
            updateFileListDisplay();
        } else {
            showMessage('error', `❌ 上傳過程發生錯誤！訊息：${result.error || '未知錯誤'}`);
        }
    } catch (error) {
        console.error(error);
        showMessage('error', `🚨 發生網路連線錯誤！請確認後端服務是否正常運行。`);
    } finally {
        uploadButton.disabled = false;
    }
}


// ----------------------------------------------------
// 初始化
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // 綁定全域函式
    window.uploadPhoto = uploadPhoto;
    
    fetchAlbumsForSelect();
    updateFileListDisplay();

    // 拖曳 & 選擇檔案邏輯
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('photoFile');

    if (dropArea && fileInput) {
        dropArea.addEventListener('click', () => fileInput.click());
        dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('drag-over'); });
        dropArea.addEventListener('dragleave', () => { dropArea.classList.remove('drag-over'); });
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files);
        });
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
    }
    
    // ⭐ 額外添加：當使用者從上傳頁返回主頁時，強制讓主頁刷新 (雖然主頁的 focus 監聽已經處理了)
    window.addEventListener('beforeunload', () => {
        localStorage.setItem('albums_data_changed', 'true'); 
    });
});
