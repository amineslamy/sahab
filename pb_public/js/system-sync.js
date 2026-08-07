// تابع کمکی برای اطمینان از دسترسی به نمونه سراسری PocketBase
function getPb() {
    if (!window.pb && typeof PocketBase !== 'undefined') {
        window.pb = new PocketBase(window.location.origin);
    }
    return window.pb;
}

document.addEventListener('DOMContentLoaded', async () => {
    const pbInstance = getPb();

    // بررسی وجود pb و اعتبارسنجی نشست کاربر
    if (!pbInstance || !pbInstance.authStore || !pbInstance.authStore.isValid) {
        window.location.href = 'login.html';
        return;
    }

    // فراخوانی مجدد رندر هدر پس از اطمینان از مقداردهی pb
    if (typeof window.renderGlobalHeader === 'function') {
        window.renderGlobalHeader();
    }
});

// تابع ثبت لوگ در UI
function logStatus(message, isError = false) {
    const container = document.getElementById('status-container');
    const logBox = document.getElementById('status-log');
    if (container) container.classList.remove('hidden');
    
    const time = new Date().toLocaleTimeString('fa-IR');
    const colorClass = isError ? 'text-rose-400' : 'text-emerald-400';
    
    if (logBox) {
        const item = document.createElement('div');
        item.className = colorClass;
        item.innerText = `[${time}] ${message}`;
        logBox.appendChild(item);
        logBox.scrollTop = logBox.scrollHeight;
    } else {
        // در صورت عدم وجود باکس لوگ در صفحه، پیام در کنسول نمایش داده می‌شود
        if (isError) {
            console.error(`[${time}] ${message}`);
        } else {
            console.log(`[${time}] ${message}`);
        }
    }
}

// ------------------- Export JSON -------------------
async function exportDataToJSON() {
    try {
        logStatus("شروع فرایند استخراج داده‌ها (JSON)...");
        
        const activePb = getPb();
        if (!activePb) throw new Error("ارتباط با PocketBase برقرار نیست.");

        // استخراج کلیه داده‌های مربوطه بر اساس ۶ اسکیما با مدیریت خطای مستقل
        const fetchCollection = async (name, options = {}) => {
            try {
                return await activePb.collection(name).getFullList({ requestKey: null, ...options });
            } catch (e) {
                console.warn(`خطا در دریافت کلکشن ${name}:`, e.message);
                return [];
            }
        };

        const [users, topics, cases, reports, comments, reportVersions] = await Promise.all([
            fetchCollection('users'),
            fetchCollection('topics'),
            fetchCollection('cases'),
            fetchCollection('reports', { sort: '-created' }),
            fetchCollection('comments'),
            fetchCollection('report_versions')
        ]);

        // نگه‌داشتن تمامی فیلدها و حفظ ساختار کامل رکوردها
        const mapRecords = (list) => list.map(record => ({ ...record }));

        const exportPayload = {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            data: {
                users: mapRecords(users),
                topics: mapRecords(topics),
                cases: mapRecords(cases),
                reports: mapRecords(reports),
                comments: mapRecords(comments),
                report_versions: mapRecords(reportVersions)
            }
        };
        const jsonString = JSON.stringify(exportPayload, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `sahab_export_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        logStatus(`خروجی موفقیت‌آمیز انجام شد. تعداد کل گزارش‌ها: ${reports.length}`);
    } catch (err) {
        console.error("Export error:", err);
        logStatus(`خطا در خروجی گرفتن: ${err.message}`, true);
    }
}

// ------------------- Export ZIP (شامل پیوست‌ها) -------------------
async function exportDataToZIP() {
    if (typeof JSZip === 'undefined') {
        logStatus("کتابخانه JSZip بارگذاری نشده است.", true);
        return;
    }

    try {
        logStatus("در حال جمع‌آوری داده‌ها و فایل‌های پیوست...");
        const zip = new JSZip();

        const activePb = getPb();
        if (!activePb) throw new Error("ارتباط با PocketBase برقرار نیست.");

        const fetchCollection = async (name, options = {}) => {
            try {
                return await activePb.collection(name).getFullList({ requestKey: null, ...options });
            } catch (e) {
                console.warn(`خطا در دریافت کلکشن ${name}:`, e.message);
                return [];
            }
        };

        const [users, topics, cases, reports, comments, reportVersions] = await Promise.all([
            fetchCollection('users'),
            fetchCollection('topics'),
            fetchCollection('cases'),
            fetchCollection('reports', { sort: '-created' }),
            fetchCollection('comments'),
            fetchCollection('report_versions')
        ]);


        const cleanRecords = (list) => list.map(record => {
            const clean = { ...record };
            delete clean.expand;
            return clean;
        });

        const exportPayload = {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            data: {
                users: cleanRecords(users),
                topics: cleanRecords(topics),
                cases: cleanRecords(cases),
                reports: cleanRecords(reports),
                comments: cleanRecords(comments),
                report_versions: cleanRecords(reportVersions)
            }
        };
        // افزودن دیتای متنی JSON به ZIP
        zip.file("data.json", JSON.stringify(exportPayload, null, 2));

        // فولدر اختصاصی رسانه‌ها
        const mediaFolder = zip.folder("media");

        logStatus("در حال دریافت فایل‌های پیوست از سرور...");
        
        // استخراج آواتار کاربران
        for (const u of users) {
            if (u.avatar) {
                try {
                    const avatarUrl = activePb.files.getUrl(u, u.avatar);
                    const res = await fetch(avatarUrl);
                    if (res.ok) {
                        const blob = await res.blob();
                        mediaFolder.file(`users/${u.id}/${u.avatar}`, blob);
                    }
                } catch (e) {
                    console.warn(`امکان دانلود آواتار کاربر ${u.id} وجود نداشت.`);
                }
            }
        }

        // استخراج کاور و پیوست‌های گزارش‌ها
        for (const r of reports) {
            if (r.cover_image) {
                try {
                    const imgUrl = activePb.files.getUrl(r, r.cover_image);
                    const res = await fetch(imgUrl);
                    if (res.ok) {
                        const blob = await res.blob();
                        mediaFolder.file(`reports/${r.id}/${r.cover_image}`, blob);
                    }
                } catch (e) {
                    console.warn(`امکان دانلود فایل ${r.cover_image} وجود نداشت.`);
                }
            }

            if (r.attachments && Array.isArray(r.attachments)) {
                for (const file of r.attachments) {
                    try {
                        const fileUrl = activePb.files.getUrl(r, file);
                        const res = await fetch(fileUrl);
                        if (res.ok) {
                            const blob = await res.blob();
                            mediaFolder.file(`reports/${r.id}/${file}`, blob);
                        }
                    } catch (e) {
                        console.warn(`امکان دانلود پیوست ${file} وجود نداشت.`);
                    }
                }
            }
        }

        logStatus("در حال فشرده‌سازی و ایجاد فایل ZIP...");
        const content = await zip.generateAsync({ type: "blob" });
        
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sahab_full_export_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        logStatus("فایل ZIP با موفقیت دانلود شد.");
    } catch (err) {
        console.error("ZIP Export Error:", err);
        logStatus(`خطا در ساخت ZIP: ${err.message}`, true);
    }
}

// ------------------- Import Data -------------------
async function importDataFromFile() {
    const fileInput = document.getElementById('import-file-input');
    if (!fileInput || !fileInput.files.length) {
        alert("لطفاً ابتدا یک فایل JSON یا ZIP انتخاب کنید.");
        return;
    }

    const file = fileInput.files[0];
    const isZip = file.name.endsWith('.zip');
    const isJson = file.name.endsWith('.json');

    if (!isZip && !isJson) {
        alert("فرمت فایل انتخاب‌شده معتبر نیست. (فقط json یا zip)");
        return;
    }

    try {
        logStatus(`در حال پردازش فایل ${file.name}...`);

        if (isJson) {
            const text = await file.text();
            const parsed = JSON.parse(text);
            await processImportData(parsed.data || parsed);
        } else if (isZip) {
            if (typeof JSZip === 'undefined') {
                logStatus("کتابخانه JSZip برای پردازش ZIP آماده نیست.", true);
                return;
            }
            const zip = await JSZip.loadAsync(file);
            
            // پیدا کردن اولویت‌دار data.json یا اولین فایل json موجود در آرشیو
            let targetJsonFile = zip.file("data.json");
            
            if (!targetJsonFile) {
                const jsonFiles = zip.file(/\.json$/i);
                if (jsonFiles && jsonFiles.length > 0) {
                    targetJsonFile = jsonFiles[0];
                }
            }
            
            if (!targetJsonFile) {
                logStatus("هیچ فایل داده با پسوند JSON در آرشیو ZIP یافت نشد.", true);
                return;
            }

            logStatus(`در حال خواندن داده‌ها از فایل ${targetJsonFile.name}...`);
            const jsonText = await targetJsonFile.async("string");
            const parsed = JSON.parse(jsonText);
            
            // پردازش داده‌های متنی و فایل‌های رسانه‌ای نمونه زیپ
            await processImportData(parsed.data || parsed, zip);
        }

        logStatus("عملیات ورود اطلاعات با موفقیت پایان یافت.");
    } catch (err) {
        console.error("Import Error:", err);
        logStatus(`خطا در ورود داده‌ها: ${err.message}`, true);
    }
}

// تابع اصلی ایجاد/بروزرسانی داده‌ها در دیتابیس (پشتیبانی از آرایه مختلط و پیوست‌های ZIP)
async function processImportData(payload, zipInstance = null) {
    const overwrite = document.getElementById('overwrite-existing')?.checked || false;

    let collectionsMap = {
        users: [],
        topics: [],
        cases: [],
        reports: [],
        comments: [],
        report_versions: []
    };

    // تفکیک داده‌ها همراه با تطابق هوشمند بر اساس اسکیماهای ۶ کلکشن
    if (Array.isArray(payload)) {
        payload.forEach(item => {
            let cName = item.collectionName;

            if (!cName) {
                // نگاشت بر اساس فیلدهای اختصاصی هر اسکیما (اولویت با report_versions نسبت به reports)
                if (item.snapshot_comments !== undefined || item.cases_rel !== undefined || (item.automation_id !== undefined && item.report !== undefined)) {
                    cName = 'report_versions';
                } else if (item.text !== undefined && item.author !== undefined && item.report !== undefined) {
                    cName = 'comments';
                } else if (item.automation_id !== undefined || item.occurrence_date !== undefined) {
                    cName = 'reports';
                } else if (item.user_code !== undefined || item.dept_code !== undefined || item.email !== undefined) {
                    cName = 'users';
                } else if (item.parent_case !== undefined) {
                    cName = 'cases';
                } else if (item.title !== undefined) {
                    cName = 'topics';
                } else {
                    cName = 'reports';
                }
            }

            if (collectionsMap[cName]) {
                collectionsMap[cName].push(item);
            } else {
                collectionsMap[cName] = [item];
            }
        });
    } else if (typeof payload === 'object' && payload !== null) {
        Object.keys(collectionsMap).forEach(key => {
            if (Array.isArray(payload[key])) {
                collectionsMap[key] = payload[key];
            }
        });
    }

    const { users, topics, cases, reports, comments, report_versions } = collectionsMap;

    // ۱. ورود کاربران (Users)
    if (users.length > 0) {
        logStatus(`بررسی و ورود ${users.length} کاربر...`);
        for (const item of users) {
            await upsertRecord('users', item, overwrite, zipInstance);
        }
    }

    // ۲. ورود موضوعات (Topics)
    if (topics.length > 0) {
        logStatus(`بررسی و ورود ${topics.length} موضوع...`);
        for (const item of topics) {
            await upsertRecord('topics', item, overwrite, zipInstance);
        }
    }

    // ۳. ورود کیس‌ها (Cases)
    if (cases.length > 0) {
        logStatus(`بررسی و ورود ${cases.length} کیس...`);
        for (const item of cases) {
            await upsertRecord('cases', item, overwrite, zipInstance);
        }
    }

    // ۴. ورود گزارش‌ها (Reports)
    if (reports.length > 0) {
        logStatus(`بررسی و ورود ${reports.length} گزارش...`);
        for (const item of reports) {
            await upsertRecord('reports', item, overwrite, zipInstance);
        }
    }

    // ۵. ورود کامنت‌ها (Comments)
    if (comments.length > 0) {
        logStatus(`بررسی و ورود ${comments.length} کامنت...`);
        for (const item of comments) {
            await upsertRecord('comments', item, overwrite, zipInstance);
        }
    }

    // ۶. ورود نسخه‌های گزارش (Report Versions)
    if (report_versions && report_versions.length > 0) {
        logStatus(`بررسی و ورود ${report_versions.length} نسخه گزارش...`);
        for (const item of report_versions) {
            await upsertRecord('report_versions', item, overwrite, zipInstance);
        }
    }
}

// تابع کمکی برای ایجاد یا بروزرسانی رکوردها همراه با بارگذاری رسانه
async function upsertRecord(collectionName, itemData, overwrite, zipInstance = null) {
    const activePb = getPb();
    if (!activePb) return;

    try {
        if (!itemData.id) return;

        // پاک‌سازی فیلدهای غیرمجاز برای ارسال به PocketBase (مانند expand) با حفظ تمامی فیلدهای اصلی اسکیما
        const cleanData = { ...itemData };
        delete cleanData.expand;
        delete cleanData.collectionId;
        delete cleanData.collectionName;

        let formData = null;

        // اگر زیپ وجود داشته باشد، فایل‌های مرتبط از فولدر media خوانده می‌شوند
        if (zipInstance && collectionName === 'reports') {
            formData = new FormData();
            
            // افزودن تمام فیلدهای متنی به FormData
            Object.keys(cleanData).forEach(key => {
                if (key !== 'cover_image' && key !== 'attachments') {
                    if (Array.isArray(cleanData[key]) || typeof cleanData[key] === 'object') {
                        formData.append(key, JSON.stringify(cleanData[key]));
                    } else if (cleanData[key] !== null && cleanData[key] !== undefined) {
                        formData.append(key, cleanData[key]);
                    }
                }
            });

            // خواندن تصویر کاور
            if (cleanData.cover_image) {
                const coverPath = `media/reports/${cleanData.id}/${cleanData.cover_image}`;
                const coverZipFile = zipInstance.file(coverPath);
                if (coverZipFile) {
                    const blob = await coverZipFile.async('blob');
                    formData.append('cover_image', blob, cleanData.cover_image);
                }
            }

            // خواندن پیوست‌های چندگانه
            if (cleanData.attachments && Array.isArray(cleanData.attachments)) {
                for (const file of cleanData.attachments) {
                    const attachPath = `media/reports/${cleanData.id}/${file}`;
                    const attachZipFile = zipInstance.file(attachPath);
                    if (attachZipFile) {
                        const blob = await attachZipFile.async('blob');
                        formData.append('attachments', blob, file);
                    }
                }
            }
        }

        const dataToSend = formData || cleanData;

        let exists = false;
        try {
            await activePb.collection(collectionName).getOne(itemData.id, { requestKey: null });
            exists = true;
        } catch (e) {
            exists = false;
        }

        if (exists) {
            if (overwrite) {
                await activePb.collection(collectionName).update(itemData.id, dataToSend, { requestKey: null });
            }
        } else {
            await activePb.collection(collectionName).create(dataToSend, { requestKey: null });
        }
    } catch (err) {
        console.warn(`خطا در پردازش رکورد ${itemData.id} در کلکسیون ${collectionName}:`, err.message);
    }
}