// ffmpeg-loader.js (最終穩固版 - 專為 GitHub Pages 根目錄優化)

let ffmpeg = null;
// ⭐ 關鍵修正 A：使用 URL API 嚴格計算出絕對路徑，指向檔案所在的根目錄。
// 這將確保 base 變數為：https://happycarollai.github.io/MyPhotoStorage-frontend/
const base = new URL('./', window.location.href).href; 
let isFfmpegLoaded = false;

console.log('FFmpeg Base Path Calculated:', base); // 請務必在 Console 中確認此路徑正確

/**
 * 載入 FFmpeg 核心並設定進度回呼
 * @param {FFmpeg} FFmpegClass - FFmpeg 類別構造函數
 */
async function load(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    // (類別檢查的健壯性程式碼)
    if (typeof FFmpegClass !== 'function' && window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg === 'function') {
         FFmpegClass = window.FFmpegWASM.FFmpeg; 
    }
    
    if (typeof FFmpegClass !== 'function') {
        const errorMsg = '❌ FFmpeg.js 函式庫尚未載入。';
        window.showMessage('error', errorMsg);
        throw new Error(errorMsg);
    }
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // ⭐ 關鍵修正 B：只使用 corePath。移除 classWorkerURL，避免引入額外的複雜性。
    // 讓 FFmpeg 庫自行處理 Worker 內部載入 ffmpeg-core.js/wasm
    ffmpeg = new FFmpegClass({ 
        corePath: base, // 基礎路徑 (e.g., https://.../MyPhotoStorage-frontend/)
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
        // 呼叫 load()。它會使用 corePath + 'ffmpeg-core.js' / 'ffmpeg-core.wasm'
        await ffmpeg.load(); 
        
        isFfmpegLoaded = true;
        window.showMessage('success', '✅ 影片處理核心載入完成！');
        return ffmpeg;
    } catch (e) {
        console.error('❌ FFmpeg 核心載入失敗:', e);
        window.showMessage('error', `❌ 影片核心載入失敗：${e.message}。請檢查 Console 面板中的錯誤。`);
        throw new Error('FFmpeg 核心載入失敗');
    }
}

// 暴露出全域變數
window.FFMpegLoader = {
    load: load, 
    getIsLoaded: () => isFfmpegLoaded,
    getFfmpeg: () => ffmpeg
};