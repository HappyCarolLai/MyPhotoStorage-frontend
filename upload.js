// upload.js (最終完整修正版)

const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app'; 
let selectedFiles = []; 
// FFmpeg 相關 DOM 元素
const compressionProgressDiv = document.getElementById('compressionProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');


// ----------------------------------------------------
// showMessage 函式 (保持不變，暴露給全域以供 ffmpeg-loader.js 使用)
// ----------------------------------------------------
function showMessage(type, content) {
    const msg = document.getElementById('message');
    msg.className = `message-box ${type}`;
    msg.innerHTML = content;
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
}
// 暴露出 showMessage
window.showMessage = showMessage;

// ----------------------------------------------------
// 載入相簿選單 (保持不變)
// ----------------------------------------------------
async function fetchAlbumsForSelect() {
    const select = document.getElementById('targetAlbumSelect');
    try {
        const res = await fetch(`${BACKEND_URL}/api/albums`); 
        const albums = await res.json();
        select.innerHTML = '';
        
        if (albums.length === 0) {
            select.innerHTML = '<option>無相簿</option>';
            return;
        }

        albums.forEach(album => {
            const opt = document.createElement('option');
            opt.value = album._id;
            opt.textContent = album.name;
            if (album.name === '未分類相簿') opt.selected = true;
            select.appendChild(opt);
        });
    } catch (e) { 
        console.error(e); 
        showMessage('error', '載入相簿清單失敗。');
    }
}

// ----------------------------------------------------
// FFmpeg 載入函式 (⭐ 關鍵修正：提取 FFmpeg 類別)
// ----------------------------------------------------
async function loadFfmpeg() {
    // 檢查 FFMpegLoader 模組物件，以及 FFmpegWASM 模組物件內的 FFmpeg 類別
    if (window.FFMpegLoader && window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg === 'function') { 
        // ⭐ 關鍵修正：傳遞 window.FFmpegWASM.FFmpeg (實際的類別構造函數)
        return await window.FFMpegLoader.load(window.FFmpegWASM.FFmpeg); 
    }
    // 如果腳本載入順序有問題
    throw new Error('FFmpeg 載入程式碼遺失或順序錯誤。');
}

// ----------------------------------------------------
// 影片壓縮核心函式 (保持不變)
// ----------------------------------------------------
/**
 * 壓縮影片檔案並返回壓縮後的 File 物件
 */
async function compressVideo(file) {
    // 從全域獲取實例，這是正確的
    const ffmpegInstance = window.FFMpegLoader.getFfmpeg(); 

    if (!ffmpegInstance) {
        window.showMessage('error', 'FFmpeg 核心未準備好，無法壓縮！');
        throw new Error('FFmpeg not initialized');
    }

    // 顯示進度條
    compressionProgressDiv.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = '0%';

    const inputFileName = file.name;
    const outputFileName = `compressed-${inputFileName.replace(/\.[^/.]+$/, '.mp4')}`;

    try {
        const data = await new Response(file).arrayBuffer();
        await ffmpegInstance.writeFile(inputFileName, new Uint8Array(data)); 

        await ffmpegInstance.exec([ 
            '-i', inputFileName,
            '-c:v', 'libx264',
            '-preset', 'ultrafast', 
            '-crf', '28',          
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', 'frag_keyframe+empty_moov',
            outputFileName
        ]);

        const outputData = await ffmpegInstance.readFile(outputFileName); 
        const compressedBlob = new Blob([outputData.buffer], { type: 'video/mp4' });
        const compressedFile = new File([compressedBlob], inputFileName, { type: 'video/mp4' });

        return compressedFile;

    } catch (e) {
        console.error('影片壓縮失敗:', e);
        throw e; 
    } finally {
        if (ffmpegInstance) {
            await ffmpegInstance.deleteFile(inputFileName).catch(e => console.warn('清理輸入檔失敗', e)); 
            await ffmpegInstance.deleteFile(outputFileName).catch(e => console.warn('清理輸出檔失敗', e)); 
        }
        
        compressionProgressDiv.style.display = 'none';
    }
}


// ----------------------------------------------------
// 處理檔案選取與預覽 (保持不變)
// ----------------------------------------------------
function handleFiles(files) {
    const newFiles = Array.from(files);
    selectedFiles = selectedFiles.concat(newFiles);
    
    const previewGrid = document.getElementById('previewGrid');
    const emptyState = document.getElementById('emptyState');
    const uploadButton = document.getElementById('uploadButton');
    
    emptyState.style.display = 'none';
    uploadButton.disabled = false;

    const dropArea = document.getElementById('dropArea');
    dropArea.classList.remove('drag-over');

    newFiles.forEach(file => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.onclick = () => {
            selectedFiles = selectedFiles.filter(f => f !== file);
            previewGrid.removeChild(previewItem);
            
            if (selectedFiles.length === 0) {
                emptyState.style.display = 'block';
                uploadButton.disabled = true;
            }
        };
        previewItem.appendChild(deleteBtn);

        const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
        media.src = URL.createObjectURL(file);
        media.alt = file.name;
        media.title = file.name;
        media.onerror = () => {
             media.alt = `無法預覽: ${file.name}`;
             media.src = ''; 
             media.className = 'preview-error';
             media.textContent = `無法預覽: ${file.name}`;
        };
        if (file.type.startsWith('video/')) {
            media.controls = true;
            media.muted = true;
        }

        previewItem.appendChild(media);
        previewGrid.appendChild(previewItem);
    });

    if (selectedFiles.length > 0) {
        loadFfmpeg().catch(e => console.error('背景 FFmpeg 載入失敗', e)); 
    }
}


// ----------------------------------------------------
// 上傳照片函式 (保持不變)
// ----------------------------------------------------
async function uploadPhoto() {
    if (selectedFiles.length === 0) return;

    const btn = document.getElementById('uploadButton');
    const targetAlbumId = document.getElementById('targetAlbumSelect').value;
    
    btn.disabled = true;

    const filesToCompress = selectedFiles.filter(f => f.type.startsWith('video/'));

    if (filesToCompress.length > 0) {
        if (!window.FFMpegLoader || !window.FFMpegLoader.getIsLoaded()) {
            btn.innerHTML = '正在準備影片核心...';

            try {
                await loadFfmpeg(); 
            } catch (e) {
                showMessage('error', '❌ 影片核心載入失敗，無法上傳影片！');
                btn.disabled = false;
                btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:white;"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" /></svg> <span>上傳</span>`;
                return; 
            }
        }
    }

    btn.innerHTML = '處理檔案中...'; 

    const filesToUpload = [];
    const videoCount = filesToCompress.length;
    let currentVideoIndex = 0;

    for (const file of selectedFiles) {
        if (file.type.startsWith('video/')) {
            if (window.FFMpegLoader && window.FFMpegLoader.getIsLoaded()) {
                currentVideoIndex++;
                showMessage('info', `🎥 正在壓縮第 ${currentVideoIndex} / ${videoCount} 個影片...`);
                try {
                    const compressedFile = await compressVideo(file);
                    filesToUpload.push(compressedFile);
                } catch (e) {
                    console.error(`跳過失敗的影片 ${file.name}`);
                    showMessage('warning', `⚠️ 影片 ${file.name} 壓縮失敗，已跳過`);
                    continue; 
                }
            } else {
                showMessage('warning', `⚠️ 影片核心未準備好，上傳 ${file.name} 原始檔案，速度可能較慢。`);
                filesToUpload.push(file); 
            }
        } else {
            filesToUpload.push(file);
        }
    }
    
    if (filesToUpload.length === 0) { 
        showMessage('error', '❌ 所有選定檔案均處理失敗或被跳過。');
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:white;"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" /></svg> <span>上傳</span>`;
        return; 
    }

    btn.innerHTML = '上傳中...'; 

    const formData = new FormData();
    filesToUpload.forEach(file => {
        formData.append('photos', file);
    });
    formData.append('targetAlbumId', targetAlbumId); 

    try {
        const res = await fetch(`${BACKEND_URL}/upload`, { 
            method: 'POST',
            body: formData,
        });

        const result = await res.json();
        
        if (res.ok) {
            const successCount = result.results.filter(r => r.status === 'success').length;
            showMessage('success', `✅ 成功上傳 ${successCount} 個檔案！`);
            
            selectedFiles = [];
            document.getElementById('previewGrid').innerHTML = '';
            document.getElementById('emptyState').style.display = 'block';
            
            localStorage.setItem('albums_data_changed', 'true');
        } else {
            showMessage('error', `上傳失敗: ${result.error}`);
        }
    } catch (e) {
        showMessage('error', '上傳發生網路錯誤');
    } finally {
        btn.disabled = selectedFiles.length === 0;
        if(selectedFiles.length === 0) btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:white;"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" /></svg> <span>上傳</span>`;
    }
}

// ----------------------------------------------------
// DOMContentLoaded
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 在頁面載入時預先載入 FFmpeg
    loadFfmpeg().catch(e => console.error('背景 FFmpeg 載入失敗', e));
    
    window.uploadPhoto = uploadPhoto;
    fetchAlbumsForSelect(); 

    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('photoFile');

    // 拖曳上傳與點擊選取邏輯 (保持不變)
    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('drag-over');
    });
    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('drag-over');
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag-over');
        if (e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
        }
    });

    // 檔案選取事件
    fileInput.addEventListener('change', (e) => {
        if (e.target.files) {
            handleFiles(e.target.files);
        }
        e.target.value = ''; // 重設 input 讓使用者可以選取相同檔案
    });
});