/**
 * سیستم خروجی جامع (اطلاعات و فایل‌های فیزیکی) به‌صورت Zip
 */
async function exportZip() {
    const exportBtn = document.querySelector('button[onclick="exportZip()"]');
    const originalBtnText = exportBtn ? exportBtn.innerHTML : '';

    try {
        if (typeof JSZip === 'undefined') {
            alert('کتابخانه JSZip بارگذاری نشده است.');
            return;
        }

        // استخراج شناسه گزارش‌های انتخاب‌شده از Set مربوطه
        const selectedIds = Array.from(window.selectedReportIds || []);
        if (selectedIds.length === 0) {
            alert('لطفاً حداقل یک گزارش را از جدول انتخاب کنید.');
            return;
        }

        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = '⏳ در حال بسته‌بندی...';
        }

        const zip = new JSZip();
        const pbInstance = window.pb || (typeof PocketBase !== 'undefined' ? new PocketBase(window.location.origin) : null);

        if (!pbInstance) {
            throw new Error('نمونه PocketBase یافت نشد.');
        }

        // ساخت شرط فیلتر PocketBase برای دریافت فقط گزارش‌های انتخاب‌شده
        const reportsFilter = selectedIds.map(id => `id = "${id}"`).join(' || ');

        // ۱. دریافت داده‌های گزارش‌های انتخاب‌شده و موارد وابسته
        const reports = await pbInstance.collection('reports').getFullList({
            filter: reportsFilter,
            sort: '-created'
        });

        const [reportVersions, comments, cases, topics, usersRaw] = await Promise.all([
            pbInstance.collection('report_versions').getFullList({ sort: '-created' }),
            pbInstance.collection('comments').getFullList({ sort: '-created' }),
            pbInstance.collection('cases').getFullList({ sort: '-created' }),
            pbInstance.collection('topics').getFullList({ sort: '-created' }),
            pbInstance.collection('users').getFullList({ sort: '-created' })
        ]);

        // استخراج کلیه شناسه‌های ریلیشن‌های وابسته به گزارش‌های انتخاب‌شده
        const validReportIds = new Set(reports.map(r => r.id));
        const relatedCaseIds = new Set();
        const relatedTopicIds = new Set();
        const relatedUserIds = new Set();

        reports.forEach(r => {
            if (r.author) relatedUserIds.add(r.author);
            if (r.department) relatedUserIds.add(r.department);
            if (r.submitter) relatedUserIds.add(r.submitter);

            if (Array.isArray(r.cases_rel)) {
                r.cases_rel.forEach(id => relatedCaseIds.add(id));
            }
            if (Array.isArray(r.topics_rel)) {
                r.topics_rel.forEach(id => relatedTopicIds.add(id));
            }
        });

        // فیلتر کردن نسخه گزارش‌ها و کامنت‌های مربوط به گزارش‌های انتخاب‌شده
        const filteredVersions = reportVersions.filter(v => validReportIds.has(v.report));
        const filteredComments = comments.filter(c => validReportIds.has(c.report));

        // اضافه کردن شناسه نویسندگان کامنت‌ها و نسخه‌ها به کاربران مرتبط
        filteredVersions.forEach(v => { if (v.author) relatedUserIds.add(v.author); });
        filteredComments.forEach(c => { if (c.author) relatedUserIds.add(c.author); });

        // فیلتر کردن کیس‌ها، موضوعات و کاربران متمایز و مرتبط
        const filteredCases = cases.filter(c => relatedCaseIds.has(c.id));
        const filteredTopics = topics.filter(t => relatedTopicIds.has(t.id));
        const filteredUsersRaw = usersRaw.filter(u => relatedUserIds.has(u.id));

        // حذف فیلدهای حساس کاربران
        const safeUsers = filteredUsersRaw.map(user => {
            const { password, tokenKey, ...safeUser } = user;
            return safeUser;
        });

        // ساخت شیء اصلی JSON
        const exportData = {
            exported_at: new Date().toISOString(),
            data: {
                reports,
                report_versions: filteredVersions,
                comments: filteredComments,
                cases: filteredCases,
                topics: filteredTopics,
                users: safeUsers
            }
        };

        zip.file("data.json", JSON.stringify(exportData, null, 2));

        // ۲. دانلود فایل‌های فیزیکی مرتبط
        const filesFolder = zip.folder("files");

        const getFileUrlSafe = (record, filename) => {
            if (typeof pbInstance.getFileUrl === 'function') {
                return pbInstance.getFileUrl(record, filename);
            }
            if (pbInstance.files && typeof pbInstance.files.getUrl === 'function') {
                return pbInstance.files.getUrl(record, filename);
            }
            return `/api/files/${record.collectionId || record.collectionName}/${record.id}/${filename}`;
        };

        // الف) فایل‌های فیزیکی گزارش‌های انتخاب شده (کاور و پیوست‌ها)
        for (const report of reports) {
            if (report.cover_image) {
                const url = getFileUrlSafe(report, report.cover_image);
                await fetchAndAddToZip(filesFolder, `reports/${report.id}/${report.cover_image}`, url);
            }
            if (Array.isArray(report.attachments)) {
                for (const fileName of report.attachments) {
                    const url = getFileUrlSafe(report, fileName);
                    await fetchAndAddToZip(filesFolder, `reports/${report.id}/${fileName}`, url);
                }
            }
        }

        // ب) آواتار کاربران مرتبط
        for (const user of filteredUsersRaw) {
            if (user.avatar) {
                const url = getFileUrlSafe(user, user.avatar);
                await fetchAndAddToZip(filesFolder, `users/${user.id}/${user.avatar}`, url);
            }
        }

        // ۳. استخراج نام کاربر جاری و ساخت نام فایل زیپ بر اساس الگوی درخواستی
        let userName = "unknown";
        if (pbInstance.authStore && pbInstance.authStore.model && pbInstance.authStore.model.name) {
            userName = pbInstance.authStore.model.name;
        }

        let dateStr = "";
        let timeStr = "";

        if (typeof persianDate !== 'undefined') {
            const pd = new persianDate();
            dateStr = pd.format("YYMMDD");
            timeStr = pd.format("HHmm");
        } else {
            const now = new Date();
            dateStr = now.toISOString().slice(2, 10).replace(/-/g, "");
            timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
        }

        const zipFileName = `${userName}_${dateStr}_${timeStr}.zip`;

        // تولید و دانلود فایل زیپ
        const content = await zip.generateAsync({ type: "blob" });
        const downloadUrl = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = zipFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

    } catch (error) {
        console.error('خطا در خروجی زیپ:', error);
        alert('خطا در دریافت خروجی: ' + error.message);
    } finally {
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalBtnText;
        }
    }
}

/**
 * دریافت فایل از سرور و افزودن آن به Zip
 */
async function fetchAndAddToZip(zipFolder, relativePath, url) {
    try {
        const response = await fetch(url);
        if (response.ok) {
            const blob = await response.blob();
            zipFolder.file(relativePath, blob);
        }
    } catch (e) {
        console.warn(`فایل در آدرس ${url} دریافت نشد:`, e);
    }
}

/**
 * تابع شروع عملیات ایمپورت داده‌ها و فایل‌های فیزیکی از فایل ZIP به همراه نوار پیشرفت
 */
async function handleStartImport() {
    const fileInput = document.getElementById('sync-zip-file');
    const importBtn = document.getElementById('btn-start-import');

    const progressContainer = document.getElementById('import-progress-container');
    const progressBar = document.getElementById('import-progress-bar');
    const progressText = document.getElementById('import-progress-text');
    const progressPercent = document.getElementById('import-progress-percent');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert('لطفاً یک فایل ZIP انتخاب کنید.');
        return;
    }

    const zipFile = fileInput.files[0];
    const originalBtnText = importBtn ? importBtn.innerHTML : '';

    const updateProgress = (current, total, message) => {
        if (!progressContainer) return;
        progressContainer.classList.remove('hidden');
        const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressPercent) progressPercent.innerText = `${percentage}%`;
        if (progressText) progressText.innerText = message;
    };

    try {
        if (typeof JSZip === 'undefined') {
            alert('کتابخانه JSZip بارگذاری نشده است.');
            return;
        }

        const pbInstance = window.pb || (typeof PocketBase !== 'undefined' ? new PocketBase(window.location.origin) : null);
        if (!pbInstance) {
            throw new Error('نمونه PocketBase یافت نشد.');
        }

        if (importBtn) {
            importBtn.disabled = true;
            importBtn.innerHTML = '⏳ در حال بسته‌بندی داده‌ها...';
        }

        updateProgress(0, 100, 'در حال خواندن فایل ZIP...');

        // ۱. خواندن فایل زیپ
        const zip = await JSZip.loadAsync(zipFile);
        const jsonFile = zip.file("data.json");

        if (!jsonFile) {
            throw new Error('فایل data.json در ریشه فایل ZIP یافت نشد.');
        }

        const jsonText = await jsonFile.async("text");
        const parsedData = JSON.parse(jsonText);

        if (!parsedData || !parsedData.data) {
            throw new Error('ساختار data.json معتبر نیست.');
        }

        const {
            users = [],
            cases = [],
            topics = [],
            reports = [],
            comments = [],
            report_versions = []
        } = parsedData.data;

        // محاسبه مجموع کل آیتم‌ها جهت نمایش دقیق درصد
        const totalItems = users.length + cases.length + topics.length + reports.length + comments.length + report_versions.length;
        let processedItems = 0;

        if (totalItems === 0) {
            updateProgress(100, 100, 'هیچ داده‌ای برای ایمپورت یافت نشد.');
            alert('فایل ZIP حاوی داده‌ای برای ایمپورت نیست.');
            return;
        }

        // ۲. ایمپورت بر اساس ترتیب منطقی کلیدهای خارجی:
        // ۱. کاربران -> ۲. کیس‌ها -> ۳. موضوعات -> ۴. گزارش‌ها -> ۵. کامنت‌ها -> ۶. نسخه‌ها

// آمارگیری مجزا برای گزارش‌ها و سایر آیتم‌ها
        const reportStats = {
            created: new Set(),
            updated: new Set(),
            skipped: new Set(),
            failed: new Set()
        };

        const otherStats = {
            created: new Set(),
            updated: new Set(),
            skipped: new Set(),
            failed: new Set()
        };

        const processResult = (record, res, isReport = false) => {
            if (res && res.status && record && record.id) {
                const targetStats = isReport ? reportStats : otherStats;
                if (targetStats[res.status]) {
                    targetStats[res.status].add(record.id);
                }
            }
        };

        // ۱. کاربران
        for (const user of users) {
            updateProgress(processedItems, totalItems, `در حال بررسی کاربر: ${user.name || user.username || user.id}`);
            const res = await importRecordWithFiles(pbInstance, zip, 'users', user, {
                avatar: `files/users/${user.id}/${user.avatar}`
            });
            processResult(user, res, false);
            processedItems++;
            updateProgress(processedItems, totalItems, `کاربر بررسی شد (${processedItems}/${totalItems})`);
        }

        // ۲. کیس‌ها
        for (const caseItem of cases) {
            updateProgress(processedItems, totalItems, `در حال بررسی کیس: ${caseItem.title || caseItem.id}`);
            const res = await importRecordWithFiles(pbInstance, zip, 'cases', caseItem, {});
            processResult(caseItem, res, false);
            processedItems++;
            updateProgress(processedItems, totalItems, `کیس بررسی شد (${processedItems}/${totalItems})`);
        }

        // ۳. موضوعات
        for (const topic of topics) {
            updateProgress(processedItems, totalItems, `در حال بررسی موضوع: ${topic.title || topic.id}`);
            const res = await importRecordWithFiles(pbInstance, zip, 'topics', topic, {});
            processResult(topic, res, false);
            processedItems++;
            updateProgress(processedItems, totalItems, `موضوع بررسی شد (${processedItems}/${totalItems})`);
        }

        // ۴. گزارش‌ها (با کلید isReport = true)
        for (const report of reports) {
            updateProgress(processedItems, totalItems, `در حال بررسی گزارش: ${report.title || report.id}`);
            const filePathsMap = {};
            if (report.cover_image) {
                filePathsMap['cover_image'] = `files/reports/${report.id}/${report.cover_image}`;
            }
            if (Array.isArray(report.attachments) && report.attachments.length > 0) {
                filePathsMap['attachments'] = report.attachments.map(att => `files/reports/${report.id}/${att}`);
            }

            const res = await importRecordWithFiles(pbInstance, zip, 'reports', report, filePathsMap);
            processResult(report, res, true);
            processedItems++;
            updateProgress(processedItems, totalItems, `گزارش بررسی شد (${processedItems}/${totalItems})`);
        }

        // ۵. کامنت‌ها
        for (const comment of comments) {
            updateProgress(processedItems, totalItems, `در حال بررسی کامنت (${processedItems + 1}/${totalItems})`);
            const res = await importRecordWithFiles(pbInstance, zip, 'comments', comment, {});
            processResult(comment, res, false);
            processedItems++;
            updateProgress(processedItems, totalItems, `کامنت بررسی شد (${processedItems}/${totalItems})`);
        }

        // ۶. نسخه‌های گزارش
        for (const version of report_versions) {
            updateProgress(processedItems, totalItems, `در حال بررسی نسخه گزارش (${processedItems + 1}/${totalItems})`);
            const res = await importRecordWithFiles(pbInstance, zip, 'report_versions', version, {});
            processResult(version, res, false);
            processedItems++;
            updateProgress(processedItems, totalItems, `نسخه گزارش بررسی شد (${processedItems}/${totalItems})`);
        }

        // محاسبه آمار گزارش‌های اصلی
        const repCreated = reportStats.created.size;
        const repUpdated = reportStats.updated.size;
        const repOther = reportStats.skipped.size + reportStats.failed.size;

        // محاسبه آمار آیتم‌های وابسته
        const otherCreated = otherStats.created.size;
        const otherUpdated = otherStats.updated.size;

        // نمایش گزارش دقیق تفکیک شده
        if (repCreated === 0 && repUpdated === 0 && otherCreated === 0 && otherUpdated === 0) {
            const msg = 'اطلاعات وارد شده تکراری بود و هیچ مطلب جدید یا تغییریافته‌ای در دیتابیس ثبت نشد.';
            updateProgress(totalItems, totalItems, `ℹ️ ${msg}`);
        } else {
            const msg = `عملیات ایمپورت انجام شد | گزارش‌های جدید: ${repCreated} | گزارش‌های بروزرسانی‌شده: ${repUpdated} (موارد وابسته: ${otherUpdated} بروزرسانی، ${otherCreated} جدید)`;
            updateProgress(totalItems, totalItems, `✅ ${msg}`);
        }

        // بازخوانی جدول گزارش‌ها در صورت وجود تابع مربوطه
        if (typeof loadReports === 'function') {
            loadReports();
        }

    } catch (error) {
        console.error('خطا در فرایند ایمپورت:', error);
        if (progressText) {
            progressText.innerText = '❌ خطا در ایمپورت: ' + error.message;
        }
    }
    
    finally {
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.innerHTML = originalBtnText;
        }
        fileInput.value = '';
    }
}

/**
 * تابع کمکی برای ثبت/بروزرسانی یک رکورد در PocketBase به همراه فایل‌های فیزیکی (Upsert)
 */
async function importRecordWithFiles(pbInstance, zip, collectionName, recordData, filePathsMap = {}) {
    const recordId = recordData.id;
    const collection = pbInstance.collection(collectionName);

    let existingRecord = null;
    if (recordId) {
        try {
            existingRecord = await collection.getOne(recordId);
        } catch (e) {
            existingRecord = null;
        }
    }

    const buildFormData = (isUpdate) => {
        const formData = new FormData();

        for (const [key, value] of Object.entries(recordData)) {
            // نادیده گرفتن فیلدهای فایل، سیستم و expand
            if (
                filePathsMap[key] ||
                key === 'id' ||
                key === 'created' ||
                key === 'updated' ||
                key === 'collectionId' ||
                key === 'collectionName' ||
                key === 'expand'
            ) {
                continue;
            }

            if (Array.isArray(value)) {
                value.forEach(item => formData.append(key, item));
            } else if (value !== null && typeof value === 'object') {
                formData.append(key, JSON.stringify(value));
            } else {
                // ارسال مقدار به صورت رشته (در صورت null یا undefined بودن، رشته خالی ارسال می‌شود تا خطای validation رخ ندهد)
                formData.append(key, value ?? '');
            }
        }

        return formData;
    };

    const attachFilesToFormData = async (formData) => {
        for (const [fieldName, zipPathOrPaths] of Object.entries(filePathsMap)) {
            if (Array.isArray(zipPathOrPaths)) {
                for (const path of zipPathOrPaths) {
                    const zipFile = zip.file(path);
                    if (zipFile) {
                        const blob = await zipFile.async("blob");
                        const fileName = path.split('/').pop();
                        formData.append(fieldName, blob, fileName);
                    }
                }
            } else if (zipPathOrPaths) {
                const zipFile = zip.file(zipPathOrPaths);
                if (zipFile) {
                    const blob = await zipFile.async("blob");
                    const fileName = zipPathOrPaths.split('/').pop();
                    formData.append(fieldName, blob, fileName);
                }
            }
        }
    };

    try {
        if (existingRecord) {
            // اگر رکورد وجود داشته باشد، بررسی می‌شود که آیا بروزرسانی لازم است یا خیر
            try {
                const updateData = buildFormData(true);
                await attachFilesToFormData(updateData);
                await collection.update(recordId, updateData);
                return { status: 'updated' };
            } catch (err) {
                // در صورت عدم اجازه بروزرسانی (مثلاً 404 یا 403 به خاطر API Rules)، رکورد موجود نادیده گرفته می‌شود
                return { status: 'skipped', error: err };
            }
        } else {
            const createData = buildFormData(false);
            await attachFilesToFormData(createData);
            await collection.create(createData);
            return { status: 'created' };
        }
    } catch (err) {
        console.warn(`[ایمپورت] عدم امکان ثبت/ویرایش رکورد در ${collectionName} (ID: ${recordId}):`, err?.data || err?.message || err);
        return { status: 'failed', error: err };
    }
}