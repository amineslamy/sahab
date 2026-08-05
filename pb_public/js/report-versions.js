document.addEventListener('DOMContentLoaded', () => {
    const PB_URL = window.location.origin;
    const VERSIONS_COLLECTION = 'report_versions';

    const state = {
        pb: null,
        reportId: null,
        versions: [],
        currentReport: null
    };

    const $id = (id) => document.getElementById(id);

    async function boot() {
        try {
            state.pb = new PocketBase(PB_URL);
            const urlParams = new URLSearchParams(window.location.search);
            state.reportId = urlParams.get('id');

            if (state.reportId) {
                await fetchVersions();
            }
        } catch (err) {
            console.error('خطا در راه‌اندازی ماژول تاریخچه نسخه‌ها:', err);
        }
    }

    boot();

    async function fetchVersions() {
        try {
            state.currentReport = await state.pb.collection('reports').getOne(state.reportId);
            const records = await state.pb.collection(VERSIONS_COLLECTION).getFullList({
                filter: `report = "${state.reportId}"`,
                sort: '-version',
                expand: 'author,submitter'
            });

            state.versions = records;
            renderVersionsAccordion();
        } catch (err) {
            console.error('خطا در دریافت تاریخچه نسخه‌ها:', err);
        }
    }

    function computeDiffHtml(oldStr, newStr) {
        const cleanOld = (oldStr || '').replace(/<[^>]*>/g, '');
        const cleanNew = (newStr || '').replace(/<[^>]*>/g, '');

        const oldWords = cleanOld.split(/(\s+)/);
        const newWords = cleanNew.split(/(\s+)/);

        const matrix = Array(oldWords.length + 1).fill(null).map(() => Array(newWords.length + 1).fill(0));

        for (let i = 0; i < oldWords.length; i++) {
            for (let j = 0; j < newWords.length; j++) {
                if (oldWords[i] === newWords[j]) {
                    matrix[i + 1][j + 1] = matrix[i][j] + 1;
                } else {
                    matrix[i + 1][j + 1] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
                }
            }
        }

        let i = oldWords.length;
        let j = newWords.length;
        const result = [];

        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
                result.unshift(escapeHtml(oldWords[i - 1]));
                i--;
                j--;
            } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
                result.unshift(`<span class="bg-cyan-100 text-cyan-900 px-1 rounded font-bold">${escapeHtml(newWords[j - 1])}</span>`);
                j--;
            } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
                result.unshift(`<span class="bg-rose-100 text-rose-900 line-through px-1 rounded font-bold">${escapeHtml(oldWords[i - 1])}</span>`);
                i--;
            }
        }

        return result.join('');
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function renderVersionsAccordion() {
        const container = $id('versions-history-container');
        if (!container) return;

        container.innerHTML = '';

        if (!state.versions || state.versions.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-slate-400 font-semibold text-sm">هیچ نسخه قبلی برای این گزارش ثبت نشده است.</div>';
            return;
        }

        state.versions.forEach((ver, idx) => {
            const nextVersionObj = state.versions[idx - 1] || state.currentReport;
            const card = document.createElement('div');
            card.className = 'border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm mb-3';

            const createdDate = ver.created ? new Date(ver.created).toLocaleDateString('fa-IR') : 'نامشخص';
            const authorName = ver.expand?.author?.name || ver.expand?.author?.username || 'نامشخص';

            card.innerHTML = `
                <button type="button" class="w-full p-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition border-b border-slate-200 text-right accordion-toggle-btn">
                    <div class="flex items-center gap-3">
                        <span class="bg-slate-800 text-white text-xs font-bold px-2.5 py-1 rounded-md">نسخه ${ver.version}</span>
                        <span class="text-sm font-bold text-slate-800">${ver.title || 'بدون عنوان'}</span>
                        <span class="text-xs text-slate-400">ویرایش‌شده توسط ${authorName}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-xs text-slate-400 font-medium">${createdDate}</span>
                        <span class="text-slate-500 font-bold transform transition-transform duration-200 accordion-arrow">▼</span>
                    </div>
                </button>
                <div class="accordion-content hidden p-4 space-y-4 bg-white">
                    <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <div class="text-xs font-bold text-slate-500">مقایسه تغییرات شرح گزارش (Diff):</div>
                        <div class="text-sm leading-relaxed p-3 bg-white rounded border border-slate-200 font-medium">
                            ${computeDiffHtml(ver.content, nextVersionObj?.content)}
                        </div>
                    </div>
                    <div class="flex justify-end pt-2 border-t border-slate-100">
                        <button type="button" class="restore-version-btn px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition">
                            🔄 بازیابی این نسخه به فرم
                        </button>
                    </div>
                </div>
            `;

            const toggleBtn = card.querySelector('.accordion-toggle-btn');
            const content = card.querySelector('.accordion-content');
            const arrow = card.querySelector('.accordion-arrow');
            const restoreBtn = card.querySelector('.restore-version-btn');

            toggleBtn.addEventListener('click', () => {
                const isHidden = content.classList.contains('hidden');
                content.classList.toggle('hidden', !isHidden);
                arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            });

            restoreBtn.addEventListener('click', () => {
                const confirmed = confirm(`آیا مطمئن هستید که می‌خواهید نسخه ${ver.version} را روی فرم بازیابی کنید؟`);
                if (confirmed && typeof window.restoreReportVersionToForm === 'function') {
                    window.restoreReportVersionToForm(ver);
                }
            });

            container.appendChild(card);
        });
    }
});