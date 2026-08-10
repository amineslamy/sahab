// pb_hooks/main.pb.js

routerAdd("POST", "/api/custom-change-password", (e) => {
    // دریافت اطلاعات کاربر جاری از روی توکن درخواست
    const authRecord = e.auth;
    if (!authRecord) {
        return e.json(401, { "message": "کاربر وارد نشده است." });
    }

    const data = e.requestInfo().body;
    const targetUserId = data.targetUserId;
    const newPassword = data.newPassword;

    if (!targetUserId || !newPassword) {
        return e.json(400, { "message": "شناسه کاربر و کلمه عبور جدید الزامی است." });
    }

    const currentRole = authRecord.get("role");

    // ۱. اگر کاربر در حال تغییر کلمه عبور خودش است
    const isSelf = (authRecord.id === targetUserId);

    // ۲. اگر کاربر سطح بالاتر است و می‌خواهد پسورد زیرمجموعه را تغییر دهد
    let isAllowedManage = false;
    if (currentRole === 'admin_site' || currentRole === 'admin_general') {
        isAllowedManage = true;
    } else if (currentRole === 'department') {
        const targetUser = $app.findRecordById("users", targetUserId);
        if (targetUser && targetUser.get("department_rel") === authRecord.id) {
            isAllowedManage = true;
        }
    }

    if (!isSelf && !isAllowedManage) {
        return e.json(403, { "message": "شما دسترسی لازم برای تغییر کلمه عبور این کاربر را ندارید." });
    }

    // به‌روزرسانی کلمه عبور با دسترسی Superuser سیستم (بدون نیاز به oldPassword)
    const record = $app.findRecordById("users", targetUserId);
    record.setPassword(newPassword);
    $app.save(record);

    return e.json(200, { "success": true, "message": "کلمه عبور با موفقیت به‌روزرسانی شد." });
});