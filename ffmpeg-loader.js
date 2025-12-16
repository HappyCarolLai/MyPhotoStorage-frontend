// ffmpeg-loader.js (FINAL & ULTIMATE GitHub Pages PATH FIX)

let ffmpeg = null;
// ⭐ 關鍵修正 A：使用 URL API 嚴格計算出絕對路徑。
// 確保路徑為：https://happycarollai.github.io/MyPhotoStorage-frontend/ffmpeg_static/
// window.location.href 會包含子目錄，這是最可靠的計算方式。
const base = new URL('ffmpeg_static/', window.location.href).href; 
let isFfmpegLoaded = false;

console.log('FFmpeg Base Path Calculated:', base); // 檢查路徑是否正確

// ----------------------------------------------------
// 載入 FFmpeg 核心
// ----------------------------------------------------
async function load(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    // (省略類別檢查的健壯性程式碼)
    // 確保 FFmpegClass 是從 window.FFmpegWASM 取得的
    if (typeof FFmpegClass !== 'function' && window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg === 'function') {
         FFmpegClass = window.FFmpegWASM.FFmpeg; 
    }
    
    if (typeof FFmpegClass !== 'function') {
        const errorMsg = '❌ FFmpeg.js 函式庫尚未載入。';
        window.showMessage('error', errorMsg);
        throw new Error(errorMsg);
    }
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // ⭐ 關鍵修正 B：在構造函數中設定 classWorkerURL。
    // 這會強制 Worker 內部使用這個絕對路徑來創建 Worker 實例，確保核心載入成功。
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
        // 呼叫 load()，FFmpeg 內部會使用 corePath 載入 ffmpeg-core.js/wasm
        await ffmpeg.load(); 
        
        isFfmpegLoaded = true;
        window.showMessage('success', '✅ 影片處理核心載入完成！');
        return ffmpeg;
    } catch (e) {
        console.error('❌ FFmpeg 核心載入失敗:', e);
        window.showMessage('error', `❌ 影片核心載入失敗：${e.message}。請檢查 Network 面板中的 ffmpeg-core.js/wasm 請求。`);
        throw new Error('FFmpeg 核心載入失敗');
    }
}

// 暴露出全域變數
window.FFMpegLoader = {
    load: load, 
    getIsLoaded: () => isFfmpegLoaded,
    getFfmpeg: () => ffmpeg
};