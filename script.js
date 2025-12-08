// script.js (主頁面 - 包含所有相簿管理及強制 focus 刷新邏輯)

// ✨ ✨ ✨ 這裡是你後端服務的公開網址！ ✨ ✨ ✨
const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app'; // <--- 請替換成您的實際網址！

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

// 2. SVG 圖示定義
const iconRename = `
    <svg class="icon-rename" viewBox="0 0 24 24">
        <path d="M7.127 22.56L0 23.56L1 16.433L15.367 2.067L22.933 9.633L7.127 22.56ZM2.617 18.233L15.367 5.483L18.517 8.633L5.767 21.383L2.617 18.233Z"/>
    </svg>`;
const iconDelete = `
    <svg class="icon-delete" viewBox="0 0 24 24">
        <path d="M7 21C6.45 21 5.979 20.804 5.588 20.413C5.196 20.021 5 19.55 5 19V6H4V4H9V3H15V4H20V6H19V19C19 19.55 18.804 20.021 18.413 20.413C18.021 20.804 17.55 21 17 21H7ZM9 17H11V8H9V17ZM13 17H15V8H13V17Z"/>
    </svg>`;


/** 取得並渲染所有相簿列表 (不包含下拉選單填充，因為上傳功能已移到別頁) */
async function fetchAlbums() {
    // 這裡我們直接使用 #albumListWrapper 內的 #albumList
    const albumListElement = document.getElementById('albumList'); 
    
    // ⭐ 確保元素存在
    if (!albumListElement) {
        console.error('albumList 元素未找到。');
        return;
    }

    try {
        albumListElement.innerHTML = '<p class="loading-text">載入中...</p>';
        const response = await fetch(`${BACKEND_URL}/api/albums`);
        const albums = await response.json();

        albumListElement.innerHTML = ''; // 清空列表
        
        if (albums.length === 0) {
            albumListElement.innerHTML = '<p>尚未建立任何留影簿。</p>';
            return;
        }

        albums.forEach(album => {
            // 渲染相簿卡片
            const albumCard = document.createElement('a'); 
            albumCard.className = 'album-card';
            albumCard.setAttribute('data-id', album._id);
            
            // 設定連結目標網址和開啟新分頁
            albumCard.href = `album.html?id=${album._id}&name=${encodeURIComponent(album.name)}`;
            albumCard.target = "_blank"; 

            let actionsHtml = '';
            
            if (album.name !== '未分類相簿') {
                // 2. 更名與刪除按鍵挪到下方，使用 SVG 圖示與 title 懸停提示
                actionsHtml = `
                    <div class="album-actions">
                        <button onclick="showRenameModal('${album._id}', '${album.name}');" title="更名">${iconRename}</button>
                        <button onclick="deleteAlbum('${album._id}', '${album.name}');" title="刪除">${iconDelete}</button>
                    </div>
                `;
            }

            albumCard.innerHTML = `
                
                <h3>${album.name}</h3>
                <p>留影數量: ${album.photoCount}</p>
                <p>建立於: ${new Date(album.createdAt).toLocaleDateString()}</p>
                ${actionsHtml} `;
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
// (3. 移除批次上傳邏輯)
// ----------------------------------------------------

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
    // 移除 window.uploadPhoto
    
    fetchAlbums();

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