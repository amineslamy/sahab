let pb;
let allReports = [];
let allTopics = [];
let allCases = [];
let allUsers = [];
let chartInstances = {};
let currentPage = 1;
let perPage = 100;
let currentFilterQuery = "";

window.selectedReportIds = new Set();
const selectedReportIds = window.selectedReportIds;

function toggleReportSelection(id, isChecked) {
    if (isChecked) {
        selectedReportIds.add(id);
    } else {
        selectedReportIds.delete(id);
    }
    updateSelectionUI();
}

function toggleSelectAllPage(isChecked) {
    const checkboxes = document.querySelectorAll('.report-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        if (isChecked) {
            selectedReportIds.add(cb.value);
        } else {
            selectedReportIds.delete(cb.value);
        }
    });
    updateSelectionUI();
}

function clearSelection() {
    selectedReportIds.clear();
    const selectAllCb = document.getElementById('select-all-page');
    if (selectAllCb) selectAllCb.checked = false;

    document.querySelectorAll('.report-checkbox').forEach(cb => {
        cb.checked = false;
    });
    updateSelectionUI();
}
function exportZip() {
    const ids = Array.from(selectedReportIds);
    if (ids.length === 0) return;
    console.log("درخواست خروجی Zip برای شناسه ها:", ids);
    // منطق اتصال به API خروجی Zip اینجا قرار می‌گیرد
}

function exportBulletin() {
    const ids = Array.from(selectedReportIds);
    if (ids.length === 0) return;
    console.log("درخواست خروجی بولتن برای شناسه ها:", ids);
    // منطق اتصال به API خروجی بولتن اینجا قرار می‌گیرد
}

async function deleteReport(id) {
    const confirmResult = await Swal.fire({
        title: 'آیا اطمینان دارید؟',
        text: 'این گزارش و کامنت‌های آن به سطل آشغال منتقل و حذف خواهند شد.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'بله، حذف شود',
        cancelButtonText: 'انصراف'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        // ۱. دریافت اطلاعات کامل گزارش فعلی
        const reportData = await pb.collection('reports').getOne(id, { requestKey: null });

        // ۲. دریافت تمام کامنت‌ها و نسخه‌های مرتبط با این گزارش
        const [relatedComments, relatedVersions] = await Promise.all([
            pb.collection('comments').getFullList({
                filter: `report ~ "${id}" || report = "${id}"`,
                requestKey: null
            }),
            pb.collection('report_versions').getFullList({
                filter: `report = "${id}"`,
                requestKey: null
            })
        ]);

        // ۳. ارسال داده‌های گزارش، کامنت‌ها و نسخه‌ها به کالکشن سطل آشغال (trash_reports)
        const currentUser = pb.authStore.model;
        await pb.collection('trash_reports').create({
            original_id: id,
            report_data: reportData,
            comments_data: relatedComments,
            versions_data: relatedVersions,
            deleted_by: currentUser ? currentUser.id : null
        }, { requestKey: null });

        // ۴. حذف تمامی کامنت‌ها و نسخه‌های پیدا شده از کالکشن‌های اصلی
        for (const comment of relatedComments) {
            await pb.collection('comments').delete(comment.id, { requestKey: null });
        }
        for (const version of relatedVersions) {
            await pb.collection('report_versions').delete(version.id, { requestKey: null });
        }

        // ۵. حذف خودِ گزارش از کالکشن اصلی
        await pb.collection('reports').delete(id, { requestKey: null });

        selectedReportIds.delete(id);
        loadReportsTable();

        Swal.fire({
            title: 'موفقیت‌آمیز',
            text: 'گزارش و کامنت‌های مربوطه با موفقیت به سطل آشغال منتقل و پاک شدند.',
            icon: 'success',
            confirmButtonText: 'تایید',
            confirmButtonColor: '#4f46e5'
        });
    } catch (err) {
        console.error("خطا در فرآیند انتقال به سطل آشغال و حذف گزارش:", err);

        const status = err?.status || 0;
        const msg = err?.message || "";

        let errorTitle = "خطا در عملیات";
        let errorText = msg || 'خطایی رخ داده است.';

        if (status === 400 && msg.includes("required relation reference")) {
            errorTitle = "عدم امکان حذف";
            errorText = "کامنت‌ها یا وابستگی‌های اجباری این گزارش پاک نشده‌اند و دیتابیس اجازه حذف نمی‌دهد.";
        } else if (status === 403) {
            errorTitle = "عدم داشتن دسترسی";
            errorText = "شما مجوز لازم روی کالکشن سطل آشغال، کامنت‌ها یا گزارش‌ها را ندارید (API Rules را بررسی کنید).";
        } else if (status === 404) {
            errorTitle = "یافت نشد";
            errorText = "گزارش یا کامنت مورد نظر یافت نشد.";
        } else if (status === 0 || msg.includes("Failed to fetch")) {
            errorTitle = "خطای ارتباط با سرور";
            errorText = "اتصال به سرور برقرار نیست.";
        }

        Swal.fire({
            title: errorTitle,
            text: errorText,
            icon: 'error',
            confirmButtonText: 'متوجه شدم',
            confirmButtonColor: '#4f46e5'
        });
    }
}
function updateSelectionUI() {
    const selectionBar = document.getElementById('selection-bar');
    const countSpan = document.getElementById('selected-count');
    const count = selectedReportIds.size;

    if (count > 0) {
        if (selectionBar) selectionBar.classList.remove('hidden');
        if (countSpan) countSpan.innerText = count;
    } else {
        if (selectionBar) selectionBar.classList.add('hidden');
    }

    // به‌روزرسانی وضعیت چک‌باکس «انتخاب همه صفحه»
    const currentPageCheckboxes = Array.from(document.querySelectorAll('.report-checkbox'));
    const selectAllCb = document.getElementById('select-all-page');
    if (selectAllCb && currentPageCheckboxes.length > 0) {
        selectAllCb.checked = currentPageCheckboxes.every(cb => selectedReportIds.has(cb.value));
    }
}

// تابع کمکی برای ساخت فیلتر بر اساس نقش کاربر
function getRoleBasedFilter() {
    const user = pb.authStore.model;
    if (!user) return "id = ''"; // در صورت عدم وجود کاربر، هیچ داده‌ای برنگردد

    const role = user.role;

    // ادمین‌ها و مدیر کل به همه گزارش‌ها دسترسی دارند
    if (role === 'admin_site' || role === 'admin_general') {
        return "";
    }

    // اداره: گزارش‌های خودش + اخبار کارشناسان زیرمجموعه‌اش
    if (role === 'department') {
        return `(author = "${user.id}" || author.department_rel = "${user.id}")`;
    }

    // کارشناس: فقط گزارش‌های خودش
    if (role === 'expert') {
        return `author = "${user.id}"`;
    }

    // نقش پیش‌فرض/ناشناخته
    return `author = "${user.id}"`;
}
const chartFont = 'Vazirmatn, sans-serif';
function setupApexDefaults() {
    if (window.ApexCharts && window.Apex) {
        window.Apex = {
            chart: { fontFamily: chartFont },
            dataLabels: { style: { fontFamily: chartFont, fontWeight: 'bold' } },
            tooltip: { style: { fontFamily: chartFont } },
            xaxis: { labels: { style: { fontFamily: chartFont } } },
            yaxis: { labels: { style: { fontFamily: chartFont } } },
            legend: { fontFamily: chartFont }
        };
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    pb = new PocketBase(window.location.origin);

    if (!pb.authStore.isValid) {
        window.location.href = 'login.html';
        return;
    }

    // بروزرسانی هدر پس از مقداردهی کامل pb و تایید لاگین
    if (typeof window.renderGlobalHeader === 'function') {
        window.renderGlobalHeader();
    }

    setupApexDefaults();
    await loadAllBaseData();
    renderOverviewCharts();
    renderAnalyticsCharts();
    loadReportsTable();
    populateSearchDropdowns();

    // راه‌اندازی تقویم شمسی با تنظیم پیش‌فرض ۳۰ روز گذشته
    if (window.$ && $.fn.persianDatepicker && window.persianDate) {
        // تابع کمکی برای استخراج تاریخ میلادی بدون تغییر منطقه زمانی (Timezone Shift)
        const formatLocalDateToIso = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const pdTo = new persianDate(); // تاریخ امروز (شمسی)
        const pdFrom = new persianDate().subtract('days', 30); // ۳۰ روز قبل (شمسی)

        // ۱. استخراج تاریخ ISO میلادی محلی جهت فیلتر نمودارها
        const isoTo = formatLocalDateToIso(pdTo.toDate());
        const isoFrom = formatLocalDateToIso(pdFrom.toDate());

        const $dateFrom = $('#filter-date-from');
        const $dateTo = $('#filter-date-to');

        // ۲. ذخیره مقادیر اولیه ISO در ویژگی data
        $dateFrom.data('iso', isoFrom);
        $dateTo.data('iso', isoTo);

        // ۳. راه‌اندازی دیت‌پیکر «از»
        $dateFrom.persianDatepicker({
            format: 'YYYY/MM/DD',
            autoClose: true,
            initialValue: false,
            onSelect: function (unix) {
                const pd = new persianDate(unix);
                const isoDate = formatLocalDateToIso(pd.toDate());
                $dateFrom.data('iso', isoDate);
            }
        });
        // مقداردهی ظاهری فیلد «از» با فرمت شمسی
        $dateFrom.val(pdFrom.format('YYYY/MM/DD'));

        // ۴. راه‌اندازی دیت‌پیکر «تا»
        $dateTo.persianDatepicker({
            format: 'YYYY/MM/DD',
            autoClose: true,
            initialValue: false,
            onSelect: function (unix) {
                const pd = new persianDate(unix);
                const isoDate = formatLocalDateToIso(pd.toDate());
                $dateTo.data('iso', isoDate);
            }
        });
        // مقداردهی ظاهری فیلد «تا» با فرمت شمسی
        $dateTo.val(pdTo.format('YYYY/MM/DD'));

        // ۵. اعمال فیلتر بر روی نمودارها بر اساس بازه اولیه ۳۰ روزه
        applyAnalyticsDateFilter();
    }
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(tabId).classList.remove('hidden');
    document.getElementById('btn-' + tabId).classList.add('active');

    window.dispatchEvent(new Event('resize'));
}

function formatDateToFa(dateStr) {
    if (!dateStr) return '---';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fa-IR');
    } catch {
        return dateStr;
    }
}

async function loadAllBaseData() {
    try {
        const roleFilter = getRoleBasedFilter();
        const [reports, topics, cases, users] = await Promise.all([
            pb.collection('reports').getFullList({
                sort: '-created',
                expand: 'cases_rel,topics_rel,author.department_rel,department,submitter',
                filter: roleFilter,
                requestKey: null
            }),
            pb.collection('topics').getFullList({ requestKey: null }),
            pb.collection('cases').getFullList({ requestKey: null }),
            pb.collection('users').getFullList({ requestKey: null })
        ]);

        allReports = reports;
        allTopics = topics;
        allCases = cases;
        allUsers = users;

        // استخراج کیس‌های منحصر‌به‌فرد از روی اخبار قابل دسترسی کاربر
        const activeUserCases = new Set();
        allReports.forEach(r => {
            const cases = r.expand?.cases_rel || [];
            cases.forEach(c => activeUserCases.add(c.id));
        });

        const statTotal = document.getElementById('stat-total-reports-1');
        const statCases = document.getElementById('stat-active-cases');
        if (statTotal) statTotal.innerText = allReports.length;
        if (statCases) statCases.innerText = activeUserCases.size;

    } catch (err) {
        console.error("خطا در بارگذاری اطلاعات پایه دیتابیس:", err);
    }
}

// ------------------- جدول و Pagination -------------------
function changePerPage(val) {
    perPage = parseInt(val);
    currentPage = 1;
    loadReportsTable();
}

async function loadReportsTable() {
    const tbody = document.getElementById('table-reports-body');
    if (!tbody) return;

    try {
        const roleFilter = getRoleBasedFilter();
        let finalFilter = roleFilter;

        if (currentFilterQuery) {
            finalFilter = roleFilter ? `(${roleFilter}) && (${currentFilterQuery})` : currentFilterQuery;
        }

        const result = await pb.collection('reports').getList(currentPage, perPage, {
            sort: '-created',
            expand: 'cases_rel,topics_rel,author.department_rel,department,submitter',
            filter: finalFilter
        });

        if (result.items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-slate-500 font-bold">هیچ گزارشی یافت نشد.</td></tr>`;
            document.getElementById('pagination-info').innerText = 'صفحه ۰ از ۰';
            document.getElementById('pagination-controls').innerHTML = '';
            return;
        }

        let html = '';
        result.items.forEach((rec, index) => {
            const exp = rec.expand || {};

            // موضوعات و کیس‌ها در قالب Badgeهای رنگی
            const topicsHtml = exp.topics_rel && exp.topics_rel.length > 0
                ? exp.topics_rel.map(t => `<span class="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-100">${t.title}</span>`).join(' ')
                : '<span class="text-slate-400">---</span>';

            const casesHtml = exp.cases_rel && exp.cases_rel.length > 0
                ? exp.cases_rel.map(c => `<span class="bg-purple-50 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-purple-100">${c.title}</span>`).join(' ')
                : '<span class="text-slate-400">---</span>';

            const authorName = exp.author ? (exp.author.name || exp.author.username || '---') : '---';
            const deptObj = exp.author?.expand?.department_rel;
            const deptName = deptObj ? (deptObj.name || deptObj.username || '---') : '---';
            const submitterName = exp.submitter ? (exp.submitter.name || exp.submitter.username || '---') : '---';

            const hasCover = !!rec.cover_image;
            const hasAttachments = Array.isArray(rec.attachments) && rec.attachments.length > 0;

            const coverIcon = hasCover ? `<span title="دارای تصویر شاخص">🖼️</span>` : '';
            const attachmentIcon = hasAttachments ? `<span title="دارای فایل پیوست (${rec.attachments.length} مورد)">📎</span>` : '';
            const mediaIcons = (hasCover || hasAttachments) ? `<span class="inline-flex gap-1 text-[11px]">${coverIcon}${attachmentIcon}</span>` : '';

            // استایل طبقه‌بندی
            let classBadgeClass = 'bg-slate-100 text-slate-700';
            if (rec.classification === 'محرمانه') classBadgeClass = 'bg-amber-100 text-amber-800 border border-amber-200';
            else if (rec.classification === 'خیلی محرمانه') classBadgeClass = 'bg-orange-100 text-orange-800 border border-orange-200';
            else if (rec.classification === 'سری' || rec.classification === 'به کلی سری') classBadgeClass = 'bg-red-100 text-red-800 border border-red-200';

            // استایل اولویت
            let prioBadgeClass = 'bg-slate-100 text-slate-600';
            if (rec.priority === 'فوری') prioBadgeClass = 'bg-amber-50 text-amber-700 border border-amber-200';
            else if (rec.priority === 'آنی') prioBadgeClass = 'bg-red-50 text-red-700 font-black border border-red-200';

            const isEven = index % 2 === 0;
            const bgRow = isEven ? 'bg-white' : 'bg-slate-50/70';
            const isChecked = selectedReportIds.has(rec.id) ? 'checked' : '';

            html += `
                <tr class="${bgRow} hover:bg-indigo-50/40 transition-colors">
                    <!-- ۱. چک‌باکس انتخاب -->
                    <td class="p-2.5 text-center align-middle">
                        <input type="checkbox" value="${rec.id}" ${isChecked} onchange="toggleReportSelection('${rec.id}', this.checked)" class="report-checkbox rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                    </td>

                    <!-- ۲. عنوان خبر و شناسه -->
                    <td class="p-2.5 align-middle">
                        <div class="flex items-center gap-1.5 font-bold text-slate-900">
                            <span class="truncate max-w-[280px]" title="${rec.title || 'بدون عنوان'}">${rec.title || 'بدون عنوان'}</span>
                            ${mediaIcons}
                        </div>
                        <div class="text-[10px] text-slate-400 font-mono mt-0.5">
                            اتوماسیون: <span class="text-slate-600 font-semibold">${rec.automation_id || '---'}</span>
                        </div>
                    </td>

                    <!-- ۳. موضوعات و کیس‌ها -->
                    <td class="p-2.5 align-middle">
                        <div class="flex flex-col gap-1 max-w-[220px]">
                            <div class="flex flex-wrap gap-1">${topicsHtml}</div>
                            <div class="flex flex-wrap gap-1">${casesHtml}</div>
                        </div>
                    </td>

                    <!-- ۴. نویسنده، اداره و ثبت‌کننده -->
                    <td class="p-2.5 align-middle">
                        <div class="font-bold text-slate-800">${authorName}</div>
                        <div class="text-[10px] text-slate-500">${deptName}</div>
                        <div class="text-[10px] text-indigo-600 mt-0.5">ثبت: <span class="font-medium text-slate-600">${submitterName}</span></div>
                    </td>

                    <!-- ۵. تاریخ‌ها (وقوع، انتشار، به‌روزرسانی) -->
                    <td class="p-2.5 align-middle text-[10px] leading-tight space-y-0.5">
                        <div class="text-slate-700">وقوع: <strong class="text-slate-900">${formatDateToFa(rec.occurrence_date)}</strong></div>
                        <div class="text-slate-500">انتشار: ${formatDateToFa(rec.created)}</div>
                        <div class="text-slate-400">به‌روزرسانی: ${formatDateToFa(rec.updated)}</div>
                    </td>

                    <!-- ۶. وضعیت / طبقه‌بندی / اولویت -->
                    <td class="p-2.5 align-middle">
                        <div class="flex flex-wrap gap-1">
                            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${classBadgeClass}">${rec.classification || 'عادی'}</span>
                            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${prioBadgeClass}">${rec.priority || 'عادی'}</span>
                        </div>
                    </td>

                    <!-- ۷. عملیات -->
                    <td class="p-2.5 text-center align-middle">
                        <div class="flex items-center justify-center gap-1">
                            <button onclick="openDetailModal('${rec.id}')" title="مشاهده جزئیات" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition">
                                🔍
                            </button>
                            <a href="create-report.html?id=${rec.id}" title="ویرایش" class="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition">
                                ✏️
                            </a>
                            <button onclick="deleteReport('${rec.id}')" title="حذف" class="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition">
                                ❌
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        updateSelectionUI();

        // به‌روزرسانی Pagination
        document.getElementById('pagination-info').innerText = `صفحه ${result.page} از ${result.totalPages} (مجموع ${result.totalItems} گزارش)`;
        let pageBtns = '';
        pageBtns += `<button onclick="goToPage(${result.page - 1})" ${result.page === 1 ? 'disabled' : ''} class="px-3 py-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-50">قبلی</button>`;
        pageBtns += `<span class="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-black">${result.page}</span>`;
        pageBtns += `<button onclick="goToPage(${result.page + 1})" ${result.page === result.totalPages ? 'disabled' : ''} class="px-3 py-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-50">بعدی</button>`;
        document.getElementById('pagination-controls').innerHTML = pageBtns;

    } catch (err) {
        console.error("خطا در لود جدول:", err);
    }
}
function goToPage(page) {
    if (page < 1) return;
    currentPage = page;
    loadReportsTable();
}

// ------------------- نمودارها -------------------
function renderChart(elementSelector, options) {
    if (typeof ApexCharts === 'undefined') {
        // اگر هنوز آماده نیست، پس از ۱۰۰ میلی‌ثانیه دوباره تلاش کن
        setTimeout(() => renderChart(elementSelector, options), 100);
        return;
    }
    const el = document.querySelector(elementSelector);
    if (!el) return;

    if (chartInstances[elementSelector]) {
        chartInstances[elementSelector].destroy();
    }
    const chart = new ApexCharts(el, options);
    chart.render();
    chartInstances[elementSelector] = chart;
}

// پالت رنگی گسترده (۱۵ رنگ هماهنگ و متمایز)
const extendedPalette = [
    '#10b981', '#6366f1', '#ec4899', '#f59e0b', '#06b6d4',
    '#8b5cf6', '#f97316', '#14b8a6', '#eab308', '#ef4444',
    '#3b82f6', '#a855f7', '#84cc16', '#d97706', '#64748b'
];

function renderOverviewCharts() {
    // ۱. نمودار موضوعات
    const topicCounts = {};
    allReports.forEach(r => {
        const topics = r.expand?.topics_rel || [];
        topics.forEach(t => {
            topicCounts[t.title] = (topicCounts[t.title] || 0) + 1;
        });
    });
    renderChart("#chart-topics", {
        series: Object.values(topicCounts).length ? Object.values(topicCounts) : [1],
        labels: Object.keys(topicCounts).length ? Object.keys(topicCounts) : ['بدون داده'],
        chart: { type: 'donut', height: 260 },
        colors: extendedPalette
    });

    // ۲. نمودار کیس‌ها
    const caseCounts = {};
    allReports.forEach(r => {
        const cases = r.expand?.cases_rel || [];
        cases.forEach(c => {
            caseCounts[c.title] = (caseCounts[c.title] || 0) + 1;
        });
    });
    renderChart("#chart-cases", {
        series: Object.values(caseCounts).length ? Object.values(caseCounts) : [1],
        labels: Object.keys(caseCounts).length ? Object.keys(caseCounts) : ['بدون داده'],
        chart: { type: 'donut', height: 260 },
        colors: extendedPalette
    });
}

// تابع کمکی تبدیل تاریخ میلادی (YYYY-MM-DD یا ISO) به فرمت شمسی کوتاه (YY/MM/DD)
function convertIsoToFaShort(dateStr) {
    if (!dateStr || dateStr === 'نامشخص') return 'نامشخص';
    try {
        const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
        if (window.persianDate) {
            const parts = cleanDate.split('-');
            if (parts.length === 3) {
                // ساخت شیء تاریخ استاندارد JS از روی ورودی میلادی
                const gDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                // تبدیل صحیح تاریخ میلادی به شمسی
                const pd = new window.persianDate(gDate);
                return pd.format('YY/MM/DD');
            }
        }
        const d = new Date(cleanDate);
        return d.toLocaleDateString('fa-IR');
    } catch {
        return dateStr;
    }
}

function renderAnalyticsCharts(reportsData = allReports) {
    // ۱. روند زمانی انتشار (تجمیع بر اساس روز + تبدیل به تاریخ شمسی کوتاه)
    const datesMap = {};
    reportsData.forEach(r => {
        if (r.created) {
            const rawDay = r.created.includes('T') ? r.created.split('T')[0] : r.created.split(' ')[0];
            datesMap[rawDay] = (datesMap[rawDay] || 0) + 1;
        }
    });

    const sortedRawDates = Object.keys(datesMap).sort();
    const timelineCategories = sortedRawDates.map(d => convertIsoToFaShort(d));
    const timelineValues = sortedRawDates.map(d => datesMap[d]);

    renderChart("#chart-timeline", {
        series: [{ name: 'تعداد اخبار', data: timelineValues }],
        chart: {
            type: 'area',
            height: 260,
            toolbar: { show: false },
            zoom: { enabled: false }
        },
        stroke: { curve: 'smooth', width: 3 },
        colors: ['#06b6d4'],
        fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
        xaxis: { categories: timelineCategories }
    });

    // عملکرد کاربران
    const userMap = {};
    reportsData.forEach(r => {
        const name = r.expand?.author?.name || r.expand?.author?.username || 'ناشناس';
        userMap[name] = (userMap[name] || 0) + 1;
    });
    renderChart("#chart-user-performance", {
        series: [{ name: 'تعداد اخبار منتشر شده', data: Object.values(userMap) }],
        chart: { type: 'bar', height: 320, toolbar: { show: false } },
        plotOptions: { bar: { borderRadius: 6, columnWidth: '40%' } },
        colors: ['#4f46e5'],
        xaxis: { categories: Object.keys(userMap) }
    });

    // تفکیک اداره
    const deptMap = {};
    reportsData.forEach(r => {
        const deptObj = r.expand?.author?.expand?.department_rel;
        const dName = deptObj ? (deptObj.name || deptObj.username || 'تعریف‌نشده') : 'تعریف‌نشده';
        deptMap[dName] = (deptMap[dName] || 0) + 1;
    });
    renderChart("#chart-department", {
        series: [{ name: 'تعداد اخبار به تفکیک اداره', data: Object.values(deptMap) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        plotOptions: { bar: { borderRadius: 5, horizontal: true } },
        colors: ['#3b82f6'],
        xaxis: { categories: Object.keys(deptMap) }
    });

    // چکیده
    let hasSummary = 0, noSummary = 0;
    reportsData.forEach(r => { (r.abstract && r.abstract.trim() !== '') ? hasSummary++ : noSummary++; });
    renderChart("#chart-has-summary", {
        series: [hasSummary, noSummary],
        labels: ['دارای چکیده', 'بدون چکیده'],
        chart: { type: 'donut', height: 250 },
        colors: ['#10b981', '#94a3b8']
    });

    // تصویر پیوست
    let hasImg = 0, noImg = 0;
    reportsData.forEach(r => { r.cover_image ? hasImg++ : noImg++; });
    renderChart("#chart-has-image", {
        series: [hasImg, noImg],
        labels: ['دارای تصویر', 'بدون تصویر'],
        chart: { type: 'donut', height: 250 },
        colors: ['#f59e0b', '#94a3b8']
    });

    // کیس‌ها
    const caseMap = {};
    reportsData.forEach(r => {
        (r.expand?.cases_rel || []).forEach(c => { caseMap[c.title] = (caseMap[c.title] || 0) + 1; });
    });
    renderChart("#chart-analytics-cases", {
        series: Object.values(caseMap).length ? Object.values(caseMap) : [1],
        labels: Object.keys(caseMap).length ? Object.keys(caseMap) : ['بدون کیس'],
        chart: { type: 'donut', height: 250 },
        colors: ['#8b5cf6', '#06b6d4', '#a855f7', '#6366f1', '#ec4899', '#f59e0b',
            '#f97316', '#14b8a6', '#eab308', '#ef4444',
            '#3b82f6', '#84cc16', '#d97706', '#64748b']
    });

    // موضوعات
    const topicMap = {};
    reportsData.forEach(r => {
        (r.expand?.topics_rel || []).forEach(t => { topicMap[t.title] = (topicMap[t.title] || 0) + 1; });
    });
    renderChart("#chart-analytics-topics", {
        series: Object.values(topicMap).length ? Object.values(topicMap) : [1],
        labels: Object.keys(topicMap).length ? Object.keys(topicMap) : ['بدون موضوع'],
        chart: { type: 'donut', height: 250 },
        colors: ['#6366f1', '#10b981', '#ec4899', '#f59e0b', '#06b6d4',
            '#8b5cf6', '#f97316', '#14b8a6', '#eab308', '#ef4444',
            '#3b82f6', '#a855f7', '#84cc16', '#d97706', '#64748b']
    });

    // ثبت کننده
    const submitterMap = {};
    reportsData.forEach(r => {
        const sName = r.expand?.submitter?.name || r.expand?.submitter?.username || 'سیستم';
        submitterMap[sName] = (submitterMap[sName] || 0) + 1;
    });
    renderChart("#chart-analytics-creators", {
        series: [{ name: 'تعداد ثبت', data: Object.values(submitterMap) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        plotOptions: { bar: { borderRadius: 5, columnWidth: '40%' } },
        colors: ['#06b6d4'],
        xaxis: { categories: Object.keys(submitterMap) }
    });

    // طبقه‌بندی
    const classMap = {};
    reportsData.forEach(r => { const c = r.classification || 'تعریف‌نشده'; classMap[c] = (classMap[c] || 0) + 1; });
    renderChart("#chart-classification", {
        series: Object.values(classMap),
        labels: Object.keys(classMap),
        chart: { type: 'donut', height: 250 },
        colors: ['#10b981', '#8b5cf6', '#3b82f6', '#f97316', '#ec4899', '#cde73a']
    });

    // اولویت
    const prioMap = {};
    reportsData.forEach(r => { const p = r.priority || 'تعریف‌نشده'; prioMap[p] = (prioMap[p] || 0) + 1; });
    renderChart("#chart-priority", {
        series: Object.values(prioMap),
        labels: Object.keys(prioMap),
        chart: { type: 'donut', height: 250 },
        colors: ['#3b82f6', '#f59e0b', '#ef4444', '#de48ec']
    });

    // نوع خبر
    const typeMap = {};
    reportsData.forEach(r => { const t = r.news_type || 'تعریف‌نشده'; typeMap[t] = (typeMap[t] || 0) + 1; });
    renderChart("#chart-news-type", {
        series: Object.values(typeMap),
        labels: Object.keys(typeMap),
        chart: { type: 'donut', height: 250 },
        colors: ['#14b8a6', '#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#64748b']
    });

    // ارزیابی
    const evalMap = {};
    reportsData.forEach(r => { const e = r.evaluation || 'تعریف‌نشده'; evalMap[e] = (evalMap[e] || 0) + 1; });
    renderChart("#chart-evaluation", {
        series: Object.values(evalMap),
        labels: Object.keys(evalMap),
        chart: { type: 'donut', height: 250 },
        colors: ['#10b981', '#f59e0b', '#3b82f6', '#f43f5e', '#bb48ec']
    });

    // ۲. روند زمانی تاریخ وقوع (تجمیع بر اساس روز + تبدیل به تاریخ شمسی کوتاه)
    const occMap = {};
    reportsData.forEach(r => {
        if (r.occurrence_date) {
            const rawDay = r.occurrence_date.includes('T') ? r.occurrence_date.split('T')[0] : r.occurrence_date.split(' ')[0];
            occMap[rawDay] = (occMap[rawDay] || 0) + 1;
        }
    });

    const sortedRawOcc = Object.keys(occMap).sort();
    const occCategories = sortedRawOcc.map(d => convertIsoToFaShort(d));
    const occValues = sortedRawOcc.map(d => occMap[d]);

    renderChart("#chart-occurrence-timeline", {
        series: [{ name: 'تعداد اخبار (تاریخ وقوع)', data: occValues }],
        chart: {
            type: 'area',
            height: 260,
            toolbar: { show: false },
            zoom: { enabled: false }
        },
        stroke: { curve: 'smooth', width: 3 },
        colors: ['#0284c7'],
        fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
        xaxis: { categories: occCategories }
    });
}

function applyAnalyticsDateFilter() {
    const $fromInput = $('#filter-date-from');
    const $toInput = $('#filter-date-to');

    const fromVal = $fromInput.val() ? $fromInput.val().trim() : '';
    const toVal = $toInput.val() ? $toInput.val().trim() : '';

    let fromStr = $fromInput.data('iso');
    let toStr = $toInput.data('iso');

    // اگر مقدار iso وجود نداشت، سعی می‌کنیم از روی متن ورودی شمسی تبدیل کنیم
    if (!fromStr && fromVal && window.persianDate) {
        try {
            const p = fromVal.split('/');
            if (p.length === 3) {
                const pd = new persianDate([parseInt(p[0]), parseInt(p[1]), parseInt(p[2])]);
                const d = pd.toDate();
                fromStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
        } catch (e) { }
    }

    if (!toStr && toVal && window.persianDate) {
        try {
            const p = toVal.split('/');
            if (p.length === 3) {
                const pd = new persianDate([parseInt(p[0]), parseInt(p[1]), parseInt(p[2])]);
                const d = pd.toDate();
                toStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
        } catch (e) { }
    }

    let filtered = allReports;

    if (fromStr) {
        filtered = filtered.filter(r => {
            if (!r.created) return false;
            const rDate = r.created.includes('T') ? r.created.split('T')[0] : r.created.split(' ')[0];
            return rDate >= fromStr;
        });
    }

    if (toStr) {
        // برای شامل شدن کامل روز «تا»، از مقایسه تاریخ یا اضافه کردن ۱ روز به انتهای بازه استفاده می‌کنیم
        try {
            const parts = toStr.split('-');
            const endDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            endDate.setDate(endDate.getDate() + 1);

            const nextDayStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

            filtered = filtered.filter(r => {
                if (!r.created) return false;
                const rDate = r.created.includes('T') ? r.created.split('T')[0] : r.created.split(' ')[0];
                return rDate < nextDayStr;
            });
        } catch (e) {
            filtered = filtered.filter(r => {
                if (!r.created) return false;
                const rDate = r.created.includes('T') ? r.created.split('T')[0] : r.created.split(' ')[0];
                return rDate <= toStr;
            });
        }
    }

    renderAnalyticsCharts(filtered);
}
// ------------------- جستجو و فیلتر پیشرفته -------------------
function populateSearchDropdowns() {
    const topicSel = document.getElementById('adv-filter-topic');
    const caseSel = document.getElementById('adv-filter-case');
    const authorSel = document.getElementById('adv-filter-author');

    if (topicSel) {
        allTopics.forEach(t => { topicSel.innerHTML += `<option value="${t.id}">${t.title}</option>`; });
    }
    if (caseSel) {
        allCases.forEach(c => { caseSel.innerHTML += `<option value="${c.id}">${c.title}</option>`; });
    }
    if (authorSel) {
        allUsers.forEach(u => { authorSel.innerHTML += `<option value="${u.id}">${u.name || u.username || u.email}</option>`; });
    }
}

// باز و بسته کردن آکاردئون فیلتر پیشرفته
function toggleAdvancedFilterAccordion() {
    const accordion = document.getElementById('advanced-filter-accordion');
    if (accordion) {
        accordion.classList.toggle('hidden');
    }
}

function applyAdvancedFilters() {
    const filters = [];

    // ۱. بررسی جستجوی متنی عمومی
    const globalQuery = document.getElementById('global-search-input')?.value.trim();
    if (globalQuery) {
        filters.push(`(title ~ "${globalQuery}" || automation_id ~ "${globalQuery}" || abstract ~ "${globalQuery}")`);
    }

    // ۲. بررسی انتخاب‌های دراپ‌داون
    const topic = document.getElementById('adv-filter-topic')?.value;
    if (topic) filters.push(`topics_rel ~ "${topic}"`);

    const kase = document.getElementById('adv-filter-case')?.value;
    if (kase) filters.push(`cases_rel ~ "${kase}"`);

    const classification = document.getElementById('adv-filter-classification')?.value;
    if (classification) filters.push(`classification = "${classification}"`);

    const priority = document.getElementById('adv-filter-priority')?.value;
    if (priority) filters.push(`priority = "${priority}"`);

    const newsType = document.getElementById('adv-filter-news-type')?.value;
    if (newsType) filters.push(`news_type = "${newsType}"`);

    const evaluation = document.getElementById('adv-filter-evaluation')?.value;
    if (evaluation) filters.push(`evaluation = "${evaluation}"`);

    const author = document.getElementById('adv-filter-author')?.value;
    if (author) filters.push(`author = "${author}"`);

    currentFilterQuery = filters.join(' && ');
    currentPage = 1;
    loadReportsTable();
}



function resetAdvancedFilters() {
    document.getElementById('adv-filter-topic').value = "";
    document.getElementById('adv-filter-case').value = "";
    document.getElementById('adv-filter-classification').value = "";
    document.getElementById('adv-filter-priority').value = "";
    document.getElementById('adv-filter-news-type').value = "";
    document.getElementById('adv-filter-evaluation').value = "";
    document.getElementById('adv-filter-author').value = "";
    currentFilterQuery = "";
    currentPage = 1;
    loadReportsTable();
}

// ------------------- مودال جزئیات -------------------
async function openDetailModal(id) {
    try {
        const [report, comments] = await Promise.all([
            pb.collection('reports').getOne(id, {
                expand: 'cases_rel,topics_rel,author.department_rel,department,submitter'
            }),
            pb.collection('comments').getFullList({
                filter: `report = "${id}"`,
                sort: 'created',
                expand: 'author'
            })
        ]);

        const exp = report.expand || {};
        const topicTitles = exp.topics_rel ? exp.topics_rel.map(t => t.title).join('، ') : '---';
        const caseTitles = exp.cases_rel ? exp.cases_rel.map(c => c.title).join('، ') : '---';
        const authorName = exp.author
            ? (exp.author.name || exp.author.username || '---')
            : '---';

        const deptObj = exp.author?.expand?.department_rel;
        const deptName = deptObj
            ? (deptObj.name || deptObj.username || '---')
            : '---';

        const submitterName = exp.submitter
            ? (exp.submitter.name || exp.submitter.username || '---')
            : '---';

        // ساخت HTML برای بخش کامنت‌ها، نظریه‌ها و ملاحظات
        let commentsHtml = '';
        if (comments && comments.length > 0) {
            commentsHtml = comments.map(c => {
                const cAuthor = c.expand?.author ? (c.expand.author.name || c.expand.author.username) : 'کاربر نامشخص';
                const cType = c.type || 'کامنت عمومی';

                // استایل‌دهی بر اساس نوع (ملاحظه، نظریه، پاسخ، کامنت)
                let badgeStyle = 'bg-slate-200 text-slate-800';
                if (cType === 'ملاحظه') badgeStyle = 'bg-amber-100 text-amber-800 border border-amber-300';
                else if (cType === 'نظریه') badgeStyle = 'bg-indigo-100 text-indigo-800 border border-indigo-300';
                else if (cType === 'پاسخ') badgeStyle = 'bg-emerald-100 text-emerald-800 border border-emerald-300';

                return `
                    <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1.5">
                        <div class="flex justify-between items-center text-xs">
                            <div class="flex items-center gap-2">
                                <span class="font-black text-slate-800">${cAuthor}</span>
                                <span class="text-[10px] px-2 py-0.5 rounded-md font-bold ${badgeStyle}">${cType}</span>
                            </div>
                            <span class="text-[10px] text-slate-400 font-medium">${formatDateToFa(c.created)}</span>
                        </div>
                        <div class="text-slate-700 text-xs leading-relaxed overflow-x-auto">${c.text || ''}</div>
                    </div>
                `;
            }).join('');
        } else {
            commentsHtml = `<p class="text-slate-400 text-xs italic">هیچ کامنت، نظریه یا ملاحظه‌ای برای این خبر ثبت نشده است.</p>`;
        }

        // ساخت HTML مربوط به تصویر شاخص (cover_image)
        let coverImageHtml = '';
        if (report.cover_image) {
            const coverUrl = pb.files.getUrl(report, report.cover_image);
            coverImageHtml = `
                <div class="col-span-2 bg-slate-50 p-2.5 rounded-xl">
                    <span class="text-slate-500 text-[10px] block mb-1.5 font-bold">تصویر شاخص (کاور):</span>
                    <div class="flex justify-center items-center w-full">
                        <a href="${coverUrl}" target="_blank" class="inline-block max-w-full">
                            <img src="${coverUrl}" alt="تصویر شاخص" class="max-h-40 max-w-full object-contain rounded-lg border border-slate-200 shadow-sm hover:opacity-90 transition mx-auto">
                        </a>
                    </div>
                </div>
            `;
        } else {
            coverImageHtml = `
                <div class="col-span-2 bg-slate-50 p-2.5 rounded-xl">
                    <span class="text-slate-500 text-[10px] block font-bold">تصویر شاخص (کاور):</span>
                    <p class="text-slate-400 text-[10px] italic mt-0.5">بدون تصویر شاخص</p>
                </div>
            `;
        }

        // ساخت HTML مربوط به فایل‌های پیوست (attachments)
        let attachmentsHtml = '';
        if (report.attachments && Array.isArray(report.attachments) && report.attachments.length > 0) {
            const fileItems = report.attachments.map(file => {
                const fileUrl = pb.files.getUrl(report, file);
                return `
                    <li>
                        <a href="${fileUrl}" target="_blank" download class="text-indigo-600 hover:text-indigo-800 font-bold hover:underline inline-flex items-center gap-1 text-[11px]">
                            📎 ${file}
                        </a>
                    </li>
                `;
            }).join('');

            attachmentsHtml = `
                <div class="col-span-2 bg-slate-50 p-2.5 rounded-xl">
                    <span class="text-slate-500 text-[10px] block mb-1 font-bold">فایل‌های پیوست:</span>
                    <ul class="space-y-1 text-[11px]">${fileItems}</ul>
                </div>
            `;
        } else {
            attachmentsHtml = `
                <div class="col-span-2 bg-slate-50 p-2.5 rounded-xl">
                    <span class="text-slate-500 text-[10px] block font-bold">فایل‌های پیوست:</span>
                    <p class="text-slate-400 text-[10px] italic mt-0.5">بدون فایل پیوست</p>
                </div>
            `;
        }

        const modalContainer = document.getElementById('modal-content-container');
        modalContainer.innerHTML = `
            <div class="bg-slate-50 p-2.5 rounded-xl"><span class="text-slate-500 text-[10px] block mb-0.5">عنوان:</span><strong class="text-slate-900 font-bold text-xs">${report.title || '---'}</strong></div>
            <div class="bg-slate-50 p-2.5 rounded-xl"><span class="text-slate-500 text-[10px] block mb-0.5">شماره اتوماسیون:</span><strong class="text-slate-900 font-bold text-xs">${report.automation_id || '---'}</strong></div>
            <div class="bg-slate-50 p-2.5 rounded-xl"><span class="text-slate-500 text-[10px] block mb-0.5">موضوع:</span><strong class="text-slate-900 font-bold text-[11px]">${topicTitles}</strong></div>
            <div class="bg-slate-50 p-2.5 rounded-xl"><span class="text-slate-500 text-[10px] block mb-0.5">کیس:</span><strong class="text-slate-900 font-bold text-[11px]">${caseTitles}</strong></div>
            <div class="bg-slate-50 p-2.5 rounded-xl"><span class="text-slate-500 text-[10px] block mb-0.5">نوع خبر / ارزیابی:</span><strong class="text-slate-900 font-bold text-[11px]">${report.news_type || '---'} / ${report.evaluation || '---'}</strong></div>
            <div class="bg-slate-50 p-2.5 rounded-xl"><span class="text-slate-500 text-[10px] block mb-0.5">طبقه‌بندی / اولویت:</span><strong class="text-slate-900 font-bold text-[11px]">${report.classification || '---'} / ${report.priority || '---'}</strong></div>
            <div class="bg-slate-50 p-2.5 rounded-xl"><span class="text-slate-500 text-[10px] block mb-0.5">نویسنده / اداره / ثبت‌کننده:</span><strong class="text-slate-900 font-bold text-[11px]">${authorName} - ${deptName} (ثبت: ${submitterName})</strong></div>
            <div class="bg-slate-50 p-2.5 rounded-xl"><span class="text-slate-500 text-[10px] block mb-0.5">تاریخ وقوع:</span><strong class="text-slate-900 font-bold text-[11px]">${formatDateToFa(report.occurrence_date)}</strong></div>
            ${coverImageHtml}     

            <div class="col-span-2 bg-slate-50 p-2.5 rounded-xl"><span class="text-slate-500 text-[10px] block mb-0.5 font-bold">چکیده:</span><p class="text-slate-800 leading-relaxed text-[11px]">${report.abstract || 'بدون چکیده'}</p></div>
            <div class="col-span-2 bg-slate-50 p-2.5 rounded-xl"><span class="text-slate-500 text-[10px] block mb-0.5 font-bold">متن کامل:</span><div class="text-slate-800 leading-relaxed text-[11px] overflow-x-auto">${report.content || 'بدون متن'}</div></div>
         
            <!-- بخش کامنت‌ها، نظریه‌ها و ملاحظات -->
            <div class="col-span-2 bg-slate-100/70 p-3 rounded-xl space-y-2 border border-slate-200">
                <h4 class="font-black text-slate-800 text-[11px] border-b border-slate-200 pb-1.5">💬 کامنت‌ها، نظریه‌ها و ملاحظات ثبت‌شده:</h4>
                <div class="space-y-1.5">
                    ${commentsHtml}
                </div>
            </div>

            ${attachmentsHtml} 
        `;

        document.getElementById('modal-edit-link').href = `create-report.html?id=${report.id}`;
        document.getElementById('detail-modal').classList.remove('hidden');
        document.getElementById('detail-modal').classList.add('flex');
    } catch (err) {
        console.error("خطا در بارگذاری جزئیات گزارش:", err);
    }
}

function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}