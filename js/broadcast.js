// 全校校安廣播中樞模組 (Campus Safety & Emergency Broadcast)
import { getCampusAnnouncements, saveCampusAnnouncement, toggleCampusAnnouncement } from './firebase.js';
import { showToast, triggerHaptic, escapeHtml } from './utils.js';

export async function renderBroadcastDashboard(container, currentSchool) {
    if (!currentSchool) return;

    container.innerHTML = `
        <div class="space-y-6">
            <!-- 頂部引言 -->
            <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-black">即時廣播網</span>
                        <h2 class="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">全校校安廣播與緊急通報中樞</h2>
                    </div>
                    <p class="text-xs sm:text-sm text-slate-500 font-medium mt-1">發布校安緊急防護、防汛防颱天候停課、全校流感防疫通知，即時推播至教師端與家長端頂部跑馬看板</p>
                </div>

                <div class="flex items-center gap-2">
                    <button id="bc-new-btn" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-bullhorn"></i>
                        <span>發布新校安廣播</span>
                    </button>
                </div>
            </div>

            <!-- 廣播清單 -->
            <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 class="font-black text-base text-slate-800 flex items-center gap-2">
                        <i class="fa-solid fa-tower-broadcast text-rose-600"></i>
                        <span>目前全校廣播頻道狀態</span>
                    </h3>
                    <span id="bc-active-count" class="text-xs font-bold text-slate-400">0 則廣播生效中</span>
                </div>

                <div id="bc-list-container" class="space-y-3">
                    <div class="py-8 text-center text-slate-400 text-sm">
                        <i class="fa-solid fa-spinner fa-spin mr-2"></i>載入廣播清單中...
                    </div>
                </div>
            </div>
        </div>

        <!-- 發布新廣播彈窗 -->
        <div id="bc-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-bullhorn"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-lg text-slate-800">建立全校緊急校安廣播</h4>
                            <p class="text-xs text-slate-500 font-medium">廣播訊息將即時呈現在全校教師端與家長端首頁</p>
                        </div>
                    </div>
                    <button id="bc-modal-close" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form id="bc-form" class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">通報等級</label>
                        <select id="bc-level" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                            <option value="emergency">🚨 緊急校安事件 (最高警戒，全站醒目閃爍紅底跑馬燈)</option>
                            <option value="weather">⚠️ 天候防汛預警 (停課、防颱與安全疏散防範)</option>
                            <option value="epidemic">🛡️ 全校公共衛生 (流行性流感、腸病毒防護加強)</option>
                            <option value="notice">📢 重要行政通報 (常態行政公告)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">廣播對象</label>
                        <select id="bc-target" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                            <option value="all">全體師生與家長 (教師端 + 家長端同步接收)</option>
                            <option value="teachers">僅限全校教師端 (內部行政廣播)</option>
                            <option value="parents">僅限家長端 (親師專屬宣導)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">廣播標題</label>
                        <input type="text" id="bc-title" required placeholder="例如：【防汛緊急通知】今日因豪大雨，全校第六節提前放學" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">廣播詳細內容</label>
                        <textarea id="bc-content" rows="3" required placeholder="請詳述通報事由、因應措施與各班導師協處原則..." class="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 focus:bg-white outline-none"></textarea>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2">
                        <button type="button" id="bc-cancel-btn" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs sm:text-sm">取消</button>
                        <button type="submit" class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-paper-plane"></i>
                            <span>立即推播全校廣播</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const modal = container.querySelector('#bc-modal');
    const modalClose = container.querySelector('#bc-modal-close');
    const cancelBtn = container.querySelector('#bc-cancel-btn');
    const newBtn = container.querySelector('#bc-new-btn');
    const form = container.querySelector('#bc-form');
    const listContainer = container.querySelector('#bc-list-container');
    const activeCountEl = container.querySelector('#bc-active-count');

    const closeModal = () => modal.classList.add('hidden');
    modalClose.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    newBtn.addEventListener('click', () => {
        triggerHaptic('light');
        modal.classList.remove('hidden');
    });

    async function loadBroadcasts() {
        const broadcasts = await getCampusAnnouncements(currentSchool.id);
        const list = broadcasts.length > 0 ? broadcasts : [
            {
                id: 'demo_bc_1',
                title: '【校安廣播】放學交通安全加強宣導',
                content: '近日校門口周邊車流量較大，請各班導師提醒學生過馬路走斑馬線，並由交服隊指引安全通行。',
                level: 'notice',
                target: 'all',
                active: true,
                createdAt: new Date().toISOString()
            }
        ];

        const activeCount = list.filter(b => b.active).length;
        activeCountEl.textContent = `${activeCount} 則廣播生效中`;

        const badgeMap = {
            emergency: { bg: 'bg-rose-100 text-rose-800 border-rose-300', icon: 'fa-shield-halved', label: '緊急校安' },
            weather: { bg: 'bg-amber-100 text-amber-900 border-amber-300', icon: 'fa-cloud-bolt', label: '天候預警' },
            epidemic: { bg: 'bg-teal-100 text-teal-800 border-teal-300', icon: 'fa-virus-covid', label: '公衛防疫' },
            notice: { bg: 'bg-blue-100 text-blue-800 border-blue-300', icon: 'fa-bullhorn', label: '行政通報' }
        };

        listContainer.innerHTML = list.map(b => {
            const badge = badgeMap[b.level] || badgeMap.notice;
            return `
                <div class="p-4 sm:p-5 rounded-2xl border ${b.active ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200 bg-slate-50/50 opacity-60'} flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
                    <div class="space-y-1.5 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black border ${badge.bg}">
                                <i class="fa-solid ${badge.icon} text-[10px]"></i> ${badge.label}
                            </span>
                            <span class="text-xs font-bold text-slate-500">對象：${b.target === 'all' ? '全體端' : (b.target === 'teachers' ? '僅教師端' : '僅家長端')}</span>
                            <span class="text-xs font-mono text-slate-400">${(b.createdAt || '').slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <h4 class="font-black text-slate-800 text-base">${escapeHtml(b.title)}</h4>
                        <p class="text-xs text-slate-600 font-medium leading-relaxed">${escapeHtml(b.content)}</p>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                        <button class="bc-toggle-btn px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${b.active ? 'bg-amber-100 hover:bg-amber-200 text-amber-900' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'}" data-id="${b.id}" data-active="${b.active}">
                            <i class="fa-solid ${b.active ? 'fa-pause' : 'fa-play'} mr-1"></i>
                            <span>${b.active ? '停止廣播' : '重新推播'}</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        listContainer.querySelectorAll('.bc-toggle-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                triggerHaptic('light');
                const id = btn.dataset.id;
                const curActive = btn.dataset.active === 'true';
                try {
                    await toggleCampusAnnouncement(id, !curActive);
                    showToast(`已${curActive ? '停止' : '啟用'}此項廣播推播`, 'info');
                    loadBroadcasts();
                } catch (e) {
                    showToast('變更狀態失敗', 'error');
                }
            });
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        triggerHaptic('medium');
        const level = container.querySelector('#bc-level').value;
        const target = container.querySelector('#bc-target').value;
        const title = container.querySelector('#bc-title').value.trim();
        const content = container.querySelector('#bc-content').value.trim();

        const payload = {
            schoolId: currentSchool.id,
            level,
            target,
            title,
            content,
            active: true
        };

        try {
            await saveCampusAnnouncement(payload);
            showToast('已成功向全校發布即時校安廣播！', 'success', 4000);
            closeModal();
            form.reset();
            loadBroadcasts();
        } catch (e) {
            showToast('發布廣播失敗：' + e.message, 'error');
        }
    });

    await loadBroadcasts();
}
