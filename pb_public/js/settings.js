// اسکریپت مدیریت تنظیمات سامانه (موضوعات و کیس‌ها)

document.addEventListener('DOMContentLoaded', async () => {
    // ۱. بررسی دسترسی (فقط مدیر کل و ادمین سایت)
    checkAccessPermission();

    // ۲. بارگذاری اولیه داده‌ها
    await loadTopics();
    await loadCases();
});

// تابع بررسی سطح دسترسی کاربر
function checkAccessPermission() {
    const activePb = window.pb || (typeof pb !== 'undefined' ? pb : null);
    const user = activePb?.authStore?.isValid ? activePb.authStore.model : null;
    const rawRole = user?.role_name || user?.role;

    if (rawRole !== 'admin_site' && rawRole !== 'admin_general') {
        Swal.fire({
            title: 'عدم دسترسی',
            text: 'شما دسترسی لازم برای ورود به این صفحه را ندارید.',
            icon: 'error',
            confirmButtonText: 'متوجه شدم'
        }).then(() => {
            window.location.href = 'index.html';
        });
    }
}

// سوئیچ بین تب‌های تنظیمات
function switchSettingsTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(tabId)?.classList.remove('hidden');
    if (tabId === 'tab-topics') {
        document.getElementById('btn-tab-topics')?.classList.add('active');
    } else if (tabId === 'tab-cases') {
        document.getElementById('btn-tab-cases')?.classList.add('active');
    }
}

// ==========================================
//              بخش مدیریت موضوعات
// ==========================================

async function loadTopics() {
    const tbody = document.getElementById('table-topics-body');
    const countEl = document.getElementById('topics-count');
    if (!tbody) return;

    try {
        const activePb = window.pb || pb;
        const records = await activePb.collection('topics').getFullList({
            sort: '-created'
        });

        if (countEl) countEl.textContent = `تعداد: ${records.length}`;

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-slate-400">هیچ موضوعی یافت نشد.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map((item, index) => `
            <tr class="hover:bg-slate-50">
                <td class="p-3 text-center font-bold text-slate-500">${index + 1}</td>
                <td class="p-3 font-bold text-slate-800">${escapeHtml(item.title)}</td>
                <td class="p-3 text-slate-500 text-xs" dir="ltr">${formatDate(item.created)}</td>
                <td class="p-3 text-center">
                    <button onclick="deleteTopic('${item.id}', '${escapeHtml(item.title)}')" 
                        class="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-bold transition">
                        حذف
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error('خطا در دریافت موضوعات:', err);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-red-500">خطا در دریافت داده‌ها</td></tr>`;
    }
}

async function handleAddTopic(e) {
    e.preventDefault();
    const input = document.getElementById('input-topic-title');
    const title = input?.value?.trim();

    if (!title) return;

    try {
        const activePb = window.pb || pb;
        await activePb.collection('topics').create({ title });

        input.value = '';
        Swal.fire({
            icon: 'success',
            title: 'موفق',
            text: 'موضوع با موفقیت ثبت شد.',
            timer: 1500,
            showConfirmButton: false
        });

        await loadTopics();
    } catch (err) {
        console.error('خطا در ثبت موضوع:', err);
        Swal.fire('خطا', 'مشکلی در ثبت موضوع رخ داد.', 'error');
    }
}

async function deleteTopic(id, title) {
    const confirm = await Swal.fire({
        title: 'تأیید حذف موضوع',
        text: `آیا از حذف موضوع «${title}» اطمینان دارید؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'بله، حذف شود',
        cancelButtonText: 'انصراف'
    });

    if (!confirm.isConfirmed) return;

    try {
        const activePb = window.pb || pb;
        await activePb.collection('topics').delete(id);

        Swal.fire({
            icon: 'success',
            title: 'حذف شد',
            text: 'موضوع مورد نظر با موفقیت حذف گردید.',
            timer: 1500,
            showConfirmButton: false
        });

        await loadTopics();
    } catch (err) {
        console.error('خطا در حذف موضوع:', err);
        Swal.fire('خطا', 'مشکلی در حذف موضوع رخ داد.', 'error');
    }
}

// ==========================================
//               بخش مدیریت کیس‌ها
// ==========================================

async function loadCases() {
    const tbody = document.getElementById('table-cases-body');
    const countEl = document.getElementById('cases-count');
    const parentSelect = document.getElementById('select-case-parent');
    if (!tbody) return;

    try {
        const activePb = window.pb || pb;
        const records = await activePb.collection('cases').getFullList({
            sort: '-created',
            expand: 'parent_case'
        });

        if (countEl) countEl.textContent = `تعداد: ${records.length}`;

        // آپدیت dropdown کیس‌های والد در فرم افزودن
        if (parentSelect) {
            parentSelect.innerHTML = '<option value="">بدون والد (کیس اصلی)</option>' +
                records.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');
        }

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-400">هیچ کیسی یافت نشد.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map((item, index) => {
            const parentTitle = item.expand?.parent_case?.title
                ? escapeHtml(item.expand.parent_case.title)
                : '<span class="text-slate-400">-</span>';

            return `
                <tr class="hover:bg-slate-50">
                    <td class="p-3 text-center font-bold text-slate-500">${index + 1}</td>
                    <td class="p-3 font-bold text-slate-800">${escapeHtml(item.title)}</td>
                    <td class="p-3 text-slate-600">${parentTitle}</td>
                    <td class="p-3 text-slate-500 text-xs" dir="ltr">${formatDate(item.created)}</td>
                    <td class="p-3 text-center">
                        <button onclick="deleteCase('${item.id}', '${escapeHtml(item.title)}')" 
                            class="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-bold transition">
                            حذف
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('خطا در دریافت کیس‌ها:', err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-red-500">خطا در دریافت داده‌ها</td></tr>`;
    }
}

async function handleAddCase(e) {
    e.preventDefault();
    const inputTitle = document.getElementById('input-case-title');
    const selectParent = document.getElementById('select-case-parent');

    const title = inputTitle?.value?.trim();
    const parent_case = selectParent?.value || null;

    if (!title) return;

    try {
        const activePb = window.pb || pb;
        const payload = { title };
        if (parent_case) payload.parent_case = parent_case;

        await activePb.collection('cases').create(payload);

        inputTitle.value = '';
        if (selectParent) selectParent.value = '';

        Swal.fire({
            icon: 'success',
            title: 'موفق',
            text: 'کیس با موفقیت ثبت شد.',
            timer: 1500,
            showConfirmButton: false
        });

        await loadCases();
    } catch (err) {
        console.error('خطا در ثبت کیس:', err);
        Swal.fire('خطا', 'مشکلی در ثبت کیس رخ داد.', 'error');
    }
}

async function deleteCase(id, title) {
    const confirm = await Swal.fire({
        title: 'تأیید حذف کیس',
        text: `آیا از حذف کیس «${title}» اطمینان دارید؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'بله، حذف شود',
        cancelButtonText: 'انصراف'
    });

    if (!confirm.isConfirmed) return;

    try {
        const activePb = window.pb || pb;
        await activePb.collection('cases').delete(id);

        Swal.fire({
            icon: 'success',
            title: 'حذف شد',
            text: 'کیس مورد نظر با موفقیت حذف گردید.',
            timer: 1500,
            showConfirmButton: false
        });

        await loadCases();
    } catch (err) {
        console.error('خطا در حذف کیس:', err);
        Swal.fire('خطا', 'مشکلی در حذف کیس رخ داد.', 'error');
    }
}

// توابع کمکی
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toISOString().replace('T', ' ').substring(0, 19);
    } catch (e) {
        return dateStr;
    }
}