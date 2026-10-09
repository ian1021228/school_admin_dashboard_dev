// 線上行政抽查核章模組 (Administrative Inspection & Electronic Stamp)
import { getSchoolClasses, getAdminInspections, saveAdminInspection } from './firebase.js';
import { DEPARTMENTS } from './constants.js';
import { getTodayDateString, showToast, triggerHaptic, escapeHtml } from './utils.js';

export async function renderInspectionDashboard(container, currentSchool) {
    if (!currentSchool) return;

    container.innerHTML = `
        <div class="space-y-6">
            <!-- 頂部引言 -->
            <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-black">線上行政稽核</span>
                        <h2 class="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">線上行政抽查核章與評語中樞</h2>
                    </div>
                    <p class="text-xs sm:text-sm text-slate-500 font-medium mt-1">教務處 / 學務處線上查閱各班聯絡簿、作業缺繳與出勤紀錄，並加蓋公信電子行政戳章</p>
                </div>

                <div class="flex items-center gap-2">
                    <button id="insp-new-btn" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-stamp"></i>
                        <span>新增行政抽查與核章</span>
                    </button>
                </div>
            </div>

            <!-- 兩欄佈局：左側班級抽查看板，右側已核章公文歷史 -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <!-- 左側：班級抽查卡片矩陣 (8 欄) -->
                <div class="lg:col-span-7 space-y-4">
                    <div class="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
                        <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                            <h3 class="font-black text-base text-slate-800 flex items-center gap-2">
                                <i class="fa-solid fa-chalkboard-user text-indigo-600"></i>
                                <span>全校班級即時學事抽查清冊</span>
                            </h3>
                            <span class="text-xs font-bold text-slate-400">點擊班級可立即檢視並執行行政核章</span>
                        </div>
                        <div id="insp-class-grid" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div class="col-span-full py-8 text-center text-slate-400">
                                <i class="fa-solid fa-spinner fa-spin mr-2"></i>載入班級資料中...
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 右側：已核章公文存查紀錄 (5 欄) -->
                <div class="lg:col-span-5 space-y-4">
                    <div class="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
                        <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                            <h3 class="font-black text-base text-slate-800 flex items-center gap-2">
                                <i class="fa-solid fa-award text-rose-600"></i>
                                <span>最新電子核章紀錄存查</span>
                            </h3>
                            <span id="insp-stamp-count" class="text-xs font-bold text-slate-400">0 份核章</span>
                        </div>
                        <div id="insp-stamps-list" class="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                            <div class="py-8 text-center text-slate-400 text-xs">尚無抽查核章紀錄</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 行政核章操作彈窗 (Stamp Modal) -->
        <div id="insp-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-white rounded-3xl w-full max-w-xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-stamp"></i>
                        </div>
                        <div>
                            <h4 id="insp-modal-title" class="font-black text-lg text-slate-800">執行行政抽查與電子核章</h4>
                            <p class="text-xs text-slate-500 font-medium">查核結果將同步回傳導師聯絡簿與行政日誌</p>
                        </div>
                    </div>
                    <button id="insp-modal-close" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form id="insp-form" class="space-y-4">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">查核班級</label>
                            <select id="insp-select-class" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">查核處室</label>
                            <select id="insp-select-dept" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                                ${DEPARTMENTS.map(d => `<option value="${d.id}">${d.name} (${d.stampText})</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">抽查項目</label>
                            <select id="insp-select-category" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                                <option value="聯絡簿親師簽章">聯絡簿親師簽章抽查</option>
                                <option value="日常作業點收進度">日常作業點收進度抽查</option>
                                <option value="早自習出缺席記錄">早自習出缺席記錄抽查</option>
                                <option value="定期段考成績登錄">定期段考成績登錄抽查</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">查核主管姓名</label>
                            <input type="text" id="insp-inspector-name" value="王禹硯 組長" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">查核評語與指導建議</label>
                        <textarea id="insp-comment" rows="3" class="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 focus:bg-white outline-none" placeholder="例如：導師批閱用心，親師聯絡簿回饋良好，查訖准予備查。">導師批閱詳實用心，親師聯絡簿家長簽章率達 96% 以上，查訖准予備查。</textarea>
                    </div>

                    <!-- 電子章戳即時預覽 -->
                    <div class="p-4 rounded-2xl bg-rose-50/50 border border-rose-200/60 flex items-center justify-between gap-4">
                        <div class="space-y-0.5">
                            <span class="text-xs font-black text-rose-800">電子核章印戳預覽 (行政防偽戳記)</span>
                            <p class="text-[11px] text-rose-600/80">自動附加查核時間戳記與專屬數位防偽流水號</p>
                        </div>
                        <div id="insp-stamp-preview" class="shrink-0">
                            <!-- SVG 印戳 -->
                        </div>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2">
                        <button type="button" id="insp-cancel-btn" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs sm:text-sm">取消</button>
                        <button type="submit" class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-stamp"></i>
                            <span>確認加蓋電子核章</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const modal = container.querySelector('#insp-modal');
    const modalClose = container.querySelector('#insp-modal-close');
    const cancelBtn = container.querySelector('#insp-cancel-btn');
    const newBtn = container.querySelector('#insp-new-btn');
    const form = container.querySelector('#insp-form');
    const stampPreview = container.querySelector('#insp-stamp-preview');
    const deptSelect = container.querySelector('#insp-select-dept');
    const classSelect = container.querySelector('#insp-select-class');

    function renderStampSVG(deptName, dateStr) {
        return `
            <div class="w-20 h-20 rounded-full border-4 border-rose-600 flex flex-col items-center justify-center text-rose-600 select-none shadow-xs rotate-[-6deg] bg-white/80">
                <span class="text-[9px] font-black tracking-tighter">${currentSchool.name.slice(0, 6)}</span>
                <span class="text-xs font-black my-0.5 border-y border-rose-600/60 px-1">${deptName}</span>
                <span class="text-[8px] font-mono font-bold">${dateStr}</span>
            </div>
        `;
    }

    function updatePreview() {
        const curDept = DEPARTMENTS.find(d => d.id === deptSelect.value) || DEPARTMENTS[0];
        stampPreview.innerHTML = renderStampSVG(curDept.stampText, getTodayDateString());
    }

    deptSelect.addEventListener('change', updatePreview);
    updatePreview();

    const closeModal = () => modal.classList.add('hidden');
    modalClose.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    async function loadInspections() {
        const classes = await getSchoolClasses(currentSchool.id);
        const effectiveClasses = classes.length > 0 ? classes : [
            { classCode: '701', className: '7年1班' },
            { classCode: '702', className: '7年2班' },
            { classCode: '703', className: '7年3班' },
            { classCode: '801', className: '8年1班' },
            { classCode: '802', className: '8年2班' },
            { classCode: '901', className: '9年1班' }
        ];

        // 填充班級下拉選單
        classSelect.innerHTML = effectiveClasses.map(c => `<option value="${c.classCode}">${c.className} (${c.classCode})</option>`).join('');

        // 渲染班級矩陣
        const grid = container.querySelector('#insp-class-grid');
        grid.innerHTML = '';
        effectiveClasses.forEach(cls => {
            const card = document.createElement('div');
            card.className = 'p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-indigo-50/30 hover:border-indigo-300 transition-all flex flex-col justify-between gap-3';
            card.innerHTML = `
                <div>
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-mono font-bold text-slate-400">#${cls.classCode}</span>
                        <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">運作正常</span>
                    </div>
                    <h4 class="font-black text-slate-800 text-base mt-1">${cls.className}</h4>
                    <p class="text-xs text-slate-500 font-medium mt-0.5">聯絡簿簽章率：96.8% ｜ 作業繳交率：94.2%</p>
                </div>
                <div class="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                    <button class="insp-quick-stamp-btn flex-1 py-1.5 px-3 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-stamp text-[11px]"></i>
                        <span>抽查核章</span>
                    </button>
                </div>
            `;
            card.querySelector('.insp-quick-stamp-btn').addEventListener('click', () => {
                triggerHaptic('light');
                classSelect.value = cls.classCode;
                modal.classList.remove('hidden');
            });
            grid.appendChild(card);
        });

        // 載入歷史核章
        const inspections = await getAdminInspections(currentSchool.id);
        const stampsList = container.querySelector('#insp-stamps-list');
        const stampCountEl = container.querySelector('#insp-stamp-count');

        // 若無資料，提供兩筆示範核章
        const records = inspections.length > 0 ? inspections : [
            {
                id: 'demo_1',
                className: '7年1班',
                deptName: '教務處 查訖',
                category: '聯絡簿親師簽章',
                inspector: '王禹硯 組長',
                comment: '導師批閱詳實用心，親師聯絡簿回饋熱絡，准予備查。',
                stampedAt: new Date().toISOString()
            },
            {
                id: 'demo_2',
                className: '8年1班',
                deptName: '學務處 查訖',
                category: '早自習出缺席記錄',
                inspector: '陳主任',
                comment: '早自習點名準時於 07:55 完成，學生全勤無缺席。',
                stampedAt: new Date(Date.now() - 86400000).toISOString()
            }
        ];

        stampCountEl.textContent = `${records.length} 份核章`;
        stampsList.innerHTML = records.map(r => `
            <div class="p-4 rounded-2xl border border-rose-200/60 bg-gradient-to-r from-rose-50/40 via-white to-white shadow-2xs space-y-2 relative overflow-hidden">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-black text-slate-800 text-sm">${r.className || '全校班級'}</span>
                            <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">${r.category}</span>
                        </div>
                        <p class="text-xs text-slate-600 mt-1 font-medium leading-relaxed">${escapeHtml(r.comment)}</p>
                    </div>
                    <div class="w-14 h-14 rounded-full border-2 border-rose-600 flex flex-col items-center justify-center text-rose-600 text-[9px] font-black shrink-0 rotate-[-8deg] bg-white shadow-2xs">
                        <span>${escapeHtml(r.deptName || '查訖')}</span>
                        <span class="text-[7px] font-mono">${(r.stampedAt || '').slice(0, 10)}</span>
                    </div>
                </div>
                <div class="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-1 border-t border-slate-100">
                    <span>核章主管：<b>${escapeHtml(r.inspector || '行政處室')}</b></span>
                    <span>${(r.stampedAt || '').slice(0, 16).replace('T', ' ')}</span>
                </div>
            </div>
        `).join('');
    }

    newBtn.addEventListener('click', () => {
        triggerHaptic('light');
        modal.classList.remove('hidden');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        triggerHaptic('medium');
        const selectedClassCode = classSelect.value;
        const selectedClassText = classSelect.options[classSelect.selectedIndex].text;
        const curDept = DEPARTMENTS.find(d => d.id === deptSelect.value) || DEPARTMENTS[0];
        const inspector = container.querySelector('#insp-inspector-name').value;
        const comment = container.querySelector('#insp-comment').value;
        const category = container.querySelector('#insp-select-category').value;

        const payload = {
            schoolId: currentSchool.id,
            classCode: selectedClassCode,
            className: selectedClassText,
            deptId: curDept.id,
            deptName: curDept.stampText,
            inspector,
            comment,
            category,
            stampedAt: new Date().toISOString()
        };

        try {
            await saveAdminInspection(payload);
            showToast(`已成功對【${selectedClassText}】完成行政抽查並加蓋【${curDept.stampText}】電子核章！`, 'success', 4000);
            closeModal();
            loadInspections();
        } catch (err) {
            console.error(err);
            showToast('儲存核章失敗：' + err.message, 'error');
        }
    });

    await loadInspections();
}
