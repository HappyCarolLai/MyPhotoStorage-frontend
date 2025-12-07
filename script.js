// script.js (主頁面 - 包含所有相簿管理、照片上傳及強制 focus 刷新邏輯)

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
// 相簿管理邏輯
// ----------------------------------------------------

/** 取得並渲染所有相簿列表 (包含下拉選單填充) */
async function fetchAlbums() {
    // 這裡我們直接使用 #albumListWrapper 內的 #albumList
    const albumListElement = document.getElementById('albumList'); 
    const targetAlbumSelect = document.getElementById('targetAlbumSelect');
    
    // ⭐ 確保元素存在，特別是 #albumListWrapper 內的 #albumList
    if (!albumListElement || !targetAlbumSelect) {
        console.error('albumList 或 targetAlbumSelect 元素未找到。');
        return;
    }

    try {
        albumListElement.innerHTML = '<p class="loading-text">載入中...</p>';
        const response = await fetch(`${BACKEND_URL}/api/albums`);
        const albums = await response.json();

        albumListElement.innerHTML = ''; // 清空列表
        targetAlbumSelect.innerHTML = ''; // 清空下拉選單
        
        if (albums.length === 0) {
            albumListElement.innerHTML = '<p>尚未建立任何留影簿。</p>';
            return;
        }

        albums.forEach(album => {
            // 1. 填充上傳目標下拉選單
            const option = document.createElement('option');
            option.value = album._id;
            option.textContent = album.name;
            if (album.name === '未分類相簿') {
                option.selected = true;
            }
            targetAlbumSelect.appendChild(option);

            // 2. 渲染相簿卡片
            const albumCard = document.createElement('a'); 
            albumCard.className = 'album-card';
            albumCard.setAttribute('data-id', album._id);
            
            // 設定連結目標網址和開啟新分頁
            albumCard.href = `album.html?id=${album._id}&name=${encodeURIComponent(album.name)}`;
            albumCard.target = "_blank"; 

            let actionsHtml = '';
            
            if (album.name !== '未分類相簿') {
                actionsHtml = `
                    <div class="album-actions">
                        <button onclick="showRenameModal('${album._id}', '${album.name}'); event.stopPropagation();" class="rename">📝 更名</button>
                        <button onclick="deleteAlbum('${album._id}', '${album.name}'); event.stopPropagation();" class="delete">🗑️ 刪除</button>
                    </div>
                `;
            }

            albumCard.innerHTML = `
                ${actionsHtml}
                <h3>${album.name}</h3>
                <p>留影數量: ${album.photoCount}</p>
                <p>建立於: ${new Date(album.createdAt).toLocaleDateString()}</p>
            `;
            albumListElement.appendChild(albumCard);
        });
    } catch (error) {
        console.error('載入相簿列表失敗:', error);
        showMessage('error', '🚨 無法載入留影簿列表，請檢查後端服務是否正常。');
    }
}

/** 新增相簿 */
async function addNewAlbum() {
    const name = document.getElementById('newAlbumName').value.trim();
    if (!name) {
        alert('留影簿名稱不能為空！');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/albums`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        const result = await response.json();

        if (response.ok) {
            showMessage('success', `✅ 留影簿「${name}」建立成功！`);
            document.getElementById('addAlbumModal').style.display = 'none';
            document.getElementById('newAlbumName').value = ''; 
            fetchAlbums(); // 刷新列表
        } else {
            showMessage('error', `❌ 建立失敗：${result.error || '未知錯誤'}`);
        }

    } catch (error) {
        console.error('新增相簿失敗:', error);
        showMessage('error', '🚨 網路連線錯誤，無法建立留影簿。');
    }
}

/** 顯示重新命名 Modal */
function showRenameModal(albumId, currentName) {
    document.getElementById('renameAlbumId').value = albumId;
    document.getElementById('newRenameAlbumName').value = currentName;
    document.getElementById('renameAlbumModal').style.display = 'block';
}

/** 執行重新命名操作 */
async function renameAlbum() {
    const albumId = document.getElementById('renameAlbumId').value;
    const newName = document.getElementById('newRenameAlbumName').value.trim();
    
    if (!newName) {
        alert('留影簿名稱不能為空！');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/albums/${albumId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName }) 
        });

        const result = await response.json();
        
        if (response.ok) {
            showMessage('success', `✅ 留影簿已成功更名為「${newName}」！`);
            document.getElementById('renameAlbumModal').style.display = 'none';
            fetchAlbums(); // 刷新列表
        } else {
            showMessage('error', `❌ 更名失敗：${result.error || '未知錯誤'}`);
        }

    } catch (error) {
        console.error('重新命名相簿失敗:', error);
        showMessage('error', '🚨 網路連線錯誤，無法更名留影簿。');
    }
}

/** 刪除相簿 */
async function deleteAlbum(albumId, albumName) {
    if (!confirm(`⚠️ 確定要刪除留影簿「${albumName}」嗎？\n留影簿內所有照片將會被移到「未分類相簿」！`)) {
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/albums/${albumId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            showMessage('success', `✅ ${result.message}`);
            fetchAlbums(); // 刷新列表
        } else {
            showMessage('error', `❌ 刪除失敗：${result.error || '未知錯誤'}`);
        }

    } catch (error) {
        console.error('刪除相簿失敗:', error);
        showMessage('error', '🚨 網路連線錯誤，無法刪除留影簿。');
    }
}

// ----------------------------------------------------
// 批次上傳邏輯
// ----------------------------------------------------

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


function handleFiles(files) {
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
            
            fetchAlbums(); 
            
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
// 初始化與 Modal 關閉
// ----------------------------------------------------

// 關閉 Modal 邏輯
window.onclick = function(event) {
    const addModal = document.getElementById('addAlbumModal');
    const renameModal = document.getElementById('renameAlbumModal');
    
    if (event.target == addModal) {
        addModal.style.display = "none";
    }
    if (event.target == renameModal) {
        renameModal.style.display = "none";
    }
}

// 頁面載入時，立即載入相簿列表並設定監聽器
document.addEventListener('DOMContentLoaded', () => {
    // 綁定全域函式
    window.showRenameModal = showRenameModal;
    window.renameAlbum = renameAlbum;
    window.deleteAlbum = deleteAlbum;
    window.addNewAlbum = addNewAlbum;
    window.uploadPhoto = uploadPhoto;
    
    fetchAlbums();
    updateFileListDisplay();

    // ----------------------------------------------------
    // ⭐ 核心修正：監聽視窗焦點 (Focus Event) 進行強制刷新
    // ----------------------------------------------------
    
    /** * 當使用者從其他分頁切換回來時，視窗會獲得焦點 (focus)。
     * 這會強制觸發相簿列表刷新。
     */
    window.addEventListener('focus', () => {
        console.log('偵測到視窗重新獲得焦點，正在強制刷新主頁面留影簿列表...');
        
        if (typeof fetchAlbums === 'function') {
            fetchAlbums(); 
            showMessage('info', '🔁 視窗獲得焦點，留影簿已自動刷新。'); 
        }
    });
});