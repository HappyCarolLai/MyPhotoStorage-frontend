// album-content.js

const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app'; 
let currentAlbumId = null; 
let allPhotos = []; 
let currentPhotoIndex = 0; 
let selectedPhotoIds = new Set(); 
let isBulkMove = false; // 追蹤目前是批量移動還是單張移動

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return { id: params.get('id'), name: decodeURIComponent(params.get('name') || '相簿') };
}

function showMessage(type, content) {
    const msg = document.getElementById('message');
    if (!msg) return; 
    msg.className = `message-box ${type}`;
    msg.innerHTML = content;
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
}

// 判斷是否為影片檔案
function isVideo(filename) {
    return filename.match(/\.(mp4|mov|webm|ogg)$/i);
}

async function loadAlbumContent() {
    const { id, name } = getUrlParams();
    if (!id) return;
    
    document.getElementById('currentAlbumName').textContent = name;
    document.title = name;
    currentAlbumId = id;
    
    const grid = document.getElementById('photoGrid');
    const noPhotosMessage = document.getElementById('noPhotosMessage'); 
    
    // 步驟 1: 設置載入狀態並重置訊息
    grid.innerHTML = '<p>載入中...</p>';
    if (noPhotosMessage) {
        noPhotosMessage.style.display = 'none';
    }

    try {
        const res = await fetch(`${BACKEND_URL}/api/albums/${id}/photos`);
        
        if (!res.ok) {
            throw new Error(`API 載入失敗 (狀態碼: ${res.status})`);
        }
        
        const photos = await res.json();
        allPhotos = photos;
        
        // 步驟 2: 成功取得資料，清除載入中狀態
        grid.innerHTML = ''; 
        
        selectedPhotoIds.clear();
        document.getElementById('bulkActions').style.display = 'none';

        // 步驟 3: 檢查相簿是否為空
        if (photos.length === 0) {
            if (noPhotosMessage) {
                 noPhotosMessage.style.display = 'block';
            } else {
                 grid.innerHTML = '<p style="color: #6C757D; text-align: center; margin-top: 50px; font-size: 1.1rem;">此相簿目前沒有留影</p>';
            }
            return; 
        }

        // 步驟 4: 渲染照片/影片網格
        photos.forEach((photo, index) => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            card.setAttribute('data-photo-id', photo._id); // 新增屬性便於查找

            // 判斷顯示圖片或影片
            let mediaHtml = '';
            if (isVideo(photo.originalFileName)) {
                // 影片縮圖處理：使用 video 標籤，並指定時間點抓取畫面
                mediaHtml = `
                    <div class="video-indicator">▶</div>
                    <video src="${photo.githubUrl}#t=0.1" preload="metadata" poster="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="></video>
                `;
            } else {
                // 圖片
                mediaHtml = `<img src="${photo.githubUrl}" alt="photo">`;
            }

            card.innerHTML = `
                <input type="checkbox" class="photo-select-checkbox" onclick="handleSelectionClick(event, '${photo._id}')">
                <div class="media-wrapper" onclick="openLightbox(${index}); event.stopPropagation();">
                    ${mediaHtml}
                </div>
                <div class="photo-actions">
                    <button onclick="singleDeletePhoto('${photo._id}'); event.stopPropagation();" class="delete">🗑️</button>
                    <button onclick="showMovePhotoModal(false, '${photo._id}', '${photo.originalFileName}'); event.stopPropagation();" class="move">📦</button>
                </div>
            `;
            grid.appendChild(card);
        });
        
    } catch (e) {
        // 步驟 5: 處理錯誤
        console.error("載入相簿內容時發生錯誤：", e);
        grid.innerHTML = '<p class="error-text">❌ 載入失敗，請檢查網路或後端服務。</p>'; 
        if (noPhotosMessage) {
            noPhotosMessage.style.display = 'none';
        }
    }
}

// --- 燈箱邏輯 --- (略)
function openLightbox(index) {
    currentPhotoIndex = index;
    const lightbox = document.getElementById('lightbox');
    lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden'; 
    displayLightboxContent(index);
    document.addEventListener('keydown', handleKeyNavigation);
}

function displayLightboxContent(index) {
    const photo = allPhotos[index];
    const wrapper = document.querySelector('.lightbox-content-wrapper');
    
    // 清除舊內容
    const oldImg = document.getElementById('lightboxImage');
    const oldVideo = document.getElementById('lightboxVideo');
    if(oldImg) oldImg.remove();
    if(oldVideo) oldVideo.remove();

    const caption = document.getElementById('imageCaption');
    if(caption) caption.textContent = photo.originalFileName;

    // 建立新的元素
    if (isVideo(photo.originalFileName)) {
        const video = document.createElement('video');
        video.id = 'lightboxVideo';
        video.src = photo.githubUrl;
        video.controls = true;
        video.autoplay = true;
        // 插入到按鈕之間
        const nextBtn = document.getElementById('nextBtn');
        wrapper.insertBefore(video, nextBtn);
    } else {
        const img = document.createElement('img');
        img.id = 'lightboxImage';
        img.src = photo.githubUrl;
        // 插入到按鈕之間
        const nextBtn = document.getElementById('nextBtn');
        wrapper.insertBefore(img, nextBtn);
    }
}

function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
    document.body.style.overflow = 'auto';
    // 停止影片播放
    const video = document.getElementById('lightboxVideo');
    if(video) video.pause();
    document.removeEventListener('keydown', handleKeyNavigation);
}

function navigatePhoto(dir) {
    currentPhotoIndex = (currentPhotoIndex + dir + allPhotos.length) % allPhotos.length;
    displayLightboxContent(currentPhotoIndex);
}

function handleKeyNavigation(e) {
    if (e.key === 'ArrowLeft') navigatePhoto(-1);
    if (e.key === 'ArrowRight') navigatePhoto(1);
    if (e.key === 'Escape') closeLightbox();
}

// --- 選取與刪除邏輯 ---

function handleSelectionClick(e, id) {
    e.stopPropagation();
    if (e.target.checked) selectedPhotoIds.add(id);
    else selectedPhotoIds.delete(id);
    
    const bulkDiv = document.getElementById('bulkActions');
    if (selectedPhotoIds.size > 0) {
        bulkDiv.style.display = 'flex';
        document.getElementById('selectedCount').textContent = `已選 ${selectedPhotoIds.size} 張`;
    } else {
        bulkDiv.style.display = 'none';
    }
}

async function bulkDeletePhotos() {
    if (!confirm(`確定要刪除這 ${selectedPhotoIds.size} 張留影嗎？`)) return;
    try {
        await fetch(`${BACKEND_URL}/api/photos/bulkDelete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoIds: Array.from(selectedPhotoIds) })
        });
        showMessage('success', `✅ 成功刪除 ${selectedPhotoIds.size} 張留影。`);
        loadAlbumContent(); // 重新載入相簿
    } catch (e) {
        showMessage('error', '刪除失敗');
    }
}

async function singleDeletePhoto(id) {
    if (!confirm('確定要刪除此留影嗎？')) return;
    try {
        await fetch(`${BACKEND_URL}/api/photos/bulkDelete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoIds: [id] })
        });
        showMessage('success', '✅ 成功刪除 1 張留影。');
        loadAlbumContent();
    } catch (e) {
        showMessage('error', '刪除失敗');
    }
}

// --- 移動照片邏輯 (新增) ---

async function fetchAlbumsForMove() {
    const select = document.getElementById('targetMoveAlbumSelect');
    select.innerHTML = '';
    try {
        const res = await fetch(`${BACKEND_URL}/api/albums`);
        const albums = await res.json();
        
        albums.forEach(album => {
            // 排除當前相簿
            if (album._id === currentAlbumId) return; 
            
            const opt = document.createElement('option');
            opt.value = album._id;
            opt.textContent = album.name;
            select.appendChild(opt);
        });
        
        if (select.children.length === 0) {
            select.innerHTML = '<option value="">無其他相簿可移動</option>';
            document.getElementById('confirmMovePhoto').disabled = true;
        } else {
            document.getElementById('confirmMovePhoto').disabled = false;
        }

    } catch (e) { 
        console.error('載入相簿失敗', e);
        select.innerHTML = '<option value="">載入失敗</option>';
        document.getElementById('confirmMovePhoto').disabled = true;
    }
}

function showMovePhotoModal(isBulk, singleId = null, singleName = null) {
    isBulkMove = isBulk;
    document.getElementById('movePhotoModal').style.display = 'block';
    
    // 載入相簿清單 (每次開啟都重新載入，確保清單是最新的)
    fetchAlbumsForMove(); 
    
    const messageElement = document.getElementById('movePhotoMessage');
    const nameElement = document.getElementById('photoToMoveName');
    
    if (isBulk) {
        // 批量移動
        messageElement.textContent = `將 ${selectedPhotoIds.size} 張留影移動到：`;
        nameElement.style.display = 'none'; // 隱藏單張名稱顯示
        document.getElementById('confirmMovePhoto').onclick = executeMovePhoto;
        
    } else {
        // 單張移動
        if (!singleId) return;
        messageElement.textContent = `將 `;
        nameElement.style.display = 'inline';
        nameElement.textContent = singleName;
        messageElement.insertAdjacentElement('beforeend', nameElement);
        messageElement.insertAdjacentText('beforeend', ' 移動到：');
        
        // 將單張照片 ID 暫存到確認按鈕的 data 屬性，以便執行時使用
        document.getElementById('confirmMovePhoto').dataset.singleId = singleId;
        document.getElementById('confirmMovePhoto').onclick = executeMovePhoto;
    }
}

async function executeMovePhoto() {
    const targetAlbumId = document.getElementById('targetMoveAlbumSelect').value;
    if (!targetAlbumId) return showMessage('error', '請選擇目標相簿');

    let photoIdsToMove = [];
    if (isBulkMove) {
        photoIdsToMove = Array.from(selectedPhotoIds);
    } else {
        photoIdsToMove = [document.getElementById('confirmMovePhoto').dataset.singleId];
    }
    
    if (photoIdsToMove.length === 0) return;

    try {
        const res = await fetch(`${BACKEND_URL}/api/photos/bulkMove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                photoIds: photoIdsToMove, 
                targetAlbumId: targetAlbumId 
            })
        });

        if (res.ok) {
            showMessage('success', `✅ 成功移動 ${photoIdsToMove.length} 張留影！`);
        } else {
            showMessage('error', '移動失敗');
        }

        document.getElementById('movePhotoModal').style.display = 'none';
        loadAlbumContent(); // 重新載入相簿內容
    } catch (e) {
        showMessage('error', '網路錯誤，移動失敗');
    }
}


// 暴露給 HTML
document.addEventListener('DOMContentLoaded', () => {
    loadAlbumContent();
    window.openLightbox = openLightbox;
    window.closeLightbox = closeLightbox;
    window.navigatePhoto = navigatePhoto;
    window.handleSelectionClick = handleSelectionClick;
    window.bulkDeletePhotos = bulkDeletePhotos;
    window.singleDeletePhoto = singleDeletePhoto;
    window.showMovePhotoModal = showMovePhotoModal; // 暴露新功能
    window.executeMovePhoto = executeMovePhoto; // 暴露新功能
});