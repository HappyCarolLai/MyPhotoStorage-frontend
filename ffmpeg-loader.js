// ffmpeg-loader.js (絕對路徑最終修正版)

let ffmpeg = null;
// ⭐ 關鍵修正 1：將相對路徑改為完整的絕對 URL
// 確保 Web Worker 能正確解析路徑，例如：https://yourdomain.com/ffmpeg_static/
const base = window.location.origin + '/ffmpeg_static/'; 
let isFfmpegLoaded = false;

/**
 * 載入 FFmpeg 核心並設定進度回呼
 * @param {FFmpeg} FFmpegClass - 從 upload.js 傳入的 FFmpeg 類別構造函數
 */
async function load(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    // 1. 檢查並確保 FFmpegClass 是真正的構造函數
    if (typeof FFmpegClass !== 'function' || typeof FFmpegClass === 'undefined') {
        // 嘗試從 window.FFmpegWASM 中提取 FFmpeg 類別
        if (window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg === 'function') {
             FFmpegClass = window.FFmpegWASM.FFmpeg; 
        } else if (window.FFmpegWASM && typeof window.FFmpegWASM === 'function') {
             // 兼容舊版可能直接是 FFmpegWASM
             FFmpegClass = window.FFmpegWASM; 
        }
        
        if (typeof FFmpegClass !== 'function') {
            const errorMsg = '❌ FFmpeg.js 函式庫尚未載入。';
            window.showMessage('error', errorMsg);
            throw new Error(errorMsg);
        }
    }
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // 2. ⭐ 關鍵修正 2：將 corePath 傳遞給構造函數
    // 使用已經修正為絕對路徑的 base 變數
    ffmpeg = new FFmpegClass({ 
        corePath: base // 現在 base 是完整的絕對 URL (e.g., https://yourdomain/ffmpeg_static/)
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
        // 3. 簡化 load 呼叫：因為 corePath 已經在構造函數中設定，這裡只需要呼叫 load()
        await ffmpeg.load(); 
        
        isFfmpegLoaded = true;
        window.showMessage('success', '✅ 影片處理核心載入完成！');
        return ffmpeg;
    } catch (e) {
        console.error('❌ FFmpeg 核心載入失敗:', e);
        window.showMessage('error', `❌ 影片核心載入失敗：${e.message}。`);
        throw new Error('FFmpeg 核心載入失敗');
    }
}

// 暴露出全域變數供 upload.js 使用 
window.FFMpegLoader = {
    load: load, 
    getIsLoaded: () => isFfmpegLoaded,
    getFfmpeg: () => ffmpeg
};