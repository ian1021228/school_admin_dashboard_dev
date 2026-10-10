// 全校班級、人數、缺號、學生帳號批量註冊與容量監控唯讀中樞 (Class & Account Provisioning & Storage Metering)
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
                        <span class="px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-black whitespace-nowrap">統一管理中樞</span>
                        <h2 class="text-xl sm:text-2xl font-black text-slate-800 tracking-tight whitespace-nowrap">全校班級、學生帳號與容量監控中樞</h2>
                    </div>
                    <p class="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                        學校管理端統一配置班級人數、缺號、教師與家長憑證、<b>學生學籍帳號批量註冊</b>、以及<b>各班容量即時監控與遠端唯讀保護</b>。
                    </p>
                </div>

                <div class="flex items-center gap-2.5 flex-wrap">
                    <!-- 批量註冊學生帳號按鈕 (依使用者指示新增) -->
                    <button id="acc-batch-students-btn" class="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer whitespace-nowrap active:scale-95">
                        <i class="fa-solid fa-id-card"></i>
                        <span>批量註冊學生帳號 (指定格式)</span>
                    </button>

                    <!-- 批量產生班級按鈕 -->
                    <button id="acc-batch-gen-btn" class="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer whitespace-nowrap active:scale-95">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>一鍵批量產生班級</span>
                    </button>

                    <!-- 單班新增按鈕 -->
                    <button id="acc-new-class-btn" class="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap active:scale-95">
                        <i class="fa-solid fa-plus"></i>
                        <span>新增單一班級</span>
                    </button>

                    <!-- 匯出 Excel 清冊 -->
                    <button id="acc-export-excel-btn" class="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center gap-2 cursor-pointer whitespace-nowrap">
                        <i class="fa-solid fa-file-excel text-emerald-600"></i>
                        <span>匯出全校清冊 (CSV)</span>
                    </button>

                    <!-- 匯入 Excel 清冊 -->
                    <label class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs sm:text-sm transition-all border border-slate-200 flex items-center gap-2 cursor-pointer whitespace-nowrap">
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
                        <h3 class="font-black text-base sm:text-lg text-slate-800 flex items-center gap-2 whitespace-nowrap">
                            <i class="fa-solid fa-users-rectangle text-indigo-600"></i>
                            <span>全校班級派發與容量監控清單</span>
                        </h3>
                        <span id="acc-class-count-badge" class="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-black text-xs whitespace-nowrap">-- 班級</span>
                    </div>

                    <div class="flex items-center gap-2">
                        <div class="relative">
                            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input type="text" id="acc-search-input" placeholder="搜尋班級名稱、代碼或導師帳號..." class="pl-8 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:bg-white outline-none w-56 sm:w-64 whitespace-nowrap">
                        </div>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50/80 text-slate-500 font-bold text-xs uppercase border-b border-slate-100 whitespace-nowrap">
                                <th class="py-3.5 px-4 whitespace-nowrap">班級代碼</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">班級名稱</th>
                                <th class="py-3.5 px-4 text-center whitespace-nowrap">學生人數</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">缺號名單</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">教師端登入帳密</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">家長端登入憑證</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">容量監控 (Storage Metering)</th>
                                <th class="py-3.5 px-4 text-center whitespace-nowrap">唯讀保護模式</th>
                                <th class="py-3.5 px-4 text-center whitespace-nowrap">操作管理</th>
                            </tr>
                        </thead>
                        <tbody id="acc-table-body" class="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            <tr>
                                <td colspan="9" class="text-center py-8 text-slate-400">
                                    <i class="fa-solid fa-spinner fa-spin mr-2"></i>載入班級清單中...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 1. 批量產生全校班級彈窗 -->
        <div id="acc-batch-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-lg text-slate-800 whitespace-nowrap">一鍵批次產生全校班級帳密</h4>
                            <p class="text-xs text-slate-500 font-medium whitespace-nowrap">系統將自動產生高強度密碼與雙端憑證，並同步至雲端</p>
                        </div>
                    </div>
                    <button id="acc-batch-close" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form id="acc-batch-form" class="space-y-4">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1 whitespace-nowrap">起始年級</label>
                            <input type="number" id="batch-grade-start" min="1" max="12" value="7" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1 whitespace-nowrap">結束年級</label>
                            <input type="number" id="batch-grade-end" min="1" max="12" value="9" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1 whitespace-nowrap">每學年班級數</label>
                            <input type="number" id="batch-class-count" min="1" max="30" value="6" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1 whitespace-nowrap">預設每班人數</label>
                            <input type="number" id="batch-student-count" min="10" max="60" value="30" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                    </div>

                    <div class="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed font-medium">
                        <i class="fa-solid fa-circle-info text-indigo-600 mr-1"></i>
                        將建立 <b>701~706、801~806、901~906</b> 共 18 個班級。自動生成教師帳密（如 <code>t701_shs</code>）與家長端專屬憑證代碼。
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2">
                        <button type="button" id="acc-batch-cancel" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs sm:text-sm whitespace-nowrap">取消</button>
                        <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                            <i class="fa-solid fa-play"></i>
                            <span>立即執行批量生成</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 2. 單班新增/編輯彈窗 -->
        <div id="acc-single-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </div>
                        <div>
                            <h4 id="acc-single-modal-title" class="font-black text-lg text-slate-800 whitespace-nowrap">編輯班級與帳密派發</h4>
                            <p class="text-xs text-slate-500 font-medium whitespace-nowrap">配置班級代碼、名稱、座號人數、缺號與兩端專屬憑證</p>
                        </div>
                    </div>
                    <button id="acc-single-close" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form id="acc-single-form" class="space-y-4">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1 whitespace-nowrap">班級代碼 (如 701)</label>
                            <input type="text" id="single-class-code" required placeholder="701" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1 whitespace-nowrap">班級全稱 (如 7年1班)</label>
                            <input type="text" id="single-class-name" required placeholder="7年1班" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1 whitespace-nowrap">學生總人數 (最大座號)</label>
                            <input type="number" id="single-student-count" min="1" max="80" value="30" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1 whitespace-nowrap">缺號設定 (以逗號隔開)</label>
                            <input type="text" id="single-missing-seats" placeholder="例如：14, 25" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                        </div>
                    </div>

                    <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <span class="block text-xs font-black text-slate-800 whitespace-nowrap">教師端登入帳密</span>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[11px] font-bold text-slate-500 mb-0.5 whitespace-nowrap">教師帳號</label>
                                <input type="text" id="single-teacher-user" required placeholder="t701_shs" class="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold bg-white outline-none">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold text-slate-500 mb-0.5 whitespace-nowrap">教師密碼</label>
                                <div class="flex items-center gap-1">
                                    <input type="text" id="single-teacher-pass" required placeholder="密碼" class="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold bg-white outline-none">
                                    <button type="button" id="btn-gen-t-pass" class="p-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-600 text-xs cursor-pointer" title="隨機產生密碼"><i class="fa-solid fa-shuffle"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                        <span class="block text-xs font-black text-indigo-900 whitespace-nowrap">家長端登入資訊</span>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[11px] font-bold text-indigo-700 mb-0.5 whitespace-nowrap">家長查詢代碼</label>
                                <input type="text" id="single-parent-code" required placeholder="SHS_701" class="w-full px-2.5 py-2 rounded-lg border border-indigo-200 text-xs font-mono font-bold bg-white outline-none">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold text-indigo-700 mb-0.5 whitespace-nowrap">家長端密碼</label>
                                <div class="flex items-center gap-1">
                                    <input type="text" id="single-parent-pass" required placeholder="密碼" class="w-full px-2.5 py-2 rounded-lg border border-indigo-200 text-xs font-mono font-bold bg-white outline-none">
                                    <button type="button" id="btn-gen-p-pass" class="p-2 bg-indigo-200 hover:bg-indigo-300 rounded-lg text-indigo-700 text-xs cursor-pointer" title="隨機產生密碼"><i class="fa-solid fa-shuffle"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2">
                        <button type="button" id="acc-single-cancel" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs sm:text-sm whitespace-nowrap">取消</button>
                        <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>儲存並同步至雲端</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 3. 學生帳號批量註冊彈窗 (依使用者指示新增：指定格式例如學號＋身分證後3碼) -->
        <div id="acc-students-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-white rounded-3xl w-full max-w-2xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto custom-scrollbar">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-id-card"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-lg text-slate-800 whitespace-nowrap">學生帳號批量註冊中樞</h4>
                            <p class="text-xs text-slate-500 font-medium whitespace-nowrap">支援指定格式匯入（學號＋身分證後 3 碼），一鍵批量建立學籍與成績 PIN 碼</p>
                        </div>
                    </div>
                    <button id="acc-students-close" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div class="space-y-4">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1 whitespace-nowrap">選擇目標班級</label>
                            <select id="students-target-class-select" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                                <!-- 動態載入全校班級 -->
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1 whitespace-nowrap">帳密指定規則</label>
                            <select id="students-rule-select" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white outline-none">
                                <option value="std_id_idcard">帳號：學號 / 密碼：身分證後3碼 (預設建議)</option>
                                <option value="class_seat_pin">帳號：班級+座號 / 密碼：6位數PIN碼 (100000+座號)</option>
                            </select>
                        </div>
                    </div>

                    <!-- 匯入說明卡片 -->
                    <div class="p-3.5 bg-teal-50/70 rounded-2xl border border-teal-200/80 text-xs text-teal-900 leading-relaxed font-medium">
                        <div class="font-bold flex items-center gap-1.5 mb-1 text-teal-950">
                            <i class="fa-solid fa-circle-info text-teal-600"></i>
                            <span>資料匯入指定格式範例：</span>
                        </div>
                        <p>每行一筆，以空格或逗號隔開：<code>[座號] [學生姓名] [學號] [身分證後3碼]</code></p>
                        <p class="text-[11px] text-teal-700 mt-0.5">範例：<code>1 陳大文 1130101 482</code>（支援直接由 Excel 複製 4 欄並貼上）</p>
                    </div>

                    <!-- 名冊貼上區域 -->
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <label class="text-xs font-bold text-slate-700 whitespace-nowrap">學生清冊資料貼上區</label>
                            <button type="button" id="btn-fill-student-demo" class="text-xs text-teal-700 font-bold hover:underline cursor-pointer">
                                帶入此班預設範例名單 (30人)
                            </button>
                        </div>
                        <textarea id="students-batch-input" rows="8" class="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none leading-relaxed" placeholder="1 王小明 1130101 482&#10;2 李小華 1130102 591&#10;3 張小美 1130103 823..."></textarea>
                    </div>

                    <!-- 預覽與操作按鈕 -->
                    <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <span id="students-batch-preview-count" class="text-xs font-bold text-slate-500 whitespace-nowrap">尚未輸入名冊</span>

                        <div class="flex items-center gap-2">
                            <button type="button" id="acc-students-cancel" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs sm:text-sm whitespace-nowrap cursor-pointer">取消</button>
                            <button type="button" id="btn-export-students-csv" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                                <i class="fa-solid fa-file-csv text-emerald-600"></i>
                                <span>匯出學生清冊</span>
                            </button>
                            <button type="button" id="btn-commit-batch-students" class="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs sm:text-sm shadow-md shadow-teal-600/20 flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95">
                                <i class="fa-solid fa-check"></i>
                                <span>確認批量註冊並同步</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 取得元件參照
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

    const studentsBtn = container.querySelector('#acc-batch-students-btn');
    const studentsModal = container.querySelector('#acc-students-modal');
    const studentsClose = container.querySelector('#acc-students-close');
    const studentsCancel = container.querySelector('#acc-students-cancel');
    const studentsClassSelect = container.querySelector('#students-target-class-select');
    const studentsInput = container.querySelector('#students-batch-input');
    const studentsPreviewCount = container.querySelector('#students-batch-preview-count');
    const btnFillDemo = container.querySelector('#btn-fill-student-demo');
    const btnCommitStudents = container.querySelector('#btn-commit-batch-students');
    const btnExportStudentsCsv = container.querySelector('#btn-export-students-csv');

    const exportBtn = container.querySelector('#acc-export-excel-btn');
    const importInput = container.querySelector('#acc-import-file');

    let allClassList = [];

    const closeBatch = () => batchModal.classList.add('hidden');
    batchClose.addEventListener('click', closeBatch);
    batchCancel.addEventListener('click', closeBatch);

    const closeSingle = () => singleModal.classList.add('hidden');
    singleClose.addEventListener('click', closeSingle);
    singleCancel.addEventListener('click', closeSingle);

    const closeStudents = () => studentsModal.classList.add('hidden');
    studentsClose.addEventListener('click', closeStudents);
    studentsCancel.addEventListener('click', closeStudents);

    // 隨機產生密碼按鈕
    container.querySelector('#btn-gen-t-pass').addEventListener('click', () => {
        container.querySelector('#single-teacher-pass').value = generateSecurePassword(8);
    });
    container.querySelector('#btn-gen-p-pass').addEventListener('click', () => {
        container.querySelector('#single-parent-pass').value = generateSecurePassword(6);
    });

    // 載入全校班級
    async function loadClasses() {
        const localKey = `school_classes_${currentSchool.id}`;
        let cached = [];
        try { cached = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch(e) {}
        if (cached && cached.length > 0) {
            allClassList = cached;
            renderTable(allClassList);
            updateStudentsClassSelect(allClassList);
        }

        try {
            const timeoutPromise = new Promise(r => setTimeout(() => r(null), 1500));
            const cloudList = await Promise.race([getSchoolClasses(currentSchool.id), timeoutPromise]);
            if (Array.isArray(cloudList) && cloudList.length > 0) {
                allClassList = cloudList;
                localStorage.setItem(localKey, JSON.stringify(allClassList));
            }
        } catch(e) {}
        
        // 若雲端與本地皆為空，自動載入預設 6 班
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
                    parentPassword: 'P#701',
                    storageBytes: 1250000,
                    isReadOnly: false
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
                    parentPassword: 'P#702',
                    storageBytes: 980000,
                    isReadOnly: false
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
                    parentPassword: 'P#703',
                    storageBytes: 1120000,
                    isReadOnly: false
                },
                {
                    schoolId: currentSchool.id,
                    classCode: '801',
                    className: '8年1班',
                    studentCount: 31,
                    missingSeats: [5],
                    teacherUsername: 't801_shs',
                    teacherPassword: 'Pass#801',
                    parentAccessCode: 'SHS_801',
                    parentPassword: 'P#801',
                    storageBytes: 1450000,
                    isReadOnly: false
                },
                {
                    schoolId: currentSchool.id,
                    classCode: '802',
                    className: '8年2班',
                    studentCount: 30,
                    missingSeats: [],
                    teacherUsername: 't802_shs',
                    teacherPassword: 'Pass#802',
                    parentAccessCode: 'SHS_802',
                    parentPassword: 'P#802',
                    storageBytes: 1050000,
                    isReadOnly: false
                },
                {
                    schoolId: currentSchool.id,
                    classCode: '901',
                    className: '9年1班',
                    studentCount: 28,
                    missingSeats: [18],
                    teacherUsername: 't901_shs',
                    teacherPassword: 'Pass#901',
                    parentAccessCode: 'SHS_901',
                    parentPassword: 'P#901',
                    storageBytes: 2550000, // 85% 警戒範例
                    isReadOnly: false
                }
            ];
            localStorage.setItem(localKey, JSON.stringify(allClassList));
            Promise.allSettled(allClassList.map(c => saveSchoolClass(c))).catch(() => {});
        }

        renderTable(allClassList);
        updateStudentsClassSelect(allClassList);
    }

    // 更新學生批量註冊的班級下拉選單
    function updateStudentsClassSelect(list) {
        if (!studentsClassSelect) return;
        studentsClassSelect.innerHTML = list.map(c => `
            <option value="${c.classCode}">${escapeHtml(c.className)} (${c.classCode}) - 學生 ${c.studentCount || 30}人</option>
        `).join('');
    }

    // 渲染班級清單表格
    function renderTable(list) {
        badgeEl.textContent = `${list.length} 個班級`;
        tableBody.innerHTML = '';

        if (list.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400 whitespace-nowrap">目前尚無班級資料，請點擊「一鍵批量產生」或「新增單一班級」</td></tr>`;
            return;
        }

        const MAX_BYTES = 3 * 1024 * 1024; // 3MB 上限

        list.forEach(c => {
            const missingArr = Array.isArray(c.missingSeats) ? c.missingSeats : [];
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50/80 transition-colors border-b border-slate-100';

            // 容量計算與進度條樣式
            const bytes = c.storageBytes || (c.studentCount ? c.studentCount * 36000 + 135000 : 960000);
            const mbText = (bytes / (1024 * 1024)).toFixed(2);
            const ratio = bytes / MAX_BYTES;
            const percent = Math.min(100, (ratio * 100)).toFixed(1);

            let barColor = 'bg-emerald-500';
            let usageBadge = `<span class="text-[10px] text-emerald-700 font-bold whitespace-nowrap">${percent}% (正常)</span>`;
            if (ratio >= 1.0) {
                barColor = 'bg-rose-500';
                usageBadge = `<span class="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[9px] font-black animate-pulse whitespace-nowrap">100% 超額</span>`;
            } else if (ratio >= 0.8) {
                barColor = 'bg-amber-500';
                usageBadge = `<span class="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-black whitespace-nowrap">${percent}% 警戒</span>`;
            }

            const isReadOnly = Boolean(c.isReadOnly);

            tr.innerHTML = `
                <td class="py-3.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">${escapeHtml(c.classCode)}</td>
                <td class="py-3.5 px-4 font-black text-slate-900 whitespace-nowrap">${escapeHtml(c.className)}</td>
                <td class="py-3.5 px-4 text-center font-bold text-slate-700 whitespace-nowrap">
                    <span class="px-2.5 py-1 rounded-full bg-slate-100 font-mono">${c.studentCount || 30} 人</span>
                </td>
                <td class="py-3.5 px-4 whitespace-nowrap">
                    ${missingArr.length > 0 
                        ? `<span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">缺 ${missingArr.join(', ')} 號</span>` 
                        : '<span class="text-slate-400">無缺號</span>'
                    }
                </td>
                <td class="py-3.5 px-4 whitespace-nowrap">
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
                <td class="py-3.5 px-4 whitespace-nowrap">
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
                <!-- 各班容量視覺化條 (Storage Usage Bar) -->
                <td class="py-3.5 px-4 whitespace-nowrap min-w-[160px]">
                    <div class="space-y-1">
                        <div class="flex items-center justify-between text-[11px] font-mono">
                            <span class="font-bold text-slate-700">${mbText} MB / 3MB</span>
                            ${usageBadge}
                        </div>
                        <div class="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-300 ${barColor}" style="width: ${percent}%;"></div>
                        </div>
                    </div>
                </td>
                <!-- 唯讀保護模式 (Read-Only Status) -->
                <td class="py-3.5 px-4 text-center whitespace-nowrap">
                    ${isReadOnly 
                        ? `<span class="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-black border border-rose-200 inline-flex items-center gap-1"><i class="fa-solid fa-lock text-[10px]"></i>唯讀保護</span>`
                        : `<span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 inline-flex items-center gap-1"><i class="fa-solid fa-lock-open text-[10px]"></i>正常讀寫</span>`
                    }
                </td>
                <!-- 操作管理按鈕群 -->
                <td class="py-3.5 px-4 text-center whitespace-nowrap">
                    <div class="flex items-center justify-center gap-1">
                        <!-- 唯讀切換按鈕 -->
                        <button class="toggle-readonly-btn p-2 rounded-xl ${isReadOnly ? 'text-rose-600 bg-rose-50 hover:bg-rose-100' : 'text-slate-600 hover:bg-slate-100'} transition-colors cursor-pointer" title="${isReadOnly ? '點擊解除唯讀' : '一鍵設定為唯讀保護'}">
                            <i class="fa-solid ${isReadOnly ? 'fa-lock' : 'fa-lock-open'}"></i>
                        </button>
                        <!-- 發送清理提醒按鈕 -->
                        <button class="send-clean-alert-btn p-2 rounded-xl text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer" title="發送容量超額清理提醒">
                            <i class="fa-solid fa-bell"></i>
                        </button>
                        <!-- 複製開學通知函 -->
                        <button class="copy-notice-btn p-2 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer" title="複製家長開學通知函">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                        <!-- 編輯班級 -->
                        <button class="edit-class-btn p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer" title="編輯班級與密碼">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <!-- 刪除班級 -->
                        <button class="delete-class-btn p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" title="刪除班級">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;

            // 切換唯讀
            tr.querySelector('.toggle-readonly-btn').addEventListener('click', async () => {
                triggerHaptic('medium');
                const nextState = !isReadOnly;
                c.isReadOnly = nextState;
                try {
                    await saveSchoolClass(c);
                } catch (e) {
                    console.warn("切換唯讀狀態已同步至本地快取:", e);
                }
                showToast(`已將【${c.className}】設定為：${nextState ? '唯讀保護模式 (無法新增作業)' : '正常讀寫模式'}`, nextState ? 'warning' : 'success');
                loadClasses();
            });

            // 發送清理提醒
            tr.querySelector('.send-clean-alert-btn').addEventListener('click', () => {
                triggerHaptic('light');
                const reminderText = `【學校行政處通知 · 容量清理提醒】\n親愛的 ${c.className} 導師您好：\n系統檢測到貴班目前的雲端資料量已達 ${mbText} MB (${percent}%)，接近上限。\n請於今日進入系統設定，點選「學期結束一鍵歸檔」或「清理 60 天以上舊紀錄」以釋放空間，避免作業新增受阻。謝謝您的配合！`;
                safeCopyToClipboard(reminderText);
                showToast(`已複製【${c.className}】容量清理催促通知文案至剪貼簿！`, 'success');
            });

            // 複製通知函
            tr.querySelector('.copy-notice-btn').addEventListener('click', () => {
                const noticeText = `【${currentSchool.name} ${c.className} 家長開學通知函】\n親愛的家長您好：\n本學期本班全面啟用線上數位聯絡簿與作業點收系統。\n家長端專屬登入憑證如下：\n家長端網址：https://ian1021228.github.io/parent_dashboard_dev/\n班級查詢代碼：${c.parentAccessCode}\n登入密碼：${c.parentPassword}\n請家長每日準時查閱並完成線上電子簽章，感謝您的配合！`;
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
                    parentPassword: parentPass,
                    storageBytes: studentCount * 36000 + 120000,
                    isReadOnly: false
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
            parentPassword,
            storageBytes: studentCount * 36000 + 120000,
            isReadOnly: false
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

    // 學生帳號批量註冊彈窗開啟
    studentsBtn.addEventListener('click', () => {
        triggerHaptic('light');
        updateStudentsClassSelect(allClassList);
        studentsModal.classList.remove('hidden');
    });

    // 帶入示範學生清單
    btnFillDemo.addEventListener('click', () => {
        const targetCode = studentsClassSelect.value || '701';
        const demoLines = [];
        const familyNames = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '洪', '郭', '邱', '曾', '廖', '賴', '徐', '周', '葉', '蘇', '莊', '呂', '江', '何', '蕭', '羅', '高'];
        const givenNames = ['大文', '小華', '志豪', '雅婷', '家豪', '淑芬', '冠宇', '怡君', '俊傑', '欣怡', '承翰', '詩涵', '宇軒', '婷婷', '建宏', '佩珊', '柏翰', '冠宏', '佳穎', '文傑', '子豪', '巧萍', '偉誠', '靜雯', '建廷', '美珍', '家瑋', '惠玲', '宗翰', '玉萍'];

        for (let i = 1; i <= 30; i++) {
            const fName = familyNames[(i - 1) % familyNames.length];
            const gName = givenNames[(i - 1) % givenNames.length];
            const stdId = `113${targetCode}${String(i).padStart(2, '0')}`;
            const id3 = String(100 + (i * 29) % 899).padStart(3, '0');
            demoLines.push(`${i} ${fName}${gName} ${stdId} ${id3}`);
        }

        studentsInput.value = demoLines.join('\n');
        studentsPreviewCount.textContent = `已載入 ${demoLines.length} 筆學生資料`;
        showToast(`已帶入【${targetCode} 班】30 人範例名冊！`, 'info');
    });

    // 監聽文字輸入更新筆數預覽
    studentsInput.addEventListener('input', () => {
        const lines = studentsInput.value.split('\n').map(l => l.trim()).filter(Boolean);
        studentsPreviewCount.textContent = `已輸入 ${lines.length} 筆學生資料`;
    });

    // 確認批量註冊學生並同步至雲端
    btnCommitStudents.addEventListener('click', async () => {
        const text = studentsInput.value.trim();
        if (!text) {
            showToast("請先輸入或貼上學生名冊資料！", "warning");
            return;
        }

        const targetCode = studentsClassSelect.value;
        const targetClass = allClassList.find(c => c.classCode === targetCode);
        if (!targetClass) {
            showToast("找不到目標班級！", "error");
            return;
        }

        triggerHaptic('medium');
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const studentAccounts = [];
        const studentPins = {};

        lines.forEach(line => {
            const parts = line.split(/[\s,，\t]+/).filter(Boolean);
            if (parts.length >= 2) {
                const seat = parseInt(parts[0], 10) || 1;
                const name = parts[1] || `學生${seat}`;
                const stdId = parts[2] || `113${targetCode}${String(seat).padStart(2, '0')}`;
                const id3 = parts[3] || String(100000 + seat).slice(-3);
                const pin = String(100000 + seat);

                studentAccounts.push({
                    seat,
                    name,
                    studentId: stdId,
                    idLast3: id3,
                    pin
                });

                studentPins[String(seat)] = pin;
            }
        });

        targetClass.studentAccounts = studentAccounts;
        targetClass.studentPins = studentPins;
        targetClass.studentCount = Math.max(targetClass.studentCount || 30, studentAccounts.length);

        await saveSchoolClass(targetClass);
        showToast(`已成功為【${targetClass.className}】批量註冊 ${studentAccounts.length} 位學生帳號與專屬 PIN 碼！`, 'success', 5000);
        closeStudents();
        loadClasses();
    });

    // 匯出學生清冊 CSV
    btnExportStudentsCsv.addEventListener('click', () => {
        const targetCode = studentsClassSelect.value;
        const targetClass = allClassList.find(c => c.classCode === targetCode);
        const accounts = targetClass?.studentAccounts || [];

        if (accounts.length === 0) {
            showToast("此班級尚無註冊學生資料，請先輸入名冊並確認註冊！", "warning");
            return;
        }

        triggerHaptic('medium');
        const rows = [
            ['學校名稱', currentSchool.name],
            ['班級名稱', targetClass.className],
            ['班級代碼', targetClass.classCode],
            [],
            ['座號', '學生姓名', '學號 (帳號)', '身分證後3碼 (密碼)', '成績查詢6位數PIN碼']
        ];

        accounts.forEach(s => {
            rows.push([
                s.seat,
                s.name,
                s.studentId,
                s.idLast3,
                s.pin
            ]);
        });

        exportToCSV(`${currentSchool.name}_${targetClass.className}_學生帳號與PIN碼清冊.csv`, rows);
        showToast(`已成功匯出【${targetClass.className}】學生帳號清冊 CSV！`, 'success');
    });

    // 匯出全校清冊 CSV
    exportBtn.addEventListener('click', () => {
        triggerHaptic('medium');
        const rows = [
            ['學校名稱', currentSchool.name],
            ['學校代碼', currentSchool.code || currentSchool.id],
            ['匯出時間', new Date().toLocaleString()],
            [],
            ['班級代碼', '班級名稱', '學生總人數', '缺號名單', '教師端帳號', '教師端密碼', '家長端代碼', '家長端密碼', '空間用量(MB)', '唯讀狀態', '家長端登入連結']
        ];

        allClassList.forEach(c => {
            const missingArr = Array.isArray(c.missingSeats) ? c.missingSeats.join(';') : '';
            const parentLink = `https://ian1021228.github.io/parent_dashboard_dev/?code=${c.parentAccessCode}`;
            const mbVal = ((c.storageBytes || 1000000) / (1024 * 1024)).toFixed(2);
            rows.push([
                c.classCode,
                c.className,
                c.studentCount || 30,
                missingArr,
                c.teacherUsername || '',
                c.teacherPassword || '',
                c.parentAccessCode || '',
                c.parentPassword || '',
                mbVal,
                c.isReadOnly ? '唯讀保護' : '正常讀寫',
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
                            parentPassword: parentP,
                            storageBytes: count * 36000 + 120000,
                            isReadOnly: false
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
