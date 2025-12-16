// ffmpeg-loader.js (最終完整修正程式碼)

let ffmpeg = null;
// FFmpeg 核心檔案的路徑
const base = '/ffmpeg_static/'; 
let isFfmpegLoaded = false;

/**
 * 載入 FFmpeg 核心並設定進度回呼
 * @param {FFmpeg} FFmpegClass - 從 window.FFmpegWASM 獲取的類別 (可能為 undefined)
 */
async function load(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    // 檢查 FFmpeg 類別是否存在
    if (typeof FFmpegClass === 'undefined') {
        // ⭐ 關鍵修正：從 window.FFmpegWASM 模組物件中提取 FFmpeg 類別
        if (window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg === 'function') {
             FFmpegClass = window.FFmpegWASM.FFmpeg;
        }

        if (typeof FFmpegClass === 'undefined') {
            const errorMsg = '❌ FFmpeg.js 函式庫尚未載入。';
            window.showMessage('error', errorMsg);
            throw new Error(errorMsg);
        }
    }
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // L43: 這裡執行 new FFmpegClass()，現在 FFmpegClass 應該是真正的類別構造函數了
    ffmpeg = new FFmpegClass(); 

    // 設定進度回呼
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
            // 確保 workerURL 是正確的
            workerURL: base + 'ffmpeg-core.js', 
        });
        isFfmpegLoaded = true;
        window.showMessage('success', '✅ 影片處理核心載入完成！');
        return ffmpeg;
    } catch (e) {
        console.error('❌ FFmpeg 核心載入失敗:', e);
        window.showMessage('error', `❌ 影片核心載入失敗：${e.message}。`);
        // 讓 loadFfmpeg 拋出錯誤，通知上傳流程
        throw e;
    }
}

// 暴露 API
function getFfmpeg() { return ffmpeg; }
function getIsLoaded() { return isFfmpegLoaded; }

window.FFMpegLoader = { load, getFfmpeg, getIsLoaded };