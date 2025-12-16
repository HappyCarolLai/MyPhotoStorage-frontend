// ffmpeg-loader.js (最終修正版 - 處理核心檔案載入路徑)

let ffmpeg = null;
// FFmpeg 核心檔案的路徑
const base = '/ffmpeg_static/'; 
let isFfmpegLoaded = false;

/**
 * 載入 FFmpeg 核心並設定進度回呼
 * @param {FFmpeg} FFmpegClass - 從 upload.js 傳入的 FFmpeg 類別構造函數 (window.FFmpegWASM.FFmpeg)
 */
async function load(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    // 1. 檢查並確保 FFmpegClass 是真正的構造函數 (Fallback 邏輯)
    if (typeof FFmpegClass === 'undefined' || typeof FFmpegClass !== 'function') {
        if (window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg === 'function') {
             FFmpegClass = window.FFmpegWASM.FFmpeg;
        }
        if (typeof FFmpegClass !== 'function') {
            const errorMsg = '❌ FFmpeg.js 函式庫尚未載入。';
            window.showMessage('error', errorMsg);
            throw new Error(errorMsg);
        }
    }
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // 2. ⭐ 關鍵修正：將 corePath 傳遞給構造函數
    // 這是告訴 FFmpeg 庫去哪裡尋找 worker 和所有核心檔案 (包括 814.ffmpeg.js 等內部檔案)
    ffmpeg = new FFmpegClass({ 
        corePath: base // base = '/ffmpeg_static/'
    }); 

    // 設定進度回呼 (保持不變)
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
        // 3. 簡化 load 呼叫
        // 由於 corePath 已經在構造函數中設定，這裡不需要再傳入參數
        await ffmpeg.load(); 
        
        isFfmpegLoaded = true;
        window.showMessage('success', '✅ 影片處理核心載入完成！');
        return ffmpeg;
    } catch (e) {
        console.error('❌ FFmpeg 核心載入失敗:', e);
        window.showMessage('error', `❌ 影片核心載入失敗：${e.message}。`);
        throw e;
    }
}

// 暴露 API (保持不變)
function getFfmpeg() { return ffmpeg; }
function getIsLoaded() { return isFfmpegLoaded; }

window.FFMpegLoader = { load, getFfmpeg, getIsLoaded };