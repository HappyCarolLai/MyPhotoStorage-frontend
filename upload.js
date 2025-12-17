// upload.js (後端壓縮專用版)

const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app'; 
let selectedFiles = []; 
// ⭐ 修正：移除所有 FFmpeg 相關 DOM 元素


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
// ⭐ 修正：移除 loadFfmpeg 函式
// ⭐ 修正：移除 compressVideo 函式
// ----------------------------------------------------


// ----------------------------------------------------
// 處理檔案選取與預覽 (移除 loadFfmpeg 呼叫)
// ----------------------------------------------------
function handleFiles(files) {
    const newFiles = Array.from(files);
    selectedFiles = selectedFiles.concat(newFiles);
    
    const previewGrid = document.getElementById('previewGrid');
    const emptyState = document.getElementById('emptyState');
    const uploadButton = document.getElementById('uploadButton');
    
    emptyState.style.display = 'none';
    uploadButton.disabled = false;

    const dropArea = document.getElementById('dropArea');
    dropArea.classList.remove('drag-over');

    newFiles.forEach(file => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.onclick = () => {
            selectedFiles = selectedFiles.filter(f => f !== file);
            previewGrid.removeChild(previewItem);
            
            if (selectedFiles.length === 0) {
                emptyState.style.display = 'block';
                uploadButton.disabled = true;
            }
        };
        previewItem.appendChild(deleteBtn);

        const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
        media.src = URL.createObjectURL(file);
        media.alt = file.name;
        media.title = file.name;
        media.onerror = () => {
             media.alt = `無法預覽: ${file.name}`;
             media.src = ''; 
             media.className = 'preview-error';
             media.textContent = `無法預覽: ${file.name}`;
        };
        if (file.type.startsWith('video/')) {
            media.controls = true;
            media.muted = true;
        }

        previewItem.appendChild(media);
        previewGrid.appendChild(previewItem);
    });
    
    // ⭐ 修正：移除 loadFfmpeg() 的呼叫
}


// ----------------------------------------------------
// 上傳照片函式 (簡化為直接上傳)
// ----------------------------------------------------
async function uploadPhoto() {
    if (selectedFiles.length === 0) return;

    const btn = document.getElementById('uploadButton');
    const targetAlbumId = document.getElementById('targetAlbumSelect').value;
    
    btn.disabled = true;
    btn.innerHTML = '上傳中...'; 
    showMessage('info', `正在上傳 ${selectedFiles.length} 個檔案到伺服器進行處理...`);


    const formData = new FormData();
    // 直接上傳所有檔案 (包括影片)
    selectedFiles.forEach(file => {
        formData.append('photos', file); 
    });
    formData.append('targetAlbumId', targetAlbumId); 

    try {
        const res = await fetch(`${BACKEND_URL}/upload`, { 
            method: 'POST',
            body: formData,
        });

        const result = await res.json();
        
        if (res.ok) {
            const successCount = result.results.filter(r => r.status === 'success').length;
            const errorCount = result.results.filter(r => r.status === 'error').length;
            
            if (errorCount > 0) {
                 showMessage('warning', `⚠️ 上傳完成。成功 ${successCount} 個，失敗 ${errorCount} 個。`);
            } else {
                 showMessage('success', `✅ 成功上傳 ${successCount} 個檔案，後端正在進行處理！`);
            }
            
            selectedFiles = [];
            document.getElementById('previewGrid').innerHTML = '';
            document.getElementById('emptyState').style.display = 'block';
            
            localStorage.setItem('albums_data_changed', 'true');
        } else {
            showMessage('error', `上傳失敗: ${result.error}`);
        }
    } catch (e) {
        showMessage('error', '上傳發生網路錯誤');
    } finally {
        btn.disabled = selectedFiles.length === 0;
        // 還原按鈕文字
        if(selectedFiles.length === 0) btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:white;"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" /></svg> <span>上傳</span>`;
    }
}

// ----------------------------------------------------
// DOMContentLoaded
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // ⭐ 修正：移除 loadFfmpeg() 呼叫
    
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
});