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

            // تنظیم خودکار ارتفاع تکست‌آریا بر اساس محتوا
            const commentTextarea = $id('comment-text');
            if (commentTextarea) {
                commentTextarea.style.overflowY = 'hidden';
                commentTextarea.addEventListener('input', function () {
                    this.style.height = 'auto';
                    this.style.height = this.scrollHeight + 'px';
                });
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

        const currentUser = state.pb.authStore.record || state.pb.authStore.model;
        const authorId = comment.author || comment.expand?.author?.id;
        const isOwner = currentUser && currentUser.id === authorId;

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
            <div class="comment-display-body space-y-2">
                <div class="comment-text-content text-sm text-slate-700 leading-relaxed font-semibold">
                    ${comment.text}
                </div>
                <div class="pt-2 flex justify-end items-center gap-3">
                    ${!isChild ? `
                        <button type="button" class="reply-btn text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1">
                            💬 پاسخ
                        </button>
                    ` : ''}
                    ${isOwner ? `
                        <button type="button" class="edit-btn text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            ✏️ ویرایش
                        </button>
                        <button type="button" class="delete-btn text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1">
                            🗑️ حذف
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="comment-edit-form hidden space-y-2 pt-2">
                <textarea class="edit-textarea w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:border-slate-800">${comment.text}</textarea>
                <div class="flex justify-end gap-2">
                    <button type="button" class="cancel-edit-btn px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg">انصراف</button>
                    <button type="button" class="save-edit-btn px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg">ذخیره ویرایش</button>
                </div>
            </div>
            <div class="comment-reply-form hidden space-y-2 pt-2 border-t border-slate-100 mt-2">
                <div class="text-xs text-slate-500 font-semibold">پاسخ به ${authorName}:</div>
                <textarea class="reply-textarea w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:border-slate-800" placeholder="متن پاسخ خود را بنویسید..."></textarea>
                <div class="flex justify-end gap-2">
                    <button type="button" class="cancel-reply-btn px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg">انصراف</button>
                    <button type="button" class="save-reply-btn px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">ثبت پاسخ</button>
                </div>
            </div>
        `;

        const replyBtn = card.querySelector('.reply-btn');
        const replyForm = card.querySelector('.comment-reply-form');
        const cancelReplyBtn = card.querySelector('.cancel-reply-btn');
        const saveReplyBtn = card.querySelector('.save-reply-btn');
        const replyTextarea = card.querySelector('.reply-textarea');

        if (replyBtn) {
            replyBtn.addEventListener('click', () => {
                const isHidden = replyForm.classList.contains('hidden');
                replyForm.classList.toggle('hidden', !isHidden);
                if (isHidden && replyTextarea) {
                    replyTextarea.focus();
                }
            });

            cancelReplyBtn?.addEventListener('click', () => {
                replyForm.classList.add('hidden');
                if (replyTextarea) replyTextarea.value = '';
            });

            saveReplyBtn?.addEventListener('click', async () => {
                const replyText = replyTextarea ? replyTextarea.value.trim() : '';
                if (!replyText) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'هشدار',
                        text: 'متن پاسخ نمی‌تواند خالی باشد.'
                    });
                    return;
                }

                const currentUser = state.pb.authStore.record || state.pb.authStore.model;
                if (!currentUser) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'عدم دسترسی',
                        text: 'جهت ارسال پاسخ ابتدا باید وارد سیستم شوید.'
                    });
                    return;
                }

                const typeSelect = $id('comment-type');
                const commentType = (typeSelect && typeSelect.value) ? typeSelect.value : 'کامنت عمومی';

                if (state.reportId) {
                    const data = {
                        report: state.reportId,
                        author: currentUser.id,
                        type: commentType,
                        text: replyText,
                        parent: comment.id,
                        version: 1
                    };

                    try {
                        await state.pb.collection(COMMENTS_COLLECTION).create(data);

                        resetCommentForm();
                        await fetchComments();
                        Swal.fire({
                            icon: 'warning',
                            title: 'ثبت موقت دیدگاه',
                            text: 'کامنت شما به‌صورت موقت ثبت شد و پس از فشردن دکمه «ویرایش | ثبت در دیتابیس» در دیتابیس قرار می‌گیرد.'
                        });
                    } catch (err) {
                        console.error('خطا در ثبت کامنت (جزئیات):', err?.data || err);
                        const serverMsg = err?.data?.message || err?.message || 'خطا در برقراری ارتباط با سرور';
                        Swal.fire({
                            icon: 'error',
                            title: 'خطا در ثبت دیدگاه',
                            text: serverMsg
                        });
                    }
                } else {
                    const tempComment = {
                        id: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        author: currentUser.id,
                        authorName: currentUser.name || currentUser.username || 'کاربر سیستم',
                        type: commentType,
                        text: replyText,
                        parent: comment.id,
                        version: 1,
                        isPending: true
                    };

                    state.pendingComments.push(tempComment);
                    renderCommentsList();
                    //     Swal.fire({
                    //         icon: 'info',
                    //         title: 'ثبت موقت',
                    //         text: 'پاسخ شما به‌صورت موقت ثبت شد و پس از ذخیره نهایی گزارش، ثبت خواهد شد.'
                    //     });

                    let timerInterval;
                    Swal.fire({
                        title: "ثبت موقت",
                        html: "پاسخ شما به‌صورت موقت ثبت شد و پس از ذخیره نهایی گزارش، ثبت خواهد شد",
                        timer: 3000,
                        timerProgressBar: true,
                        didOpen: () => {
                            Swal.showLoading();
                            const timer = Swal.getPopup().querySelector("b");
                            timerInterval = setInterval(() => {
                                timer.textContent = `${Swal.getTimerLeft()}`;
                            }, 100);
                        },
                        willClose: () => {
                            clearInterval(timerInterval);
                        }
                    }).then((result) => {
                        /* Read more about handling dismissals below */
                        if (result.dismiss === Swal.DismissReason.timer) console.log("I was closed by the timer");
                    });
                }

            });
        }

        if (isOwner) {
            const editBtn = card.querySelector('.edit-btn');
            const deleteBtn = card.querySelector('.delete-btn');
            const cancelEditBtn = card.querySelector('.cancel-edit-btn');
            const saveEditBtn = card.querySelector('.save-edit-btn');
            const displayBody = card.querySelector('.comment-display-body');
            const editForm = card.querySelector('.comment-edit-form');
            const editTextarea = card.querySelector('.edit-textarea');

            // نمایش فرم ویرایش
            editBtn?.addEventListener('click', () => {
                displayBody.classList.add('hidden');
                editForm.classList.remove('hidden');
            });

            // انصراف از ویرایش
            cancelEditBtn?.addEventListener('click', () => {
                editForm.classList.add('hidden');
                displayBody.classList.remove('hidden');
                editTextarea.value = comment.text;
            });

            // ذخیره ویرایش
            saveEditBtn?.addEventListener('click', async () => {
                const updatedText = editTextarea.value.trim();
                if (!updatedText) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'هشدار',
                        text: 'متن دیدگاه نمی‌تواند خالی باشد.'
                    });
                    return;
                }

                if (comment.isPending) {
                    comment.text = updatedText;
                    renderCommentsList();
                } else {
                    try {
                        const currentVersion = Number(comment.version) || 1;
                        await state.pb.collection(COMMENTS_COLLECTION).update(comment.id, {
                            text: updatedText,
                            version: currentVersion + 1
                        });
                        await fetchComments();
                        Swal.fire({
                            icon: 'success',
                            title: 'موفقیت',
                            text: 'دیدگاه با موفقیت ویرایش شد.'
                        });
                    } catch (err) {
                        console.error('خطا در ویرایش دیدگاه:', err);
                        Swal.fire({
                            icon: 'error',
                            title: 'خطا',
                            text: 'ویرایش دیدگاه با خطا مواجه شد.'
                        });
                    }
                }
            });

            // حذف دیدگاه با تاییدیه SweetAlert2
            deleteBtn?.addEventListener('click', async () => {
                const result = await Swal.fire({
                    title: 'حذف دیدگاه',
                    text: 'آیا از حذف این دیدگاه اطمینان دارید؟ این عملیات قابل بازگشت نیست.',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'بله، حذف شود',
                    cancelButtonText: 'انصراف'
                });

                if (!result.isConfirmed) return;

                if (comment.isPending) {
                    state.pendingComments = state.pendingComments.filter(c => c.id !== comment.id);
                    renderCommentsList();
                    Swal.fire({
                        icon: 'success',
                        title: 'حذف شد',
                        text: 'دیدگاه موقت حذف گردید.'
                    });
                } else {
                    try {
                        await state.pb.collection(COMMENTS_COLLECTION).delete(comment.id);
                        await fetchComments();
                        Swal.fire({
                            icon: 'success',
                            title: 'حذف شد',
                            text: 'دیدگاه با موفقیت حذف گردید.'
                        });
                    } catch (err) {
                        console.error('خطا در حذف دیدگاه:', err);
                        Swal.fire({
                            icon: 'error',
                            title: 'خطا',
                            text: 'حذف دیدگاه با خطا مواجه شد.'
                        });
                    }
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
            Swal.fire({
                icon: 'warning',
                title: 'عدم دسترسی',
                text: 'جهت ارسال کامنت ابتدا باید وارد سیستم شوید.'
            });
            return;
        }

        const textInput = $id('comment-text');
        const typeSelect = $id('comment-type');
        const parentInput = $id('comment-parent-id');

        const text = textInput ? textInput.value.trim() : '';
        const type = (typeSelect && typeSelect.value) ? typeSelect.value : 'کامنت عمومی';
        const parent = parentInput && parentInput.value.trim() !== '' ? parentInput.value : null;

        if (!text) {
            Swal.fire({
                icon: 'warning',
                title: 'هشدار',
                text: 'متن کامنت نمی‌تواند خالی باشد.'
            });
            return;
        }

        if (state.reportId) {
            const data = {
                report: state.reportId,
                author: currentUser.id,
                type: type,
                text: text,
                version: 1
            };
            if (parent) {
                data.parent = parent;
            }

            try {
                await state.pb.collection(COMMENTS_COLLECTION).create(data);

                resetCommentForm();
                await fetchComments();
                // showToast('کامنت شما به صورت موقت ثبت شد و پس از فشردن دکمه ویرایش در دیتابیس قرار می گیرد');
                // Swal.fire({
                //     icon: 'warning',
                //     title: 'ثبت موقت دیدگاه',
                //     text: 'کامنت شما به‌صورت موقت ثبت شد و پس از فشردن دکمه «ویرایش | ثبت» در دیتابیس قرار می‌گیرد.'
                // });
                // Swal.fire({
                //     position: "top-end",
                //     icon: "success",
                //     title: "کامنت شما به صورت موقت ثبت شد و پس از فشردن دکمه ویرایش در دیتابیس قرار می گیرد",
                //     showConfirmButton: false,
                //     timer: 5000
                // });
                let timerInterval;
                Swal.fire({
                    title: "ثبت موقت دیدگاه!",
                    html: "دیدگاه شما به صورت موقت ثبت شد و پس از فشردن دکمه ویرایش در دیتابیس قرار می گیرد.",
                    timer: 3000,
                    timerProgressBar: true,
                    didOpen: () => {
                        Swal.showLoading();
                        const timer = Swal.getPopup().querySelector("b");
                        timerInterval = setInterval(() => {
                            timer.textContent = `${Swal.getTimerLeft()}`;
                        }, 100);
                    },
                    willClose: () => {
                        clearInterval(timerInterval);
                    }
                }).then((result) => {
                    /* Read more about handling dismissals below */
                    if (result.dismiss === Swal.DismissReason.timer) console.log("I was closed by the timer");
                });
            } catch (err) {
                console.error('خطا در ثبت کامنت (جزئیات):', err?.data || err);
                const serverMsg = err?.data?.message || err?.message || 'خطا در برقراری ارتباط با سرور';
                Swal.fire({
                    icon: 'error',
                    title: 'خطا در ثبت دیدگاه',
                    text: serverMsg
                });
            }
        } else {
            const tempComment = {
                id: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                author: currentUser.id,
                authorName: currentUser.name || currentUser.username || 'کاربر سیستم',
                type: type,
                text: text,
                parent: parent || null,
                version: 1,
                isPending: true
            };

            state.pendingComments.push(tempComment);
            resetCommentForm();
            renderCommentsList();
            Swal.fire({
                icon: 'info',
                title: 'ثبت موقت',
                text: 'دیدگاه شما به‌صورت موقت ثبت شد و پس از ذخیره نهایی گزارش، ثبت خواهد شد.'
            });
        }
    }

    function resetCommentForm() {
        const textInput = $id('comment-text');
        const parentInput = $id('comment-parent-id');

        if (textInput) {
            textInput.value = '';
            textInput.style.height = 'auto';
        }
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
                parent: resolvedParent,
                version: item.version || 1
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