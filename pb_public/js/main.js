document.addEventListener('DOMContentLoaded', () => {
    const pb = new PocketBase(window.location.origin);

    // ۱. بررسی نشست کاربر
    if (!pb.authStore.isValid) {
        window.location.href = 'login.html';
        return;
    }

    const user = pb.authStore.record || {};

    // ۲. نمایش اطلاعات کاربر
    const userNameElement = document.getElementById('user-name');
    const userRoleElement = document.getElementById('user-role');

    if (userNameElement) {
        userNameElement.innerText = user.name || user.username || user.email || 'کاربر سیستم';
    }
    if (userRoleElement) {
        userRoleElement.innerText = `نقش: ${user.role || 'تعریف نشده'}`;
    }

    // ۳. دکمه خروج
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            pb.authStore.clear();
            window.location.href = 'login.html';
        });
    }

    // ۴. عناصر مودال ثبت گزارش
    const modal = document.getElementById('report-modal');
    // تغییر رفتار دکمه ثبت گزارش در داشبورد
    const openBtn = document.getElementById('open-modal-btn');
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            window.location.href = 'create-report.html';
        });
    }
    const closeBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-modal-btn');

    function openModal() {
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            loadSelectOptions();
        }
    }

    function closeModal() {
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            const form = document.getElementById('new-report-form');
            if (form) form.reset();
        }
    }

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // ۵. دریافت موضوعات و کیس‌ها
    async function loadSelectOptions() {
        try {
            const topicSelect = document.getElementById('report-topic');
            const caseSelect = document.getElementById('report-case');

            const topics = await pb.collection('topics').getFullList().catch(() => []);
            const cases = await pb.collection('cases').getFullList().catch(() => []);

            if (topicSelect) {
                topicSelect.innerHTML = '<option value="">انتخاب کنید...</option>';
                topics.forEach(t => {
                    topicSelect.innerHTML += `<option value="${t.id}">${t.title || t.name || t.id}</option>`;
                });
            }

            if (caseSelect) {
                caseSelect.innerHTML = '<option value="">انتخاب کنید...</option>';
                cases.forEach(c => {
                    caseSelect.innerHTML += `<option value="${c.id}">${c.title || c.name || c.id}</option>`;
                });
            }
        } catch (err) {
            console.warn('عدم امکان دریافت موضوعات/کیس‌ها:', err);
        }
    }

    // ۶. ثبت گزارش جدید
    const form = document.getElementById('new-report-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('submit-btn');
            if (submitBtn) {
                submitBtn.innerText = 'در حال ذخیره‌سازی...';
                submitBtn.disabled = true;
            }

            try {
                const formData = new FormData();
                formData.append('title', document.getElementById('report-title').value);
                formData.append('automation_no', document.getElementById('report-automation-no').value);
                formData.append('classification_level', document.getElementById('report-classification').value);
                formData.append('content', document.getElementById('report-content').value);
                if (user.id) formData.append('author', user.id);

                const topicVal = document.getElementById('report-topic').value;
                if (topicVal) formData.append('topic', topicVal);

                const caseVal = document.getElementById('report-case').value;
                if (caseVal) formData.append('case', caseVal);

                const fileInput = document.getElementById('report-attachments');
                if (fileInput && fileInput.files) {
                    for (let file of fileInput.files) {
                        formData.append('attachments', file);
                    }
                }

                await pb.collection('reports').create(formData);

                alert('گزارش با موفقیت ثبت گردید.');
                closeModal();
                loadReports();

            } catch (err) {
                console.error(err);
                alert('خطا در ثبت گزارش: ' + err.message);
            } finally {
                if (submitBtn) {
                    submitBtn.innerText = 'ثبت و ذخیره‌سازی';
                    submitBtn.disabled = false;
                }
            }
        });
    }

    // ۷. دریافت لیست گزارش‌ها
    async function loadReports() {
        const container = document.getElementById('reports-container');
        if (!container) return;

        try {
            const records = await pb.collection('reports').getFullList({
                sort: '-created'
            });

            const countElem = document.getElementById('reports-count');
            if (countElem) countElem.innerText = `${records.length} مورد`;

            if (records.length === 0) {
                container.innerHTML = `
                    <div class="py-12">
                        <p class="text-slate-400 text-lg mb-2">هنوز هیچ گزارشی ثبت نشده است.</p>
                        <p class="text-xs text-slate-400">با دکمه «ثبت گزارش جدید» اولین داده را وارد کنید.</p>
                    </div>
                `;
                return;
            }

            let html = '<div class="divide-y divide-slate-100 text-right">';
            records.forEach(rec => {
                const classificationVal = rec.classification || rec.classification_level || 'عادی';
                const badgeColor = classificationVal === 'سری' || classificationVal === 'secret' ? 'bg-red-100 text-red-700' :
                    classificationVal === 'محرمانه' || classificationVal === 'confidential' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700';

                const automationId = rec.automation_id || rec.automation_no || '---';

                html += `
                    <div class="p-4 hover:bg-slate-50 flex justify-between items-center transition">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <a href="create-report.html?id=${rec.id}" class="font-bold text-slate-800 hover:text-indigo-600 text-base transition duration-150 underline-offset-4 hover:underline">
                                    ${rec.title || 'بدون عنوان'}
                                </a>
                                <span class="text-[10px] px-2 py-0.5 rounded ${badgeColor}">${classificationVal}</span>
                            </div>
                            <div class="text-xs text-slate-500 space-x-3 space-x-reverse">
                                <span>شماره اتوماسیون: ${automationId}</span> | 
                                <span>تاریخ ایجاد: ${new Date(rec.created).toLocaleDateString('fa-IR')}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;

        } catch (err) {
            console.error(err);
            container.innerHTML = `<p class="text-red-500">خطا در دریافت اطلاعات: ${err.message}</p>`;
        }
    }

    // اجرا برای اولین بار
    loadReports();
});