let pb;
let allReports = [];
let allTopics = [];
let allCases = [];
let allUsers = [];
let chartInstances = {};
let currentPage = 1;
let perPage = 10;
let currentFilterQuery = "";

const chartFont = 'Vazirmatn, sans-serif';
if (window.Apex) {
    window.Apex = {
        chart: { fontFamily: chartFont },
        dataLabels: { style: { fontFamily: chartFont, fontWeight: 'bold' } },
        tooltip: { style: { fontFamily: chartFont } },
        xaxis: { labels: { style: { fontFamily: chartFont } } },
        yaxis: { labels: { style: { fontFamily: chartFont } } },
        legend: { fontFamily: chartFont }
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    pb = new PocketBase(window.location.origin);

    if (!pb.authStore.isValid) {
        window.location.href = 'login.html';
        return;
    }

    await loadAllBaseData();
    renderOverviewCharts();
    renderAnalyticsCharts();
    loadReportsTable();
    populateSearchDropdowns();

    // راه‌اندازی تقویم شمسی با تنظیم پیش‌فرض ۳۰ روز گذشته
    if (window.$ && $.fn.persianDatepicker && window.persianDate) {
        const pdTo = new persianDate(); // تاریخ امروز (شمسی)
        const pdFrom = new persianDate().subtract('days', 30); // ۳۰ روز قبل (شمسی)

        // ۱. استخراج تاریخ ISO میلادی جهت فیلتر نمودارها
        const isoTo = pdTo.toDate().toISOString().split('T')[0];
        const isoFrom = pdFrom.toDate().toISOString().split('T')[0];

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
                const dateObj = new Date(unix);
                const isoDate = dateObj.toISOString().split('T')[0];
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
                const dateObj = new Date(unix);
                const isoDate = dateObj.toISOString().split('T')[0];
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
        const [reports, topics, cases, users] = await Promise.all([
            pb.collection('reports').getFullList({
                sort: '-created',
                expand: 'cases_rel,topics_rel,author.department_rel,department,submitter'
            }),
            pb.collection('topics').getFullList(),
            pb.collection('cases').getFullList(),
            pb.collection('users').getFullList()
        ]);

        allReports = reports;
        allTopics = topics;
        allCases = cases;
        allUsers = users;

        const statTotal = document.getElementById('stat-total-reports-1');
        const statCases = document.getElementById('stat-active-cases');
        if (statTotal) statTotal.innerText = allReports.length;
        if (statCases) statCases.innerText = allCases.length;

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
        const result = await pb.collection('reports').getList(currentPage, perPage, {
            sort: '-created',
            expand: 'cases_rel,topics_rel,author.department_rel,department,submitter',
            filter: currentFilterQuery
        });

        if (result.items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="text-center p-6 text-slate-500 font-bold">هیچ گزارشی یافت نشد.</td></tr>`;
            document.getElementById('pagination-info').innerText = 'صفحه ۰ از ۰';
            document.getElementById('pagination-controls').innerHTML = '';
            return;
        }

        let html = '';
        result.items.forEach(rec => {
            const exp = rec.expand || {};
            const topicTitles = exp.topics_rel ? exp.topics_rel.map(t => t.title).join('، ') : '---';
            const caseTitles = exp.cases_rel ? exp.cases_rel.map(c => c.title).join('، ') : '---';
            // خواندن نام نویسنده در مودال
            const authorName = exp.author
                ? (exp.author.name || exp.author.username || '---')
                : '---';

            // خواندن نام اداره در مودال (صرفاً از روی ادارهٔ متصل به نویسنده)
            const deptObj = exp.author?.expand?.department_rel;
            const deptName = deptObj
                ? (deptObj.name || deptObj.username || '---')
                : '---';

            html += `
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-3.5 font-bold text-slate-900">${rec.title || 'بدون عنوان'}</td>
                    <td class="p-3.5 font-mono text-slate-500">${rec.automation_id || '---'}</td>
                    <td class="p-3.5"><span class="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded">${topicTitles}</span></td>
                    <td class="p-3.5"><span class="bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded">${caseTitles}</span></td>
                    <td class="p-3.5">${rec.news_type || '---'}</td>
                    <td class="p-3.5 font-semibold">${authorName}</td>
                    <td class="p-3.5">${deptName}</td>
                    <td class="p-3.5">${formatDateToFa(rec.occurrence_date)}</td>
                    <td class="p-3.5">${formatDateToFa(rec.created)}</td>
                    <td class="p-3.5">${formatDateToFa(rec.updated)}</td>
                    <td class="p-3.5 text-center flex gap-2 justify-center">
                        <button onclick="openDetailModal('${rec.id}')" class="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-black px-2.5 py-1 rounded-lg transition">جزئیات</button>
                        <a href="create-report.html?id=${rec.id}" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-black px-2.5 py-1 rounded-lg transition">ویرایش</a>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

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
    if (chartInstances[elementSelector]) {
        chartInstances[elementSelector].destroy();
    }
    const chart = new ApexCharts(document.querySelector(elementSelector), options);
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
        chart: { type: 'area', height: 260, toolbar: { show: false } },
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
        colors: ['#f59e0b', '#cbd5e1']
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
        chart: { type: 'area', height: 260, toolbar: { show: false } },
        stroke: { curve: 'smooth', width: 3 },
        colors: ['#0284c7'],
        fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
        xaxis: { categories: occCategories }
    });
}

function applyAnalyticsDateFilter() {
    const $fromInput = $('#filter-date-from');
    const $toInput = $('#filter-date-to');

    // اگر فیلد خالی شود، مقدار iso پاک می‌شود
    if (!$fromInput.val().trim()) $fromInput.data('iso', null);
    if (!$toInput.val().trim()) $toInput.data('iso', null);

    const fromIso = $fromInput.data('iso');
    const toIso = $toInput.data('iso');

    let filtered = allReports;

    if (fromIso) {
        filtered = filtered.filter(r => {
            const rDate = r.created ? r.created.split('T')[0] : '';
            return rDate >= fromIso;
        });
    }

    if (toIso) {
        filtered = filtered.filter(r => {
            const rDate = r.created ? r.created.split('T')[0] : '';
            return rDate <= toIso;
        });
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

function executeGlobalSearch() {
    const query = document.getElementById('global-search-input').value.trim();
    if (!query) {
        currentFilterQuery = "";
    } else {
        currentFilterQuery = `title ~ "${query}" || automation_id ~ "${query}" || abstract ~ "${query}"`;
    }
    currentPage = 1;
    switchTab('tab-overview');
    loadReportsTable();
}

function applyAdvancedFilters() {
    const filters = [];

    const topic = document.getElementById('adv-filter-topic').value;
    if (topic) filters.push(`topics_rel ~ "${topic}"`);

    const kase = document.getElementById('adv-filter-case').value;
    if (kase) filters.push(`cases_rel ~ "${kase}"`);

    const classification = document.getElementById('adv-filter-classification').value;
    if (classification) filters.push(`classification = "${classification}"`);

    const priority = document.getElementById('adv-filter-priority').value;
    if (priority) filters.push(`priority = "${priority}"`);

    const newsType = document.getElementById('adv-filter-news-type').value;
    if (newsType) filters.push(`news_type = "${newsType}"`);

    const evaluation = document.getElementById('adv-filter-evaluation').value;
    if (evaluation) filters.push(`evaluation = "${evaluation}"`);

    const author = document.getElementById('adv-filter-author').value;
    if (author) filters.push(`author = "${author}"`);

    currentFilterQuery = filters.join(' && ');
    currentPage = 1;
    switchTab('tab-overview');
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
        const report = await pb.collection('reports').getOne(id, {
            expand: 'cases_rel,topics_rel,author.department_rel,department,submitter'
        });

        const exp = report.expand || {};
        const topicTitles = exp.topics_rel ? exp.topics_rel.map(t => t.title).join('، ') : '---';
        const caseTitles = exp.cases_rel ? exp.cases_rel.map(c => c.title).join('، ') : '---';
        // خواندن نام نویسنده
        const authorName = exp.author
            ? (exp.author.name || exp.author.username || '---')
            : '---';

        // خواندن نام اداره (صرفاً از روی ادارهٔ متصل به نویسنده)
        const deptObj = exp.author?.expand?.department_rel;
        const deptName = deptObj
            ? (deptObj.name || deptObj.username || '---')
            : '---';

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
            <div class="col-span-2 bg-slate-50 p-3 rounded-xl"><span class="text-slate-500 block">چکیده:</span><p class="text-slate-800 leading-relaxed mt-1">${report.abstract || 'بدون چکیده'}</p></div>
            <div class="col-span-2 bg-slate-50 p-3 rounded-xl"><span class="text-slate-500 block">متن کامل:</span><div class="text-slate-800 leading-relaxed mt-1 overflow-x-auto">${report.content || 'بدون متن'}</div></div>
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