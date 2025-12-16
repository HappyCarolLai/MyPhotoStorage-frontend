// ffmpeg-loader.js (FINAL & ULTIMATE ROOT DIRECTORY FIX)

let ffmpeg = null;
// ⭐ 關鍵修正 A：現在核心檔案與 HTML/JS 檔案在同一根目錄，
// 使用 '/' 作為絕對路徑的根目錄，例如：https://happycarollai.github.io/MyPhotoStorage-frontend/
const base = window.location.origin + '/MyPhotoStorage-frontend/'; 
let isFfmpegLoaded = false;

console.log('FFmpeg Base Path Calculated:', base); 

// ... (load 函式開始)
async function load(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    // (省略類別檢查的健壯性程式碼)
    if (typeof FFmpegClass !== 'function' && window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg === 'function') {
         FFmpegClass = window.FFmpegWASM.FFmpeg; 
    }
    
    if (typeof FFmpegClass !== 'function') {
        const errorMsg = '❌ FFmpeg.js 函式庫尚未載入。';
        window.showMessage('error', errorMsg);
        throw new Error(errorMsg);
    }
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // ⭐ 關鍵修正 B：在構造函數中設定 classWorkerURL，並確保指向新的根目錄路徑。
    // classWorkerURL: base + 'ffmpeg-core.js'
    ffmpeg = new FFmpegClass({ 
        corePath: base, // 基礎路徑
        classWorkerURL: base + 'ffmpeg-core.js' // 強制 Worker 創建腳本的絕對路徑
    }); 

    // 設定進度回呼 (保持不變)
    ffmpeg.on('progress', ({ progress, time }) => {
        // ... (進度條邏輯)
        const percentage = Math.round(progress);
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        if (progressFill && progressText) {
             progressFill.style.width = `${percentage}%`;
             progressText.textContent = `${percentage}%`;
        }
    });

    try {
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

// 暴露出全域變數
window.FFMpegLoader = {
    load: load, 
    getIsLoaded: () => isFfmpegLoaded,
    getFfmpeg: () => ffmpeg
};