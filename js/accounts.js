// 全校班級、人數、缺號與教師/家長帳密統一派發中樞 (Class & Account Provisioning)
import { getSchoolClasses, saveSchoolClass, deleteSchoolClass } from './firebase.js';
import { generateSecurePassword, safeCopyToClipboard, exportToCSV, showToast, triggerHaptic, escapeHtml } from './utils.js';

export async function renderAccountsDashboard(container, currentSchool) {
    if (!currentSchool) return;

    container.innerHTML = `
        <div class="space-y-6">
            <!-- 頂部引言與操作列 -->
            <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-black">統一帳密派發</span>
                        <h2 class="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">全校班級與兩端帳密統一管理中樞</h2>
                    </div>
                    <p class="text-xs sm:text-sm text-slate-500 font-medium mt-1">學校管理端統一配置班級人數、缺號、教師端帳密與家長端憑證，導師開學登入即享完整班級，無需手動建班！</p>
                </div>

                <div class="flex items-center gap-2.5 flex-wrap">
                    <!-- 批量產生按鈕 -->
                    <button id="acc-batch-gen-btn" class="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>一鍵批量產生全校班級</span>
                    </button>

                    <!-- 單班新增按鈕 -->
                    <button id="acc-new-class-btn" class="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-plus"></i>
                        <span>新增單一班級</span>
                    </button>

                    <!-- 匯出 Excel 清冊 -->
                    <button id="acc-export-excel-btn" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-file-excel"></i>
                        <span>匯出全校帳密清冊 (CSV/Excel)</span>
                    </button>

                    <!-- 匯入 Excel 清冊 -->
                    <label class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs sm:text-sm transition-all border border-slate-200 flex items-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-file-import"></i>
                        <span>匯入班級清冊</span>
                        <input type="file" id="acc-import-file" accept=".csv,.xlsx,.xls" class="hidden">
                    </label>
                </div>
            </div>

            <!-- 班級列表卡片與統計 -->
            <div class="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div class="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <h3 class="font-black text-base sm:text-lg text-slate-800 flex items-center gap-2">
                            <i class="fa-solid fa-users-rectangle text-indigo-600"></i>
                            <span>全校班級派發清單</span>
                        </h3>
                        <span id="acc-class-count-badge" class="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-black text-xs">-- 班級</span>
                    </div>

                    <div class="flex items-center gap-2">
                        <div class="relative">
                            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input type="text" id="acc-search-input" placeholder="搜尋班級名稱、代碼或導師帳號..." class="pl-8 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:bg-white outline-none w-56 sm:w-64">
                        </div>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50/80 text-slate-500 font-bold text-xs uppercase border-b border-slate-100">
                                <th class="py-3.5 px-4">班級代碼</th>
                                <th class="py-3.5 px-4">班級名稱</th>
                                <th class="py-3.5 px-4 text-center">學生人數</th>
                                <th class="py-3.5 px-4">缺號名單</th>
                                <th class="py-3.5 px-4">教師端登入帳密</th>
                                <th class="py-3.5 px-4">家長端登入代碼/密碼</th>
                                <th class="py-3.5 px-4 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody id="acc-table-body" class="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            <tr>
                                <td colspan="7" class="text-center py-8 text-slate-400">
                                    <i class="fa-solid fa-spinner fa-spin mr-2"></i>載入班級清單中...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 批量產生全校班級彈窗 -->
        <div id="acc-batch-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-lg text-slate-800">一鍵批次產生全校班級帳密</h4>
                            <p class="text-xs text-slate-500 font-medium">系統將自動產生高強度密碼與雙端憑證，並同步至雲端</p>
                        </div>
                    </div>
                    <button id="acc-batch-close" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form id="acc-batch-form" class="space-y-4">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">起始年級</label>
                            <input type="number" id="batch-grade-start" min="1" max="12" value="7" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">結束年級</label>
                            <input type="number" id="batch-grade-end" min="1" max="12" value="9" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">每學年班級數</label>
                            <input type="number" id="batch-class-count" min="1" max="30" value="6" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">預設每班人數</label>
                            <input type="number" id="batch-student-count" min="10" max="60" value="30" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                    </div>

                    <div class="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed font-medium">
                        <i class="fa-solid fa-circle-info text-indigo-600 mr-1"></i>
                        將建立 <b>701~706、801~806、901~906</b> 共 18 個班級。自動生成教師帳密（如 <code>t701_shs</code>）與家長端專屬憑證代碼。
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2">
                        <button type="button" id="acc-batch-cancel" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs sm:text-sm">取消</button>
                        <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-play"></i>
                            <span>立即執行批量生成</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 單班新增/編輯彈窗 -->
        <div id="acc-single-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h4 id="acc-single-modal-title" class="font-black text-lg text-slate-800">新增班級與帳密派發</h4>
                    <button id="acc-single-close" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form id="acc-single-form" class="space-y-4">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">班級代碼 (如 701)</label>
                            <input type="text" id="single-class-code" required placeholder="701" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">班級名稱 (如 7年1班)</label>
                            <input type="text" id="single-class-name" required placeholder="7年1班" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">學生總人數</label>
                            <input type="number" id="single-student-count" min="1" max="100" value="30" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">缺號名單 (逗號分隔)</label>
                            <input type="text" id="single-missing-seats" placeholder="例如：14, 28" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                    </div>

                    <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <span class="block text-xs font-black text-slate-700">教師端登入資訊</span>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[11px] font-bold text-slate-500 mb-0.5">教師帳號</label>
                                <input type="text" id="single-teacher-user" required placeholder="t701_shs" class="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold bg-white outline-none">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold text-slate-500 mb-0.5">教師密碼</label>
                                <div class="flex items-center gap-1">
                                    <input type="text" id="single-teacher-pass" required placeholder="密碼" class="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold bg-white outline-none">
                                    <button type="button" id="btn-gen-t-pass" class="p-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-600 text-xs" title="隨機產生密碼"><i class="fa-solid fa-shuffle"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                        <span class="block text-xs font-black text-indigo-900">家長端登入資訊</span>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[11px] font-bold text-indigo-700 mb-0.5">家長查詢代碼</label>
                                <input type="text" id="single-parent-code" required placeholder="SHS_701" class="w-full px-2.5 py-2 rounded-lg border border-indigo-200 text-xs font-mono font-bold bg-white outline-none">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold text-indigo-700 mb-0.5">家長端密碼</label>
                                <div class="flex items-center gap-1">
                                    <input type="text" id="single-parent-pass" required placeholder="密碼" class="w-full px-2.5 py-2 rounded-lg border border-indigo-200 text-xs font-mono font-bold bg-white outline-none">
                                    <button type="button" id="btn-gen-p-pass" class="p-2 bg-indigo-200 hover:bg-indigo-300 rounded-lg text-indigo-700 text-xs" title="隨機產生密碼"><i class="fa-solid fa-shuffle"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2">
                        <button type="button" id="acc-single-cancel" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs sm:text-sm">取消</button>
                        <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>儲存並同步至雲端</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // 參照
    const tableBody = container.querySelector('#acc-table-body');
    const badgeEl = container.querySelector('#acc-class-count-badge');
    const searchInput = container.querySelector('#acc-search-input');
    const batchBtn = container.querySelector('#acc-batch-gen-btn');
    const batchModal = container.querySelector('#acc-batch-modal');
    const batchClose = container.querySelector('#acc-batch-close');
    const batchCancel = container.querySelector('#acc-batch-cancel');
    const batchForm = container.querySelector('#acc-batch-form');

    const singleBtn = container.querySelector('#acc-new-class-btn');
    const singleModal = container.querySelector('#acc-single-modal');
    const singleClose = container.querySelector('#acc-single-close');
    const singleCancel = container.querySelector('#acc-single-cancel');
    const singleForm = container.querySelector('#acc-single-form');

    const exportBtn = container.querySelector('#acc-export-excel-btn');
    const importInput = container.querySelector('#acc-import-file');

    let allClassList = [];

    const closeBatch = () => batchModal.classList.add('hidden');
    batchClose.addEventListener('click', closeBatch);
    batchCancel.addEventListener('click', closeBatch);

    const closeSingle = () => singleModal.classList.add('hidden');
    singleClose.addEventListener('click', closeSingle);
    singleCancel.addEventListener('click', closeSingle);

    // 隨機產生密碼按鈕
    container.querySelector('#btn-gen-t-pass').addEventListener('click', () => {
        container.querySelector('#single-teacher-pass').value = generateSecurePassword(8);
    });
    container.querySelector('#btn-gen-p-pass').addEventListener('click', () => {
        container.querySelector('#single-parent-pass').value = generateSecurePassword(6);
    });

    // 載入全校班級
    async function loadClasses() {
        allClassList = await getSchoolClasses(currentSchool.id);
        
        // 若雲端為空，自動載入預設 6 班
        if (allClassList.length === 0) {
            allClassList = [
                {
                    schoolId: currentSchool.id,
                    classCode: '701',
                    className: '7年1班',
                    studentCount: 30,
                    missingSeats: [14],
                    teacherUsername: 't701_shs',
                    teacherPassword: 'Pass#701',
                    parentAccessCode: 'SHS_701',
                    parentPassword: 'P#701'
                },
                {
                    schoolId: currentSchool.id,
                    classCode: '702',
                    className: '7年2班',
                    studentCount: 32,
                    missingSeats: [],
                    teacherUsername: 't702_shs',
                    teacherPassword: 'Pass#702',
                    parentAccessCode: 'SHS_702',
                    parentPassword: 'P#702'
                },
                {
                    schoolId: currentSchool.id,
                    classCode: '703',
                    className: '7年3班',
                    studentCount: 29,
                    missingSeats: [8, 22],
                    teacherUsername: 't703_shs',
                    teacherPassword: 'Pass#703',
                    parentAccessCode: 'SHS_703',
                    parentPassword: 'P#703'
                },
                {
                    schoolId: currentSchool.id,
                    classCode: '801',
                    className: '8年1班',
                    studentCount: 31,
                    missingSeats: [],
                    teacherUsername: 't801_shs',
                    teacherPassword: 'Pass#801',
                    parentAccessCode: 'SHS_801',
                    parentPassword: 'P#801'
                },
                {
                    schoolId: currentSchool.id,
                    classCode: '802',
                    className: '8年2班',
                    studentCount: 30,
                    missingSeats: [5],
                    teacherUsername: 't802_shs',
                    teacherPassword: 'Pass#802',
                    parentAccessCode: 'SHS_802',
                    parentPassword: 'P#802'
                },
                {
                    schoolId: currentSchool.id,
                    classCode: '901',
                    className: '9年1班',
                    studentCount: 33,
                    missingSeats: [],
                    teacherUsername: 't901_shs',
                    teacherPassword: 'Pass#901',
                    parentAccessCode: 'SHS_901',
                    parentPassword: 'P#901'
                }
            ];
            // 立即渲染，並背景非同步同步
            renderTable(allClassList);
            Promise.all(allClassList.map(c => saveSchoolClass(c).catch(() => {})));
            return;
        }

        renderTable(allClassList);
    }

    function renderTable(list) {
        badgeEl.textContent = `${list.length} 個班級`;
        tableBody.innerHTML = '';

        if (list.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">目前尚無班級資料，請點擊「一鍵批量產生」或「新增單一班級」</td></tr>`;
            return;
        }

        list.forEach(c => {
            const missingArr = Array.isArray(c.missingSeats) ? c.missingSeats : [];
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50/80 transition-colors border-b border-slate-100';
            tr.innerHTML = `
                <td class="py-3.5 px-4 font-mono font-bold text-slate-800">${escapeHtml(c.classCode)}</td>
                <td class="py-3.5 px-4 font-black text-slate-900">${escapeHtml(c.className)}</td>
                <td class="py-3.5 px-4 text-center font-bold text-slate-700">
                    <span class="px-2.5 py-1 rounded-full bg-slate-100 font-mono">${c.studentCount || 30} 人</span>
                </td>
                <td class="py-3.5 px-4">
                    ${missingArr.length > 0 
                        ? `<span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">缺 ${missingArr.join(', ')} 號</span>` 
                        : '<span class="text-slate-400">無缺號</span>'
                    }
                </td>
                <td class="py-3.5 px-4">
                    <div class="space-y-0.5 font-mono">
                        <div class="text-slate-800 font-bold flex items-center gap-1.5">
                            <i class="fa-solid fa-user-tie text-[10px] text-indigo-500"></i>
                            <span>${escapeHtml(c.teacherUsername || '-')}</span>
                        </div>
                        <div class="text-slate-500 text-[11px] flex items-center gap-1.5">
                            <i class="fa-solid fa-key text-[10px] text-slate-400"></i>
                            <span>${escapeHtml(c.teacherPassword || '-')}</span>
                        </div>
                    </div>
                </td>
                <td class="py-3.5 px-4">
                    <div class="space-y-0.5 font-mono">
                        <div class="text-indigo-700 font-bold flex items-center gap-1.5">
                            <i class="fa-solid fa-house-user text-[10px] text-indigo-500"></i>
                            <span>代碼：${escapeHtml(c.parentAccessCode || '-')}</span>
                        </div>
                        <div class="text-slate-500 text-[11px] flex items-center gap-1.5">
                            <i class="fa-solid fa-lock text-[10px] text-slate-400"></i>
                            <span>密碼：${escapeHtml(c.parentPassword || '-')}</span>
                        </div>
                    </div>
                </td>
                <td class="py-3.5 px-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <!-- 複製開學通知 -->
                        <button class="copy-notice-btn p-2 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-colors" title="一鍵複製本班家長開學通知函">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                        <!-- 編輯 -->
                        <button class="edit-class-btn p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors" title="編輯班級與密碼">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <!-- 刪除 -->
                        <button class="delete-class-btn p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors" title="刪除班級">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;

            // 複製通知函
            tr.querySelector('.copy-notice-btn').addEventListener('click', () => {
                const noticeText = `【${currentSchool.name} ${c.className} 家長開學通知函】\n親愛的家長您好：\n本學期本班全面啟用線上數位聯絡簿與作業點收系統。\n家長端專屬登入憑證如下：\n🔗 家長端網址：https://ian1021228.github.io/parent_dashboard_dev/\n🔑 班級查詢代碼：${c.parentAccessCode}\n🔒 登入密碼：${c.parentPassword}\n請家長每日準時查閱並完成線上電子簽章，感謝您的配合！`;
                safeCopyToClipboard(noticeText);
                showToast(`已複製【${c.className}】家長開學登入通知函文案！`, 'success');
            });

            // 編輯班級
            tr.querySelector('.edit-class-btn').addEventListener('click', () => {
                triggerHaptic('light');
                container.querySelector('#acc-single-modal-title').textContent = `編輯班級：${c.className}`;
                container.querySelector('#single-class-code').value = c.classCode;
                container.querySelector('#single-class-code').readOnly = true;
                container.querySelector('#single-class-name').value = c.className;
                container.querySelector('#single-student-count').value = c.studentCount || 30;
                container.querySelector('#single-missing-seats').value = missingArr.join(', ');
                container.querySelector('#single-teacher-user').value = c.teacherUsername || '';
                container.querySelector('#single-teacher-pass').value = c.teacherPassword || '';
                container.querySelector('#single-parent-code').value = c.parentAccessCode || '';
                container.querySelector('#single-parent-pass').value = c.parentPassword || '';
                singleModal.classList.remove('hidden');
            });

            // 刪除班級
            tr.querySelector('.delete-class-btn').addEventListener('click', async () => {
                if (confirm(`確定要刪除【${c.className} (${c.classCode})】嗎？刪除後該班帳密將失效！`)) {
                    triggerHaptic('medium');
                    await deleteSchoolClass(currentSchool.id, c.classCode);
                    showToast(`已刪除班級【${c.className}】`, 'info');
                    loadClasses();
                }
            });

            tableBody.appendChild(tr);
        });
    }

    // 搜尋
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderTable(allClassList);
            return;
        }
        const filtered = allClassList.filter(c => 
            (c.classCode || '').toLowerCase().includes(query) ||
            (c.className || '').toLowerCase().includes(query) ||
            (c.teacherUsername || '').toLowerCase().includes(query)
        );
        renderTable(filtered);
    });

    // 批次產生彈窗開啟
    batchBtn.addEventListener('click', () => {
        triggerHaptic('light');
        batchModal.classList.remove('hidden');
    });

    // 批次產生執行
    batchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        triggerHaptic('medium');
        const gStart = parseInt(container.querySelector('#batch-grade-start').value, 10);
        const gEnd = parseInt(container.querySelector('#batch-grade-end').value, 10);
        const classCount = parseInt(container.querySelector('#batch-class-count').value, 10);
        const studentCount = parseInt(container.querySelector('#batch-student-count').value, 10);

        showToast('正在批次建立班級與生成高強度帳密...', 'info');

        let createdCount = 0;
        for (let g = gStart; g <= gEnd; g++) {
            for (let c = 1; c <= classCount; c++) {
                const code = `${g}${String(c).padStart(2, '0')}`;
                const name = `${g}年${c}班`;
                const teacherUser = `t${code}_${currentSchool.id || 'shs'}`;
                const teacherPass = generateSecurePassword(8);
                const parentCode = `P${code}${currentSchool.id.toUpperCase()}`;
                const parentPass = generateSecurePassword(6);

                const classPayload = {
                    schoolId: currentSchool.id,
                    classCode: code,
                    className: name,
                    studentCount: studentCount,
                    missingSeats: [],
                    teacherUsername: teacherUser,
                    teacherPassword: teacherPass,
                    parentAccessCode: parentCode,
                    parentPassword: parentPass
                };

                await saveSchoolClass(classPayload);
                createdCount++;
            }
        }

        showToast(`已成功批次產生 ${createdCount} 個班級與兩端帳密憑證！`, 'success', 5000);
        closeBatch();
        loadClasses();
    });

    // 單班新增按鈕
    singleBtn.addEventListener('click', () => {
        triggerHaptic('light');
        container.querySelector('#acc-single-modal-title').textContent = '新增單一班級與帳密派發';
        container.querySelector('#single-class-code').readOnly = false;
        singleForm.reset();
        container.querySelector('#single-student-count').value = 30;
        container.querySelector('#single-teacher-pass').value = generateSecurePassword(8);
        container.querySelector('#single-parent-pass').value = generateSecurePassword(6);
        singleModal.classList.remove('hidden');
    });

    // 單班儲存
    singleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        triggerHaptic('medium');
        const classCode = container.querySelector('#single-class-code').value.trim();
        const className = container.querySelector('#single-class-name').value.trim();
        const studentCount = parseInt(container.querySelector('#single-student-count').value, 10);
        const missingSeatsStr = container.querySelector('#single-missing-seats').value.trim();
        const missingSeats = missingSeatsStr 
            ? missingSeatsStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
            : [];
        const teacherUsername = container.querySelector('#single-teacher-user').value.trim();
        const teacherPassword = container.querySelector('#single-teacher-pass').value.trim();
        const parentAccessCode = container.querySelector('#single-parent-code').value.trim();
        const parentPassword = container.querySelector('#single-parent-pass').value.trim();

        const payload = {
            schoolId: currentSchool.id,
            classCode,
            className,
            studentCount,
            missingSeats,
            teacherUsername,
            teacherPassword,
            parentAccessCode,
            parentPassword
        };

        try {
            await saveSchoolClass(payload);
            showToast(`班級【${className}】帳密已成功儲存並同步至雲端！`, 'success');
            closeSingle();
            loadClasses();
        } catch (err) {
            showToast('儲存失敗：' + err.message, 'error');
        }
    });

    // 匯出 CSV/Excel
    exportBtn.addEventListener('click', () => {
        triggerHaptic('medium');
        const rows = [
            ['學校名稱', currentSchool.name],
            ['學校代碼', currentSchool.code || currentSchool.id],
            ['匯出時間', new Date().toLocaleString()],
            [],
            ['班級代碼', '班級名稱', '學生總人數', '缺號名單', '教師端帳號', '教師端密碼', '家長端代碼', '家長端密碼', '家長端登入連結']
        ];

        allClassList.forEach(c => {
            const missingArr = Array.isArray(c.missingSeats) ? c.missingSeats.join(';') : '';
            const parentLink = `https://ian1021228.github.io/parent_dashboard_dev/?code=${c.parentAccessCode}`;
            rows.push([
                c.classCode,
                c.className,
                c.studentCount || 30,
                missingArr,
                c.teacherUsername || '',
                c.teacherPassword || '',
                c.parentAccessCode || '',
                c.parentPassword || '',
                parentLink
            ]);
        });

        exportToCSV(`${currentSchool.name}_全校班級帳密清冊.csv`, rows);
        showToast('已成功匯出全校班級帳密清冊 CSV', 'success');
    });

    // 匯入 CSV
    importInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        triggerHaptic('medium');

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const text = evt.target.result;
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                let imported = 0;

                for (const line of lines) {
                    const parts = line.split(',').map(p => p.replace(/"/g, '').trim());
                    // 檢查是否符合班級列 (長度>=3 且第一欄不是標題)
                    if (parts.length >= 3 && parts[0] !== '班級代碼' && parts[0] !== '學校名稱') {
                        const code = parts[0];
                        const name = parts[1];
                        const count = parseInt(parts[2], 10) || 30;
                        const missing = parts[3] ? parts[3].split(';').map(n => parseInt(n, 10)).filter(n => !isNaN(n)) : [];
                        const teacherU = parts[4] || `t${code}_${currentSchool.id}`;
                        const teacherP = parts[5] || generateSecurePassword(8);
                        const parentC = parts[6] || `P${code}${currentSchool.id.toUpperCase()}`;
                        const parentP = parts[7] || generateSecurePassword(6);

                        await saveSchoolClass({
                            schoolId: currentSchool.id,
                            classCode: code,
                            className: name,
                            studentCount: count,
                            missingSeats: missing,
                            teacherUsername: teacherU,
                            teacherPassword: teacherP,
                            parentAccessCode: parentC,
                            parentPassword: parentP
                        });
                        imported++;
                    }
                }

                showToast(`已成功匯入 ${imported} 個班級資料！`, 'success', 4000);
                loadClasses();
            } catch (err) {
                showToast('匯入失敗：' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    });

    await loadClasses();
}
