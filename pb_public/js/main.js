let pb;
let allReports = [];
let allTopics = [];
let allCases = [];
let allUsers = [];
let chartInstances = {};
let currentPage = 1;
let perPage = 10;
let currentFilterQuery = "";

// متغیر سراسری مدیریت انتخاب‌ها (حفظ ID خبرها در پجینیشن و فیلترها)
const selectedReportIds = new Set();

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
            updateSelectionUI();
            return;
        }

        let html = '';
        result.items.forEach((rec, index) => {
            const exp = rec.expand || {};
            const topicTitles = exp.topics_rel ? exp.topics_rel.map(t => t.title).join('، ') : '---';
            const caseTitles = exp.cases_rel ? exp.cases_rel.map(c => c.title).join('، ') : '---';
            const authorName = exp.author
                ? (exp.author.name || exp.author.username || '---')
                : '---';

            const deptObj = exp.author?.expand?.department_rel;
            const deptName = deptObj
                ? (deptObj.name || deptObj.username || '---')
                : '---';

            // بررسی انتخاب شدن خبر در حافظه
            const isChecked = selectedReportIds.has(rec.id) ? 'checked' : '';

            // رنگ زمینه یکدست و یکی در میان برای هر کارت خبر
            const isEven = index % 2 === 0;
            const bgRow = isEven ? 'bg-white' : 'bg-slate-100/60';

            html += `
                <!-- سطر اصلی خبر -->
                <tr class="${bgRow} border-t-2 border-slate-300">
                    <td class="p-3 text-center" rowspan="2">
                        <input type="checkbox" value="${rec.id}" ${isChecked} onchange="toggleReportSelection('${rec.id}', this.checked)" class="report-checkbox w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer">
                    </td>
                    <td class="p-3 font-bold text-slate-900">${rec.title || 'بدون عنوان'}</td>
                    <td class="p-3"><span class="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded inline-block">${topicTitles}</span></td>
                    <td class="p-3" rowspan="2"><span class="bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded inline-block">${caseTitles}</span></td>
                    <td class="p-3 font-semibold text-slate-700">${authorName} <span class="text-xs text-slate-400">(${deptName})</span></td>
                    <td class="p-3 text-slate-600">${formatDateToFa(rec.created)}</td>
                    <td class="p-3 text-center" rowspan="2">
                        <div class="flex flex-col gap-1.5 justify-center items-center">
                            <button onclick="openDetailModal('${rec.id}')" class="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black px-3 py-1.5 rounded-lg transition w-full">جزئیات</button>
                            <a href="create-report.html?id=${rec.id}" class="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-black px-3 py-1.5 rounded-lg transition w-full text-center">ویرایش</a>
                        </div>
                    </td>
                </tr>
                <!-- سطر مکمل (اطلاعات تکمیلی زیر هر خبر) -->
                <tr class="${bgRow} border-b-2 border-slate-300 text-slate-500 text-xs">
                    <td class="px-3 pb-3 pt-0">
                        <span class="font-mono text-slate-600 bg-slate-200/60 px-1.5 py-0.5 rounded">اتوماسیون: ${rec.automation_id || '---'}</span>
                    </td>
                    <td class="px-3 pb-3 pt-0">
                        <span>نوع خبر: <strong>${rec.news_type || '---'}</strong></span>
                    </td>
                    <td class="px-3 pb-3 pt-0">
                        <span>تاریخ وقوع: <strong>${formatDateToFa(rec.occurrence_date)}</strong></span>
                    </td>
                    <td class="px-3 pb-3 pt-0">
                        <span class="text-slate-400">بروزرسانی: ${formatDateToFa(rec.updated)}</span>
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
// ------------------- مدیریت حافظه انتخاب‌ها (Selection Manager) -------------------

// تغییر وضعیت انتخاب یک خبر منفرد
function toggleReportSelection(id, isChecked) {
    if (isChecked) {
        selectedReportIds.add(id);
    } else {
        selectedReportIds.delete(id);
    }
    updateSelectionUI();
}

// تغییر وضعیت انتخاب کل خبرهای صفحه جاری
function toggleSelectAllCurrentPage(isChecked) {
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

// پاک‌سازی کامل تمام انتخاب‌ها
function clearAllSelections() {
    selectedReportIds.clear();
    const selectAllCb = document.getElementById('select-all-checkbox');
    if (selectAllCb) selectAllCb.checked = false;

    document.querySelectorAll('.report-checkbox').forEach(cb => cb.checked = false);
    updateSelectionUI();
}

// به‌روزرسانی نوار اطلاع‌رسانی بالای جدول و چک‌باکس هدر
function updateSelectionUI() {
    const count = selectedReportIds.size;
    const badge = document.getElementById('selected-count-badge');
    const bar = document.getElementById('selection-bar');
    const selectAllCb = document.getElementById('select-all-checkbox');

    if (badge) {
        badge.innerText = `${count.toLocaleString('fa-IR')} مورد انتخاب شده`;
    }

    if (bar) {
        if (count > 0) {
            bar.classList.remove('hidden');
        } else {
            bar.classList.add('hidden');
        }
    }

    // همگام‌سازی چک‌باکس "انتخاب همه" در هدر صفحه جاری
    if (selectAllCb) {
        const currentPageCheckboxes = Array.from(document.querySelectorAll('.report-checkbox'));
        if (currentPageCheckboxes.length > 0) {
            const allCheckedOnPage = currentPageCheckboxes.every(cb => cb.checked);
            selectAllCb.checked = allCheckedOnPage;
        } else {
            selectAllCb.checked = false;
        }
    }
}

// تابع عملیاتی دریافت خروجی زیپ دسته‌جمعی به همراه فایل‌های رسانه‌ای (Media)
async function exportBatchZip() {
    if (selectedReportIds.size === 0) {
        alert("لطفاً حداقل یک خبر را برای دریافت خروجی انتخاب کنید.");
        return;
    }

    if (typeof JSZip === 'undefined') {
        alert("کتابخانه JSZip بارگذاری نشده است. لطفاً اسکریپت JSZip را به فایل HTML اضافه کنید.");
        return;
    }

    const ids = Array.from(selectedReportIds);
    const zip = new JSZip();
    const mediaFolder = zip.folder("media");

    try {
        // دریافت اطلاعات کامل اخبار انتخاب‌شده از پاکت‌بیس
        const filterQuery = ids.map(id => `id = "${id}"`).join(' || ');
        const reports = await pb.collection('reports').getFullList({
            filter: filterQuery,
            expand: 'cases_rel,topics_rel,author.department_rel,department,submitter',
            requestKey: null
        });

        if (!reports || reports.length === 0) {
            alert("هیچ داده‌ای برای اخبار انتخاب‌شده یافت نشد.");
            return;
        }

        // ۱. قرار دادن فایل اصلی شامل تمام اطلاعات اخبار انتخاب‌شده
        zip.file("all_selected_reports.json", JSON.stringify(reports, null, 2));

        // ۲. دانلود و افزودن فایل‌های رسانه‌ای (تصویر شاخص و پیوست‌ها) به پوشه media
        for (const report of reports) {
            // الف) دانلود تصویر شاخص (Cover Image)
            if (report.cover_image) {
                const coverUrl = pb.files.getUrl(report, report.cover_image);
                try {
                    const response = await fetch(coverUrl);
                    if (response.ok) {
                        const blob = await response.blob();
                        mediaFolder.file(report.cover_image, blob);
                    }
                } catch (imgErr) {
                    console.error(`خطا در دریافت تصویر شاخص ${report.cover_image}:`, imgErr);
                }
            }

            // ب) دانلود فایل‌های پیوست (Attachments)
            if (report.attachments && Array.isArray(report.attachments)) {
                for (const file of report.attachments) {
                    const fileUrl = pb.files.getUrl(report, file);
                    try {
                        const response = await fetch(fileUrl);
                        if (response.ok) {
                            const blob = await response.blob();
                            mediaFolder.file(file, blob);
                        }
                    } catch (attErr) {
                        console.error(`خطا در دریافت فایل پیوست ${file}:`, attErr);
                    }
                }
            }
        }

        // ۳. تولید فایل ZIP و دانلود آن
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `reports_export_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

    } catch (err) {
        console.error("خطا در ایجاد فایل زیپ:", err);
        alert("خطایی هنگام دانلود و بسته‌بندی فایل زیپ رخ داد.");
    }
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
                <div class="col-span-2 bg-slate-50 p-3 rounded-xl">
                    <span class="text-slate-500 block mb-2">تصویر شاخص (کاور):</span>
                    <div class="flex justify-center items-center w-full">
                        <a href="${coverUrl}" target="_blank" class="inline-block max-w-full">
                            <img src="${coverUrl}" alt="تصویر شاخص" class="max-h-48 max-w-full object-contain rounded-lg border border-slate-200 shadow-sm hover:opacity-90 transition mx-auto">
                        </a>
                    </div>
                </div>
            `;
        } else {
            coverImageHtml = `
                <div class="col-span-2 bg-slate-50 p-3 rounded-xl">
                    <span class="text-slate-500 block">تصویر شاخص (کاور):</span>
                    <p class="text-slate-400 italic mt-1">بدون تصویر شاخص</p>
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
                        <a href="${fileUrl}" target="_blank" download class="text-indigo-600 hover:text-indigo-800 font-bold hover:underline inline-flex items-center gap-1">
                            📎 ${file}
                        </a>
                    </li>
                `;
            }).join('');

            attachmentsHtml = `
                <div class="col-span-2 bg-slate-50 p-3 rounded-xl">
                    <span class="text-slate-500 block mb-2">فایل‌های پیوست:</span>
                    <ul class="space-y-1 text-xs">${fileItems}</ul>
                </div>
            `;
        } else {
            attachmentsHtml = `
                <div class="col-span-2 bg-slate-50 p-3 rounded-xl">
                    <span class="text-slate-500 block">فایل‌های پیوست:</span>
                    <p class="text-slate-400 italic mt-1">بدون فایل پیوست</p>
                </div>
            `;
        }

        const modalContainer = document.getElementById('modal-content-container');
        modalContainer.innerHTML = `
            <div class="bg-slate-50 p-3 rounded-xl"><span class="text-slate-500 block">عنوان:</span><strong class="text-slate-900 font-bold">${report.title || '---'}</strong></div>
            <div class="bg-slate-50 p-3 rounded-xl"><span class="text-slate-500 block">شماره اتوماسیون:</span><strong class="text-slate-900 font-bold">${report.automation_id || '---'}</strong></div>
            <div class="bg-slate-50 p-3 rounded-xl"><span class="text-slate-500 block">موضوع:</span><strong class="text-slate-900 font-bold">${topicTitles}</strong></div>
            <div class="bg-slate-50 p-3 rounded-xl"><span class="text-slate-500 block">کیس:</span><strong class="text-slate-900 font-bold">${caseTitles}</strong></div>
            <div class="bg-slate-50 p-3 rounded-xl"><span class="text-slate-500 block">نوع خبر / ارزیابی:</span><strong class="text-slate-900 font-bold">${report.news_type || '---'} / ${report.evaluation || '---'}</strong></div>
            <div class="bg-slate-50 p-3 rounded-xl"><span class="text-slate-500 block">طبقه‌بندی / اولویت:</span><strong class="text-slate-900 font-bold">${report.classification || '---'} / ${report.priority || '---'}</strong></div>
            <div class="bg-slate-50 p-3 rounded-xl"><span class="text-slate-500 block">نویسنده / اداره:</span><strong class="text-slate-900 font-bold">${authorName} - ${deptName}</strong></div>
            <div class="bg-slate-50 p-3 rounded-xl"><span class="text-slate-500 block">تاریخ وقوع:</span><strong class="text-slate-900 font-bold">${formatDateToFa(report.occurrence_date)}</strong></div>
            ${coverImageHtml}     


            <div class="col-span-2 bg-slate-50 p-3 rounded-xl"><span class="text-slate-500 block">چکیده:</span><p class="text-slate-800 leading-relaxed mt-1">${report.abstract || 'بدون چکیده'}</p></div>
            <div class="col-span-2 bg-slate-50 p-3 rounded-xl"><span class="text-slate-500 block">متن کامل:</span><div class="text-slate-800 leading-relaxed mt-1 overflow-x-auto">${report.content || 'بدون متن'}</div></div>
         
            <!-- بخش کامنت‌ها، نظریه‌ها و ملاحظات -->
            <div class="col-span-2 bg-slate-100/70 p-4 rounded-xl space-y-3 border border-slate-200">
                <h4 class="font-black text-slate-800 text-xs border-b border-slate-200 pb-2">💬 کامنت‌ها، نظریه‌ها و ملاحظات ثبت‌شده:</h4>
                <div class="space-y-2">
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