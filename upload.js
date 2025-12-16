// upload.js (最終完整修正版)

const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app'; 
let selectedFiles = []; 
// FFmpeg 相關 DOM 元素
const compressionProgressDiv = document.getElementById('compressionProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');


// ----------------------------------------------------
// showMessage 函式 (保持不變，暴露給全域以供 ffmpeg-loader.js 使用)
// ----------------------------------------------------
function showMessage(type, content) {
    const msg = document.getElementById('message');
    msg.className = `message-box ${type}`;
    msg.innerHTML = content;
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
}
// 暴露出 showMessage
window.showMessage = showMessage;

// ----------------------------------------------------
// 載入相簿選單 (保持現有 API 路徑，因為它工作正常)
// ----------------------------------------------------
async function fetchAlbumsForSelect() {
    const select = document.getElementById('targetAlbumSelect');
    try {
        // ⚠️ 保持 /api/albums，因為您的網路記錄顯示它工作正常
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
// FFmpeg 載入函式 (最終修正：還原為檢查全域變數)
// ----------------------------------------------------
async function loadFfmpeg() {
    // 檢查全域變數是否存在
    // window.FFmpeg 現在預期由本地載入的 ffmpeg-cdn.js 定義
    if (window.FFMpegLoader && window.FFmpeg) { 
        // 呼叫 Loader 中的真正載入邏輯。
        // 不傳參數，讓 ffmpeg-loader.js 依賴 window.FFmpeg 進行初始化。
        // FFMpegLoader 的 load 函式已經有判斷是否為 undefined 的 fallback 邏輯。
        return await window.FFMpegLoader.load(); 
    }
    // 如果腳本載入順序有問題
    throw new Error('FFmpeg 載入程式碼遺失或順序錯誤。');
}

// ----------------------------------------------------
// 影片壓縮核心函式 (保持不變)
// ----------------------------------------------------
/**
 * 壓縮影片檔案並返回壓縮後的 File 物件
 */
async function compressVideo(file) {
    // 從全域獲取實例，這是正確的
    const ffmpegInstance = window.FFMpegLoader.getFfmpeg(); 

    if (!ffmpegInstance) {
        window.showMessage('error', 'FFmpeg 核心未準備好，無法壓縮！');
        throw new Error('FFmpeg not initialized');
    }

    // 顯示進度條 (進度條會在這裡出現)
    compressionProgressDiv.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = '0%';

    const inputFileName = file.name;
    const outputFileName = `compressed-${inputFileName.replace(/\.[^/.]+$/, '.mp4')}`;

    try {
        // 1. 將 File 讀取為 ArrayBuffer，並寫入虛擬檔案系統 (FS)
        const data = await new Response(file).arrayBuffer();
        await ffmpegInstance.writeFile(inputFileName, new Uint8Array(data)); 

        // 2. 執行壓縮命令 (使用極速設定)
        await ffmpegInstance.exec([ 
            '-i', inputFileName,
            '-c:v', 'libx264',
            '-preset', 'ultrafast', 
            '-crf', '28',          
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', 'frag_keyframe+empty_moov',
            outputFileName
        ]);

        // 3. 從 FS 讀取壓縮後的檔案
        const outputData = await ffmpegInstance.readFile(outputFileName); 

        // 4. 轉換為 Blob
        const compressedBlob = new Blob([outputData.buffer], { type: 'video/mp4' });

        // 5. 返回一個新的 File 物件
        const compressedFile = new File([compressedBlob], inputFileName, { type: 'video/mp4' });

        return compressedFile;

    } catch (e) {
        console.error('影片壓縮失敗:', e);
        // showMessage 在 finally 之後會執行，因此這裡不需要再 showMessage
        throw e; 
    } finally {
        // 清理虛擬檔案系統
        if (ffmpegInstance) {
            await ffmpegInstance.deleteFile(inputFileName).catch(e => console.warn('清理輸入檔失敗', e)); 
            await ffmpegInstance.deleteFile(outputFileName).catch(e => console.warn('清理輸出檔失敗', e)); 
        }
        
        // 隱藏進度條
        compressionProgressDiv.style.display = 'none';
    }
}


// ----------------------------------------------------
// 處理檔案選取與預覽 (修正：移除 HEIC 檔案的 showMessage 呼叫)
// ----------------------------------------------------
function handleFiles(files) {
    const newFiles = Array.from(files);
    selectedFiles = selectedFiles.concat(newFiles);
    
    const previewGrid = document.getElementById('previewGrid');
    const emptyState = document.getElementById('emptyState');
    const uploadButton = document.getElementById('uploadButton');
    
    emptyState.style.display = 'none';
    uploadButton.disabled = false;

    // 清理舊的拖曳樣式
    const dropArea = document.getElementById('dropArea');
    dropArea.classList.remove('drag-over');

    newFiles.forEach(file => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        
        // 刪除按鈕
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.onclick = () => {
            // 移除檔案
            selectedFiles = selectedFiles.filter(f => f !== file);
            previewGrid.removeChild(previewItem);
            
            // 檢查是否還有檔案
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
             // ⭐ 修正 HEIC 頻繁跳動：移除 showMessage 呼叫
             media.alt = `無法預覽: ${file.name}`;
             media.src = ''; 
             media.className = 'preview-error';
             media.textContent = `無法預覽: ${file.name}`;
             // 移除 showMessage('warning', ...)
        };
        if (file.type.startsWith('video/')) {
            media.controls = true;
            media.muted = true;
        }

        previewItem.appendChild(media);
        previewGrid.appendChild(previewItem);
    });

    // 檔案選取後立即嘗試載入 FFmpeg
    if (selectedFiles.length > 0) {
        loadFfmpeg().catch(e => console.error('背景 FFmpeg 載入失敗', e)); 
    }
}


// ----------------------------------------------------
// 上傳照片函式 (修正核心邏輯、同步等待、API 路徑)
// ----------------------------------------------------
async function uploadPhoto() {
    if (selectedFiles.length === 0) return;

    const btn = document.getElementById('uploadButton');
    const targetAlbumId = document.getElementById('targetAlbumSelect').value;
    
    btn.disabled = true; // 立即禁用按鈕

    const filesToCompress = selectedFiles.filter(f => f.type.startsWith('video/'));

    // ⭐ 修正 1：如果包含影片，則強制等待 FFmpeg 載入 (解決未載入問題)
    if (filesToCompress.length > 0) {
        // 使用 window.FFMpegLoader.getIsLoaded() 檢查是否已載入
        if (!window.FFMpegLoader || !window.FFMpegLoader.getIsLoaded()) {
            btn.innerHTML = '正在準備影片核心...';

            try {
                // 必須使用 await 等待非同步載入完成
                await loadFfmpeg(); 
            } catch (e) {
                // 載入失敗，中止流程
                showMessage('error', '❌ 影片核心載入失敗，無法上傳影片！');
                btn.disabled = false;
                btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:white;"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" /></svg> <span>上傳</span>`;
                return; 
            }
        }
    }

    // 核心準備就緒或無影片時，開始處理檔案
    btn.innerHTML = '處理檔案中...'; 

    const filesToUpload = [];
    const videoCount = filesToCompress.length;
    let currentVideoIndex = 0;

    // 預先處理所有檔案
    for (const file of selectedFiles) {
        if (file.type.startsWith('video/')) {
            // 現在核心已準備好，直接執行壓縮
            if (window.FFMpegLoader && window.FFMpegLoader.getIsLoaded()) {
                currentVideoIndex++;
                showMessage('info', `🎥 正在壓縮第 ${currentVideoIndex} / ${videoCount} 個影片...`);
                try {
                    const compressedFile = await compressVideo(file);
                    filesToUpload.push(compressedFile);
                } catch (e) {
                    console.error(`跳過失敗的影片 ${file.name}`);
                    showMessage('warning', `⚠️ 影片 ${file.name} 壓縮失敗，已跳過`);
                    continue; 
                }
            } else {
                // 如果載入失敗，則上傳原檔
                showMessage('warning', `⚠️ 影片核心未準備好，上傳 ${file.name} 原始檔案，速度可能較慢。`);
                filesToUpload.push(file); 
            }
        } else {
            // 圖片直接上傳
            filesToUpload.push(file);
        }
    }
    
    // ⭐ 修正 2：如果所有檔案都因壓縮失敗而被跳過，則中止上傳
    if (filesToUpload.length === 0) { 
        showMessage('error', '❌ 所有選定檔案均處理失敗或被跳過。');
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:white;"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" /></svg> <span>上傳</span>`;
        return; 
    }

    // 設置最終上傳狀態
    btn.innerHTML = '上傳中...'; 

    const formData = new FormData();
    filesToUpload.forEach(file => {
        formData.append('photos', file);
    });
    formData.append('targetAlbumId', targetAlbumId); 

    try {
        // ⭐ 修正 3：修正 API 呼叫路徑 (移除 /api)
        // 解決 404 錯誤：路徑從 /api/upload 改為 /upload
        const res = await fetch(`${BACKEND_URL}/upload`, { 
            method: 'POST',
            body: formData,
        });

        const result = await res.json();
        
        if (res.ok) {
            const successCount = result.results.filter(r => r.status === 'success').length;
            showMessage('success', `✅ 成功上傳 ${successCount} 個檔案！`);
            
            // 清理狀態
            selectedFiles = [];
            document.getElementById('previewGrid').innerHTML = '';
            document.getElementById('emptyState').style.display = 'block';
            
            localStorage.setItem('albums_data_changed', 'true');
        } else {
            // 後端回傳失敗訊息
            showMessage('error', `上傳失敗: ${result.error}`);
        }
    } catch (e) {
        showMessage('error', '上傳發生網路錯誤');
    } finally {
        btn.disabled = selectedFiles.length === 0;
        if(selectedFiles.length === 0) btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:white;"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" /></svg> <span>上傳</span>`;
    }
}

// ----------------------------------------------------
// DOMContentLoaded
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 在頁面載入時預先載入 FFmpeg
    // ⭐ 呼叫 loadFfmpeg()
    loadFfmpeg().catch(e => console.error('背景 FFmpeg 載入失敗', e));
    
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