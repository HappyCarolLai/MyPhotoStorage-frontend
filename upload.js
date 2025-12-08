// upload.js (支援影片上傳與縮圖生成)

const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app';

let selectedFiles = [];

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

async function fetchAlbumsForSelect() {
    const targetAlbumSelect = document.getElementById('targetAlbumSelect');
    
    if (!targetAlbumSelect) return;

    try {
        targetAlbumSelect.innerHTML = '<option>載入中...</option>';
        const response = await fetch(`${BACKEND_URL}/api/albums`);
        const albums = await response.json();

        targetAlbumSelect.innerHTML = '';
        
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

function handleFiles(files) {
    selectedFiles = Array.from(files);
    updateFileListDisplay();
}

/** 生成影片縮圖 */
function generateVideoThumbnail(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        
        video.onloadeddata = () => {
            video.currentTime = 1; // 取第1秒的畫面
        };
        
        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.8);
        };
        
        video.onerror = () => reject(new Error('無法載入影片'));
        
        video.src = URL.createObjectURL(file);
    });
}

/** 更新檔案列表顯示（顯示在 dropArea 內部） */
async function updateFileListDisplay() {
    const fileListElement = document.getElementById('fileList');
    const dropPrompt = document.getElementById('dropPrompt');
    const uploadButton = document.getElementById('uploadButton');
    
    if (!fileListElement || !uploadButton || !dropPrompt) return;
    
    if (selectedFiles.length === 0) {
        fileListElement.style.display = 'none';
        dropPrompt.style.display = 'block';
        uploadButton.disabled = true;
        return;
    }
    
    dropPrompt.style.display = 'none';
    fileListElement.style.display = 'block';
    uploadButton.disabled = false;
    
    let listHTML = `<p style="font-weight: bold; margin-bottom: 10px;">已選取 ${selectedFiles.length} 個檔案：</p><ul style="list-style: none; padding: 0;">`;
    
    for (const file of selectedFiles) {
        const isVideo = file.type.startsWith('video/');
        const icon = isVideo ? '🎬' : '🖼️';
        const size = (file.size / 1024 / 1024).toFixed(2);
        listHTML += `<li style="margin-bottom: 5px;">${icon} ${file.name} (${size} MB)</li>`;
    }
    
    listHTML += '</ul>';
    fileListElement.innerHTML = listHTML;
}

/** 執行上傳（支援影片 + 縮圖生成） */
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
    showMessage('loading', `🚀 正在上傳 ${selectedFiles.length} 個檔案，請稍候...`);
    
    const targetAlbumId = targetAlbumSelect.value;
    const formData = new FormData();
    
    // 處理每個檔案，為影片生成縮圖
    for (const file of selectedFiles) {
        formData.append('photos', file);
        
        // 如果是影片，生成縮圖
        if (file.type.startsWith('video/')) {
            try {
                const thumbnail = await generateVideoThumbnail(file);
                formData.append('thumbnails', thumbnail, `${file.name}_thumb.jpg`);
            } catch (error) {
                console.warn(`無法為影片 ${file.name} 生成縮圖:`, error);
            }
        }
    }
    
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
            
            localStorage.setItem('albums_data_changed', 'true');
            
            selectedFiles = [];
            fileInput.value = '';
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

document.addEventListener('DOMContentLoaded', () => {
    window.uploadPhoto = uploadPhoto;
    
    fetchAlbumsForSelect();
    updateFileListDisplay();

    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('photoFile');

    if (dropArea && fileInput) {
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
            handleFiles(e.dataTransfer.files);
        });
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
    }
    
    window.addEventListener('beforeunload', () => {
        localStorage.setItem('albums_data_changed', 'true'); 
    });
});