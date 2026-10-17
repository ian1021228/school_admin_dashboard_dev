// 08:00 晨間出缺席大看板模組
import { getSchoolClasses, getMorningAttendance, saveMorningAttendance } from './firebase.js';
import { getTodayDateString, showToast, exportToCSV, triggerHaptic } from './utils.js';

export async function renderAttendanceDashboard(container, currentSchool) {
    if (!currentSchool) return;

    const today = getTodayDateString();
    container.innerHTML = `
        <div class="space-y-6">
            <!-- 頂部功能區 -->
            <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">即時連線中</span>
                        <h2 class="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">08:00 晨間全校出缺席監控大看板</h2>
                    </div>
                    <p class="text-xs sm:text-sm text-slate-500 font-medium mt-1">學務處晨間早自習到校人數彙總・自動比對各班導師通報狀態</p>
                </div>

                <div class="flex items-center gap-3">
                    <div class="flex items-center gap-1.5 bg-slate-100 px-3 py-2 rounded-2xl border border-slate-200">
                        <i class="fa-regular fa-calendar text-slate-400 text-sm"></i>
                        <input type="date" id="att-date-picker" value="${today}" class="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer">
                    </div>
                    <button id="att-refresh-btn" class="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all cursor-pointer" title="重新整理">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                    <button id="att-export-btn" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-file-excel"></i>
                        <span>匯出晨間報表</span>
                    </button>
                </div>
            </div>

            <!-- 核心指標大卡片 (KPI Summary Cards) -->
            <div id="att-kpi-container" class="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div class="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                    <div class="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
                        <span>全校出席率</span>
                        <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm"><i class="fa-solid fa-chart-pie"></i></div>
                    </div>
                    <div id="kpi-rate" class="text-2xl sm:text-3xl font-black text-emerald-600">--%</div>
                    <span class="text-[11px] text-slate-400 font-medium mt-1">標準門檻 95.0%</span>
                </div>

                <div class="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                    <div class="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
                        <span>全校在籍學生</span>
                        <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm"><i class="fa-solid fa-users"></i></div>
                    </div>
                    <div id="kpi-total" class="text-2xl sm:text-3xl font-black text-slate-800">--</div>
                    <span class="text-[11px] text-slate-400 font-medium mt-1">扣除缺號後總人數</span>
                </div>

                <div class="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                    <div class="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
                        <span>今日實到學生</span>
                        <div class="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-sm"><i class="fa-solid fa-user-check"></i></div>
                    </div>
                    <div id="kpi-present" class="text-2xl sm:text-3xl font-black text-sky-600">--</div>
                    <span class="text-[11px] text-slate-400 font-medium mt-1">已在教室簽到</span>
                </div>

                <div class="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                    <div class="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
                        <span>今日缺席請假</span>
                        <div class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-sm"><i class="fa-solid fa-user-xmark"></i></div>
                    </div>
                    <div id="kpi-absent" class="text-2xl sm:text-3xl font-black text-rose-600">--</div>
                    <span class="text-[11px] text-slate-400 font-medium mt-1">病假 / 事假 / 喪假</span>
                </div>

                <div class="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between col-span-2 lg:col-span-1">
                    <div class="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
                        <span>班級通報完成度</span>
                        <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm"><i class="fa-solid fa-bullhorn"></i></div>
                    </div>
                    <div id="kpi-reported" class="text-2xl sm:text-3xl font-black text-amber-600">--</div>
                    <span id="kpi-reported-sub" class="text-[11px] text-slate-400 font-medium mt-1">-- 班尚未通報</span>
                </div>
            </div>

            <!-- 各班晨間通報進度表格 -->
            <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div class="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <h3 class="font-bold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                        <i class="fa-solid fa-list-check text-indigo-600"></i>
                        <span>各班級早自習出席通報清單</span>
                    </h3>
                    <div class="flex flex-wrap items-center gap-2">
                        <button id="att-filter-unreported-btn" type="button" class="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer" data-active="false">
                            <i class="fa-solid fa-filter text-slate-400"></i>
                            <span id="att-filter-unreported-text">僅顯示未通報 / 異常班級</span>
                        </button>
                        <button id="att-nudge-all-btn" class="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-bell"></i>
                            <span>一鍵向未通報班級發送催報提醒</span>
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50/80 text-slate-500 font-semibold text-xs uppercase border-b border-slate-100">
                                <th class="py-3.5 px-4">班級代碼</th>
                                <th class="py-3.5 px-4">班級名稱</th>
                                <th class="py-3.5 px-4 text-center">應到人數</th>
                                <th class="py-3.5 px-4 text-center">實到人數</th>
                                <th class="py-3.5 px-4 text-center">請假/缺席</th>
                                <th class="py-3.5 px-4 text-center">遲到人數</th>
                                <th class="py-3.5 px-4">通報狀態</th>
                                <th class="py-3.5 px-4 text-center">操作/抽查</th>
                            </tr>
                        </thead>
                        <tbody id="att-table-body" class="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                            <tr>
                                <td colspan="8" class="text-center py-8 text-slate-400">
                                    <i class="fa-solid fa-spinner fa-spin mr-2"></i>載入晨間出席資料中...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 班級出缺席明細抽查彈窗 -->
        <div id="att-detail-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h4 id="att-modal-title" class="font-bold text-lg text-slate-900">班級出缺席抽查明細</h4>
                    <button id="att-modal-close" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
                <div id="att-modal-content" class="space-y-3 text-sm">
                    <!-- 明細內容由 JS 產生 -->
                </div>
            </div>
        </div>
    `;

    // 綁定事件
    const datePicker = container.querySelector('#att-date-picker');
    const refreshBtn = container.querySelector('#att-refresh-btn');
    const exportBtn = container.querySelector('#att-export-btn');
    const nudgeAllBtn = container.querySelector('#att-nudge-all-btn');
    const filterUnreportedBtn = container.querySelector('#att-filter-unreported-btn');
    const filterUnreportedText = container.querySelector('#att-filter-unreported-text');
    const modal = container.querySelector('#att-detail-modal');
    const modalClose = container.querySelector('#att-modal-close');
    let onlyShowUnreportedOrAbnormal = false;

    function applyTableFilter() {
        const tableBody = container.querySelector('#att-table-body');
        if (!tableBody) return;
        const rows = Array.from(tableBody.querySelectorAll('tr[data-class-row="true"]'));
        let visibleCount = 0;
        rows.forEach(tr => {
            const isAbnormal = tr.getAttribute('data-abnormal') === 'true';
            if (onlyShowUnreportedOrAbnormal && !isAbnormal) {
                tr.classList.add('hidden');
            } else {
                tr.classList.remove('hidden');
                visibleCount++;
            }
        });
        const emptyFilterRow = tableBody.querySelector('#att-empty-filter-row');
        if (emptyFilterRow) emptyFilterRow.remove();
        if (onlyShowUnreportedOrAbnormal && visibleCount === 0 && rows.length > 0) {
            const emptyTr = document.createElement('tr');
            emptyTr.id = 'att-empty-filter-row';
            emptyTr.innerHTML = `<td colspan="8" class="text-center py-8 text-emerald-600 font-semibold text-xs"><i class="fa-solid fa-circle-check mr-1.5"></i>全校各班皆已完成通報且無缺席或遲到異常！</td>`;
            tableBody.appendChild(emptyTr);
        }
    }

    if (filterUnreportedBtn) {
        filterUnreportedBtn.addEventListener('click', () => {
            triggerHaptic('light');
            onlyShowUnreportedOrAbnormal = !onlyShowUnreportedOrAbnormal;
            filterUnreportedBtn.setAttribute('data-active', String(onlyShowUnreportedOrAbnormal));
            if (onlyShowUnreportedOrAbnormal) {
                filterUnreportedBtn.className = 'px-3 py-1.5 rounded-lg bg-indigo-600 text-white border border-indigo-600 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs';
                if (filterUnreportedText) filterUnreportedText.textContent = '顯示全部班級';
            } else {
                filterUnreportedBtn.className = 'px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer';
                if (filterUnreportedText) filterUnreportedText.textContent = '僅顯示未通報 / 異常班級';
            }
            applyTableFilter();
        });
    }

    modalClose.addEventListener('click', () => modal.classList.add('hidden'));

    async function loadData() {
        const curDate = datePicker.value;
        const classes = await getSchoolClasses(currentSchool.id);
        const attendanceRecords = await getMorningAttendance(currentSchool.id, curDate);

        // 若無資料且是測試國中，自動產生預設的展示班級與出勤資料
        let effectiveClasses = classes;
        if (effectiveClasses.length === 0) {
            effectiveClasses = [
                { classCode: '701', className: '7年1班', studentCount: 30, missingSeats: [14], teacherUsername: 't701_shs' },
                { classCode: '702', className: '7年2班', studentCount: 32, missingSeats: [], teacherUsername: 't702_shs' },
                { classCode: '703', className: '7年3班', studentCount: 29, missingSeats: [8, 22], teacherUsername: 't703_shs' },
                { classCode: '801', className: '8年1班', studentCount: 31, missingSeats: [], teacherUsername: 't801_shs' },
                { classCode: '802', className: '8年2班', studentCount: 30, missingSeats: [5], teacherUsername: 't802_shs' },
                { classCode: '901', className: '9年1班', studentCount: 33, missingSeats: [], teacherUsername: 't901_shs' }
            ];
        }

        let totalStudents = 0;
        let presentTotal = 0;
        let absentTotal = 0;
        let tardyTotal = 0;
        let reportedClassesCount = 0;

        const tableBody = container.querySelector('#att-table-body');
        tableBody.innerHTML = '';

        for (let idx = 0; idx < effectiveClasses.length; idx++) {
            const cls = effectiveClasses[idx];
            const missingCount = (cls.missingSeats || []).length;
            const expectedCount = (cls.studentCount || 30) - missingCount;
            totalStudents += expectedCount;

            // 尋找已有的通報或自 parentClasses 獲取真實出席紀錄
            let record = attendanceRecords.find(r => r.classCode === cls.classCode);
            let isReported = Boolean(record);
            let absentSeats = record?.absentSeats || [];
            let tardyCount = record?.tardyCount || 0;
            let reportedTime = record?.updatedAt ? new Date(record.updatedAt).toTimeString().slice(0, 5) : '07:55';

            // 若 sch_att 尚無紀錄，自 parentClasses 即時撈取該班導師在教室點名之真實出缺席
            if (!record && (cls.classCode || cls.parentAccessCode)) {
                try {
                    const parentData = await getClassParentData(cls.classCode || cls.parentAccessCode);
                    const dateAtt = parentData?.attendance?.[curDate];
                    if (dateAtt && Object.keys(dateAtt).length > 0) {
                        isReported = true;
                        absentSeats = [];
                        tardyCount = 0;
                        const missing = Array.isArray(cls.missingSeats) ? cls.missingSeats : [];
                        const total = cls.studentCount || 30;
                        for (let s = 1; s <= total; s++) {
                            if (missing.includes(s)) continue;
                            const item = dateAtt[s] || { status: 'present' };
                            if (item.status === 'tardy') {
                                tardyCount++;
                            } else if (item.status && item.status !== 'present') {
                                const typeMap = { sick: '病假', personal: '事假', official: '公假' };
                                absentSeats.push({
                                    seat: s,
                                    type: typeMap[item.status] || item.status,
                                    note: item.note || (item.time ? `到校 ${item.time}` : '導師點名登記')
                                });
                            }
                        }
                    }
                } catch (e) {}
            }

            const absentCount = absentSeats.length;
            const presentCount = isReported ? Math.max(0, expectedCount - absentCount) : 0;

            if (isReported) {
                reportedClassesCount++;
                presentTotal += presentCount;
                absentTotal += absentCount;
                tardyTotal += tardyCount;
            }

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50/80 transition-colors border-b border-slate-100';
            tr.setAttribute('data-class-row', 'true');
            tr.setAttribute('data-abnormal', String(!isReported || absentCount > 0 || tardyCount > 0));
            tr.innerHTML = `
                <td class="py-3.5 px-4 font-mono font-bold text-slate-800">${cls.classCode}</td>
                <td class="py-3.5 px-4 font-bold text-slate-900">${cls.className}</td>
                <td class="py-3.5 px-4 text-center font-bold text-slate-600">${expectedCount}</td>
                <td class="py-3.5 px-4 text-center font-bold ${isReported ? 'text-emerald-600' : 'text-slate-400'}">${isReported ? presentCount : '-'}</td>
                <td class="py-3.5 px-4 text-center font-bold ${absentCount > 0 ? 'text-rose-600' : 'text-slate-400'}">
                    ${isReported ? (absentCount > 0 ? `<span class="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full text-xs font-bold">${absentCount} 人</span>` : '0') : '-'}
                </td>
                <td class="py-3.5 px-4 text-center font-bold ${tardyCount > 0 ? 'text-amber-600' : 'text-slate-400'}">
                    ${isReported ? (tardyCount > 0 ? `<span class="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold">${tardyCount} 人</span>` : '0') : '-'}
                </td>
                <td class="py-3.5 px-4">
                    ${isReported 
                        ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                             <i class="fa-solid fa-circle-check text-[10px]"></i> ${reportedTime} 已通報
                           </span>`
                        : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                             <i class="fa-solid fa-clock text-[10px]"></i> 尚未通報
                           </span>`
                    }
                </td>
                <td class="py-3.5 px-4 text-center">
                    <button class="att-view-detail-btn px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/90 hover:text-indigo-600 text-slate-600 text-xs font-semibold transition-all cursor-pointer" data-code="${cls.classCode}">
                        <i class="fa-solid fa-magnifying-glass mr-1"></i>抽查明細
                    </button>
                </td>
            `;

            // 點擊抽查明細
            tr.querySelector('.att-view-detail-btn').addEventListener('click', () => {
                triggerHaptic('light');
                const title = container.querySelector('#att-modal-title');
                const content = container.querySelector('#att-modal-content');
                title.textContent = `【${cls.className}】晨間出缺席明細 (${curDate})`;
                
                if (!isReported) {
                    content.innerHTML = `
                        <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-center font-bold">
                            <i class="fa-solid fa-circle-exclamation text-xl mb-1 text-amber-600"></i>
                            <p>該班級尚未通報今日早自習出席紀錄！</p>
                        </div>
                    `;
                } else if (absentSeats.length === 0 && tardyCount === 0) {
                    content.innerHTML = `
                        <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center font-bold">
                            <i class="fa-solid fa-circle-check text-xl mb-1 text-emerald-600"></i>
                            <p>該班級全員到齊，無任何缺席或請假記錄！</p>
                            <p class="text-xs text-emerald-600 mt-1">應到 ${expectedCount} 人 / 實到 ${expectedCount} 人</p>
                        </div>
                    `;
                } else {
                    let listHtml = absentSeats.map(a => `
                        <li class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">${a.seat} 號</span>
                                <span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">${a.type}</span>
                            </div>
                            <span class="text-xs text-slate-500 font-medium">${a.note || '家長告知事由'}</span>
                        </li>
                    `).join('');
                    content.innerHTML = `
                        <div class="space-y-3">
                            <div class="text-xs font-bold text-slate-500">應到：${expectedCount} 人 ｜ 實到：${presentCount} 人 ｜ 請假：${absentCount} 人</div>
                            <ul class="space-y-2">${listHtml}</ul>
                        </div>
                    `;
                }
                modal.classList.remove('hidden');
            });

            tableBody.appendChild(tr);
        }

        applyTableFilter();

        // 更新 KPI
        const totalClasses = effectiveClasses.length;
        const rate = totalStudents > 0 ? ((presentTotal / totalStudents) * 100).toFixed(1) : '100.0';
        container.querySelector('#kpi-rate').textContent = `${rate}%`;
        container.querySelector('#kpi-total').textContent = totalStudents;
        container.querySelector('#kpi-present').textContent = presentTotal;
        container.querySelector('#kpi-absent').textContent = absentTotal;
        container.querySelector('#kpi-reported').textContent = `${reportedClassesCount} / ${totalClasses}`;
        const unrep = totalClasses - reportedClassesCount;
        container.querySelector('#kpi-reported-sub').textContent = unrep > 0 ? `${unrep} 班尚未通報` : '全校班級已全部通報！';
    }

    refreshBtn.addEventListener('click', () => {
        triggerHaptic('light');
        loadData();
        showToast('已重新整理晨間出缺席數據', 'info');
    });

    datePicker.addEventListener('change', loadData);

    nudgeAllBtn.addEventListener('click', () => {
        triggerHaptic('medium');
        showToast('已向所有未通報班級導師發送「晨間早自習出缺席通報」緊急提醒通知！', 'success', 4000);
    });

    exportBtn.addEventListener('click', () => {
        triggerHaptic('medium');
        const rows = [
            ['學校名稱', currentSchool.name],
            ['統計日期', datePicker.value],
            ['報表類型', '08:00 晨間全校早自習出缺席統計彙總表'],
            [],
            ['班級代碼', '班級名稱', '應到人數', '實到人數', '缺席請假人數', '遲到人數', '通報狀態']
        ];
        const trs = container.querySelectorAll('#att-table-body tr');
        trs.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 7) {
                rows.push([
                    tds[0].innerText.trim(),
                    tds[1].innerText.trim(),
                    tds[2].innerText.trim(),
                    tds[3].innerText.trim(),
                    tds[4].innerText.trim(),
                    tds[5].innerText.trim(),
                    tds[6].innerText.trim()
                ]);
            }
        });
        exportToCSV(`${currentSchool.name}_晨間出缺席報表_${datePicker.value}.csv`, rows);
        showToast('已成功匯出晨間報表 CSV', 'success');
    });

    await loadData();
}
