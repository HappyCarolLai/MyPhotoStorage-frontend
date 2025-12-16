// ffmpeg-loader.js (最終完整程式碼)

// ----------------------------------------------------
// 1. 全域變數和路徑設定
// ----------------------------------------------------
let ffmpeg = null;
// ffmpeg-loader.js
const base = '/ffmpeg_static/'; 
// ❗注意：在 GitHub Pages 上，這會被解析為您的專案根目錄
let isFfmpegLoaded = false;

// ----------------------------------------------------
// 2. 核心載入函式
// ----------------------------------------------------

/**
 * 載入 FFmpeg 核心並設定進度回呼
 * 這是非同步載入，會在背景進行。
 */
async function loadFfmpeg() { 
    if (isFfmpegLoaded) return ffmpeg;
    
    // 檢查 FFmpeg 類別是否存在 (由 index.html 載入的 <script src="https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/ffmpeg.min.js"></script>)
    if (typeof window.FFmpeg === 'undefined') {
        const errorMsg = '❌ FFmpeg.js 函式庫尚未載入。';
        console.error(errorMsg);
        // showMessage 函式已在 upload.js 中定義並暴露給 window
        window.showMessage('error', errorMsg);
        throw new Error(errorMsg);
    }
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // 實例化 FFmpeg
    ffmpeg = new window.FFmpeg(); 

    // 設定進度回呼 (用於顯示進度條)
    ffmpeg.on('progress', ({ progress, time }) => {
        const percentage = Math.round(progress);
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        if (progressFill && progressText) {
             progressFill.style.width = `${percentage}%`;
             progressText.textContent = `${percentage}%`;
        }
    });

    try {
        await ffmpeg.load({
            coreURL: base + 'ffmpeg-core.js',
            wasmURL: base + 'ffmpeg-core.wasm',
            // ⭐ 關鍵修正：解決 GitHub Pages/CORS 環境下的 SecurityError (核心載入失敗)
            workerURL: base + 'ffmpeg-core.js', 
        });
        isFfmpegLoaded = true;
        window.showMessage('success', '✅ 影片處理核心載入完成！');
        return ffmpeg;
    } catch (e) {
        console.error('❌ FFmpeg 核心載入失敗:', e);
        window.showMessage('error', `❌ 影片核心載入失敗：${e.message}。`);
        // 讓 loadFfmpeg 拋出錯誤，通知 uploadPhoto 中止
        throw new Error('FFmpeg 核心載入失敗'); 
    }
}

// ----------------------------------------------------
// 3. 供 upload.js 呼叫的介面 (暴露給全域)
// ----------------------------------------------------

// 檢查是否載入完成
function getIsLoaded() {
    return isFfmpegLoaded;
}

// 暴露給全域 (upload.js 會使用 window.FFMpegLoader.load() 和 window.FFMpegLoader.getIsLoaded())
window.FFMpegLoader = {
    load: loadFfmpeg, // 暴露 load 函式
    getIsLoaded: getIsLoaded
};