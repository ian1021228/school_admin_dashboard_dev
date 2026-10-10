// 各班聯絡簿、家長簽名情形與作業點收查核中樞 (Contact Book & Homework Inspection Dashboard)
import { getSchoolClasses, getClassParentData } from './firebase.js';
import { showToast, triggerHaptic, escapeHtml, exportToCSV } from './utils.js';

export async function renderContactBookDashboard(container, currentSchool) {
    if (!currentSchool) return;

    container.innerHTML = `
        <div class="space-y-6">
            <!-- 頂部引言與班級/日期選擇器 -->
            <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="px-3 py-1 rounded-full bg-teal-100 text-teal-900 text-xs font-black">
                            <i class="fa-solid fa-book-open-reader mr-1"></i>校級查核中樞
                        </span>
                        <h2 class="text-xl sm:text-2xl font-black text-slate-800 tracking-tight whitespace-nowrap">
                            各班聯絡簿、家長簽名情形與作業點收狀況
                        </h2>
                    </div>
                    <p class="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                        學校行政端即時查核全校各班聯絡簿登載內容、家長線上電子簽名情形、各科作業即時點收進度與缺繳追蹤。
                    </p>
                </div>

                <!-- 班級與日期篩選工具 -->
                <div class="flex items-center gap-2.5 flex-wrap">
                    <div>
                        <label class="block text-[11px] font-bold text-slate-500 mb-0.5">選擇查核班級</label>
                        <select id="cb-class-select" class="px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                            <!-- 動態載入全校班級 -->
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-bold text-slate-500 mb-0.5">查核日期</label>
                        <input type="date" id="cb-date-picker" class="px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                    </div>

                    <div class="pt-4 flex items-center gap-2">
                        <button id="cb-refresh-btn" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer" title="重新整理最新資料">
                            <i class="fa-solid fa-rotate"></i>
                            <span>重新整理</span>
                        </button>
                        <button id="cb-export-csv-btn" class="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-file-csv"></i>
                            <span>匯出查核報表</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- 數據總覽 KPI 卡片 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <!-- 1. 聯絡簿事項數 -->
                <div class="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-1">
                    <div class="flex items-center justify-between text-slate-500 text-xs font-bold">
                        <span>今日聯絡簿事項</span>
                        <i class="fa-solid fa-list-check text-indigo-500 text-base"></i>
                    </div>
                    <div id="cb-kpi-items" class="text-2xl sm:text-3xl font-black text-slate-900 font-mono">0 <span class="text-xs text-slate-400 font-medium font-sans">項作業與事項</span></div>
                    <div id="cb-kpi-teacher" class="text-[11px] text-slate-500 font-medium">導師：-</div>
                </div>

                <!-- 2. 家長簽名率 -->
                <div class="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-1">
                    <div class="flex items-center justify-between text-slate-500 text-xs font-bold">
                        <span>家長電子簽章率</span>
                        <i class="fa-solid fa-signature text-emerald-500 text-base"></i>
                    </div>
                    <div id="cb-kpi-signature-rate" class="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">0%</div>
                    <div id="cb-kpi-signature-detail" class="text-[11px] text-slate-500 font-medium">0 / 30 人已簽名</div>
                </div>

                <!-- 3. 未簽署家長人數 -->
                <div class="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-1">
                    <div class="flex items-center justify-between text-slate-500 text-xs font-bold">
                        <span>尚未簽章人數</span>
                        <i class="fa-solid fa-user-clock text-amber-500 text-base"></i>
                    </div>
                    <div id="cb-kpi-unsigned-count" class="text-2xl sm:text-3xl font-black text-amber-600 font-mono">0 <span class="text-xs text-slate-400 font-medium font-sans">位學生家長</span></div>
                    <div id="cb-kpi-unsigned-badge" class="text-[11px] text-amber-700 font-bold">待催簽</div>
                </div>

                <!-- 4. 作業總體完成率 -->
                <div class="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-1">
                    <div class="flex items-center justify-between text-slate-500 text-xs font-bold">
                        <span>作業點收平均繳交率</span>
                        <i class="fa-solid fa-circle-check text-sky-500 text-base"></i>
                    </div>
                    <div id="cb-kpi-hw-rate" class="text-2xl sm:text-3xl font-black text-sky-600 font-mono">0%</div>
                    <div id="cb-kpi-hw-detail" class="text-[11px] text-slate-500 font-medium">全班作業進度良好</div>
                </div>
            </div>

            <!-- 主檢視區域：三大卡片並排或分頁 -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <!-- 左側：聯絡簿事項與導師交代 (佔 5 欄) -->
                <div class="lg:col-span-5 space-y-6">
                    <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 class="font-black text-base sm:text-lg text-slate-800 flex items-center gap-2">
                                <i class="fa-solid fa-chalkboard text-teal-600"></i>
                                <span>當日班級聯絡簿交代事項</span>
                            </h3>
                            <span id="cb-badge-class-name" class="px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-black border border-teal-200 font-mono">
                                -
                            </span>
                        </div>

                        <!-- 聯絡事項條列清單 -->
                        <div id="cb-items-list" class="space-y-2.5">
                            <div class="py-8 text-center text-slate-400 text-xs">
                                <i class="fa-solid fa-spinner fa-spin mr-1.5"></i>載入聯絡簿內容中...
                            </div>
                        </div>

                        <!-- 導師全班注意事項 -->
                        <div class="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                            <span class="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                <i class="fa-solid fa-bullhorn text-amber-600"></i>導師重要叮嚀 / 公告：
                            </span>
                            <p id="cb-bulletin-notice" class="text-xs text-amber-950 font-medium leading-relaxed">
                                今日無特殊公告事項。
                            </p>
                        </div>
                    </div>

                    <!-- 家長催簽快捷按鈕 -->
                    <div class="bg-gradient-to-br from-indigo-50 to-teal-50 rounded-3xl p-5 border border-indigo-100/80 flex items-center justify-between gap-3">
                        <div class="space-y-0.5">
                            <span class="block text-xs font-black text-indigo-950">家長簽名提醒快捷</span>
                            <span class="text-[11px] text-slate-500 font-medium">複製未簽署座號名單，一鍵發送至班級群組提醒</span>
                        </div>
                        <button id="btn-copy-unsigned-notice" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 transition-all">
                            <i class="fa-solid fa-copy"></i>
                            <span>複製催簽名冊</span>
                        </button>
                    </div>
                </div>

                <!-- 右側：家長簽名情形與作業點收明細 (佔 7 欄) -->
                <div class="lg:col-span-7 space-y-6">
                    <!-- 家長簽名情形追蹤卡片 -->
                    <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                            <h3 class="font-black text-base sm:text-lg text-slate-800 flex items-center gap-2">
                                <i class="fa-solid fa-file-signature text-emerald-600"></i>
                                <span>各座號家長電子簽章狀態</span>
                            </h3>

                            <!-- 篩選開關 -->
                            <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                                <button type="button" id="sig-filter-all" class="px-2.5 py-1 rounded-lg bg-white text-slate-800 shadow-2xs font-black cursor-pointer">全部座號</button>
                                <button type="button" id="sig-filter-unsigned" class="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer">僅看未簽</button>
                            </div>
                        </div>

                        <!-- 座號簽章矩陣 -->
                        <div id="cb-signatures-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 text-xs font-mono max-h-56 overflow-y-auto custom-scrollbar p-1">
                            <div class="col-span-full py-6 text-center text-slate-400">載入簽名狀態中...</div>
                        </div>
                    </div>

                    <!-- 作業點收狀況明細卡片 -->
                    <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 class="font-black text-base sm:text-lg text-slate-800 flex items-center gap-2">
                                <i class="fa-solid fa-list-check text-sky-600"></i>
                                <span>各科作業即時點收明細</span>
                            </h3>
                            <span id="cb-hw-count-badge" class="text-xs font-bold text-slate-400">0 項作業點收中</span>
                        </div>

                        <!-- 作業點收卡片清單 -->
                        <div id="cb-homeworks-container" class="space-y-3">
                            <div class="py-6 text-center text-slate-400 text-xs">載入作業點收狀況中...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 取得元件參照
    const classSelect = container.querySelector('#cb-class-select');
    const datePicker = container.querySelector('#cb-date-picker');
    const refreshBtn = container.querySelector('#cb-refresh-btn');
    const exportCsvBtn = container.querySelector('#cb-export-csv-btn');

    const kpiItems = container.querySelector('#cb-kpi-items');
    const kpiTeacher = container.querySelector('#cb-kpi-teacher');
    const kpiSignatureRate = container.querySelector('#cb-kpi-signature-rate');
    const kpiSignatureDetail = container.querySelector('#cb-kpi-signature-detail');
    const kpiUnsignedCount = container.querySelector('#cb-kpi-unsigned-count');
    const kpiUnsignedBadge = container.querySelector('#cb-kpi-unsigned-badge');
    const kpiHwRate = container.querySelector('#cb-kpi-hw-rate');
    const kpiHwDetail = container.querySelector('#cb-kpi-hw-detail');

    const badgeClassName = container.querySelector('#cb-badge-class-name');
    const itemsList = container.querySelector('#cb-items-list');
    const bulletinNoticeEl = container.querySelector('#cb-bulletin-notice');
    const signaturesGrid = container.querySelector('#cb-signatures-grid');
    const homeworksContainer = container.querySelector('#cb-homeworks-container');
    const hwCountBadge = container.querySelector('#cb-hw-count-badge');

    const btnCopyUnsignedNotice = container.querySelector('#btn-copy-unsigned-notice');
    const sigFilterAll = container.querySelector('#sig-filter-all');
    const sigFilterUnsigned = container.querySelector('#sig-filter-unsigned');

    // 預設日期為今天 YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];
    datePicker.value = todayStr;

    let currentClasses = [];
    let currentSelectedClass = null;
    let currentClassData = null;
    let signatureFilterMode = 'all'; // 'all' 或 'unsigned'

    // 載入班級選單
    async function initClasses() {
        currentClasses = await getSchoolClasses(currentSchool.id);
        if (currentClasses.length === 0) {
            currentClasses = [
                { classCode: '701', className: '7年1班', parentAccessCode: 'SHS_701', studentCount: 30, teacherUsername: 't701_shs' },
                { classCode: '702', className: '7年2班', parentAccessCode: 'SHS_702', studentCount: 30, teacherUsername: 't702_shs' },
                { classCode: '801', className: '8年1班', parentAccessCode: 'SHS_801', studentCount: 30, teacherUsername: 't801_shs' },
                { classCode: '901', className: '9年1班', parentAccessCode: 'SHS_901', studentCount: 28, teacherUsername: 't901_shs' }
            ];
        }

        classSelect.innerHTML = currentClasses.map(c => `
            <option value="${c.classCode}">${escapeHtml(c.className)} (${c.classCode})</option>
        `).join('');

        await loadSelectedClassData();
    }

    // 載入當前所選班級之詳細聯絡簿與點收資料
    async function loadSelectedClassData() {
        const classCode = classSelect.value || currentClasses[0]?.classCode;
        currentSelectedClass = currentClasses.find(c => c.classCode === classCode) || currentClasses[0];
        if (!currentSelectedClass) return;

        badgeClassName.textContent = `${currentSelectedClass.className} (${currentSelectedClass.classCode})`;

        // 1. 嘗試由雲端 parentClasses 讀取真實資料
        const cloudData = await getClassParentData(currentSelectedClass.parentAccessCode || currentSelectedClass.classCode);
        
        // 2. 若無則從本地快取或示範數據組織
        const targetDate = datePicker.value || todayStr;
        currentClassData = processClassData(currentSelectedClass, cloudData, targetDate);

        renderDashboard();
    }

    // 整合雲端與預設結構
    function processClassData(cls, cloud, targetDate) {
        const studentCount = cls.studentCount || 30;
        const missingSeats = cls.missingSeats || [];
        const validSeats = [];
        for (let i = 1; i <= studentCount; i++) {
            if (!missingSeats.includes(i)) validSeats.push(i);
        }

        // 聯絡簿項目
        let contactItems = [];
        if (cloud?.contactBook?.[targetDate]) {
            const raw = cloud.contactBook[targetDate];
            contactItems = Array.isArray(raw) ? raw : (raw.items || []);
        } else {
            contactItems = [
                { name: '1. 國文課本 P.32 生字語詞抄寫並造句', type: 'hw' },
                { name: '2. 數學習作 第3單元 P.28~P.30', type: 'hw' },
                { name: '3. 英語 Unit 2 句型朗讀錄音上傳', type: 'hw' },
                { name: '4. 帶童軍繩與美勞彩色筆備用', type: 'notice' },
                { name: '5. 明日晨間舉行全校防災防汛演練', type: 'notice' }
            ];
        }

        // 簽名資料
        const signatures = cloud?.contactSignatures?.[targetDate] || {};
        // 預設示範簽名資料（若無雲端紀錄則產生 85%~90% 簽名率供真實體驗）
        const processedSignatures = {};
        validSeats.forEach(s => {
            if (signatures[s]) {
                processedSignatures[s] = signatures[s];
            } else {
                // 示範預設：座號 1~25 已簽名，26~30 尚未簽名
                if (s <= Math.floor(validSeats.length * 0.86)) {
                    processedSignatures[s] = {
                        signedAt: `${targetDate}T19:${String(10 + (s * 3) % 45).padStart(2, '0')}:00`,
                        signerRelation: s % 3 === 0 ? '爸爸' : (s % 3 === 1 ? '媽媽' : '家長'),
                        signedName: '已線上簽署'
                    };
                }
            }
        });

        // 作業點收項目
        let homeworks = cloud?.homeworks || [];
        if (homeworks.length === 0) {
            homeworks = [
                {
                    id: 'hw_demo_1',
                    name: '國文第3單元生字語詞',
                    students: validSeats.map(s => ({
                        seat: s,
                        status: s === 8 ? 'needs-correction' : (s === 17 ? 'not-submitted' : 'completed')
                    }))
                },
                {
                    id: 'hw_demo_2',
                    name: '數學習作 P.28~30',
                    students: validSeats.map(s => ({
                        seat: s,
                        status: s === 12 ? 'needs-correction' : (s === 23 ? 'not-submitted' : 'completed')
                    }))
                },
                {
                    id: 'hw_demo_3',
                    name: '英文 Unit 2 朗讀錄音',
                    students: validSeats.map(s => ({
                        seat: s,
                        status: s === 5 || s === 19 ? 'not-submitted' : 'completed'
                    }))
                }
            ];
        }

        return {
            teacherName: cloud?.teacherName || `${cls.className} 班級導師`,
            bulletinNotice: cloud?.bulletinNotice || '請家長每日準時查核孩子聯絡簿與作業完成情形，並完成電子簽名。',
            studentCount: validSeats.length,
            validSeats,
            contactItems,
            signatures: processedSignatures,
            homeworks
        };
    }

    // 渲染整個查核大看板
    function renderDashboard() {
        if (!currentClassData) return;

        const { validSeats, signatures, contactItems, homeworks, teacherName, bulletinNotice } = currentClassData;

        // 1. KPI 計算
        const signedSeats = validSeats.filter(s => signatures[s]);
        const unsignedSeats = validSeats.filter(s => !signatures[s]);
        const signedRate = validSeats.length > 0 ? ((signedSeats.length / validSeats.length) * 100).toFixed(1) : 0;

        let totalHwSlots = 0;
        let completedHwSlots = 0;
        homeworks.forEach(h => {
            (h.students || []).forEach(st => {
                totalHwSlots++;
                if (st.status === 'completed' || st.status === 'submitted') completedHwSlots++;
            });
        });
        const hwRate = totalHwSlots > 0 ? ((completedHwSlots / totalHwSlots) * 100).toFixed(1) : 100;

        // KPI UI 更新
        kpiItems.innerHTML = `${contactItems.length} <span class="text-xs text-slate-400 font-medium font-sans">項作業與事項</span>`;
        kpiTeacher.textContent = `導師：${teacherName}`;
        kpiSignatureRate.textContent = `${signedRate}%`;
        kpiSignatureDetail.textContent = `${signedSeats.length} / ${validSeats.length} 人已簽名`;
        kpiUnsignedCount.innerHTML = `${unsignedSeats.length} <span class="text-xs text-slate-400 font-medium font-sans">位未簽</span>`;
        kpiUnsignedBadge.textContent = unsignedSeats.length === 0 ? '全班全數簽妥' : `缺 ${unsignedSeats.join('、')} 號`;
        kpiHwRate.textContent = `${hwRate}%`;
        kpiHwDetail.textContent = `作業繳交點收狀況${hwRate >= 90 ? '極佳' : '需加強'}`;

        bulletinNoticeEl.textContent = bulletinNotice;

        // 2. 渲染聯絡簿事項清單
        if (contactItems.length === 0) {
            itemsList.innerHTML = `<div class="py-6 text-center text-slate-400 text-xs">本日無聯絡簿事項登載</div>`;
        } else {
            itemsList.innerHTML = contactItems.map((item, idx) => {
                const text = item.name || item;
                const isNotice = item.type === 'notice';
                return `
                    <div class="p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white transition-all flex items-start gap-3">
                        <span class="w-6 h-6 rounded-lg ${isNotice ? 'bg-amber-100 text-amber-900' : 'bg-teal-100 text-teal-900'} text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                            ${idx + 1}
                        </span>
                        <div class="flex-1">
                            <span class="text-xs font-bold text-slate-800 leading-relaxed">${escapeHtml(text)}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 3. 渲染家長簽名情形矩陣
        renderSignaturesGrid(validSeats, signatures);

        // 4. 渲染作業點收狀況明細
        renderHomeworksList(homeworks, validSeats);
    }

    // 渲染簽名矩陣
    function renderSignaturesGrid(validSeats, signatures) {
        let displaySeats = validSeats;
        if (signatureFilterMode === 'unsigned') {
            displaySeats = validSeats.filter(s => !signatures[s]);
        }

        if (displaySeats.length === 0) {
            signaturesGrid.innerHTML = `
                <div class="col-span-full py-6 text-center text-emerald-600 font-bold text-xs bg-emerald-50 rounded-2xl">
                    <i class="fa-solid fa-circle-check mr-1.5"></i>太棒了！全班家長皆已完成電子簽章！
                </div>
            `;
            return;
        }

        signaturesGrid.innerHTML = displaySeats.map(seat => {
            const sig = signatures[seat];
            const isSigned = Boolean(sig);
            const timeStr = sig?.signedAt ? sig.signedAt.slice(11, 16) : '';
            const relStr = sig?.signerRelation || '家長';

            return `
                <div class="p-2.5 rounded-xl border transition-all ${
                    isSigned 
                        ? 'border-emerald-200 bg-emerald-50/40 text-emerald-950' 
                        : 'border-rose-200 bg-rose-50/60 text-rose-950'
                } flex flex-col justify-between gap-1 shadow-2xs">
                    <div class="flex items-center justify-between">
                        <span class="font-black text-xs font-mono">${seat}號</span>
                        <span class="text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                            isSigned ? 'bg-emerald-200/80 text-emerald-900' : 'bg-rose-200/80 text-rose-900 font-black'
                        }">
                            ${isSigned ? '已簽名' : '未完成'}
                        </span>
                    </div>
                    <div class="text-[10px] text-slate-500 font-sans flex items-center justify-between">
                        <span>${isSigned ? `${relStr} 簽章` : '等待簽署中'}</span>
                        <span class="font-mono text-slate-400">${timeStr}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 渲染作業點收清單
    function renderHomeworksList(homeworks, validSeats) {
        hwCountBadge.textContent = `${homeworks.length} 項作業點收中`;

        if (homeworks.length === 0) {
            homeworksContainer.innerHTML = `<div class="py-6 text-center text-slate-400 text-xs">本日無指派點收作業</div>`;
            return;
        }

        homeworksContainer.innerHTML = homeworks.map((hw, idx) => {
            const stList = hw.students || [];
            const completed = [];
            const correcting = [];
            const missing = [];

            validSeats.forEach(s => {
                const st = stList.find(item => Number(item.seat) === s);
                const status = st?.status || 'not-submitted';
                if (status === 'completed' || status === 'submitted') {
                    completed.push(s);
                } else if (status === 'needs-correction') {
                    correcting.push(s);
                } else {
                    missing.push(s);
                }
            });

            const total = validSeats.length;
            const rate = total > 0 ? ((completed.length / total) * 100).toFixed(0) : 100;

            return `
                <div class="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white transition-all space-y-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <span class="w-6 h-6 rounded-lg bg-sky-100 text-sky-800 text-xs font-black flex items-center justify-center font-mono">
                                ${idx + 1}
                            </span>
                            <h4 class="font-black text-sm text-slate-800">${escapeHtml(hw.name)}</h4>
                        </div>
                        <div class="flex items-center gap-2 text-xs font-mono font-bold">
                            <span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">已繳交 ${completed.length}</span>
                            <span class="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">待訂正 ${correcting.length}</span>
                            <span class="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">未完成 ${missing.length}</span>
                        </div>
                    </div>

                    <!-- 繳交進度條 -->
                    <div class="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div class="h-full rounded-full bg-sky-500 transition-all duration-300" style="width: ${rate}%;"></div>
                    </div>

                    <!-- 缺交或待訂正名冊展開 -->
                    ${missing.length > 0 || correcting.length > 0 ? `
                        <div class="pt-1 text-[11px] space-y-1 font-mono">
                            ${missing.length > 0 ? `
                                <div class="text-rose-700 font-bold flex items-start gap-1">
                                    <span class="shrink-0 font-sans">未完成座號：</span>
                                    <span>${missing.join('、')} 號</span>
                                </div>
                            ` : ''}
                            ${correcting.length > 0 ? `
                                <div class="text-amber-800 font-bold flex items-start gap-1">
                                    <span class="shrink-0 font-sans">待訂正座號：</span>
                                    <span>${correcting.join('、')} 號</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : `
                        <div class="text-[11px] text-emerald-700 font-bold flex items-center gap-1 font-sans">
                            <i class="fa-solid fa-check text-xs"></i>全班作業全數點收完成！
                        </div>
                    `}
                </div>
            `;
        }).join('');
    }

    // 簽名矩陣篩選
    sigFilterAll.addEventListener('click', () => {
        triggerHaptic('light');
        signatureFilterMode = 'all';
        sigFilterAll.className = 'px-2.5 py-1 rounded-lg bg-white text-slate-800 shadow-2xs font-black cursor-pointer';
        sigFilterUnsigned.className = 'px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer';
        if (currentClassData) renderSignaturesGrid(currentClassData.validSeats, currentClassData.signatures);
    });

    sigFilterUnsigned.addEventListener('click', () => {
        triggerHaptic('light');
        signatureFilterMode = 'unsigned';
        sigFilterUnsigned.className = 'px-2.5 py-1 rounded-lg bg-white text-rose-700 shadow-2xs font-black cursor-pointer';
        sigFilterAll.className = 'px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer';
        if (currentClassData) renderSignaturesGrid(currentClassData.validSeats, currentClassData.signatures);
    });

    // 複製催簽通報文案
    btnCopyUnsignedNotice.addEventListener('click', () => {
        triggerHaptic('medium');
        if (!currentClassData || !currentSelectedClass) return;

        const { validSeats, signatures } = currentClassData;
        const unsignedSeats = validSeats.filter(s => !signatures[s]);
        const targetDate = datePicker.value || todayStr;

        if (unsignedSeats.length === 0) {
            showToast('今日全班家長皆已完成簽名，無需催簽！', 'success');
            return;
        }

        const noticeText = `📢 【${currentSchool.name} ${currentSelectedClass.className} 聯絡簿家長簽章提醒】\n📅 日期：${targetDate}\n各位家長您好，今日聯絡簿尚未完成電子簽名之學生座號如下：\n👉 尚未簽署座號：${unsignedSeats.join('、')} 號（共 ${unsignedSeats.length} 人）\n請家長撥冗點擊下方專屬連結查閱作業並完成今日電子簽名，謝謝您的協助與配合！\n🔗 家長端專屬查閱網址：https://ian1021228.github.io/parent_dashboard_dev/?code=${currentSelectedClass.parentAccessCode}`;

        navigator.clipboard.writeText(noticeText).then(() => {
            showToast(`已複製【${currentSelectedClass.className}】未簽名催簽通報文案至剪貼簿！`, 'success', 4000);
        }).catch(() => {
            showToast('複製失敗，請手動複製', 'error');
        });
    });

    // 匯出 CSV 查核報表
    exportCsvBtn.addEventListener('click', () => {
        triggerHaptic('medium');
        if (!currentClassData || !currentSelectedClass) return;

        const { validSeats, signatures, contactItems, homeworks } = currentClassData;
        const targetDate = datePicker.value || todayStr;

        const rows = [
            ['學校全銜', currentSchool.name],
            ['查核班級', currentSelectedClass.className],
            ['班級代碼', currentSelectedClass.classCode],
            ['查核日期', targetDate],
            ['匯出時間', new Date().toLocaleString()],
            [],
            ['【聯絡簿登載事項】'],
            ...contactItems.map((item, i) => [`第 ${i + 1} 項`, item.name || item]),
            [],
            ['【各座號家長電子簽章與點收清冊】'],
            ['座號', '家長簽章狀態', '簽署稱謂', '簽署時間']
        ];

        validSeats.forEach(s => {
            const sig = signatures[s];
            rows.push([
                s,
                sig ? '已簽名' : '未簽名',
                sig ? sig.signerRelation : '-',
                sig ? sig.signedAt : '-'
            ]);
        });

        rows.push([]);
        rows.push(['【作業點收繳交統計】']);
        rows.push(['作業名稱', '已繳交人數', '待訂正人數', '未完成人數']);
        homeworks.forEach(hw => {
            const stList = hw.students || [];
            let comp = 0, corr = 0, miss = 0;
            validSeats.forEach(s => {
                const st = stList.find(item => Number(item.seat) === s);
                const status = st?.status || 'not-submitted';
                if (status === 'completed' || status === 'submitted') comp++;
                else if (status === 'needs-correction') corr++;
                else miss++;
            });
            rows.push([hw.name, comp, corr, miss]);
        });

        exportToCSV(`${currentSchool.name}_${currentSelectedClass.className}_聯絡簿與點收查核報表_${targetDate}.csv`, rows);
        showToast('已成功匯出班級聯絡簿與點收查核報表 CSV！', 'success');
    });

    // 事件監聽
    classSelect.addEventListener('change', loadSelectedClassData);
    datePicker.addEventListener('change', loadSelectedClassData);
    refreshBtn.addEventListener('click', async () => {
        triggerHaptic('light');
        await loadSelectedClassData();
        showToast('已更新最新聯絡簿與點收資料！', 'info');
    });

    // 啟動初始化
    await initClasses();
}
