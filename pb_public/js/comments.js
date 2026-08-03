document.addEventListener('DOMContentLoaded', () => {
    const PB_URL = window.location.origin;
    const COMMENTS_COLLECTION = 'comments';

    const state = {
        pb: null,
        reportId: null,
        comments: [],
        pendingComments: [],
        activeReplyId: null
    };

    const $id = (id) => document.getElementById(id);

    async function boot() {
        try {
            state.pb = new PocketBase(PB_URL);

            // استخراج پارامتر ID گزارش از پارامترهای آدرس صفحه
            const urlParams = new URLSearchParams(window.location.search);
            state.reportId = urlParams.get('id');

            if (state.reportId) {
                // لود ابتدایی لیست کامنت‌ها در صورت وجود گزارش
                await fetchComments();
            } else {
                console.warn('شناسه گزارش (reportId) در آدرس صفحه یافت نشد. کامنت‌ها به‌صورت موقت ذخیره خواهند شد.');
            }

            // اتصال رویداد ثبت کامنت جدید به دکمه مربوطه
            const submitCommentBtn = $id('submit-comment-btn');
            if (submitCommentBtn) {
                submitCommentBtn.addEventListener('click', handleCreateComment);
            }
        } catch (err) {
            console.error('خطا در راه‌اندازی ماژول کامنت‌ها:', err);
        }
    }

    boot();

    // 1. دریافت لیست کامنت‌های مرتبط با این گزارش از پاکت‌بیس
    async function fetchComments() {
        if (!state.reportId) return;

        try {
            const records = await state.pb.collection(COMMENTS_COLLECTION).getFullList({
                filter: `report = "${state.reportId}"`,
                sort: '+created',
                expand: 'author,parent'
            });

            state.comments = records;
            renderCommentsList();
        } catch (err) {
            console.error('خطا در دریافت لیست کامنت‌ها:', err);
        }
    }

    // 2. ساخت ساختار درختی و رندر کردن کامنت‌ها در DOM
    function renderCommentsList() {
        const container = $id('comments-container');
        if (!container) return;

        container.innerHTML = '';

        const allComments = state.reportId ? state.comments : state.pendingComments;

        if (!allComments || allComments.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-slate-400 font-semibold text-sm">هنوز نظری ثبت نشده است.</div>';
            return;
        }

        // تفکیک کامنت‌های ریشه و زیر-کامنت‌ها (پاسخ‌ها)
        const roots = allComments.filter(c => !c.parent);
        const children = allComments.filter(c => c.parent);

        roots.forEach(root => {
            const rootEl = createCommentCard(root);
            container.appendChild(rootEl);

            // پیدا کردن و رندر پاسخ‌های مربوط به این کامنت
            const subComments = children.filter(c => c.parent === root.id);
            if (subComments.length > 0) {
                const subContainer = document.createElement('div');
                subContainer.className = 'mr-6 mt-3 space-y-3 border-r-2 border-slate-300 pr-4';

                subComments.forEach(child => {
                    const childEl = createCommentCard(child, true);
                    subContainer.appendChild(childEl);
                });

                container.appendChild(subContainer);
            }
        });
    }

    // 3. ایجاد کارت متنی کامنت
    function createCommentCard(comment, isChild = false) {
        const card = document.createElement('div');
        card.className = `p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2 ${isChild ? 'bg-slate-50/50' : ''}`;

        const authorName = comment.authorName || comment.expand?.author?.name || comment.expand?.author?.username || 'کاربر ناشناس';
        const typeBadge = comment.type ? `<span class="bg-slate-200 text-slate-800 text-xs font-bold px-2 py-0.5 rounded-md">${comment.type}</span>` : '';
        
        let createdDate = 'پیش‌نویس';
        if (comment.created) {
            createdDate = new Date(comment.created).toLocaleDateString('fa-IR');
        }

        card.innerHTML = `
            <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                <div class="flex items-center gap-2">
                    <span class="text-sm font-bold text-slate-900">👤 ${authorName}</span>
                    ${typeBadge}
                    ${comment.isPending ? '<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-md">ذخیره‌نشده</span>' : ''}
                </div>
                <span class="text-xs text-slate-400 font-medium">${createdDate}</span>
            </div>
            <div class="text-sm text-slate-700 leading-relaxed font-semibold">
                ${comment.text}
            </div>
            ${!isChild ? `
                <div class="pt-2 flex justify-end">
                    <button type="button" class="reply-btn text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1" data-id="${comment.id}">
                        💬 پاسخ
                    </button>
                </div>
            ` : ''}
        `;

        const replyBtn = card.querySelector('.reply-btn');
        if (replyBtn) {
            replyBtn.addEventListener('click', () => {
                state.activeReplyId = comment.id;
                const parentInput = $id('comment-parent-id');
                if (parentInput) parentInput.value = comment.id;

                const replyNotice = $id('reply-notice');
                if (replyNotice) {
                    replyNotice.textContent = `در حال ارسال پاسخ به کامنت ${authorName}...`;
                    replyNotice.classList.remove('hidden');
                }
            });
        }

        return card;
    }

    // 4. مدیریت ارسال فرم کامنت
    async function handleCreateComment(e) {
        e.preventDefault();

        const currentUser = state.pb.authStore.record || state.pb.authStore.model;
        if (!currentUser) {
            alert('جهت ارسال کامنت ابتدا باید وارد سیستم شوید.');
            return;
        }

        const textInput = $id('comment-text');
        const typeSelect = $id('comment-type');
        const parentInput = $id('comment-parent-id');

        const text = textInput ? textInput.value.trim() : '';
        const type = typeSelect ? typeSelect.value : 'کامنت عمومی';
        const parent = parentInput ? parentInput.value : null;

        if (!text) {
            alert('متن کامنت نمی‌تواند خالی باشد.');
            return;
        }

        // اگر گزارش موجود باشد، مستقیم در پاکت‌بیس ثبت می‌شود
        if (state.reportId) {
            const data = {
                report: state.reportId,
                author: currentUser.id,
                type: type,
                text: text,
                parent: parent || null
            };

            try {
                await state.pb.collection(COMMENTS_COLLECTION).create(data);

                resetCommentForm();
                await fetchComments();
            } catch (err) {
                console.error('خطا در ثبت کامنت:', err);
                alert('ثبت کامنت با خطا مواجه شد.');
            }
        } else {
            // اگر گزارش جدید است، در حافظه موقت نگه داشته می‌شود
            const tempComment = {
                id: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                author: currentUser.id,
                authorName: currentUser.name || currentUser.username || 'کاربر سیستم',
                type: type,
                text: text,
                parent: parent || null,
                isPending: true
            };

            state.pendingComments.push(tempComment);
            resetCommentForm();
            renderCommentsList();
        }
    }

    function resetCommentForm() {
        const textInput = $id('comment-text');
        const parentInput = $id('comment-parent-id');

        if (textInput) textInput.value = '';
        if (parentInput) parentInput.value = '';
        state.activeReplyId = null;

        const replyNotice = $id('reply-notice');
        if (replyNotice) replyNotice.classList.add('hidden');
    }

    // 5. عمومی‌سازی تابع ثبت کامنت‌های موقت پس از ایجاد موفق گزارش
    window.savePendingComments = async function (newReportId) {
        if (!state.pendingComments || state.pendingComments.length === 0) return;

        // نقشه‌برداری شناسه والد برای پاسخ‌هایی که به کامنت‌های موقت وابسته هستند
        const idMapping = {};

        for (const item of state.pendingComments) {
            const resolvedParent = item.parent && idMapping[item.parent] ? idMapping[item.parent] : (item.parent || null);

            const payload = {
                report: newReportId,
                author: item.author,
                type: item.type,
                text: item.text,
                parent: resolvedParent
            };

            try {
                const createdRecord = await state.pb.collection(COMMENTS_COLLECTION).create(payload);
                idMapping[item.id] = createdRecord.id;
            } catch (err) {
                console.error('خطا در ذخیره‌سازی کامنت موقت:', err);
            }
        }

        state.pendingComments = [];
    };
});