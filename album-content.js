// album-content.js (專門用於新分頁載入相簿內容 - 採用強制重整)

// ✨ ✨ ✨ 這裡是你後端服務的公開網址！ ✨ ✨ ✨
const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app'; // <--- 請替換成您的實際網址！

let currentAlbumId = null; 
let selectedPhotoIds = new Set(); // 儲存批量選取的 ID
let isBulkMode = false; 

// ⭐ 燈箱導覽變數
let allPhotos = []; // 儲存當前相簿所有照片的陣列
let currentPhotoIndex = 0; 

// --- 輔助函式 ---

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

/** 取得 URL 中的參數 */
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        id: params.get('id'),
        name: params.get('name') ? decodeURIComponent(params.get('name')) : '相簿內容'
    };
}

/** 更新批量操作介面 */
function updateBulkActions() {
    const selectedCountSpan = document.getElementById('selectedCount');
    const bulkActionsDiv = document.getElementById('bulkActions');
    
    if (!selectedCountSpan || !bulkActionsDiv) return;

    selectedCountSpan.textContent = `已選取 ${selectedPhotoIds.size} 張`;
    
    if (selectedPhotoIds.size > 0) {
        bulkActionsDiv.style.display = 'flex';
        isBulkMode = true;
    } else {
        bulkActionsDiv.style.display = 'none';
        isBulkMode = false;
    }
    
    // 同步更新 Checkbox 狀態
    document.querySelectorAll('.photo-select-checkbox').forEach(checkbox => {
        // 從 onclick 屬性中提取 photoId
        const matches = checkbox.getAttribute('onclick').match(/'([^']*)'/);
        const photoId = matches ? matches[1] : null;

        const card = checkbox.closest('.photo-card');
        
        if (photoId && selectedPhotoIds.has(photoId)) {
            checkbox.checked = true;
            card.classList.add('selected');
        } else {
            checkbox.checked = false;
            card.classList.remove('selected');
        }
    });
}

// ----------------------------------------------------
// 照片選取、內容載入邏輯
// ----------------------------------------------------

/** 處理選取框的點擊事件 (用於選取/取消選取) */
function handleSelectionClick(event, photoId) {
    event.stopPropagation();
    
    const isChecked = event.target.checked;
    const card = event.target.closest('.photo-card');

    if (isChecked) {
        selectedPhotoIds.add(photoId);
        card.classList.add('selected');
    } else {
        selectedPhotoIds.delete(photoId);
        card.classList.remove('selected');
    }
    updateBulkActions();
}

/** 查看相簿內容 (載入照片網格) */
async function loadAlbumContent() {
    const params = getUrlParams();
    const albumId = params.id;
    const albumName = params.name;

    if (!albumId) {
        document.getElementById('currentAlbumName').textContent = '錯誤：找不到相簿 ID';
        return;
    }
    
    document.title = `相簿內容 - ${albumName}`;
    document.getElementById('currentAlbumName').textContent = albumName;
    
    const photoGrid = document.getElementById('photoGrid');
    const noPhotosMessage = document.getElementById('noPhotosMessage'); 

    // 1. 立即顯示載入狀態並清空舊內容
    photoGrid.innerHTML = '<p class="loading-text">載入照片中...</p>'; 
    noPhotosMessage.style.display = 'none';
    currentAlbumId = albumId; 

    // 2. 清空選取狀態
    selectedPhotoIds.clear(); 
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/albums/${albumId}/photos`);
        
        if (response.status === 404) {
            showMessage('error', `❌ 載入失敗：相簿ID ${albumId} 不存在。`);
            photoGrid.innerHTML = ''; 
            return;
        }

        const photos = await response.json();
        
        // 3. 儲存所有照片
        allPhotos = photos; 
        
        // 4. 替換「載入中...」訊息
        photoGrid.innerHTML = ''; 
        
        if (photos.length === 0) {
            noPhotosMessage.style.display = 'block';
            updateBulkActions(); 
            return;
        }
        
        // 5. 渲染照片網格
        photos.forEach((photo, index) => { 
            const card = document.createElement('div');
            card.className = 'photo-card';
            card.setAttribute('data-photo-id', photo._id);
            
            card.innerHTML = `
                <input type="checkbox" class="photo-select-checkbox" 
                    onclick="handleSelectionClick(event, '${photo._id}')">

                <img src="${photo.githubUrl}" alt="${photo.originalFileName}" title="${photo.originalFileName}"
                     onclick="openLightbox(${index}); event.stopPropagation();">
                <div class="photo-info">
                    ${photo.originalFileName.substring(0, 20)}...
                </div>
                <div class="photo-actions">
                    <button onclick="singleDeletePhoto('${photo._id}', '${photo.originalFileName}'); event.stopPropagation();" class="delete">🗑️ 刪除</button>
                    <button onclick="showMovePhotoModal(false, '${photo._id}', '${photo.originalFileName}'); event.stopPropagation();" class="move">📦 移動</button>
                </div>
            `;
            photoGrid.appendChild(card);
        });

        // 6. 渲染完成後，更新批量操作介面
        updateBulkActions(); 

    } catch (error) {
        console.error('載入照片失敗:', error);
        photoGrid.innerHTML = '<p class="loading-text" style="color: red;">❌ 載入照片列表失敗，請檢查後端日誌。</p>';
        showMessage('error', '載入相簿內容失敗，請檢查後端服務或網路連線。');
    } 
}

// ----------------------------------------------------
// 單張/批量刪除邏輯
// ----------------------------------------------------

async function singleDeletePhoto(photoId, fileName) {
    if (!confirm(`⚠️ 確定要刪除照片「${fileName}」嗎？\n此操作將會同時刪除 GitHub 上的檔案！`)) {
        return;
    }
    await executeDeletePhotos([photoId], [fileName]);
}

async function bulkDeletePhotos() {
    if (selectedPhotoIds.size === 0) {
        showMessage('error', '❌ 請先選取至少一張照片！');
        return;
    }
    if (!confirm(`⚠️ 確定要刪除這 ${selectedPhotoIds.size} 張照片嗎？\n此操作將會同時刪除 GitHub 上的檔案！`)) {
        return;
    }
    
    const photoIds = Array.from(selectedPhotoIds);
    await executeDeletePhotos(photoIds, []); 
}

async function executeDeletePhotos(photoIds, fileNames) {
    showMessage('loading', `正在刪除 ${photoIds.length} 張照片...`);

    try {
        const response = await fetch(`${BACKEND_URL}/api/photos/bulkDelete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoIds: photoIds }) 
        });

        const result = await response.json();

        if (response.ok) {
            const successCount = result.successes.length;
            const failCount = result.failures.length;
            
            let successMessage = `✅ **刪除完成！** 成功刪除 ${successCount} 張，失敗 ${failCount} 張。`;
            if (failCount > 0) {
                 successMessage += `<br>部分照片刪除失敗，詳情請看控制台。`;
            }

            showMessage('success', successMessage);
            
            // ⭐ 跨分頁通知 (讓主頁面刷新)
            localStorage.setItem('albums_data_changed', 'true'); 
            
            // ⭐ 關鍵修正：執行強制重整，確保內容徹底刷新
            window.location.reload(); 
            
        } else {
            showMessage('error', `❌ 刪除照片失敗：${result.error || '未知錯誤'}`);
        }

    } catch (error) {
        console.error('執行刪除照片失敗:', error);
        showMessage('error', '🚨 網路連線錯誤，無法刪除照片。');
    }
}

// ----------------------------------------------------
// 單張/批量移動邏輯
// ----------------------------------------------------

async function loadAlbumsForMove(selectElement, excludeAlbumId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/albums`);
        const albums = await response.json();
        selectElement.innerHTML = ''; 

        albums.forEach(album => {
            if (album._id !== excludeAlbumId) {
                const option = document.createElement('option');
                option.value = album._id;
                option.textContent = album.name;
                selectElement.appendChild(option);
            }
        });
    } catch (error) {
        console.error('載入移動目標相簿列表失敗:', error);
    }
}

let singlePhotoToMoveId = null; 
let isBulkMove = false; 

async function showMovePhotoModal(isBulk, photoId = null, photoName = null) {
    const modal = document.getElementById('movePhotoModal');
    const select = document.getElementById('targetMoveAlbumSelect');
    const messageElement = document.getElementById('movePhotoMessage');
    const confirmBtn = document.getElementById('confirmMovePhoto');

    isBulkMove = isBulk;
    
    if (isBulk) {
        if (selectedPhotoIds.size === 0) {
            showMessage('error', '❌ 請先選取至少一張照片進行批量移動！');
            return;
        }
        messageElement.innerHTML = `將 **${selectedPhotoIds.size} 張** 照片移動到：`;
        singlePhotoToMoveId = null;
    } else {
        messageElement.innerHTML = `將 <span id="photoToMoveName" style="font-weight: bold;">${photoName}</span> 移動到：`;
        singlePhotoToMoveId = photoId;
    }
    
    await loadAlbumsForMove(select, currentAlbumId);
    
    confirmBtn.onclick = () => handleMovePhoto(isBulkMove);

    modal.style.display = 'block';
}


async function handleMovePhoto(isBulk) {
    const targetAlbumId = document.getElementById('targetMoveAlbumSelect').value;
    
    if (!targetAlbumId) {
        showMessage('error', '❌ 請選擇目標相簿！');
        return;
    }
    
    let photosToMove;
    if (isBulk) {
        photosToMove = Array.from(selectedPhotoIds);
    } else {
        photosToMove = [singlePhotoToMoveId];
    }
    
    showMessage('loading', `📦 正在移動 ${photosToMove.length} 張照片...`);

    try {
        const response = await fetch(`${BACKEND_URL}/api/photos/bulkMove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                photoIds: photosToMove, 
                targetAlbumId: targetAlbumId 
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            const successCount = result.successes.length;
            const failCount = result.failures.length;

            let successMessage = `✅ **移動完成！** 成功移動 ${successCount} 張，失敗 ${failCount} 張。`;
            showMessage('success', successMessage);
            
            // 確保 Modal 關閉
            document.getElementById('movePhotoModal').style.display = 'none'; 
            
            // 跨分頁通知 (讓主頁面刷新)
            localStorage.setItem('albums_data_changed', 'true'); 
            
            // ⭐ 關鍵修正：執行強制重整，確保內容徹底刷新
            window.location.reload(); 
            
        } else {
            showMessage('error', `❌ 移動失敗: ${result.error || response.statusText}`);
        }
    } catch (error) {
        console.error('移動照片失敗:', error);
        showMessage('error', '🚨 網路連線錯誤，無法移動照片。');
    }
}


// ----------------------------------------------------
// 燈箱 (Lightbox) 放大與導覽功能 (保持不變)
// ----------------------------------------------------

function openLightbox(index) {
    if (allPhotos.length === 0) return;
    
    currentPhotoIndex = index;
    const lightbox = document.getElementById('lightbox');
    
    lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden'; 
    
    displayPhoto(index);

    document.addEventListener('keydown', handleKeyNavigation);
}

function displayPhoto(index) {
    const photo = allPhotos[index];
    const imgElement = document.getElementById('lightboxImage');
    const captionElement = document.getElementById('imageCaption');
    
    if (photo) {
        imgElement.src = photo.githubUrl;
        captionElement.textContent = photo.originalFileName;
        
        currentPhotoIndex = index;
    }
}

function navigatePhoto(direction) { 
    let newIndex = currentPhotoIndex + direction;
    
    if (newIndex < 0) {
        newIndex = allPhotos.length - 1;
    } else if (newIndex >= allPhotos.length) {
        newIndex = 0;
    }
    
    displayPhoto(newIndex);
}

function handleKeyNavigation(event) {
    if (document.getElementById('lightbox') && document.getElementById('lightbox').style.display === 'flex') {
        if (event.key === 'ArrowLeft') {
            navigatePhoto(-1);
        } else if (event.key === 'ArrowRight') {
            navigatePhoto(1);
        } else if (event.key === 'Escape') {
            closeLightbox();
        }
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.style.display = 'none';
    }
    document.body.style.overflow = 'auto'; 
    document.removeEventListener('keydown', handleKeyNavigation); 
}


// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    loadAlbumContent();
    
    window.onclick = function(event) {
        const moveModal = document.getElementById('movePhotoModal'); 
        const lightbox = document.getElementById('lightbox');
        
        if (event.target == moveModal) {
            moveModal.style.display = "none";
        }
        if (event.target == lightbox) {
            closeLightbox();
        }
    }
    
    // 綁定供 HTML 內聯使用的函式
    window.closeLightbox = closeLightbox;
    window.navigatePhoto = navigatePhoto;
    window.openLightbox = openLightbox; 
    window.showMovePhotoModal = showMovePhotoModal;
    window.bulkDeletePhotos = bulkDeletePhotos;
    window.singleDeletePhoto = singleDeletePhoto;
    window.handleSelectionClick = handleSelectionClick; 
});