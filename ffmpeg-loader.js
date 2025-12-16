// ffmpeg-loader.js (最終完整修正版)

let ffmpeg = null;
// FFmpeg 核心檔案的路徑 (保持不變)
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
        
        // 🚨 關鍵修正 1：強制使用 importScripts 載入本地 FFmpeg Library
        // 這一行會同步載入並執行 ffmpeg-cdn.js，定義 window.FFmpegWASM
        try {
            // 由於 load 函式是在主執行緒執行的，我們不能使用 Worker 的 importScripts。
            // 我們必須依賴 HTML 載入。但為了處理 Worker 內部的載入問題，
            // 我們將嘗試再次檢查 window.FFmpegWASM，如果沒有，就拋出錯誤。
            
            // 這裡不再使用 importScripts，因為它只在 Worker 中有效。
            // 我們直接檢查 window.FFmpegWASM
            FFmpegClass = window.FFmpegWASM;
        } catch (e) {
            console.error("嘗試載入 ffmpeg-cdn.js 失敗:", e);
        }

        if (typeof FFmpegClass === 'undefined') {
            const errorMsg = '❌ FFmpeg.js 函式庫尚未載入。';
            // ⭐ 提示使用者檢查 HTML 載入標籤
            window.showMessage('error', errorMsg + ' 請確認 upload.html 中 ffmpeg-cdn.js 的載入標籤存在且路徑正確。');
            throw new Error(errorMsg);
        }
    }
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // 使用傳入或找到的 FFmpegWASM 類別建立實例
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
            // ⭐ 關鍵修正：必須顯式指定 workerURL，解決核心載入失敗
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