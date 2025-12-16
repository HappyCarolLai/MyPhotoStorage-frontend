// ffmpeg-loader.js (Final ULTIMATE FIX - 使用 classWorkerURL 和精確路徑)

let ffmpeg = null;
// ⭐ 關鍵修正 A：使用 URL API 嚴格計算出絕對路徑。
// 即使在 GitHub Pages 子目錄中，也能保證計算出：
// https://happycarollai.github.io/MyPhotoStorage-frontend/ffmpeg_static/
const base = new URL('ffmpeg_static/', window.location.href).href; 
let isFfmpegLoaded = false;

// ... (load 函式開始)
async function load(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    // (省略類別檢查的健壯性程式碼)
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // ⭐ 關鍵修正 B：在構造函數中設定 classWorkerURL。
    // 這會強制 FFmpeg 使用這個絕對路徑來創建 Worker 實例，忽略內部失敗的 Webpack 路徑。
    ffmpeg = new FFmpegClass({ 
        corePath: base, // 基礎路徑
        classWorkerURL: base + 'ffmpeg-core.js' // 強制 Worker 創建腳本的絕對路徑
    }); 

    // 設定進度回呼 (保持不變)
    // ...

    try {
        // 由於 classWorkerURL 已經處理了 Worker 啟動，這裡只需要呼叫 load()。
        await ffmpeg.load(); 
        
        isFfmpegLoaded = true;
        // ... (成功訊息)
        return ffmpeg;
    } catch (e) {
        // ... (錯誤處理)
        throw new Error('FFmpeg 核心載入失敗');
    }
}

// 暴露出全域變數
window.FFMpegLoader = {
    load: load, 
    getIsLoaded: () => isFfmpegLoaded,
    getFfmpeg: () => ffmpeg
};