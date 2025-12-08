// album-content.js

const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app'; 
let currentAlbumId = null; 
let allPhotos = []; 
let currentPhotoIndex = 0; 
let selectedPhotoIds = new Set(); 

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return { id: params.get('id'), name: decodeURIComponent(params.get('name') || '相簿') };
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
    grid.innerHTML = '<p>載入中...</p>';
    
    try {
        const res = await fetch(`${BACKEND_URL}/api/albums/${id}/photos`);
        if (!res.ok) throw new Error('Failed');
        const photos = await res.json();
        allPhotos = photos;
        grid.innerHTML = '';
        selectedPhotoIds.clear();
        document.getElementById('bulkActions').style.display = 'none';

        if (photos.length === 0) {
            document.getElementById('noPhotosMessage').style.display = 'block';
            return;
        }

        photos.forEach((photo, index) => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            
            // 判斷顯示圖片或影片
            let mediaHtml = '';
            if (isVideo(photo.originalFileName)) {
                // 顯示影片標籤，preload metadata 讓瀏覽器抓縮圖
                mediaHtml = `
                    <div class="video-indicator">▶</div>
                    <video src="${photo.githubUrl}#t=0.1" preload="metadata"></video>
                `;
            } else {
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
        console.error(e);
        grid.innerHTML = '<p>載入失敗</p>';
    }
}

// --- 燈箱邏輯 (支援圖片與影片自適應) ---

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

// --- 批量操作 (保持不變，略作精簡) ---

function handleSelectionClick(e, id) {
    e.stopPropagation();
    if (e.target.checked) selectedPhotoIds.add(id);
    else selectedPhotoIds.delete(id);
    
    const bulkDiv = document.getElementById('bulkActions');
    if (selectedPhotoIds.size > 0) {
        bulkDiv.style.display = 'flex';
        document.getElementById('selectedCount').textContent = `已選 ${selectedPhotoIds.size}`;
    } else {
        bulkDiv.style.display = 'none';
    }
}

async function bulkDeletePhotos() {
    if (!confirm(`刪除 ${selectedPhotoIds.size} 張?`)) return;
    await fetch(`${BACKEND_URL}/api/photos/bulkDelete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: Array.from(selectedPhotoIds) })
    });
    window.location.reload();
}

async function singleDeletePhoto(id) {
    if (!confirm('刪除此照片?')) return;
    await fetch(`${BACKEND_URL}/api/photos/bulkDelete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: [id] })
    });
    window.location.reload();
}

// 移動照片 Modal 邏輯需配合 album.html 的 HTML 結構 (此處略過未變動部分)
// 確保 HTML 中有對應的 Modal 結構即可

document.addEventListener('DOMContentLoaded', loadAlbumContent);