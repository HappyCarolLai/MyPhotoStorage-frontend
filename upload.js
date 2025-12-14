// upload.js (終極修正版)

// ⭐ 刪除頂部所有關於 FFmpeg 的 import、isFfmpegLoaded、ffmpeg 的宣告！
// 刪除後，檔案開頭應該是:
const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app'; 
let selectedFiles = []; 
// FFmpeg 相關 DOM 元素
const compressionProgressDiv = document.getElementById('compressionProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');


// ----------------------------------------------------
// showMessage 函式 (保持不變，但暴露給全域以供 ffmpeg-loader.js 使用)
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
// FFmpeg 載入函式 (使用全域載入器)
// ----------------------------------------------------
async function loadFfmpeg() {
    // 檢查全域變數是否存在 (確保 ffmpeg.js 和 ffmpeg-loader.js 已經載入)
    if (window.FFMpegLoader && window.FFmpeg) {
        // 呼叫 Loader 中的真正載入邏輯，並儲存實例
        return await window.FFMpegLoader.loadFfmpeg(window.FFmpeg); 
    }
    return null;
}

// ----------------------------------------------------
// 影片壓縮核心函式 (修正變數名稱)
// ----------------------------------------------------
/**
 * 壓縮影片檔案並返回壓縮後的 File 物件
 */
async function compressVideo(file) {
    const ffmpegInstance = window.FFMpegLoader.getFfmpeg(); // 從全域獲取實例

    if (!ffmpegInstance) {
        window.showMessage('error', 'FFmpeg 核心未準備好，無法壓縮！');
        throw new Error('FFmpeg not initialized');
    }

    // 顯示進度條
    compressionProgressDiv.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = '0%';

    const inputFileName = file.name;
    const outputFileName = `compressed-${inputFileName.replace(/\.[^/.]+$/, '.mp4')}`;

    try {
        // 1. 將 File 讀取為 ArrayBuffer，並寫入虛擬檔案系統 (FS)
        const data = await new Response(file).arrayBuffer();
        await ffmpegInstance.writeFile(inputFileName, new Uint8Array(data)); // ⭐ 修正變數名稱

        // 2. 執行壓縮命令 (使用極速設定)
        await ffmpegInstance.exec([ // ⭐ 修正變數名稱
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
        const outputData = await ffmpegInstance.readFile(outputFileName); // ⭐ 修正變數名稱

        // 4. 轉換為 Blob
        const compressedBlob = new Blob([outputData.buffer], { type: 'video/mp4' });

        // 5. 返回一個新的 File 物件
        const compressedFile = new File([compressedBlob], inputFileName, { type: 'video/mp4' });

        return compressedFile;

    } catch (e) {
        console.error('影片壓縮失敗:', e);
        showMessage('error', `影片 ${inputFileName} 壓縮失敗！請嘗試較小的檔案。`);
        throw e; 
    } finally {
        // 清理虛擬檔案系統
        if (ffmpegInstance) {
            await ffmpegInstance.deleteFile(inputFileName).catch(e => console.warn('清理輸入檔失敗', e)); // ⭐ 修正變數名稱
            await ffmpegInstance.deleteFile(outputFileName).catch(e => console.warn('清理輸出檔失敗', e)); // ⭐ 修正變數名稱
        }
        
        // 隱藏進度條
        compressionProgressDiv.style.display = 'none';
    }
}


// ----------------------------------------------------
// ... (fetchAlbumsForSelect, handleFiles 保持不變) ...
// ----------------------------------------------------
// handleFiles 底部：
// ...
    // ⭐ 檔案選取後立即嘗試載入 FFmpeg
    if (selectedFiles.length > 0) {
        loadFfmpeg(); 
    }


// ----------------------------------------------------
// 上傳照片函式 (修正核心邏輯)
// ----------------------------------------------------
async function uploadPhoto() {
    if (selectedFiles.length === 0) return;
    // ... (設定按鈕狀態、targetAlbumId 等保持不變) ...

    const filesToUpload = [];
    const videoCount = selectedFiles.filter(f => f.type.startsWith('video/')).length;
    let currentVideoIndex = 0;
    
    // 預先處理所有檔案
    for (const file of selectedFiles) {
        if (file.type.startsWith('video/')) {
            // ⭐ 影片壓縮邏輯：使用 Loader 檢查狀態
            if (window.FFMpegLoader && window.FFMpegLoader.getIsLoaded()) { 
                currentVideoIndex++;
                showMessage('info', `🎥 正在壓縮第 ${currentVideoIndex} / ${videoCount} 個影片...`);
                try {
                    const compressedFile = await compressVideo(file);
                    filesToUpload.push(compressedFile);
                } catch (e) {
                    console.error(`跳過失敗的影片 ${file.name}`);
                    continue; 
                }
            } else {
                showMessage('error', '❌ FFmpeg 尚未載入！請稍候重試。');
                filesToUpload.push(file); // 如果未載入，還是嘗試上傳原始檔案 (可能導致超時)
            }
        } else {
            // ⭐ 圖片直接上傳，交給後端處理
            filesToUpload.push(file);
        }
    }

    // ... (將檔案加入 FormData 和最終 fetch 邏輯保持不變) ...
}

// ----------------------------------------------------
// DOMContentLoaded (保持不變)
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // ⭐ 在頁面載入時預先載入 FFmpeg
    loadFfmpeg(); 
    
    window.uploadPhoto = uploadPhoto;
    fetchAlbumsForSelect();

    // ... (拖曳上傳邏輯保持不變) ...
});