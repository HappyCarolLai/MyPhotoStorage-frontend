// ffmpeg-loader.js (ULTIMATE FIX: classWorkerURL)

let ffmpeg = null;
// ⭐ 關鍵修正 A：使用 URL API 嚴格計算出絕對路徑。
// 確保路徑為：https://happycarollai.github.io/MyPhotoStorage-frontend/ffmpeg_static/
const base = new URL('ffmpeg_static/', window.location.href).href; 
let isFfmpegLoaded = false;

// ----------------------------------------------------
// 載入 FFmpeg 核心
// ----------------------------------------------------
async function load(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    // (省略類別檢查的健壯性程式碼)
    if (typeof FFmpegClass !== 'function') {
        if (window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg === 'function') {
             FFmpegClass = window.FFmpegWASM.FFmpeg; 
        } else {
            const errorMsg = '❌ FFmpeg.js 函式庫尚未載入。';
            window.showMessage('error', errorMsg);
            throw new Error(errorMsg);
        }
    }
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // ⭐ 關鍵修正 B：在構造函數中設定 classWorkerURL。
    // 這會強制 FFmpeg 使用這個絕對路徑來創建主要的 Worker 實例，
    // 徹底繞過它在子目錄環境中失敗的內部路徑計算。
    ffmpeg = new FFmpegClass({ 
        corePath: base, // 基礎路徑（供後續的 ffmpeg.load() 使用）
        classWorkerURL: base + 'ffmpeg-core.js' // 強制 Worker 創建腳本的絕對路徑
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
        // 由於 classWorkerURL 已經處理了 Worker 啟動，這裡只需要呼叫 load()。
        // （corePath 會處理核心檔案的路徑）
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