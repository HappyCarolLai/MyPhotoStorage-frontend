// upload.js (上傳頁面邏輯)

const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app'; 
let selectedFiles = []; 

function showMessage(type, content) {
    const msg = document.getElementById('message');
    msg.className = `message-box ${type}`;
    msg.innerHTML = content;
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
}

// 載入相簿選單
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
    } catch (e) { console.error(e); }
}

// 處理檔案選取與預覽
function handleFiles(files) {
    const newFiles = Array.from(files);
    selectedFiles = selectedFiles.concat(newFiles);
    
    const previewGrid = document.getElementById('previewGrid');
    const emptyState = document.getElementById('emptyState');
    const uploadBtn = document.getElementById('uploadButton');

    if (selectedFiles.length > 0) {
        emptyState.style.display = 'none';
        uploadBtn.disabled = false;
        uploadBtn.querySelector('span').textContent = `上傳 (${selectedFiles.length})`;
    }

    // 產生預覽縮圖
    newFiles.forEach(file => {
        const reader = new FileReader();
        const itemDiv = document.createElement('div');
        itemDiv.className = 'preview-item';

        reader.onload = function(e) {
            if (file.type.startsWith('video/')) {
                // 影片預覽 (使用 video 標籤，muted 避免自動播放聲音)
                itemDiv.innerHTML = `<video src="${e.target.result}" muted></video>`;
            } else {
                // 圖片預覽
                itemDiv.innerHTML = `<img src="${e.target.result}">`;
            }
        };
        reader.readAsDataURL(file);
        previewGrid.appendChild(itemDiv);
    });
}

// 執行上傳
async function uploadPhoto() {
    const btn = document.getElementById('uploadButton');
    const select = document.getElementById('targetAlbumSelect');
    
    if (selectedFiles.length === 0) return;

    btn.disabled = true;
    btn.innerHTML = '上傳中...';
    
    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('photos', file));
    formData.append('targetAlbumId', select.value); 

    try {
        const res = await fetch(`${BACKEND_URL}/upload`, {
            method: 'POST',
            body: formData 
        });
        const result = await res.json();
        
        if (res.ok) {
            const successCount = result.results.filter(r => r.status === 'success').length;
            showMessage('success', `✅ 成功上傳 ${successCount} 個檔案！`);
            
            // 重置狀態
            selectedFiles = [];
            document.getElementById('previewGrid').innerHTML = '';
            document.getElementById('emptyState').style.display = 'block';
            btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:white;"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" /></svg> <span>上傳</span>`;
            
            localStorage.setItem('albums_data_changed', 'true');
        } else {
            showMessage('error', `上傳失敗: ${result.error}`);
        }
    } catch (e) {
        showMessage('error', '上傳發生錯誤');
    } finally {
        btn.disabled = selectedFiles.length === 0;
        if(selectedFiles.length === 0) btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:white;"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" /></svg> <span>上傳</span>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.uploadPhoto = uploadPhoto;
    fetchAlbumsForSelect();

    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('photoFile');

    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('drag-over'); });
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
});