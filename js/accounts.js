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
                        學校管理端統一配置班級人數、缺號、教師與家長憑證、<b>學生成績認證碼批量設定</b>、以及<b>各班容量即時監控與遠端唯讀保護</b>。
                    </p>
                </div>

                <div class="flex items-center gap-2.5 flex-wrap">
                    <!-- 批量設定成績認證碼按鈕 -->
                    <button id="acc-batch-students-btn" class="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer whitespace-nowrap active:scale-95">
                        <i class="fa-solid fa-key"></i>
                        <span>批量設定成績認證碼</span>
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

                    <div class="flex items-center gap-2 flex-wrap">
                        <!-- 教師帳密清單按鈕 -->
                        <button type="button" id="acc-btn-teacher-list" class="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 shadow-2xs">
                            <i class="fa-solid fa-chalkboard-user"></i>
                            <span>教師帳密清單</span>
                        </button>

                        <!-- 家長代碼清單按鈕 -->
                        <button type="button" id="acc-btn-parent-list" class="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs border border-teal-200 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 shadow-2xs">
                            <i class="fa-solid fa-people-roof"></i>
                            <span>家長代碼清單</span>
                        </button>

                        <div class="relative">
                            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input type="text" id="acc-search-input" placeholder="搜尋班級名稱、代碼或導師帳號..." class="pl-8 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:bg-white outline-none w-52 sm:w-60 whitespace-nowrap">
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
                                <th class="py-3.5 px-4 whitespace-nowrap">學生 PIN 碼（成績/簽章）</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">容量監控</th>
                                <th class="py-3.5 px-4 text-center whitespace-nowrap">唯讀模式</th>
                                <th class="py-3.5 px-4 text-center whitespace-nowrap">操作管理</th>
                            </tr>
                        </thead>
                        <tbody id="acc-table-body" class="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            <tr>
                                <td colspan="10" class="text-center py-8 text-slate-400">
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

                    <div class="p-3.5 bg-teal-50/60 rounded-2xl border border-teal-100 space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="block text-xs font-black text-teal-900 whitespace-nowrap">家長端登入資訊</span>
                            <span class="text-[10px] text-teal-700 font-bold bg-teal-100/70 px-2 py-0.5 rounded-full">免密碼直達</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[11px] font-bold text-teal-700 mb-0.5 whitespace-nowrap">家長查詢代碼</label>
                                <input type="text" id="single-parent-code" required placeholder="SHS_701" class="w-full px-2.5 py-2 rounded-lg border border-teal-200 text-xs font-mono font-bold bg-white outline-none">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold text-teal-700 mb-0.5 whitespace-nowrap">家長端直達提示</label>
                                <div class="px-2.5 py-2 rounded-lg border border-teal-200 text-xs font-bold text-teal-700 bg-white">
                                    免密碼（簽章/成績需PIN）
                                </div>
                                <input type="hidden" id="single-parent-pass" value="P#701">
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

        <!-- 3. 批量設定成績認證碼彈窗 -->
        <div id="acc-students-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-white rounded-3xl w-full max-w-2xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto custom-scrollbar">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-key"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-lg text-slate-800 whitespace-nowrap">批量設定成績認證碼</h4>
                            <p class="text-xs text-slate-500 font-medium whitespace-nowrap">設定各座號成績查詢認證碼（PIN 碼），不需輸入姓名，可手動設定或由身分證自動擷取末五碼</p>
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
                            <label class="block text-xs font-bold text-slate-600 mb-1 whitespace-nowrap">設定模式選擇</label>
                            <div class="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                                <button type="button" id="pin-mode-btn-manual" class="py-1.5 rounded-lg bg-white text-indigo-700 shadow-2xs font-black transition-all cursor-pointer">
                                    手動設定
                                </button>
                                <button type="button" id="pin-mode-btn-idcard" class="py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all cursor-pointer">
                                    身分證末五碼
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 座號對應與空號規則提示卡片 -->
                    <div class="p-3 bg-indigo-50/90 border border-indigo-200/90 rounded-2xl text-xs text-indigo-950 font-medium flex items-start gap-2.5 shadow-2xs">
                        <div class="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                            <i class="fa-solid fa-circle-info text-xs"></i>
                        </div>
                        <div class="leading-relaxed">
                            <span class="font-black text-indigo-950">座號編號與空號規則說明：</span>
                            編輯器每一行左側灰色數字為不可編輯的固定座號（第 1 行為 1 號、第 2 行為 2 號...）。
                            <b class="text-indigo-900 underline decoration-indigo-300 underline-offset-2">若某一行內容留空，即代表該座號為「缺號 / 空號」</b>（例如 1 號輸入 PIN 碼後，第 2 行空白代表 2 號缺號跳過）。按下 Enter 即可加入新的一行，刪除該行該座號即自動消失。
                        </div>
                    </div>

                    <!-- 模式一：手動設定說明與操作卡片 -->
                    <div id="pin-card-manual" class="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-200/80 text-xs text-indigo-950 leading-relaxed font-medium space-y-1">
                        <div class="font-bold flex items-center justify-between">
                            <span class="flex items-center gap-1.5 text-indigo-900">
                                <i class="fa-solid fa-pen-to-square text-indigo-600"></i>
                                <span>手動設定模式：</span>
                            </span>
                            <div class="flex items-center gap-2">
                                <button type="button" id="btn-fill-student-demo" class="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer">
                                    一鍵隨機產生 6 碼 PIN
                                </button>
                                <span class="text-slate-300">|</span>
                                <button type="button" id="btn-clear-pin-input" class="text-xs text-slate-500 hover:text-slate-700 font-bold cursor-pointer">
                                    清空所有 PIN
                                </button>
                            </div>
                        </div>
                        <p class="text-indigo-800 text-[11px]">每行輸入一個認證碼對應座號（或直接整欄貼上），<b>不需輸入學生姓名</b>。開通時所有 PIN 碼預設留白。</p>
                    </div>

                    <!-- 模式二：身分證末五碼說明與操作卡片 -->
                    <div id="pin-card-idcard" class="p-3.5 bg-teal-50/70 rounded-2xl border border-teal-200/80 text-xs text-teal-950 leading-relaxed font-medium space-y-2 hidden">
                        <div class="font-bold flex items-center justify-between">
                            <span class="flex items-center gap-1.5 text-teal-900">
                                <i class="fa-solid fa-id-card-clip text-teal-600"></i>
                                <span>指定格式（身分證字號末五碼）模式：</span>
                            </span>
                            <button type="button" id="btn-fill-idcard-demo" class="text-xs text-teal-700 hover:text-teal-900 font-bold hover:underline cursor-pointer">
                                帶入 30 筆示範身分證字號
                            </button>
                        </div>
                        <p class="text-teal-800 text-[11px]">可批量貼上學生身分證字號（例如每行一個，支援由 Excel 複製一欄整批貼上）。<b>不需輸入學生姓名</b>。</p>
                        
                        <div class="pt-1 flex items-center gap-2 flex-wrap">
                            <button type="button" id="btn-extract-last5" class="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl font-black text-xs shadow-md shadow-teal-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                                <span>自動擷取末五碼按鈕</span>
                            </button>
                            <span class="text-[11px] text-teal-700 font-bold">點擊後自動抓取每筆身分證字號後 5 碼作為成績認證碼</span>
                        </div>
                    </div>

                    <!-- 帶灰色座號行號的文字編輯器與貼上區域 -->
                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between">
                            <label id="students-input-label" class="text-xs font-bold text-slate-700 whitespace-nowrap">編輯成績認證碼（左側為灰色座號編號）：</label>
                            <span id="students-batch-preview-count" class="text-xs font-bold text-slate-500 whitespace-nowrap">尚未輸入資料</span>
                        </div>

                        <!-- 編輯器視窗 (包含左側固定不可編輯座號編號) -->
                        <div class="rounded-2xl border border-slate-300 bg-white overflow-hidden shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                            <div class="flex items-stretch min-h-[220px] max-h-[300px] relative font-mono">
                                <!-- 左側：灰色不可編輯座號編號 Gutter -->
                                <div id="pin-editor-gutter" class="w-14 sm:w-16 py-3 px-1.5 bg-slate-100/90 border-r border-slate-200 text-slate-400 font-mono text-xs sm:text-sm text-right select-none flex flex-col overflow-hidden shrink-0">
                                    <!-- 動態生成 1, 2, 3... -->
                                </div>
                                <!-- 右側：文字輸入區 -->
                                <textarea 
                                    id="students-batch-input" 
                                    rows="9" 
                                    class="flex-1 py-3 px-3 bg-transparent text-slate-800 font-mono text-xs sm:text-sm leading-6 outline-none resize-none overflow-y-auto custom-scrollbar whitespace-pre"
                                    placeholder="在此輸入或貼上 PIN 碼...&#10;第 1 行為 1 號&#10;第 2 行留空代表 2 號缺號&#10;第 3 行為 3 號..."
                                    spellcheck="false"
                                ></textarea>
                            </div>
                        </div>

                        <!-- 快捷工具列：一鍵清除空白行、一鍵清除隔行空白 -->
                        <div class="flex items-center justify-between gap-2 pt-1 flex-wrap text-xs">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <button type="button" id="btn-remove-blank-lines" class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 active:scale-95 shadow-2xs" title="移除貼上內容中的所有空白行，讓所有 PIN 連號對齊">
                                    <i class="fa-solid fa-filter text-indigo-600"></i>
                                    <span>一鍵清除空白行 (連號對齊)</span>
                                </button>
                                <button type="button" id="btn-remove-alternate-blanks" class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 active:scale-95 shadow-2xs" title="清除每隔一行固定出現的空白行 (例如由試算表複製貼上帶有雙重換行時)">
                                    <i class="fa-solid fa-arrows-split-up-and-left text-teal-600"></i>
                                    <span>一鍵清除隔行空白</span>
                                </button>
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="button" id="btn-clear-editor-all" class="text-xs text-rose-500 hover:text-rose-700 font-bold hover:underline cursor-pointer flex items-center gap-1">
                                    <i class="fa-solid fa-trash-can text-[11px]"></i>
                                    <span>全部清空</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 即時解析預覽表格 -->
                    <div class="space-y-1.5">
                        <label class="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span>各座號成績認證碼即時預覽：</span>
                            <span id="pin-preview-badge" class="text-[11px] text-indigo-600 font-bold">已預覽 0 筆</span>
                        </label>
                        <div id="pin-preview-container" class="max-h-36 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 custom-scrollbar grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs font-mono">
                            <div class="col-span-full py-3 text-center text-slate-400">請輸入或貼上資料以預覽認證碼</div>
                        </div>
                    </div>

                    <!-- 預覽與操作按鈕 -->
                    <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                        <button type="button" id="btn-export-students-csv" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                            <i class="fa-solid fa-file-csv text-emerald-600"></i>
                            <span>匯出成績認證碼清冊 (CSV)</span>
                        </button>

                        <div class="flex items-center gap-2">
                            <button type="button" id="acc-students-cancel" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs sm:text-sm whitespace-nowrap cursor-pointer">取消</button>
                            <button type="button" id="btn-commit-batch-students" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95">
                                <i class="fa-solid fa-check"></i>
                                <span>確認儲存成績認證碼</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 4. 全校教師帳密清單彈窗 -->
        <div id="acc-teacher-list-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-white rounded-3xl w-full max-w-2xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-chalkboard-user"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-lg text-slate-800 whitespace-nowrap">全校教師帳密清單</h4>
                            <p class="text-xs text-slate-500 font-medium whitespace-nowrap">全校各班級教師專屬登入帳號與密碼清冊，可一鍵複製或匯出</p>
                        </div>
                    </div>
                    <button id="acc-teacher-list-close" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div class="flex items-center justify-between gap-3 flex-shrink-0">
                    <div class="relative flex-1">
                        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input type="text" id="teacher-list-filter" placeholder="搜尋班級或帳號..." class="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:bg-white">
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" id="btn-copy-all-teachers" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer active:scale-95 transition-all whitespace-nowrap">
                            <i class="fa-solid fa-copy"></i>
                            <span>一鍵複製全校教師清單</span>
                        </button>
                        <button type="button" id="btn-export-teachers-csv" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                            <i class="fa-solid fa-file-csv text-emerald-600"></i>
                            <span>匯出 CSV</span>
                        </button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto border border-slate-200 rounded-2xl custom-scrollbar">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr class="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200 sticky top-0 z-10 whitespace-nowrap">
                                <th class="py-2.5 px-3">班級代碼</th>
                                <th class="py-2.5 px-3">班級名稱</th>
                                <th class="py-2.5 px-3">教師帳號</th>
                                <th class="py-2.5 px-3">登入密碼</th>
                                <th class="py-2.5 px-3 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody id="teacher-list-table-body" class="divide-y divide-slate-100 font-mono font-medium">
                            <!-- 動態渲染 -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 5. 全校家長代碼清單彈窗 -->
        <div id="acc-parent-list-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-white rounded-3xl w-full max-w-2xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-people-roof"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-lg text-slate-800 whitespace-nowrap">全校家長代碼清單</h4>
                            <p class="text-xs text-slate-500 font-medium whitespace-nowrap">各班家長查詢代碼與免密碼直達連結（提醒：簽章與成績查詢需輸入學生 PIN 碼）</p>
                        </div>
                    </div>
                    <button id="acc-parent-list-close" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div class="p-3 bg-teal-50/70 rounded-2xl border border-teal-200/80 text-xs text-teal-950 flex items-center gap-2 flex-shrink-0">
                    <i class="fa-solid fa-circle-info text-teal-600 text-sm"></i>
                    <span>家長端採<b>免密碼直達</b>。輸入代碼或點擊專屬連結即可查閱；僅在進行「電子簽章」或「成績查詢」時需輸入各座號學生 PIN 碼。</span>
                </div>

                <div class="flex items-center justify-between gap-3 flex-shrink-0">
                    <div class="relative flex-1">
                        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input type="text" id="parent-list-filter" placeholder="搜尋班級或代碼..." class="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:bg-white">
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" id="btn-copy-all-parents" class="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-teal-600/20 cursor-pointer active:scale-95 transition-all whitespace-nowrap">
                            <i class="fa-solid fa-copy"></i>
                            <span>一鍵複製全校家長代碼</span>
                        </button>
                        <button type="button" id="btn-export-parents-csv" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                            <i class="fa-solid fa-file-csv text-emerald-600"></i>
                            <span>匯出 CSV</span>
                        </button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto border border-slate-200 rounded-2xl custom-scrollbar">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr class="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200 sticky top-0 z-10 whitespace-nowrap">
                                <th class="py-2.5 px-3">班級代碼</th>
                                <th class="py-2.5 px-3">班級名稱</th>
                                <th class="py-2.5 px-3">家長查詢代碼</th>
                                <th class="py-2.5 px-3">直達免密碼專屬網址</th>
                                <th class="py-2.5 px-3 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody id="parent-list-table-body" class="divide-y divide-slate-100 font-mono font-medium">
                            <!-- 動態渲染 -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 6. 班級學生 PIN 碼檢視與管理彈窗 -->
        <div id="acc-view-pins-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-white rounded-3xl w-full max-w-2xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] flex flex-col">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-key"></i>
                        </div>
                        <div>
                            <h4 id="view-pins-modal-title" class="font-black text-lg text-slate-800 whitespace-nowrap">班級學生 PIN 碼清冊</h4>
                            <p class="text-xs text-slate-500 font-medium whitespace-nowrap">成績查詢認證碼與家長電子簽章 PIN 碼明細（免姓名）</p>
                        </div>
                    </div>
                    <button id="acc-view-pins-close" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div class="flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
                    <div class="flex items-center gap-2">
                        <span id="view-pins-status-badge" class="px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 font-black text-xs border border-teal-200">已設定 30/30 人</span>
                        <span id="view-pins-missing-badge" class="text-xs text-slate-400 font-bold">無缺號</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" id="btn-goto-batch-from-view" class="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all whitespace-nowrap">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                            <span>批量設定此班</span>
                        </button>
                        <button type="button" id="btn-copy-view-pins" class="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-teal-600/20 cursor-pointer active:scale-95 transition-all whitespace-nowrap">
                            <i class="fa-solid fa-copy"></i>
                            <span>複製此班清單</span>
                        </button>
                    </div>
                </div>

                <div id="view-pins-grid" class="flex-1 overflow-y-auto p-3 rounded-2xl border border-slate-200 bg-slate-50/50 custom-scrollbar grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs font-mono">
                    <!-- 動態渲染各座號 PIN 卡片 -->
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
    const btnGenPPass = container.querySelector('#btn-gen-p-pass');
    if (btnGenPPass) {
        btnGenPPass.addEventListener('click', () => {
            const passEl = container.querySelector('#single-parent-pass');
            if (passEl) passEl.value = generateSecurePassword(6);
        });
    }

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
        
        // 預設示範 PIN 產生器 (5碼數字)
        const makeDefaultPins = (count, missing = []) => {
            const pins = {};
            for (let i = 1; i <= count; i++) {
                if (!missing.includes(i)) {
                    pins[String(i)] = String(10000 + (i * 1873) % 89999).padStart(5, '0');
                }
            }
            return pins;
        };

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
                    studentPins: makeDefaultPins(30, [14]),
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
                    studentPins: makeDefaultPins(32, []),
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
                    studentPins: makeDefaultPins(29, [8, 22]),
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
                    studentPins: makeDefaultPins(31, [5]),
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
                    studentPins: makeDefaultPins(30, []),
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
                    studentPins: makeDefaultPins(28, [18]),
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
            tableBody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-400 whitespace-nowrap">目前尚無班級資料，請點擊「一鍵批量產生」或「新增單一班級」</td></tr>`;
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

            // 學生 PIN 碼狀態統計
            const totalSeats = c.studentCount || 30;
            const validSeatCount = totalSeats - missingArr.length;
            const pinsMap = c.studentPins || {};
            const pinCount = Object.keys(pinsMap).filter(s => !missingArr.includes(Number(s))).length;

            let pinBadge = '';
            if (pinCount >= validSeatCount && validSeatCount > 0) {
                pinBadge = `<span class="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 font-black text-[10px] border border-teal-200 inline-flex items-center gap-1"><i class="fa-solid fa-circle-check text-teal-600"></i>已設 ${pinCount}/${validSeatCount} 人</span>`;
            } else if (pinCount > 0) {
                pinBadge = `<span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold text-[10px] border border-amber-200 inline-flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation text-amber-600"></i>已設 ${pinCount}/${validSeatCount} 人</span>`;
            } else {
                pinBadge = `<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold text-[10px] border border-slate-200 inline-flex items-center gap-1"><i class="fa-solid fa-circle-question text-slate-400"></i>未設定 PIN</span>`;
            }

            const parentDirectUrl = `https://ian1021228.github.io/parent_dashboard_dev/?code=${c.parentAccessCode}`;

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
                <!-- 1. 教師端登入帳密區塊 (含教師帳密通知按鈕) -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                    <div class="flex items-center justify-between gap-2.5">
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
                        <button type="button" class="copy-teacher-notify-btn px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold text-xs flex items-center gap-1 border border-slate-200 transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-2xs" title="複製教師帳密通知函">
                            <i class="fa-solid fa-copy text-[11px] text-indigo-600"></i>
                            <span>教師帳密通知</span>
                        </button>
                    </div>
                </td>
                <!-- 2. 家長端登入憑證區塊 (免密碼，含家長代碼通知按鈕) -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                    <div class="flex items-center justify-between gap-2.5">
                        <div class="space-y-0.5">
                            <div class="text-indigo-700 font-bold font-mono flex items-center gap-1.5">
                                <i class="fa-solid fa-house-user text-[10px] text-indigo-500"></i>
                                <span>代碼：<strong class="text-indigo-950 font-black">${escapeHtml(c.parentAccessCode || '-')}</strong></span>
                            </div>
                            <div class="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                <span class="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">免密碼直達</span>
                                <span class="text-slate-400">（簽名/成績需PIN）</span>
                            </div>
                        </div>
                        <button type="button" class="copy-parent-notify-btn px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center gap-1 border border-indigo-200 transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-2xs" title="複製家長代碼通知函">
                            <i class="fa-solid fa-copy text-[11px] text-indigo-600"></i>
                            <span>家長代碼通知</span>
                        </button>
                    </div>
                </td>
                <!-- 3. 新增學生 PIN 碼區塊 (可查看、批量設定與複製清單) -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                    <div class="space-y-1.5">
                        <div class="flex items-center gap-1.5">
                            ${pinBadge}
                            <span class="text-[10px] text-slate-400 font-mono">共 ${totalSeats} 號</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button type="button" class="view-pins-btn px-2 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[11px] border border-teal-200 transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs" title="查看該班各座號 PIN 碼">
                                <i class="fa-solid fa-eye text-[10px]"></i>
                                <span>查看 PIN 碼</span>
                            </button>
                            <button type="button" class="batch-pins-btn px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-[11px] border border-indigo-200 transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs" title="批量設定該班 PIN 碼">
                                <i class="fa-solid fa-key text-[10px]"></i>
                                <span>批量設定</span>
                            </button>
                            <button type="button" class="copy-pins-btn px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] border border-slate-200 transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs" title="複製全班學生 PIN 碼清冊">
                                <i class="fa-solid fa-copy text-[10px]"></i>
                                <span>複製清單</span>
                            </button>
                        </div>
                    </div>
                </td>
                <!-- 4. 各班容量視覺化條 (Storage Usage Bar) -->
                <td class="py-3.5 px-4 whitespace-nowrap min-w-[150px]">
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
                <!-- 5. 唯讀保護模式 (Read-Only Status) -->
                <td class="py-3.5 px-4 text-center whitespace-nowrap">
                    ${isReadOnly 
                        ? `<span class="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-black border border-rose-200 inline-flex items-center gap-1"><i class="fa-solid fa-lock text-[10px]"></i>唯讀保護</span>`
                        : `<span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 inline-flex items-center gap-1"><i class="fa-solid fa-lock-open text-[10px]"></i>正常讀寫</span>`
                    }
                </td>
                <!-- 6. 操作管理按鈕群 (已移除容量清理提醒) -->
                <td class="py-3.5 px-4 text-center whitespace-nowrap">
                    <div class="flex items-center justify-center gap-1">
                        <!-- 唯讀切換按鈕 -->
                        <button class="toggle-readonly-btn p-2 rounded-xl ${isReadOnly ? 'text-rose-600 bg-rose-50 hover:bg-rose-100' : 'text-slate-600 hover:bg-slate-100'} transition-colors cursor-pointer" title="${isReadOnly ? '點擊解除唯讀' : '一鍵設定為唯讀保護'}">
                            <i class="fa-solid ${isReadOnly ? 'fa-lock' : 'fa-lock-open'}"></i>
                        </button>
                        <!-- 編輯班級 -->
                        <button class="edit-class-btn p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer" title="編輯班級資訊">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <!-- 刪除班級 -->
                        <button class="delete-class-btn p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" title="刪除班級">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;

            // 複製教師帳密通知
            tr.querySelector('.copy-teacher-notify-btn').addEventListener('click', () => {
                triggerHaptic('light');
                const teacherNotice = `【${currentSchool.name} ${c.className} 教師登入帳密通知】
親愛的 ${c.className} 導師您好：
學校已完成全校班級經營與數位聯絡簿系統配置，您的教師端專屬登入帳密如下：

學校名稱：${currentSchool.name}
任教班級：${c.className}
教師帳號：${c.teacherUsername}
登入密碼：${c.teacherPassword}
教師端登入網址：https://ian1021228.github.io/homework_checker3.0_dev/

請登入後可進行作業登記、聯絡簿登載、出缺席點名與家長簽章查核。`;
                safeCopyToClipboard(teacherNotice);
                showToast(`已複製【${c.className}】教師帳密通知函至剪貼簿！`, 'success');
            });

            // 複製家長代碼通知
            tr.querySelector('.copy-parent-notify-btn').addEventListener('click', () => {
                triggerHaptic('light');
                const parentNotice = `【${currentSchool.name} ${c.className} 家長通知函】
親愛的家長您好：
本校 ${c.className} 已啟用線上每日數位聯絡簿與作業點收系統。
家長端採「免密碼直達」，請點擊專屬連結或輸入班級代碼即可查閱：

學校名稱：${currentSchool.name}
學生班級：${c.className}
班級代碼：${c.parentAccessCode}
家長免密碼直達網址：${parentDirectUrl}

※ 提醒：家長端瀏覽聯絡簿與作業點收無需密碼；進行「線上電子簽章」及「個人成績查詢」時，請輸入貴子弟專屬之座號認證碼（學生 PIN 碼）。
請家長每日放學後上線查閱並完成簽名，感謝您的配合！`;
                safeCopyToClipboard(parentNotice);
                showToast(`已複製【${c.className}】家長代碼通知函至剪貼簿！`, 'success');
            });

            // 查看該班學生 PIN 碼
            tr.querySelector('.view-pins-btn').addEventListener('click', () => {
                openViewPinsModal(c);
            });

            // 批量設定該班 PIN 碼
            tr.querySelector('.batch-pins-btn').addEventListener('click', () => {
                openBatchModalForClass(c.classCode);
            });

            // 複製該班學生 PIN 碼清冊
            tr.querySelector('.copy-pins-btn').addEventListener('click', () => {
                copyClassPins(c);
            });

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

    // -------------------------------------------------------------
    // 單班學生 PIN 碼檢視與複製功能
    // -------------------------------------------------------------
    let currentViewingClass = null;
    const viewPinsModal = container.querySelector('#acc-view-pins-modal');
    const viewPinsClose = container.querySelector('#acc-view-pins-close');
    const viewPinsTitle = container.querySelector('#view-pins-modal-title');
    const viewPinsStatusBadge = container.querySelector('#view-pins-status-badge');
    const viewPinsMissingBadge = container.querySelector('#view-pins-missing-badge');
    const viewPinsGrid = container.querySelector('#view-pins-grid');
    const btnGotoBatchFromView = container.querySelector('#btn-goto-batch-from-view');
    const btnCopyViewPins = container.querySelector('#btn-copy-view-pins');

    function openViewPinsModal(c) {
        currentViewingClass = c;
        triggerHaptic('light');
        viewPinsTitle.textContent = `【${c.className} (${c.classCode})】學生 PIN 碼清冊`;
        const missing = Array.isArray(c.missingSeats) ? c.missingSeats : [];
        const total = c.studentCount || 30;
        const validCount = total - missing.length;
        const pins = c.studentPins || {};
        const pinKeys = Object.keys(pins).filter(s => !missing.includes(Number(s)));

        viewPinsStatusBadge.textContent = `已設定 ${pinKeys.length}/${validCount} 人`;
        viewPinsStatusBadge.className = pinKeys.length >= validCount 
            ? 'px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 font-black text-xs border border-teal-200' 
            : 'px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-black text-xs border border-amber-200';
        viewPinsMissingBadge.textContent = missing.length > 0 ? `缺號：${missing.join(', ')} 號` : '無缺號';

        let html = '';
        for (let i = 1; i <= total; i++) {
            const isMissing = missing.includes(i);
            const pinVal = pins[String(i)] || '';
            if (isMissing) {
                html += `
                    <div class="p-2.5 rounded-xl border border-dashed border-amber-200 bg-amber-50/50 flex items-center justify-between opacity-75">
                        <span class="font-bold text-amber-800">${i}號</span>
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">缺號</span>
                    </div>
                `;
            } else if (pinVal) {
                html += `
                    <div class="p-2.5 rounded-xl border border-teal-200 bg-white shadow-2xs flex items-center justify-between">
                        <span class="font-bold text-slate-700 font-mono">${i}號</span>
                        <span class="px-1.5 py-0.5 rounded text-xs font-black font-mono bg-teal-50 text-teal-800 border border-teal-100">${escapeHtml(pinVal)}</span>
                    </div>
                `;
            } else {
                html += `
                    <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                        <span class="font-bold text-slate-400 font-mono">${i}號</span>
                        <span class="text-[10px] text-slate-400 font-bold">未設定</span>
                    </div>
                `;
            }
        }

        viewPinsGrid.innerHTML = html;
        viewPinsModal.classList.remove('hidden');
    }

    viewPinsClose.addEventListener('click', () => viewPinsModal.classList.add('hidden'));

    btnGotoBatchFromView.addEventListener('click', () => {
        if (!currentViewingClass) return;
        viewPinsModal.classList.add('hidden');
        openBatchModalForClass(currentViewingClass.classCode);
    });

    btnCopyViewPins.addEventListener('click', () => {
        if (currentViewingClass) {
            copyClassPins(currentViewingClass);
        }
    });

    function copyClassPins(c) {
        triggerHaptic('light');
        const missing = Array.isArray(c.missingSeats) ? c.missingSeats : [];
        const total = c.studentCount || 30;
        const pins = c.studentPins || {};
        const lines = [];

        for (let i = 1; i <= total; i++) {
            if (missing.includes(i)) {
                lines.push(`${i}號：(缺號)`);
            } else {
                const p = pins[String(i)] || '未設定';
                lines.push(`${i}號：${p}`);
            }
        }

        const text = `【${currentSchool.name} ${c.className} 學生成績與簽名認證碼 (PIN) 清單】
班級代碼：${c.parentAccessCode}
學生人數：${total} 人${missing.length > 0 ? `（缺 ${missing.join('、')} 號）` : ''}

${lines.join('\n')}

※ 說明：家長端瀏覽聯絡簿與作業無需密碼；進行「家長線上電子簽名」及「個人成績查詢」時請輸入上述各座號專屬 PIN 碼。`;
        safeCopyToClipboard(text);
        showToast(`已複製【${c.className}】學生 PIN 碼清冊至剪貼簿！`, 'success');
    }

    function openBatchModalForClass(classCode) {
        triggerHaptic('light');
        updateStudentsClassSelect(allClassList);
        studentsClassSelect.value = classCode;
        initEditorForClass(classCode);
        switchPinMode('manual');
        studentsModal.classList.remove('hidden');
    }

    // -------------------------------------------------------------
    // 全校教師帳密清單彈窗控制器
    // -------------------------------------------------------------
    const teacherListModal = container.querySelector('#acc-teacher-list-modal');
    const teacherListClose = container.querySelector('#acc-teacher-list-close');
    const btnTeacherList = container.querySelector('#acc-btn-teacher-list');
    const teacherListTableBody = container.querySelector('#teacher-list-table-body');
    const teacherListFilter = container.querySelector('#teacher-list-filter');
    const btnCopyAllTeachers = container.querySelector('#btn-copy-all-teachers');
    const btnExportTeachersCsv = container.querySelector('#btn-export-teachers-csv');

    function renderTeacherListTable(filterText = '') {
        const query = filterText.toLowerCase().trim();
        const filtered = allClassList.filter(c => 
            !query ||
            (c.classCode || '').toLowerCase().includes(query) ||
            (c.className || '').toLowerCase().includes(query) ||
            (c.teacherUsername || '').toLowerCase().includes(query)
        );

        if (filtered.length === 0) {
            teacherListTableBody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">無符合條件的教師帳密資料</td></tr>`;
            return;
        }

        teacherListTableBody.innerHTML = filtered.map(c => `
            <tr class="hover:bg-slate-50 border-b border-slate-100">
                <td class="py-2.5 px-3 font-bold text-slate-800">${escapeHtml(c.classCode)}</td>
                <td class="py-2.5 px-3 font-black text-slate-900">${escapeHtml(c.className)}</td>
                <td class="py-2.5 px-3 font-bold text-indigo-700">${escapeHtml(c.teacherUsername || '-')}</td>
                <td class="py-2.5 px-3 font-bold text-slate-600">${escapeHtml(c.teacherPassword || '-')}</td>
                <td class="py-2.5 px-3 text-center">
                    <button type="button" class="copy-single-teacher-btn px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] cursor-pointer" data-code="${c.classCode}">
                        <i class="fa-solid fa-copy mr-0.5"></i>複製
                    </button>
                </td>
            </tr>
        `).join('');

        teacherListTableBody.querySelectorAll('.copy-single-teacher-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.dataset.code;
                const cls = allClassList.find(c => c.classCode === code);
                if (!cls) return;
                const tText = `【${currentSchool.name} ${cls.className} 教師登入帳密】\n帳號：${cls.teacherUsername}\n密碼：${cls.teacherPassword}\n網址：https://ian1021228.github.io/homework_checker3.0_dev/`;
                safeCopyToClipboard(tText);
                showToast(`已複製【${cls.className}】教師帳密！`, 'success');
            });
        });
    }

    btnTeacherList.addEventListener('click', () => {
        triggerHaptic('light');
        teacherListFilter.value = '';
        renderTeacherListTable('');
        teacherListModal.classList.remove('hidden');
    });

    teacherListClose.addEventListener('click', () => teacherListModal.classList.add('hidden'));

    teacherListFilter.addEventListener('input', (e) => {
        renderTeacherListTable(e.target.value);
    });

    btnCopyAllTeachers.addEventListener('click', () => {
        triggerHaptic('medium');
        const rows = allClassList.map(c => 
            `• ${c.className} (${c.classCode})：帳號 ${c.teacherUsername} / 密碼 ${c.teacherPassword}`
        ).join('\n');
        const fullText = `【${currentSchool.name} 全校教師登入帳密清單】\n教師端登入網址：https://ian1021228.github.io/homework_checker3.0_dev/\n\n${rows}\n\n※ 請各班導師妥善保管密碼，登入後即可進行作業點收與聯絡簿登載。`;
        safeCopyToClipboard(fullText);
        showToast('已複製全校教師帳密清冊至剪貼簿！', 'success');
    });

    btnExportTeachersCsv.addEventListener('click', () => {
        triggerHaptic('medium');
        const rows = [
            ['學校名稱', currentSchool.name],
            ['學校代碼', currentSchool.id],
            ['匯出時間', new Date().toLocaleString()],
            [],
            ['班級代碼', '班級名稱', '教師登入帳號', '教師登入密碼', '教師端登入網址']
        ];
        allClassList.forEach(c => {
            rows.push([
                c.classCode,
                c.className,
                c.teacherUsername || '',
                c.teacherPassword || '',
                'https://ian1021228.github.io/homework_checker3.0_dev/'
            ]);
        });
        exportToCSV(`${currentSchool.name}_全校教師帳密清冊.csv`, rows);
        showToast('已匯出全校教師帳密清冊 CSV！', 'success');
    });

    // -------------------------------------------------------------
    // 全校家長代碼清單彈窗控制器
    // -------------------------------------------------------------
    const parentListModal = container.querySelector('#acc-parent-list-modal');
    const parentListClose = container.querySelector('#acc-parent-list-close');
    const btnParentList = container.querySelector('#acc-btn-parent-list');
    const parentListTableBody = container.querySelector('#parent-list-table-body');
    const parentListFilter = container.querySelector('#parent-list-filter');
    const btnCopyAllParents = container.querySelector('#btn-copy-all-parents');
    const btnExportParentsCsv = container.querySelector('#btn-export-parents-csv');

    function renderParentListTable(filterText = '') {
        const query = filterText.toLowerCase().trim();
        const filtered = allClassList.filter(c => 
            !query ||
            (c.classCode || '').toLowerCase().includes(query) ||
            (c.className || '').toLowerCase().includes(query) ||
            (c.parentAccessCode || '').toLowerCase().includes(query)
        );

        if (filtered.length === 0) {
            parentListTableBody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">無符合條件的家長代碼資料</td></tr>`;
            return;
        }

        parentListTableBody.innerHTML = filtered.map(c => {
            const directUrl = `https://ian1021228.github.io/parent_dashboard_dev/?code=${c.parentAccessCode}`;
            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100">
                    <td class="py-2.5 px-3 font-bold text-slate-800">${escapeHtml(c.classCode)}</td>
                    <td class="py-2.5 px-3 font-black text-slate-900">${escapeHtml(c.className)}</td>
                    <td class="py-2.5 px-3 font-bold text-teal-800">${escapeHtml(c.parentAccessCode || '-')}</td>
                    <td class="py-2.5 px-3 text-slate-500 truncate max-w-[200px]" title="${directUrl}">${directUrl}</td>
                    <td class="py-2.5 px-3 text-center">
                        <button type="button" class="copy-single-parent-btn px-2 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[11px] cursor-pointer" data-code="${c.classCode}">
                            <i class="fa-solid fa-copy mr-0.5"></i>複製
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        parentListTableBody.querySelectorAll('.copy-single-parent-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.dataset.code;
                const cls = allClassList.find(c => c.classCode === code);
                if (!cls) return;
                const dUrl = `https://ian1021228.github.io/parent_dashboard_dev/?code=${cls.parentAccessCode}`;
                const pText = `【${currentSchool.name} ${cls.className} 家長通知函】\n班級代碼：${cls.parentAccessCode}\n家長免密碼直達連結：${dUrl}\n※ 家長端免密碼直達；簽名與成績查詢需輸入學生座號 PIN 碼。`;
                safeCopyToClipboard(pText);
                showToast(`已複製【${cls.className}】家長代碼通知！`, 'success');
            });
        });
    }

    btnParentList.addEventListener('click', () => {
        triggerHaptic('light');
        parentListFilter.value = '';
        renderParentListTable('');
        parentListModal.classList.remove('hidden');
    });

    parentListClose.addEventListener('click', () => parentListModal.classList.add('hidden'));

    parentListFilter.addEventListener('input', (e) => {
        renderParentListTable(e.target.value);
    });

    btnCopyAllParents.addEventListener('click', () => {
        triggerHaptic('medium');
        const rows = allClassList.map(c => 
            `• ${c.className}：班級代碼 ${c.parentAccessCode} / 直達網址 https://ian1021228.github.io/parent_dashboard_dev/?code=${c.parentAccessCode}`
        ).join('\n');
        const fullText = `【${currentSchool.name} 全校家長端代碼與免密碼直達清單】\n※ 說明：家長端免帳密直達；線上電子簽名與個人成績查詢需使用各座號專屬 PIN 碼。\n\n${rows}`;
        safeCopyToClipboard(fullText);
        showToast('已複製全校家長代碼清冊至剪貼簿！', 'success');
    });

    btnExportParentsCsv.addEventListener('click', () => {
        triggerHaptic('medium');
        const rows = [
            ['學校名稱', currentSchool.name],
            ['學校代碼', currentSchool.id],
            ['匯出時間', new Date().toLocaleString()],
            [],
            ['班級代碼', '班級名稱', '家長查詢代碼', '免密碼直達網址', '登入方式說明']
        ];
        allClassList.forEach(c => {
            rows.push([
                c.classCode,
                c.className,
                c.parentAccessCode || '',
                `https://ian1021228.github.io/parent_dashboard_dev/?code=${c.parentAccessCode}`,
                '免密碼直達（簽章與成績查詢需學生PIN碼）'
            ]);
        });
        exportToCSV(`${currentSchool.name}_全校家長代碼清冊.csv`, rows);
        showToast('已匯出全校家長代碼清冊 CSV！', 'success');
    });

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

    // 批量設定成績認證碼彈窗控制
    const pinModeBtnManual = container.querySelector('#pin-mode-btn-manual');
    const pinModeBtnIdcard = container.querySelector('#pin-mode-btn-idcard');
    const pinCardManual = container.querySelector('#pin-card-manual');
    const pinCardIdcard = container.querySelector('#pin-card-idcard');
    const btnFillIdcardDemo = container.querySelector('#btn-fill-idcard-demo');
    const btnExtractLast5 = container.querySelector('#btn-extract-last5');
    const btnClearPinInput = container.querySelector('#btn-clear-pin-input');
    const pinPreviewContainer = container.querySelector('#pin-preview-container');
    const pinPreviewBadge = container.querySelector('#pin-preview-badge');
    const studentsInputLabel = container.querySelector('#students-input-label');
    const pinGutter = container.querySelector('#pin-editor-gutter');
    const btnRemoveBlankLines = container.querySelector('#btn-remove-blank-lines');
    const btnRemoveAltBlanks = container.querySelector('#btn-remove-alternate-blanks');
    const btnClearEditorAll = container.querySelector('#btn-clear-editor-all');

    let currentPinMode = 'manual'; // 'manual' 或 'idcard'
    let currentParsedPins = {};

    function switchPinMode(mode) {
        currentPinMode = mode;
        triggerHaptic('light');
        if (mode === 'manual') {
            pinModeBtnManual.className = 'py-1.5 rounded-lg bg-white text-indigo-700 shadow-2xs font-black transition-all cursor-pointer';
            pinModeBtnIdcard.className = 'py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all cursor-pointer font-bold';
            pinCardManual.classList.remove('hidden');
            pinCardIdcard.classList.add('hidden');
            studentsInputLabel.textContent = '編輯成績認證碼（左側為灰色不可編輯座號編號）：';
            studentsInput.placeholder = '在此輸入或貼上 PIN 碼...\n第 1 行為 1 號\n第 2 行留空代表 2 號缺號\n第 3 行為 3 號...';
        } else {
            pinModeBtnIdcard.className = 'py-1.5 rounded-lg bg-white text-teal-700 shadow-2xs font-black transition-all cursor-pointer';
            pinModeBtnManual.className = 'py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all cursor-pointer font-bold';
            pinCardIdcard.classList.remove('hidden');
            pinCardManual.classList.add('hidden');
            studentsInputLabel.textContent = '批量貼上身分證字號（左側為灰色座號，貼上後按「自動擷取末五碼」）：';
            studentsInput.placeholder = 'A123456789\nB223456789\n（空白行代表該號缺號）\nC198765432...';
        }
        parseAndRenderPinPreview();
    }

    pinModeBtnManual.addEventListener('click', () => switchPinMode('manual'));
    pinModeBtnIdcard.addEventListener('click', () => switchPinMode('idcard'));

    // 更新左側灰色不可編輯的座號編號 Gutter
    function updateEditorGutter() {
        if (!pinGutter || !studentsInput) return;
        const rawLines = studentsInput.value.split('\n');
        const count = Math.max(1, rawLines.length);
        let html = '';
        for (let i = 1; i <= count; i++) {
            html += `<div class="h-6 leading-6 text-slate-400 font-mono text-xs sm:text-sm font-semibold select-none pr-1.5 text-right whitespace-nowrap">${i}</div>`;
        }
        pinGutter.innerHTML = html;
        pinGutter.scrollTop = studentsInput.scrollTop;
    }

    // 齊步滾動
    studentsInput.addEventListener('scroll', () => {
        if (pinGutter) pinGutter.scrollTop = studentsInput.scrollTop;
    });

    // 初始化目標班級編輯器內容（一開始所有 PIN 碼皆為空白，第 1 行 1 號、第 2 行 2 號...）
    function initEditorForClass(classCode) {
        const targetClass = allClassList.find(c => c.classCode === classCode);
        const studentCount = targetClass?.studentCount || 30;

        if (targetClass?.studentPins && Object.keys(targetClass.studentPins).length > 0) {
            const maxSeat = Math.max(studentCount, ...Object.keys(targetClass.studentPins).map(Number));
            const lines = [];
            for (let s = 1; s <= maxSeat; s++) {
                const pin = targetClass.studentPins[String(s)];
                lines.push(pin !== undefined ? String(pin) : '');
            }
            studentsInput.value = lines.join('\n');
        } else {
            // 一開始所有 PIN 碼都要是空白的，第一行編號 1，第二行編號 2，以此類推
            studentsInput.value = Array(studentCount).fill('').join('\n');
        }
        updateEditorGutter();
        parseAndRenderPinPreview();
    }

    // 即時解析預覽表格（支援空白行為空號）
    function parseAndRenderPinPreview() {
        updateEditorGutter();
        const rawLines = studentsInput.value.split('\n');
        currentParsedPins = {};
        const previewItems = [];
        let validPinCount = 0;
        let emptyLineCount = 0;

        rawLines.forEach((rawLine, idx) => {
            const seat = idx + 1;
            const trimmed = rawLine.trim();

            if (!trimmed) {
                emptyLineCount++;
                previewItems.push({
                    seat,
                    pin: '',
                    isBlank: true
                });
                return;
            }

            const parts = trimmed.split(/[\s,，\t]+/).filter(Boolean);
            let pinVal = '';

            if (parts.length >= 2 && !isNaN(parseInt(parts[0], 10))) {
                pinVal = parts[parts.length - 1];
            } else {
                pinVal = parts[0];
            }

            if (pinVal) {
                currentParsedPins[String(seat)] = pinVal;
                validPinCount++;
                previewItems.push({
                    seat,
                    pin: pinVal,
                    isBlank: false
                });
            }
        });

        pinPreviewBadge.textContent = `已設定 ${validPinCount} 筆 (空號 ${emptyLineCount} 筆)`;
        studentsPreviewCount.textContent = validPinCount > 0 
            ? `已輸入 ${validPinCount} 筆認證碼（共 ${rawLines.length} 行，空號 ${emptyLineCount} 行）` 
            : `尚未設定有效認證碼（共 ${rawLines.length} 行空號）`;

        if (previewItems.length === 0) {
            pinPreviewContainer.innerHTML = `<div class="col-span-full py-3 text-center text-slate-400">請輸入或貼上資料以預覽認證碼</div>`;
            return;
        }

        pinPreviewContainer.innerHTML = previewItems.map(item => {
            if (item.isBlank) {
                return `
                    <div class="p-2 rounded-xl border border-dashed border-slate-200 bg-slate-100/60 flex items-center justify-between opacity-60">
                        <span class="font-bold text-slate-400 font-mono">${item.seat}號</span>
                        <span class="text-[10px] text-slate-400 font-bold font-mono">（空號 / 留空）</span>
                    </div>
                `;
            }
            const is5Digits = String(item.pin).length === 5;
            return `
                <div class="p-2 rounded-xl border border-teal-200 bg-teal-50/60 flex items-center justify-between shadow-2xs">
                    <span class="font-bold text-teal-950 font-mono">${item.seat}號</span>
                    <span class="font-black px-1.5 py-0.5 rounded text-[11px] font-mono ${is5Digits ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-800'}">
                        ${escapeHtml(item.pin)}
                    </span>
                </div>
            `;
        }).join('');
    }

    studentsInput.addEventListener('input', parseAndRenderPinPreview);
    studentsInput.addEventListener('keyup', updateEditorGutter);
    studentsInput.addEventListener('change', parseAndRenderPinPreview);

    // 下方一鍵清除快捷功能：
    // 1. 一鍵清除空白行 (連號對齊)
    if (btnRemoveBlankLines) {
        btnRemoveBlankLines.addEventListener('click', () => {
            triggerHaptic('light');
            const lines = studentsInput.value.split('\n');
            const filtered = lines.filter(l => l.trim() !== '');
            if (filtered.length === lines.length) {
                showToast('目前內容中沒有空白行', 'info');
                return;
            }
            studentsInput.value = filtered.join('\n');
            parseAndRenderPinPreview();
            showToast('已清除所有空白行，所有認證碼已連號對齊！', 'success');
        });
    }

    // 2. 一鍵清除隔行空白 (針對試算表複製產生的雙重換行)
    if (btnRemoveAltBlanks) {
        btnRemoveAltBlanks.addEventListener('click', () => {
            triggerHaptic('light');
            const lines = studentsInput.value.split('\n');
            const oddBlanks = lines.filter((l, i) => i % 2 === 1 && l.trim() === '').length;
            const evenBlanks = lines.filter((l, i) => i % 2 === 0 && l.trim() === '').length;
            let filtered = [];

            if (oddBlanks >= lines.length * 0.25) {
                filtered = lines.filter((l, i) => !(i % 2 === 1 && l.trim() === ''));
            } else if (evenBlanks >= lines.length * 0.25) {
                filtered = lines.filter((l, i) => !(i % 2 === 0 && l.trim() === ''));
            } else {
                filtered = lines.filter(l => l.trim() !== '');
            }
            studentsInput.value = filtered.join('\n');
            parseAndRenderPinPreview();
            showToast('已清除隔行空白行！', 'success');
        });
    }

    // 3. 全部清空
    if (btnClearEditorAll) {
        btnClearEditorAll.addEventListener('click', () => {
            triggerHaptic('light');
            const targetCode = studentsClassSelect.value;
            const targetClass = allClassList.find(c => c.classCode === targetCode);
            const count = targetClass?.studentCount || 30;
            studentsInput.value = Array(count).fill('').join('\n');
            parseAndRenderPinPreview();
            showToast(`已全部清空，重設為 ${count} 行空白行（1~${count}號）`, 'info');
        });
    }

    // 4. 清空所有 PIN
    btnClearPinInput.addEventListener('click', () => {
        triggerHaptic('light');
        const targetCode = studentsClassSelect.value;
        const targetClass = allClassList.find(c => c.classCode === targetCode);
        const count = targetClass?.studentCount || 30;
        studentsInput.value = Array(count).fill('').join('\n');
        parseAndRenderPinPreview();
        showToast('已清空所有 PIN 碼內容', 'info');
    });

    // 彈窗開啟時
    studentsBtn.addEventListener('click', () => {
        triggerHaptic('light');
        updateStudentsClassSelect(allClassList);
        initEditorForClass(studentsClassSelect.value);
        switchPinMode('manual');
        studentsModal.classList.remove('hidden');
    });

    // 目標班級切換時載入
    studentsClassSelect.addEventListener('change', () => {
        initEditorForClass(studentsClassSelect.value);
    });

    // 一鍵手動隨機產生 6 碼 PIN (跳過缺號)
    btnFillDemo.addEventListener('click', () => {
        triggerHaptic('light');
        const targetCode = studentsClassSelect.value || '701';
        const targetClass = allClassList.find(c => c.classCode === targetCode);
        const studentCount = targetClass?.studentCount || 30;
        const missing = targetClass?.missingSeats || [];
        const demoLines = [];

        for (let i = 1; i <= studentCount; i++) {
            if (missing.includes(i)) {
                demoLines.push(''); // 缺號行留白！
            } else {
                const pin = String(Math.floor(100000 + Math.random() * 900000));
                demoLines.push(pin);
            }
        }

        studentsInput.value = demoLines.join('\n');
        parseAndRenderPinPreview();
        showToast(`已隨機產生【${targetClass?.className || targetCode}】${studentCount - missing.length} 位學生專屬 6 碼 PIN（缺號已留空）！`, 'info');
    });

    // 帶入 30 筆示範身分證字號
    btnFillIdcardDemo.addEventListener('click', () => {
        triggerHaptic('light');
        const targetCode = studentsClassSelect.value || '701';
        const targetClass = allClassList.find(c => c.classCode === targetCode);
        const studentCount = targetClass?.studentCount || 30;
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'J', 'K', 'L', 'M', 'N'];
        const demoIdLines = [];

        for (let i = 1; i <= studentCount; i++) {
            const prefix = letters[(i - 1) % letters.length];
            const gender = (i % 2 === 0) ? '2' : '1';
            const mid = String(1000 + (i * 37) % 8999).padStart(4, '0');
            const last4 = String(1000 + (i * 73) % 8999).padStart(4, '0');
            const idCard = `${prefix}${gender}${mid}${last4}`;
            demoIdLines.push(idCard);
        }

        studentsInput.value = demoIdLines.join('\n');
        parseAndRenderPinPreview();
        showToast(`已載入 ${studentCount} 筆示範身分證字號，請點擊「自動擷取末五碼按鈕」！`, 'info', 4000);
    });

    // 按下「自動擷取末五碼按鈕」
    btnExtractLast5.addEventListener('click', () => {
        triggerHaptic('medium');
        const lines = studentsInput.value.split('\n');
        let extractedCount = 0;
        const resultLines = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed) return '';
            const cleanId = trimmed.replace(/[^A-Za-z0-9]/g, '');
            if (cleanId.length >= 5) {
                extractedCount++;
                return cleanId.slice(-5);
            } else if (cleanId.length > 0) {
                extractedCount++;
                return cleanId;
            }
            return '';
        });

        if (extractedCount === 0) {
            showToast('無法辨識有效的身分證字號，請確認輸入內容！', 'warning');
            return;
        }

        studentsInput.value = resultLines.join('\n');
        parseAndRenderPinPreview();
        showToast(`已成功自 ${extractedCount} 筆身分證字號自動擷取末五碼！`, 'success', 4000);
    });

    // 確認批量儲存成績認證碼並同步至雲端
    btnCommitStudents.addEventListener('click', async () => {
        const targetCode = studentsClassSelect.value;
        const targetClass = allClassList.find(c => c.classCode === targetCode);
        if (!targetClass) {
            showToast("找不到目標班級！", "error");
            return;
        }

        const pinKeys = Object.keys(currentParsedPins);
        if (pinKeys.length === 0) {
            showToast("請先輸入認證碼或貼上身分證字號！", "warning");
            return;
        }

        triggerHaptic('medium');
        targetClass.studentPins = { ...currentParsedPins };
        targetClass.studentCount = Math.max(targetClass.studentCount || 30, pinKeys.length);

        // 同步更新 studentAccounts 結構相容
        targetClass.studentAccounts = pinKeys.map(s => ({
            seat: Number(s),
            name: `學生${s}號`,
            studentId: `113${targetCode}${String(s).padStart(2, '0')}`,
            pin: String(currentParsedPins[s])
        }));

        await saveSchoolClass(targetClass);
        showToast(`已成功為【${targetClass.className}】批量設定 ${pinKeys.length} 位學生之成績認證碼！`, 'success', 5000);
        closeStudents();
        loadClasses();
    });

    // 匯出成績認證碼清冊 CSV (不含姓名)
    btnExportStudentsCsv.addEventListener('click', () => {
        const targetCode = studentsClassSelect.value;
        const targetClass = allClassList.find(c => c.classCode === targetCode);
        const pins = targetClass?.studentPins || currentParsedPins || {};
        const seatKeys = Object.keys(pins).map(Number).sort((a, b) => a - b);

        if (seatKeys.length === 0) {
            showToast("此班級尚無設定成績認證碼！", "warning");
            return;
        }

        triggerHaptic('medium');
        const rows = [
            ['學校名稱', currentSchool.name],
            ['班級名稱', targetClass?.className || targetCode],
            ['班級代碼', targetClass?.classCode || targetCode],
            ['匯出時間', new Date().toLocaleString()],
            [],
            ['座號', '學生成績查詢認證碼 (PIN)']
        ];

        seatKeys.forEach(seat => {
            rows.push([
                seat,
                pins[String(seat)]
            ]);
        });

        exportToCSV(`${currentSchool.name}_${targetClass?.className || targetCode}_成績認證碼清冊.csv`, rows);
        showToast(`已成功匯出【${targetClass?.className || targetCode}】成績認證碼清冊 CSV！`, 'success');
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
