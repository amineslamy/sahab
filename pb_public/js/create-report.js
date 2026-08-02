document.addEventListener('DOMContentLoaded', () => {
    const pb = new PocketBase(window.location.origin);

    // ۱. بررسی نشست کاربر
    if (!pb.authStore.isValid) {
        window.location.href = 'login.html';
        return;
    }

    const user = pb.authStore.record || {};

    // ۲. راه‌اندازی ادیتور پیشرفته Quill (آفلاین و راست‌چین)
    let quill;
    if (document.getElementById('editor-container')) {
        quill = new Quill('#editor-container', {
            theme: 'snow',
            placeholder: 'متن کامل گزارش، تحلیل یا ارزیابی را در این بخش وارد نمایید...',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'align': [] }],
                    ['link', 'blockquote', 'code-block'],
                    ['clean']
                ]
            }
        });

        // تنظیم جهت پیش‌فرض راست‌چین (RTL) برای ادیتور
        quill.format('align', 'right');
        quill.format('direction', 'rtl');
    }

    // ۳. بارگذاری موضوعات و کیس‌ها (در گام بعد کامل‌ترش می‌کنیم)
    async function loadSelectOptions() {
        try {
            const topicSelect = document.getElementById('report-topic');
            const caseSelect = document.getElementById('report-case');

            const topics = await pb.collection('topics').getFullList().catch(() => []);
            const cases = await pb.collection('cases').getFullList().catch(() => []);

            if (topicSelect) {
                topicSelect.innerHTML = '<option value="">انتخاب موضوع...</option>';
                topics.forEach(t => {
                    topicSelect.innerHTML += `<option value="${t.id}">${t.title || t.name || t.id}</option>`;
                });
            }

            if (caseSelect) {
                caseSelect.innerHTML = '<option value="">انتخاب کیس...</option>';
                cases.forEach(c => {
                    caseSelect.innerHTML += `<option value="${c.id}">${c.title || c.name || c.id}</option>`;
                });
            }
        } catch (err) {
            console.warn('خطا در دریافت لیست موضوعات یا کیس‌ها:', err);
        }
    }

    loadSelectOptions();

    // ۴. ارسال فرم و استخراج محتوای ادیتور
    const form = document.getElementById('create-report-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // دریافت محتوای HTML از ادیتور Quill
            const reportHTMLContent = quill ? quill.root.innerHTML : '';

            // اعتبارسنجی خالی نبودن متن
            if (!quill || quill.getText().trim().length === 0) {
                alert('لطفاً شرح متن گزارش را وارد کنید.');
                return;
            }

            const submitBtn = document.getElementById('submit-btn');
            if (submitBtn) {
                submitBtn.innerText = 'در حال پردازش و ذخیره‌سازی...';
                submitBtn.disabled = true;
            }

            try {
                const formData = new FormData();
                formData.append('title', document.getElementById('report-title').value);
                formData.append('automation_no', document.getElementById('report-automation-no').value);
                formData.append('classification_level', document.getElementById('report-classification').value);
                formData.append('content', reportHTMLContent); // ثبت متن فرمت‌شده
                
                if (user.id) {
                    formData.append('author', user.id);
                }

                const topicVal = document.getElementById('report-topic').value;
                if (topicVal) formData.append('topic', topicVal);

                const caseVal = document.getElementById('report-case').value;
                if (caseVal) formData.append('case', caseVal);

                // پیوست فایل‌ها
                const fileInput = document.getElementById('report-attachments');
                if (fileInput && fileInput.files) {
                    for (let file of fileInput.files) {
                        formData.append('attachments', file);
                    }
                }

                await pb.collection('reports').create(formData);

                alert('گزارش با موفقیت در سامانه ثبت گردید.');
                window.location.href = 'index.html';

            } catch (err) {
                console.error(err);
                alert('خطا در ثبت گزارش: ' + err.message);
                if (submitBtn) {
                    submitBtn.innerText = 'ثبت و ذخیره‌سازی نهایی';
                    submitBtn.disabled = false;
                }
            }
        });
    }
});