document.addEventListener('DOMContentLoaded', () => {
    const PB_URL = window.location.origin;
    const COMMENTS_COLLECTION = 'comments';

    const state = {
        pb: null,
        reportId: null,
        comments: [],
        activeReplyId: null
    };

    const $id = (id) => document.getElementById(id);

    async function boot() {
        try {
            state.pb = new PocketBase(PB_URL);
            
            // استخراج پارامتر ID گزارش از پارامترهای آدرس صفحه
            const urlParams = new URLSearchParams(window.location.search);
            state.reportId = urlParams.get('id');

            if (!state.reportId) {
                console.warn('شناسه گزارش (reportId) در آدرس صفحه یافت نشد.');
                return;
            }

            // لود ابتدایی لیست کامنت‌ها
            await fetchComments();

            // اتصال رویداد ثبت کامنت جدید
            const commentForm = $id('comment-form');
            if (commentForm) {
                commentForm.addEventListener('submit', handleCreateComment);
            }
        } catch (err) {
            console.error('خطا در راه‌اندازی ماژول کامنت‌ها:', err);
        }
    }

    boot();

    // 1. دریافت لیست کامنت‌های مرتبط با این گزارش
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

        if (!state.comments || state.comments.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-slate-400 font-semibold text-sm">هنوز نظری ثبت نشده است.</div>';
            return;
        }

        // تفکیک کامنت‌های ریشه و زیر-کامنت‌ها (پاسخ‌ها)
        const roots = state.comments.filter(c => !c.parent);
        const children = state.comments.filter(c => c.parent);

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

        const authorName = comment.expand?.author?.name || comment.expand?.author?.username || 'کاربر ناشناس';
        const typeBadge = comment.type ? `<span class="bg-slate-200 text-slate-800 text-xs font-bold px-2 py-0.5 rounded-md">${comment.type}</span>` : '';
        const createdDate = new Date(comment.created).toLocaleDateString('fa-IR');

        card.innerHTML = `
            <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                <div class="flex items-center gap-2">
                    <span class="text-sm font-bold text-slate-900">👤 ${authorName}</span>
                    ${typeBadge}
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

        const data = {
            report: state.reportId,
            author: currentUser.id,
            type: type,
            text: text,
            parent: parent || null
        };

        try {
            await state.pb.collection(COMMENTS_COLLECTION).create(data);
            
            // ریست کردن فرم
            if (textInput) textInput.value = '';
            if (parentInput) parentInput.value = '';
            state.activeReplyId = null;

            const replyNotice = $id('reply-notice');
            if (replyNotice) replyNotice.classList.add('hidden');

            // دریافت مجدد لیست و به‌روزرسانی نمای کامنت‌ها
            await fetchComments();
        } catch (err) {
            console.error('خطا در ثبت کامنت:', err);
            alert('ثبت کامنت با خطا مواجه شد.');
        }
    }
});