// ============ 配置 ============
const SUPABASE_URL = "https://hxgrpamlyujltvghhftf.supabase.co";
const SUPABASE_KEY = "sb_publishable_fYDSZNCcFJEQwSKha9W5_w_x65TrlIj";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const TB = {
  products: "fg_products",
  moves: "fg_moves",
  logs: "fg_activity_logs",
};

// 4 个固定种类 + 1 个"未分类"
const CATEGORIES = ["样布", "出口订单", "库存纱", "内销订单"];
const CAT_FILTER_UNCAT = "__uncat__";

// ⭐ 分类中文 → 英文（显示时用）
const CATEGORY_ZH2EN = {
  "样布":       "Sample",
  "出口订单":   "Export Order",
  "库存纱":     "Stock Yarn",
  "内销订单":   "Domestic Order",
  "活性染料":   "Reactive Dye",
  "分散染料":   "Disperse Dye",
  "酸性染料":   "Acid Dye",
  "主浆料":     "Main Size",
  "助剂":       "Auxiliary",
  "辅料":       "Supplies",
  "前处理助剂": "Pre-treatment",
  "后处理助剂": "Post-treatment",
  "卷染助剂":   "Jig Dyeing",
  "染色":       "Dyeing",
  "浆纱":       "Sizing",
  "后整理":     "Finishing",
  "未分类":     "Uncategorized",
};

// ⭐ 分类英文 → 中文（导入时用）
const CATEGORY_EN2ZH = {
  "Sample":         "样布",
  "Export Order":   "出口订单",
  "Stock Yarn":     "库存纱",
  "Domestic Order": "内销订单",
  "Reactive Dye":   "活性染料",
  "Disperse Dye":   "分散染料",
  "Acid Dye":       "酸性染料",
  "Main Size":      "主浆料",
  "Auxiliary":      "助剂",
  "Supplies":       "辅料",
  "Pre-treatment":  "前处理助剂",
  "Post-treatment": "后处理助剂",
  "Jig Dyeing":     "卷染助剂",
  "Dyeing":         "染色",
  "Sizing":         "浆纱",
  "Finishing":      "后整理",
  "Uncategorized":  "未分类",
};

// ⭐ 分类显示（中英切换）
function displayCategory(zh) {
  if (!zh) return "";
  if (currentLang === "en") return CATEGORY_ZH2EN[zh] || zh;
  return zh;
}

// 8 种流水类型定义
const MOVE_TYPES = {
  in: [
    { key: "purchase",        zh: "采购入库",   en: "Purchase In" },
    { key: "return_customer", zh: "客户退货",   en: "Customer Return" },
    { key: "return_internal", zh: "内部退料",   en: "Internal Return" },
    { key: "rework_in",       zh: "返工入库",   en: "Rework In" },
  ],
  out: [
    { key: "sale",            zh: "销售出库",   en: "Sales Out" },
    { key: "return_purchase", zh: "采购退货",   en: "Purchase Return" },
    { key: "internal_use",    zh: "内部领料",   en: "Internal Use" },
    { key: "rework_out",      zh: "返工出库",   en: "Rework Out" },
  ]
};

// ============ 全局状态 ============
let currentLang = "en";
let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
const PAGE_SIZE = 20;
let editingId = null;
let currentLogs = [];
let currentMoveProduct = null;
let currentMoveType = "in";
let currentMoveSubType = "purchase";
let currentReportData = [];
let currentSysLogs = [];
let currentInvoiceData = [];
let currentAgingData = [];
let currentInventoryData = [];
let invCurrentPage = 1;
const INV_PAGE_SIZE = 50;

// 分页
let currentLogsPage = 1;
const LOGS_PAGE_SIZE = 50;
let currentAgingPage = 1;
const AGING_PAGE_SIZE = 50;
let currentReportPage = 1;
const REPORT_PAGE_SIZE = 50;
let currentInvoicePage = 1;
const INVOICE_PAGE_SIZE = 50;
let currentSysLogsPage = 1;
const SYSLOGS_PAGE_SIZE = 50;

// 仪表盘"最近操作"分页
let currentDashRecent = [];
let currentDashPage = 1;
const DASH_PAGE_SIZE = 20;

// ⭐ 批量出运
let selectedIds = new Set();
let currentBatchShipType = "sale";

// ⭐ 防重复提交锁
let savingProduct = false;
let savingMove = false;
let savingBatchShip = false;
let savingPwd = false;

// ============ 工具函数 ============
function t(zh, en) { return currentLang === "zh" ? zh : en; }

function getAgingDays(p) {
  const d = p.scan_time || p.created_at;
  if (!d) return 0;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return 0;
  const diff = Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
}

function parseDateSafe(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  const t2 = new Date(s);
  if (!isNaN(t2.getTime())) {
    return `${t2.getFullYear()}-${String(t2.getMonth()+1).padStart(2,"0")}-${String(t2.getDate()).padStart(2,"0")}`;
  }
  return null;
}

// 品类归属
function getCategoryOf(p) {
  const c = (p.category || "").trim();
  if (!c) return "未分类";
  if (CATEGORIES.includes(c)) return c;
  return "未分类";
}

// 等级归一化
function getGradeOf(p) {
  const g = (p.grade || "").toUpperCase().trim();
  return ["A","B","C","P"].includes(g) ? g : "";
}

// ⭐ 判断是否已出运
function isShipped(p) {
  return Number(p.length || 0) === 0 && !!p.out_date;
}

// 获取流水类型的显示名
function getMoveTypeLabel(moveType, subType) {
  const list = MOVE_TYPES[moveType] || [];
  const found = list.find(x => x.key === subType);
  if (found) return t(found.zh, found.en);
  return moveType === "in" ? t("入库","In") : t("出库","Out");
}

// 判断是不是"初始库存"
function isInitMove(m) {
  return (m.note || "").startsWith("[初始库存]");
}

// ============ 语言切换 ============
function toggleLang() {
  currentLang = currentLang === "zh" ? "en" : "zh";
  document.querySelectorAll("[data-zh]").forEach(el => {
    el.textContent = el.getAttribute("data-" + currentLang);
  });
  document.querySelectorAll("option[data-zh]").forEach(el => {
    el.textContent = el.getAttribute("data-" + currentLang);
  });
  renderProducts();
}

function initLang() {
  document.querySelectorAll("[data-zh]").forEach(el => {
    el.textContent = el.getAttribute("data-" + currentLang);
  });
  document.querySelectorAll("option[data-zh]").forEach(el => {
    el.textContent = el.getAttribute("data-" + currentLang);
  });
}

// ============ 权限 ============
let currentUserRole = "viewer";

async function loadUserRole() {
  try {
    const { data: userData } = await supabaseClient.auth.getUser();
    if (!userData?.user) return;
    const { data, error } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (error) { currentUserRole = "viewer"; return; }
    currentUserRole = data?.role || "viewer";
    applyRoleUI();
  } catch (e) {
    currentUserRole = "viewer";
  }
}

function canEdit()   { return currentUserRole === "admin" || currentUserRole === "operator"; }
function canDelete() { return currentUserRole === "admin"; }

function applyRoleUI() {
  document.querySelectorAll("[data-role]").forEach(el => {
    const need = el.getAttribute("data-role");
    let show = false;
    if (need === "admin") show = (currentUserRole === "admin");
    else if (need === "operator") show = (currentUserRole === "admin" || currentUserRole === "operator");
    else if (need === "viewer") show = true;
    el.style.display = show ? "" : "none";
  });
}

// ============ 登录 ============
function showMain(email) {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("mainPage").style.display = "block";
  document.getElementById("userEmail").textContent = email;
}

async function login() {
  const btn = document.getElementById("loginBtn");
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("loginMsg");
  msg.textContent = "";

  // ⭐ 禁用按钮 + 显示进度
  if (btn) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = t("登录中...", "Logging in...");
    btn.style.opacity = "0.7";
    btn.style.cursor = "wait";
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      msg.textContent = t("登录失败: ", "Login failed: ") + error.message;
      return;
    }

    const remember = document.getElementById("rememberMe")?.checked;
    if (remember) localStorage.setItem("remember_email", data.user.email);
    else localStorage.removeItem("remember_email");

    // ⭐ 分步显示进度
    if (btn) btn.textContent = t("加载权限...", "Loading role...");
    await loadUserRole();

    if (btn) btn.textContent = t("加载数据...", "Loading data...");
    showMain(data.user.email);
    await loadProducts();

    if (btn) btn.textContent = t("进入系统...", "Entering...");
    goToDashboard();

  } finally {
    // ⭐ 恢复按钮
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || t("登录", "Login");
      btn.style.opacity = "";
      btn.style.cursor = "";
    }
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  document.getElementById("loginPage").style.display = "flex";
  ["mainPage","dashboardPage","logsPage","reportPage","sysLogsPage","invoicePage","agingPage","inventoryPage"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

// ============ 系统日志 ============
async function writeSysLog(action, detail) {
  try {
    const { data: userData } = await supabaseClient.auth.getUser();
    const email = userData?.user?.email || "unknown";
    await supabaseClient.from(TB.logs).insert({ user_email: email, action, detail });
  } catch (e) { console.warn(e); }
}

async function writeProductLog(action, opts) {
  try {
    const { data: userData } = await supabaseClient.auth.getUser();
    const email = userData?.user?.email || "unknown";
    await supabaseClient.from(TB.logs).insert({
      user_email: email,
      action,
      detail: opts.detail || "",
      ref_no:      opts.ref_no      || null,
      pattern_no:  opts.pattern_no  || null,
      category:    opts.category    || null,
      length:      opts.length      ?? null,
      unit_price:  opts.unit_price  ?? null,
      changes:     opts.changes     || null,
    });
  } catch (e) { console.warn(e); }
}

// ============ 加载成品 ============
async function loadProducts() {
  const { data, error } = await supabaseClient
    .from(TB.products)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) { alert(t("加载失败: ", "Load failed: ") + error.message); return; }
  allProducts = data || [];
  filteredProducts = allProducts;
  currentPage = 1;
  renderProducts();
}

function renderProducts() {
  const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
  const categoryFilter = document.getElementById("categoryFilter")?.value || "";
  const gradeFilter = document.getElementById("gradeFilter")?.value || "";
  const agingFilter = document.getElementById("agingFilter")?.value || "";
  const hideShipped = document.getElementById("hideShipped")?.checked || false;

  filteredProducts = allProducts.filter(p => {
    
    if (hideShipped && isShipped(p)) return false;

    if (keyword) {
      const kw = (p.inspection_no || "").toLowerCase().includes(keyword)
              || (p.pattern_no || "").toLowerCase().includes(keyword)
              || (p.roll_no || "").toLowerCase().includes(keyword);
      if (!kw) return false;
    }
    if (categoryFilter) {
      const cat = getCategoryOf(p);
      if (categoryFilter === CAT_FILTER_UNCAT) {
        if (cat !== "未分类") return false;
      } else {
        if (cat !== categoryFilter) return false;
      }
    }
    if (gradeFilter) {
      if (getGradeOf(p) !== gradeFilter) return false;
    }
    if (agingFilter) {
      const days = getAgingDays(p);
      if (agingFilter === "0-30" && days > 30) return false;
      if (agingFilter === "31-90" && !(days > 30 && days <= 90)) return false;
      if (agingFilter === "91-180" && !(days > 90 && days <= 180)) return false;
      if (agingFilter === "180+" && days <= 180) return false;
    }
    return true;
  });

 // ⭐ 分页只用「在库的」（或跟 hideShipped 走）
const pagingList = hideShipped
  ? filteredProducts.filter(p => Number(p.length) > 0)
  : filteredProducts;

const totalPages = Math.max(1, Math.ceil(pagingList.length / PAGE_SIZE));
if (currentPage > totalPages) currentPage = totalPages;
const start = (currentPage - 1) * PAGE_SIZE;
const pageItems = pagingList.slice(start, start + PAGE_SIZE);

  const tbody = document.getElementById("productBody");
  tbody.innerHTML = pageItems.map((p, idx) => {
    const aging = getAgingDays(p);
    const seq = start + idx + 1;
    const cat = getCategoryOf(p);
    const esc = s => String(s || "").replace(/"/g, "&quot;");
    const checked = selectedIds.has(p.id) ? "checked" : "";
    return `
    <tr>
      <td style="text-align:center;">
        <input type="checkbox" ${checked} onchange="toggleSelectOne('${p.id}', this.checked)" style="width:auto;cursor:pointer;" />
      </td>
      <td>${seq}</td>
      <td>${p.scan_time || ""}</td>
      <td style="color:${aging > 90 ? '#dc2626' : '#333'};font-weight:${aging > 90 ? 'bold' : 'normal'};">${aging}</td>
      <td>${p.inspection_no || ""}</td>
      <td>${displayCategory(cat)}</td>
      <td class="cell-ellipsis" title="${esc(p.spec)}">${p.spec || ""}</td>
      <td class="cell-ellipsis" title="${esc(p.item_no)}">${p.item_no || ""}</td>
      <td class="cell-ellipsis" title="${esc(p.pattern_no)}">${p.pattern_no || ""}</td>
      <td class="cell-ellipsis" title="${esc(p.composition)}">${p.composition || ""}</td>
      <td>${p.width || ""}</td>
      <td>${p.unit || ""}</td>
      <td>${p.length ?? 0}</td>
      <td>${p.roll_no || ""}</td>
      <td>${p.net_weight ?? 0}</td>
      <td>${p.gross_weight ?? 0}</td>
      <td>${p.grade || ""}</td>
      <td>${p.location || ""}</td>
      <td>${p.cost_price ?? 0}</td>
      <td>${p.out_date || ""}</td>
      <td>${p.invoice_no || ""}</td>
      <td>${p.customer || ""}</td>
      <td class="cell-ellipsis" title="${esc(p.note)}">${p.note || ""}</td>
      <td>
        <button class="in"  onclick="openMoveModal('${p.id}','in')"  data-role="operator">${t("入库","In")}</button>
        <button class="out" onclick="openMoveModal('${p.id}','out')" data-role="operator">${t("出库","Out")}</button>
        <button class="edit" onclick="openEditModal('${p.id}')"       data-role="operator">${t("编辑","Edit")}</button>
        <button class="copy" onclick="openCopyModal('${p.id}')"       data-role="operator">${t("复制","Copy")}</button>
        <button class="del"  onclick="deleteProduct('${p.id}')"       data-role="admin">${t("删除","Del")}</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="24" style="text-align:center;color:#999;">${t("暂无数据","No data")}</td></tr>`;

document.getElementById("pageInfo").textContent =
  `${currentPage} / ${totalPages}  (${pagingList.length})`;
  const gotoEl = document.getElementById("gotoPage");
  if (gotoEl) gotoEl.max = totalPages;

// ⭐ 头部统计：只算还有布长的
const inStock = allProducts.filter(p => Number(p.length) > 0);
const totalCount = inStock.length;
const totalLength = inStock.reduce((s, p) => s + (Number(p.length) || 0), 0);
const totalValue = inStock.reduce((s, p) =>
  s + (Number(p.length) || 0) * (Number(p.cost_price) || 0), 0);

  const sc = document.getElementById("statCount");
  const sl = document.getElementById("statLength");
  const sv = document.getElementById("statValue");
  if (sc) sc.textContent = totalCount;
  if (sl) sl.textContent = totalLength.toFixed(2);
  if (sv) sv.textContent = totalValue.toFixed(2);

  renderPageSummary("productSummary", pageItems, pagingList, "Y");
  applyRoleUI();

  updateBatchShipBtn();
  updateHeaderCheckbox(pageItems);
}

function updateHeaderCheckbox(pageItems) {
  const hc = document.getElementById("headerCheckbox");
  if (!hc) return;
  const total = pageItems.length;
  const checkedCount = pageItems.filter(p => selectedIds.has(p.id)).length;
  if (total === 0 || checkedCount === 0) {
    hc.checked = false;
    hc.indeterminate = false;
  } else if (checkedCount === total) {
    hc.checked = true;
    hc.indeterminate = false;
  } else {
    hc.checked = false;
    hc.indeterminate = true;
  }
}

function toggleSelectAllCurrentPage(checked) {
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredProducts.slice(start, start + PAGE_SIZE);
  pageItems.forEach(p => {
    if (checked) selectedIds.add(p.id);
    else selectedIds.delete(p.id);
  });
  renderProducts();
}

function toggleSelectOne(id, checked) {
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
  updateBatchShipBtn();
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredProducts.slice(start, start + PAGE_SIZE);
  updateHeaderCheckbox(pageItems);
}

function updateBatchShipBtn() {
  const btn = document.getElementById("batchShipBtn");
  if (!btn) return;
  const n = selectedIds.size;
  if (n > 0) {
    btn.disabled = false;
    btn.style.background = "";
    btn.style.cursor = "pointer";
    btn.innerHTML = `🚚 ${t("批量出运","Batch Ship")} (${n})`;
  } else {
    btn.disabled = true;
    btn.style.background = "#9ca3af";
    btn.style.cursor = "not-allowed";
    btn.innerHTML = `🚚 ${t("批量出运","Batch Ship")}`;
  }
}

// ============ 分页合计栏渲染 ============
function renderPageSummary(elId, pageItems, allItems, unit) {
  const el = document.getElementById(elId);
  if (!el) return;
  // ⭐ 排除 length=0（已出运）
  const validPage = pageItems.filter(p => Number(p.length) > 0);
  const validAll  = (allItems || []).filter(p => Number(p.length) > 0);
  const pageLen = validPage.reduce((s, p) => s + (Number(p.length) || 0), 0);
  const allLen = validAll.reduce((s, p) => s + (Number(p.length) || 0), 0);
  el.innerHTML = `
    <div class="summary-item">
      <span class="summary-label">${t("当前页","Page")}:</span>
      <span class="summary-value">${pageLen.toFixed(2)} ${unit}</span>
      <span class="summary-label">/</span>
      <span class="summary-value">${validPage.length}</span>
      <span class="summary-label">${t("条","rows")}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">${t("全部","Total")}:</span>
      <span class="summary-value">${allLen.toFixed(2)} ${unit}</span>
      <span class="summary-label">/</span>
      <span class="summary-value">${validAll.length}</span>
      <span class="summary-label">${t("条","rows")}</span>
    </div>`;
}

function renderCustomSummary(elId, leftHtml, rightHtml) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = `
    <div class="summary-item">${leftHtml}</div>
    <div class="summary-item">${rightHtml}</div>`;
}

function prevPage() { if (currentPage > 1) { currentPage--; renderProducts(); } }
function nextPage() {
  const hideShipped = document.getElementById("hideShipped")?.checked || false;
  const pagingList = hideShipped
    ? filteredProducts.filter(p => Number(p.length) > 0)
    : filteredProducts;
  const totalPages = Math.ceil(pagingList.length / PAGE_SIZE);
  if (currentPage < totalPages) { currentPage++; renderProducts(); }
}

function gotoPage() {
  const hideShipped = document.getElementById("hideShipped")?.checked || false;
  const pagingList = hideShipped
    ? filteredProducts.filter(p => Number(p.length) > 0)
    : filteredProducts;
  const input = document.getElementById("gotoPage");
  const totalPages = Math.ceil(pagingList.length / PAGE_SIZE) || 1;
  let n = parseInt(input.value);
  if (!n || n < 1) n = 1;
  if (n > totalPages) n = totalPages;
  currentPage = n;
  renderProducts();
  input.value = "";
}

// ============ 彩虹按钮 ============
function colorizeButtons() {
  const colors = ["#2563eb", "#f59e0b", "#16a34a", "#dc2626"];
  document.querySelectorAll(".toolbar").forEach(toolbar => {
    const btns = toolbar.querySelectorAll("button, .import-btn");
    btns.forEach((btn, i) => {
      btn.style.setProperty("background", colors[i % 4], "important");
      btn.style.setProperty("color", "#fff", "important");
      btn.style.setProperty("border", "none", "important");
    });
  });
  document.querySelectorAll(".dash-actions").forEach(wrap => {
    const btns = wrap.querySelectorAll("button");
    btns.forEach((btn, i) => {
      btn.style.setProperty("background", colors[i % 4], "important");
      btn.style.setProperty("color", "#fff", "important");
      btn.style.setProperty("border", "none", "important");
    });
  });
  const bsBtn = document.getElementById("batchShipBtn");
  if (bsBtn) {
    if (bsBtn.disabled) {
      bsBtn.style.setProperty("background", "#9ca3af", "important");
      bsBtn.style.setProperty("cursor", "not-allowed", "important");
    } else {
      bsBtn.style.setProperty("background", "#8b5cf6", "important");
      bsBtn.style.setProperty("cursor", "pointer", "important");
    }
    bsBtn.style.setProperty("color", "#fff", "important");
    bsBtn.style.setProperty("border", "none", "important");
  }
}
setInterval(() => { colorizeButtons(); applyRoleUI(); }, 2000);

// ============ 新增/编辑/复制 ============
function openAddModal() {
  editingId = null;
  document.getElementById("modalTitle").textContent = t("新增成品","Add FG");
  document.getElementById("modalTitle").style.color = "";
  ["f_scan_time","f_inspection_no","f_spec","f_item_no","f_pattern_no","f_composition",
   "f_width","f_unit","f_length","f_roll_no","f_net_weight","f_gross_weight",
   "f_location","f_cost_price","f_out_date","f_invoice_no","f_customer","f_note"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  const catEl = document.getElementById("f_category"); if (catEl) catEl.value = "";
  const grEl  = document.getElementById("f_grade");    if (grEl)  grEl.value  = "";

  const cb = document.getElementById("f_is_inbound");
  if (cb) { cb.checked = true; cb.disabled = false; }
  const lenInput = document.getElementById("f_length");
  if (lenInput) lenInput.disabled = false;

  document.getElementById("modal").style.display = "flex";
}

function openEditModal(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById("modalTitle").textContent = t("编辑成品","Edit FG");
  document.getElementById("modalTitle").style.color = "";

  const map = {
    f_scan_time: "scan_time", f_inspection_no: "inspection_no",
    f_spec: "spec", f_item_no: "item_no", f_pattern_no: "pattern_no",
    f_composition: "composition", f_width: "width", f_unit: "unit",
    f_length: "length", f_roll_no: "roll_no", f_net_weight: "net_weight",
    f_gross_weight: "gross_weight", f_location: "location",
    f_cost_price: "cost_price", f_out_date: "out_date",
    f_invoice_no: "invoice_no", f_customer: "customer", f_note: "note",
  };
  Object.entries(map).forEach(([inputId, field]) => {
    const el = document.getElementById(inputId);
    if (el) el.value = p[field] ?? "";
  });
  const catEl = document.getElementById("f_category");
  if (catEl) catEl.value = p.category || "";
  const grEl = document.getElementById("f_grade");
  if (grEl) grEl.value = (p.grade || "").toUpperCase().trim();

  const lenInput = document.getElementById("f_length");
  if (lenInput) lenInput.disabled = true;
  const cb = document.getElementById("f_is_inbound");
  if (cb) { cb.checked = false; cb.disabled = true; }

  document.getElementById("modal").style.display = "flex";
}

function openCopyModal(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  editingId = null;
  document.getElementById("modalTitle").textContent = t("复制新增","Copy & Add");
  document.getElementById("modalTitle").style.color = "#dc2626";

  const map = {
    f_scan_time: "scan_time", f_inspection_no: "inspection_no",
    f_spec: "spec", f_item_no: "item_no", f_pattern_no: "pattern_no",
    f_composition: "composition", f_width: "width", f_unit: "unit",
    f_length: "length", f_roll_no: "roll_no", f_net_weight: "net_weight",
    f_gross_weight: "gross_weight", f_location: "location",
    f_cost_price: "cost_price", f_out_date: "out_date",
    f_invoice_no: "invoice_no", f_customer: "customer", f_note: "note",
  };
  Object.entries(map).forEach(([inputId, field]) => {
    const el = document.getElementById(inputId);
    if (el) el.value = p[field] ?? "";
  });
  const catEl = document.getElementById("f_category");
  if (catEl) catEl.value = p.category || "";
  const grEl = document.getElementById("f_grade");
  if (grEl) grEl.value = (p.grade || "").toUpperCase().trim();

  document.getElementById("f_inspection_no").value = "";
  const lenInput = document.getElementById("f_length");
  if (lenInput) lenInput.disabled = false;
  const cb = document.getElementById("f_is_inbound");
  if (cb) { cb.checked = true; cb.disabled = false; }

  document.getElementById("modal").style.display = "flex";
}

function closeModal() { document.getElementById("modal").style.display = "none"; }

async function saveProduct() {
  if (savingProduct) return;
  savingProduct = true;
  try {
    if (!canEdit()) { alert(t("您没有编辑权限","No permission")); return; }
    const g = id => { const el = document.getElementById(id); return el ? el.value : ""; };

    const category = (g("f_category") || "").trim();
    if (!category) { alert(t("种类必选","Category required")); return; }

    const gradeVal = (g("f_grade") || "").toUpperCase().trim();
    if (gradeVal && !["A","B","C","P"].includes(gradeVal)) {
      alert(t("等级只能是 A/B/C/P","Grade must be A/B/C/P"));
      return;
    }

    const payload = {
      scan_time: g("f_scan_time").trim(),
      inspection_no: g("f_inspection_no").trim(),
      category: category,
      spec: g("f_spec").trim(),
      item_no: g("f_item_no").trim(),
      pattern_no: g("f_pattern_no").trim(),
      composition: g("f_composition").trim(),
      width: g("f_width").trim(),
      unit: g("f_unit").trim(),
      length: Number(g("f_length")) || 0,
      roll_no: g("f_roll_no").trim(),
      net_weight: Number(g("f_net_weight")) || 0,
      gross_weight: Number(g("f_gross_weight")) || 0,
      grade: gradeVal,
      location: g("f_location").trim(),
      cost_price: Number(g("f_cost_price")) || 0,
      out_date: g("f_out_date") || null,
      invoice_no: g("f_invoice_no").trim(),
      customer: g("f_customer").trim(),
      note: g("f_note").trim(),
    };

    if (!payload.inspection_no) {
      alert(t("检验单编号必填","Inspection No required"));
      return;
    }

    if (editingId) {
      const old = allProducts.find(x => x.id === editingId);
      if (old) payload.length = old.length ?? 0;
    }

    let error;
    if (editingId) {
      ({ error } = await supabaseClient.from(TB.products).update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabaseClient.from(TB.products).insert(payload));
    }

    if (error) {
      if (error.message.includes("inspection_no") || error.message.includes("unique")) {
        alert(t("该检验单编号已存在","Inspection No already exists"));
      } else {
        alert(t("保存失败: ","Save failed: ") + error.message);
      }
      return;
    }

    if (editingId) {
      const old = allProducts.find(x => x.id === editingId);
      const changes = computeProductChanges(old, payload);
      if (changes.length === 0) {
        alert(t("没有改动","No changes"));
        closeModal();
        return;
      }
      await writeProductLog("edit_product", {
        detail:     `编辑 ${payload.inspection_no}`,
        ref_no:     payload.inspection_no,
        pattern_no: old?.pattern_no || "",
        category:   old?.category   || "",
        length:     Number(old?.length) || 0,
        unit_price: Number(old?.cost_price) || 0,
        changes:    changes.join("\n"),
      });
    } else {
      await writeProductLog("add_product", {
        detail:     `新增成品 ${payload.inspection_no}`,
        ref_no:     payload.inspection_no,
        pattern_no: payload.pattern_no,
        category:   payload.category,
        length:     Number(payload.length) || 0,
        unit_price: Number(payload.cost_price) || 0,
        changes:    "",
      });

      if (Number(payload.length) > 0) {
        const isInbound = document.getElementById("f_is_inbound")?.checked;
        const { data: newProd } = await supabaseClient
          .from(TB.products).select("id")
          .eq("inspection_no", payload.inspection_no)
          .maybeSingle();

        if (newProd) {
          const { data: userData } = await supabaseClient.auth.getUser();
          await supabaseClient.from(TB.moves).insert({
            product_id: newProd.id,
            move_type: "in",
            quantity: Number(payload.length),
            unit_price: payload.cost_price || 0,
            category: payload.category,
            note: isInbound ? "采购入库" : "[初始库存] Initial stock",
            is_return: false,
            is_internal: false,
            is_rework: false,
            operator: userData?.user?.email || "unknown",
            move_date: new Date().toISOString().slice(0,10),
          });
        }
      }
    }

    closeModal();
    loadProducts();
  } finally {
    savingProduct = false;
  }
}

function computeProductChanges(oldP, newP) {
  if (!oldP) return [];
  const fields = [
    ["scan_time",    "扫描时间"],
    ["spec",         "规格"],
    ["item_no",      "货号"],
    ["pattern_no",   "花型号"],
    ["composition",  "成份"],
    ["width",        "门幅"],
    ["unit",         "单位"],
    ["roll_no",      "卷号"],
    ["net_weight",   "重量(KG)"],
    ["gross_weight", "毛重(KG)"],
    ["grade",        "等级"],
    ["location",     "库位"],
    ["cost_price",   "单价"],
    ["out_date",     "出库日期"],
    ["invoice_no",   "发票号"],
    ["customer",     "客户"],
    ["note",         "备注"],
    ["category",     "种类"],
  ];
  const fmt = v => (String(v ?? "") === "" ? "(空)" : String(v ?? ""));
  const changes = [];
  fields.forEach(([key, label]) => {
    const oldV = oldP[key] ?? "";
    const newV = newP[key] ?? "";
    if (String(oldV) !== String(newV)) {
      changes.push(`${label}: ${fmt(oldV)} → ${fmt(newV)}`);
    }
  });
  return changes;
}

async function deleteProduct(id) {
  if (!canDelete()) { alert(t("您没有删除权限","No permission")); return; }
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  if (!confirm(t(`确定删除 检验单:${p.inspection_no} ？`, `Delete ${p.inspection_no}?`))) return;
  const { error } = await supabaseClient.from(TB.products).delete().eq("id", id);
  if (error) { alert(t("删除失败: ","Delete failed: ") + error.message); return; }
  await writeProductLog("delete_product", {
    detail:     `删除成品 ${p.inspection_no}`,
    ref_no:     p.inspection_no,
    pattern_no: p.pattern_no || "",
    category:   getCategoryOf(p),
    length:     Number(p.length) || 0,
    unit_price: Number(p.cost_price) || 0,
    changes:    "",
  });
  loadProducts();
}

// ============ 导入 ============
function openImportModal() {
  document.getElementById("importFile").value = "";
  document.getElementById("importMsg").textContent = "";
  document.querySelector('input[name="importType"][value="init"]').checked = true;
  document.querySelectorAll('input[name="importSubType"]').forEach(r => r.checked = false);
  onImportTypeChange("init");
  document.getElementById("importModal").style.display = "flex";
}
function closeImportModal() { document.getElementById("importModal").style.display = "none"; }

function onImportTypeChange(type) {
  const inSub = document.getElementById("importInSub");
  const outSub = document.getElementById("importOutSub");
  if (inSub)  inSub.style.display  = type === "in"  ? "flex" : "none";
  if (outSub) outSub.style.display = type === "out" ? "flex" : "none";
}

async function doImport() {
  const fileInput = document.getElementById("importFile");
  const file = fileInput.files[0];
  const msg = document.getElementById("importMsg");
  if (!file) { msg.textContent = t("请选择 CSV 文件","Please choose a CSV file"); return; }

  const importType = document.querySelector('input[name="importType"]:checked').value;
  let importSubType = "";
  if (importType === "in" || importType === "out") {
    importSubType = document.querySelector('input[name="importSubType"]:checked')?.value || "";
    if (!importSubType) { msg.textContent = t("请选择具体类型","Choose sub type"); return; }
  }

  msg.textContent = t("读取文件中...","Reading...");
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { msg.textContent = t("CSV 为空","Empty CSV"); return; }

  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g,""));
  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/("([^"]|"")*"|[^,]*)(,|$)/g)
      .map(c => c.replace(/,$/,"").replace(/^"|"$/g,"").replace(/""/g,'"'));
    const obj = {};
    headers.forEach((h, idx) => {
      let v = cols[idx] ?? "";
      if (["length","net_weight","gross_weight","cost_price"].includes(h)) v = Number(v) || 0;
      if (h === "out_date") v = v || null;
      if (h === "grade") v = String(v || "").toUpperCase().trim();
      obj[h] = v;
    });

    // ⭐ 英文分类 → 中文
    if (obj.category) {
      const trimmed = String(obj.category).trim();
      if (CATEGORY_EN2ZH[trimmed]) {
        obj.category = CATEGORY_EN2ZH[trimmed];
      } else if (CATEGORIES.includes(trimmed)) {
        obj.category = trimmed;
      } else {
        obj.category = "未分类";
      }
    } else {
      obj.category = "未分类";
    }

    if (obj.inspection_no) items.push(obj);
  }
  if (!items.length) { msg.textContent = t("没有有效数据","No valid data"); return; }

  const inspectionNos = items.map(x => x.inspection_no);

  msg.textContent = t("检查 CSV 内部重复...","Checking CSV dups...");
  const uniqueSet = new Set(inspectionNos);
  if (uniqueSet.size !== inspectionNos.length) {
    const seen = new Set(); const dups = [];
    inspectionNos.forEach(n => { if (seen.has(n)) { if (!dups.includes(n)) dups.push(n); } else seen.add(n); });
    msg.textContent = `❌ ${t("CSV 内部有重复（前10）","CSV dups (first 10)")}:\n${dups.slice(0,10).join("、")}`;
    return;
  }

  msg.textContent = t("检查数据库重复...","Checking DB dups...");
  const CHUNK = 500; const existing = [];
  for (let i = 0; i < inspectionNos.length; i += CHUNK) {
    const part = inspectionNos.slice(i, i + CHUNK);
    const { data, error } = await supabaseClient
      .from(TB.products).select("inspection_no").in("inspection_no", part);
    if (error) { msg.textContent = t("检查失败: ","Check failed: ") + error.message; return; }
    (data || []).forEach(r => existing.push(r.inspection_no));
  }
  if (existing.length > 0) {
    msg.textContent = `❌ ${t("数据库已存在（前10）","Already in DB (first 10)")}:\n${existing.slice(0,10).join("、")}`;
    return;
  }

  msg.textContent = t(`正在导入 ${items.length} 条...`, `Importing ${items.length} rows...`);
  const INSERT_CHUNK = 500;
  for (let i = 0; i < items.length; i += INSERT_CHUNK) {
    const part = items.slice(i, i + INSERT_CHUNK);
    const { error: e1 } = await supabaseClient.from(TB.products).insert(part);
    if (e1) { msg.textContent = t("导入失败: ","Import failed: ") + e1.message; return; }
  }

  const idMap = {};
  const QUERY_CHUNK = 200;
  for (let i = 0; i < inspectionNos.length; i += QUERY_CHUNK) {
    const part = inspectionNos.slice(i, i + QUERY_CHUNK);
    const { data: prods, error: e2 } = await supabaseClient
      .from(TB.products).select("id, inspection_no, length, cost_price, category")
      .in("inspection_no", part);
    if (e2) { msg.textContent = t("查询失败: ","Query failed: ") + e2.message; return; }
    (prods || []).forEach(p => { idMap[p.inspection_no] = p; });
  }

  const { data: userData } = await supabaseClient.auth.getUser();
  const operator = userData?.user?.email || "unknown";
  const today = new Date().toISOString().slice(0,10);

  let moveType = "in";
  let isReturn = false, isInternal = false, isRework = false;
  let returnType = "", reworkStage = "";
  let typeLabel = "";

  if (importType === "init") {
    typeLabel = "[初始库存] Initial stock";
    moveType = "in";
  } else {
    const def = [...MOVE_TYPES.in, ...MOVE_TYPES.out].find(x => x.key === importSubType);
    typeLabel = def ? t(def.zh, def.en) : "";
    if (importSubType === "purchase") { moveType = "in"; }
    else if (importSubType === "return_customer") { moveType = "in"; isReturn = true; returnType = "customer_return"; }
    else if (importSubType === "return_internal") { moveType = "in"; isReturn = true; returnType = "internal_return"; }
    else if (importSubType === "rework_in") { moveType = "in"; isRework = true; reworkStage = "from_workshop"; }
    else if (importSubType === "sale") { moveType = "out"; }
    else if (importSubType === "return_purchase") { moveType = "out"; isReturn = true; returnType = "purchase_return"; }
    else if (importSubType === "internal_use") { moveType = "out"; isInternal = true; }
    else if (importSubType === "rework_out") { moveType = "out"; isRework = true; reworkStage = "to_workshop"; }
  }

  let moves = items.map(item => {
    const prod = idMap[item.inspection_no];
    if (!prod) return null;
    return {
      product_id: prod.id,
      move_type: moveType,
      quantity: Number(item.length) || 0,
      unit_price: Number(item.cost_price) || 0,
      category: item.category || prod.category || "",
      note: typeLabel,
      is_return: isReturn,
      return_type: returnType,
      return_reason: "",
      ref_move_id: null,
      is_internal: isInternal,
      is_rework: isRework,
      rework_stage: reworkStage,
      operator,
      move_date: importType === "init"
        ? (parseDateSafe(item.scan_time) || today)
        : today,
    };
  }).filter(Boolean);

  if (moves.length) {
    const MOVE_CHUNK = 500;
    for (let i = 0; i < moves.length; i += MOVE_CHUNK) {
      const part = moves.slice(i, i + MOVE_CHUNK);
      const { error: e3 } = await supabaseClient.from(TB.moves).insert(part);
      if (e3) { msg.textContent = t("写流水失败: ","Move failed: ") + e3.message; return; }
    }
  }

  const label = importType === "init"
    ? t("期初库存","Initial")
    : (importType === "in" ? t("入库","In") : t("出库","Out")) + " · " + typeLabel;
  msg.textContent = `✅ ${t("成功导入","Imported")} ${items.length} ${t("条","rows")}（${label}）`;
  setTimeout(() => { closeImportModal(); loadProducts(); }, 2000);
}

// ============ 导出 ============
function openExportModal() {
  document.querySelector('input[name="exportScope"][value="filtered"]').checked = true;
  document.getElementById("exportModal").style.display = "flex";
  updateExportInfo();
}
function closeExportModal() { document.getElementById("exportModal").style.display = "none"; }

function updateExportInfo() {
  const scope = document.querySelector('input[name="exportScope"]:checked').value;
  const info = document.getElementById("exportInfo");
  const pageCount = filteredProducts.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE).length;
  if (scope === "page") info.textContent = t(`将导出当前页 ${pageCount} 条`, `Export page (${pageCount})`);
  else if (scope === "filtered") info.textContent = t(`将导出筛选结果 ${filteredProducts.length} 条`, `Export filtered (${filteredProducts.length})`);
  else info.textContent = t(`将导出全部 ${allProducts.length} 条`, `Export all (${allProducts.length})`);
}
document.addEventListener("change", (e) => {
  if (e.target && e.target.name === "exportScope") updateExportInfo();
});

function doExport() {
  const scope = document.querySelector('input[name="exportScope"]:checked').value;
  let data;
  if (scope === "page") {
    const start = (currentPage - 1) * PAGE_SIZE;
    data = filteredProducts.slice(start, start + PAGE_SIZE);
  } else if (scope === "filtered") {
    data = filteredProducts;
  } else {
    data = allProducts;
  }
  if (!data.length) { alert(t("没有数据","No data")); return; }

  const headers = ["scan_time","inspection_no","category","spec","item_no","pattern_no","composition",
                   "width","unit","length","roll_no","net_weight","gross_weight",
                   "grade","location","cost_price","out_date","invoice_no","customer","note"];
  const rows = data.map(p =>
    headers.map(h => `"${(p[h] ?? "").toString().replace(/"/g,'""')}"`).join(","));
  const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const suffix = scope === "page" ? "_page" + currentPage : (scope === "filtered" ? "_filtered" : "_all");
  a.download = "fg" + suffix + "_" + new Date().toISOString().slice(0,10) + ".csv";
  a.click();
  closeExportModal();
}

// ============ 出入库（8 种类型 + NOTE 追加） ============
function openMoveModal(productId, type) {
  const p = allProducts.find(x => x.id === productId);
  if (!p) return;
  currentMoveProduct = p;
  currentMoveType = type;
  currentMoveSubType = type === "in" ? "purchase" : "sale";

  document.getElementById("moveTitle").textContent = type === "in" ? t("入库","Stock In") : t("出库","Stock Out");
  document.getElementById("moveProductName").textContent =
    `${t("检验单","Inspection")}:${p.inspection_no} | ${t("花型号","Pattern")}:${p.pattern_no || ""} | ${t("种类","Category")}:${displayCategory(getCategoryOf(p))} | ${t("当前布长 (Y)","Current Length (Y)")}: ${p.length ?? 0}`;

  renderMoveTypeTabs(type);

  document.getElementById("m_quantity").value = "";
  document.getElementById("m_unit_price").value = type === "in" ? (p.cost_price || "") : "";
  document.getElementById("m_invoice_no").value = p.invoice_no || "";
  document.getElementById("m_customer").value = p.customer || "";
  document.getElementById("m_note").value = "";
  document.getElementById("m_return_reason").value = "";
  document.getElementById("m_ref_move_id").innerHTML = '<option value="">-- 不关联 --</option>';
  document.getElementById("m_date").value = new Date().toISOString().slice(0,10);

  const invInput = document.getElementById("m_invoice_no");
  const cusInput = document.getElementById("m_customer");
  if (type === "out") {
    invInput.style.display = "block";
    cusInput.style.display = "block";
  } else {
    invInput.style.display = "none";
    cusInput.style.display = "none";
  }

  toggleMoveTypeUI();

  document.getElementById("moveMsg").textContent = "";
  document.getElementById("moveModal").style.display = "flex";
}

function renderMoveTypeTabs(type) {
  const wrap = document.getElementById("moveTypeTabs");
  const list = MOVE_TYPES[type] || [];
  wrap.innerHTML = list.map(item => `
    <label class="${item.key === currentMoveSubType ? 'active' : ''}" data-key="${item.key}">
      <input type="radio" name="moveSubType" value="${item.key}" ${item.key === currentMoveSubType ? 'checked' : ''} onchange="onMoveSubTypeChange('${item.key}')" />
      <span>${t(item.zh, item.en)}</span>
    </label>
  `).join("");
}

function onMoveSubTypeChange(key) {
  currentMoveSubType = key;
  document.querySelectorAll("#moveTypeTabs label").forEach(lb => {
    lb.classList.toggle("active", lb.dataset.key === key);
  });
  toggleMoveTypeUI();
}

function toggleMoveTypeUI() {
  const key = currentMoveSubType;
  const reasonWrap = document.getElementById("m_reason_wrap");
  const refWrap = document.getElementById("m_ref_wrap");

  const needReason = ["return_customer","return_purchase","return_internal","rework_in","rework_out"].includes(key);
  reasonWrap.style.display = needReason ? "block" : "none";

  const needRef = (key === "rework_in");
  refWrap.style.display = needRef ? "block" : "none";

  if (needRef) {
    loadRefMoves();
  }
}

async function loadRefMoves() {
  if (!currentMoveProduct) return;
  const sel = document.getElementById("m_ref_move_id");
  sel.innerHTML = '<option value="">-- 加载中... --</option>';

  const { data, error } = await supabaseClient
    .from(TB.moves)
    .select("id, quantity, move_date, note, return_reason")
    .eq("product_id", currentMoveProduct.id)
    .eq("is_rework", true)
    .eq("rework_stage", "to_workshop")
    .order("created_at", { ascending: false });

  if (error || !data || !data.length) {
    sel.innerHTML = '<option value="">-- 无返工出库记录 --</option>';
    return;
  }

  sel.innerHTML = '<option value="">-- 不关联 --</option>' +
    data.map(m => `<option value="${m.id}">${m.move_date} | ${m.quantity} Y | ${m.return_reason || m.note || ""}</option>`).join("");
}

function closeMoveModal() { document.getElementById("moveModal").style.display = "none"; }

async function saveMove() {
  if (savingMove) return;
  savingMove = true;
  try {
    if (!canEdit()) { alert(t("您没有出入库权限","No permission")); return; }

    const qty = Number(document.getElementById("m_quantity").value);
    const price = Number(document.getElementById("m_unit_price").value) || 0;
    const note = document.getElementById("m_note").value.trim();
    const date = document.getElementById("m_date").value || new Date().toISOString().slice(0,10);
    const reason = document.getElementById("m_return_reason").value.trim();
    const refId = document.getElementById("m_ref_move_id").value || null;
    const msg = document.getElementById("moveMsg");
    const subType = currentMoveSubType;

    if (!qty || qty <= 0) { msg.textContent = t("请输入有效布长 (Y)","Invalid length (Y)"); return; }

    let actualType = currentMoveType;
    if (["return_customer","return_internal","rework_in"].includes(subType)) {
      actualType = "in";
    }
    if (["return_purchase","internal_use","rework_out"].includes(subType)) {
      actualType = "out";
    }

    const cur = Number(currentMoveProduct.length) || 0;
    if (actualType === "out" && qty > cur) {
      msg.textContent = t(`布长不足，当前 ${cur} Y`, `Not enough, current ${cur} Y`);
      return;
    }

    const newQty = actualType === "in" ? cur + qty : cur - qty;

    const updatePayload = { length: newQty };

    if (note) {
      const oldNote = currentMoveProduct.note || "";
      const typeLabel = getMoveTypeLabel(actualType, subType);
      const newLine = `[${date} ${typeLabel}] ${note}`;
      updatePayload.note = oldNote ? `${oldNote}\n${newLine}` : newLine;
    }

    if (actualType === "out") {
      const invoice = document.getElementById("m_invoice_no").value.trim();
      const customer = document.getElementById("m_customer").value.trim();
      if (invoice) updatePayload.invoice_no = invoice;
      if (customer) updatePayload.customer = customer;
      updatePayload.out_date = date;
    }

    const { error: e1 } = await supabaseClient
      .from(TB.products).update(updatePayload).eq("id", currentMoveProduct.id);
    if (e1) { msg.textContent = t("更新失败: ","Update failed: ") + e1.message; return; }

    const { data: userData } = await supabaseClient.auth.getUser();

    const isReturn = ["return_customer","return_purchase","return_internal"].includes(subType);
    const isInternal = (subType === "internal_use");
    const isRework = ["rework_in","rework_out"].includes(subType);

    let returnType = "";
    if (subType === "return_customer") returnType = "customer_return";
    else if (subType === "return_purchase") returnType = "purchase_return";
    else if (subType === "return_internal") returnType = "internal_return";

    let reworkStage = "";
    if (subType === "rework_out") reworkStage = "to_workshop";
    else if (subType === "rework_in") reworkStage = "from_workshop";

    const movePayload = {
      product_id: currentMoveProduct.id,
      move_type: actualType,
      quantity: qty,
      unit_price: price,
      category: getCategoryOf(currentMoveProduct),
      note: note,
      operator: userData?.user?.email || "unknown",
      move_date: date,
      is_return: isReturn,
      return_type: returnType,
      return_reason: reason || "",
      ref_move_id: refId,
      is_internal: isInternal,
      is_rework: isRework,
      rework_stage: reworkStage,
    };

    const { error: e2 } = await supabaseClient.from(TB.moves).insert(movePayload);
    if (e2) { msg.textContent = t("写流水失败: ","Move failed: ") + e2.message; return; }

    closeMoveModal();
    loadProducts();
  } finally {
    savingMove = false;
  }
}
// ============ 批量出运 ============
function openBatchShipModal() {
  if (selectedIds.size === 0) { alert(t("请先勾选要出运的卷","Please select rolls first")); return; }

  const selected = allProducts.filter(p => selectedIds.has(p.id));
  const totalLen = selected.reduce((s, p) => s + (Number(p.length) || 0), 0);
  document.getElementById("batchShipInfo").textContent =
    `${t("已选","Selected")} ${selected.length} ${t("卷","rolls")} | ${t("合计","Total")} ${totalLen.toFixed(2)} Y`;

  currentBatchShipType = "sale";
  renderBatchShipTypeTabs();

  const cust = selected.find(p => (p.customer || "").trim())?.customer || "";
  document.getElementById("bs_customer").value = cust;

  document.getElementById("bs_invoice_no").value = "";
  document.getElementById("bs_note").value = "";
  document.getElementById("bs_date").value = new Date().toISOString().slice(0,10);

  document.getElementById("batchShipMsg").textContent = "";
  document.getElementById("batchShipModal").style.display = "flex";
}

function closeBatchShipModal() {
  document.getElementById("batchShipModal").style.display = "none";
}

function renderBatchShipTypeTabs() {
  const wrap = document.getElementById("batchShipTypeTabs");
  const list = MOVE_TYPES.out || [];
  wrap.innerHTML = list.map(item => `
    <label class="${item.key === currentBatchShipType ? 'active' : ''}" data-key="${item.key}">
      <input type="radio" name="batchShipType" value="${item.key}" ${item.key === currentBatchShipType ? 'checked' : ''} onchange="onBatchShipTypeChange('${item.key}')" />
      <span>${t(item.zh, item.en)}</span>
    </label>
  `).join("");
}

function onBatchShipTypeChange(key) {
  currentBatchShipType = key;
  document.querySelectorAll("#batchShipTypeTabs label").forEach(lb => {
    lb.classList.toggle("active", lb.dataset.key === key);
  });
}

async function saveBatchShip() {
  if (savingBatchShip) return;
  savingBatchShip = true;
  try {
    if (!canEdit()) { alert(t("您没有出运权限","No permission")); return; }

    const msg = document.getElementById("batchShipMsg");
    const invoice = document.getElementById("bs_invoice_no").value.trim();
    const customer = document.getElementById("bs_customer").value.trim();
    const date = document.getElementById("bs_date").value || new Date().toISOString().slice(0,10);
    const note = document.getElementById("bs_note").value.trim();
    const subType = currentBatchShipType;

    if (!invoice) { msg.textContent = t("发票号必填","Invoice No required"); return; }
    if (!date) { msg.textContent = t("出货日期必填","Ship date required"); return; }

    const selected = allProducts.filter(p => selectedIds.has(p.id));
    if (!selected.length) { msg.textContent = t("没有选中的卷","No rolls selected"); return; }

    const isReturn = (subType === "return_purchase");
    const isInternal = (subType === "internal_use");
    const isRework = (subType === "rework_out");

    let returnType = "";
    if (subType === "return_purchase") returnType = "purchase_return";

    let reworkStage = "";
    if (subType === "rework_out") reworkStage = "to_workshop";

    const typeLabel = getMoveTypeLabel("out", subType);
    const { data: userData } = await supabaseClient.auth.getUser();
    const operator = userData?.user?.email || "unknown";

    msg.textContent = t("正在出运...","Shipping...");

    // ⭐ 关键：先把出运前的布长、单价记下来，再清零
    const shipRecords = selected.map(p => ({
      id: p.id,
      length: Number(p.length) || 0,
      cost_price: Number(p.cost_price) || 0,
    }));

    const UPDATE_CHUNK = 100;
    for (let i = 0; i < selected.length; i += UPDATE_CHUNK) {
      const part = selected.slice(i, i + UPDATE_CHUNK);
      for (const p of part) {
        const updatePayload = {
          length: 0,
          out_date: date,
          invoice_no: invoice,
          customer: customer,
        };
        if (note) {
          const oldNote = p.note || "";
          const newLine = `[${date} ${typeLabel}] ${note}`;
          updatePayload.note = oldNote ? `${oldNote}\n${newLine}` : newLine;
        }
        const { error: eu } = await supabaseClient
          .from(TB.products).update(updatePayload).eq("id", p.id);
        if (eu) {
          msg.textContent = t("更新失败: ","Update failed: ") + eu.message;
          return;
        }
      }
      msg.textContent = t(`更新产品 ${Math.min(i + UPDATE_CHUNK, selected.length)} / ${selected.length}`, `Updating products... ${Math.min(i + UPDATE_CHUNK, selected.length)} / ${selected.length}`);
    }

    // ⭐ 写流水时带上 invoice_no / customer，布长用出运前的值
    const moves = shipRecords.map(r => ({
      product_id: r.id,
      move_type: "out",
      quantity: r.length,                  // ⭐ 用出运前的布长
      unit_price: r.cost_price,
      invoice_no: invoice,                 // ⭐ 必须加
      customer: customer,                  // ⭐ 必须加
      category: getCategoryOf(selected.find(p => p.id === r.id)),
      note: note || "",
      operator,
      move_date: date,
      is_return: isReturn,
      return_type: returnType,
      return_reason: "",
      ref_move_id: null,
      is_internal: isInternal,
      is_rework: isRework,
      rework_stage: reworkStage,
    }));

    const MOVE_CHUNK = 500;
    for (let i = 0; i < moves.length; i += MOVE_CHUNK) {
      const part = moves.slice(i, i + MOVE_CHUNK);
      const { error: em } = await supabaseClient.from(TB.moves).insert(part);
      if (em) {
        msg.textContent = t("写流水失败: ","Move failed: ") + em.message;
        return;
      }
    }

    await writeSysLog("batch_ship", `批量出运: ${selected.length} 卷 | 类型:${typeLabel} | 发票:${invoice} | 客户:${customer || "-"}`);

    msg.textContent = `✅ ${t("成功出运","Shipped")} ${selected.length} ${t("卷","rolls")}`;

    selectedIds.clear();

    setTimeout(() => {
      closeBatchShipModal();
      loadProducts();
    }, 1200);
  } finally {
    savingBatchShip = false;
  }
}

// ============ 修改密码 ============
function openPwdModal() {
  document.getElementById("pwd_new").value = "";
  document.getElementById("pwd_confirm").value = "";
  document.getElementById("pwdMsg").textContent = "";
  document.getElementById("pwdModal").style.display = "flex";
}
function closePwdModal() { document.getElementById("pwdModal").style.display = "none"; }

async function savePassword() {
  if (savingPwd) return;
  savingPwd = true;
  try {
    const np = document.getElementById("pwd_new").value;
    const cp = document.getElementById("pwd_confirm").value;
    const msg = document.getElementById("pwdMsg");
    if (!np || np.length < 6) { msg.textContent = t("密码至少 6 位","Min 6 chars"); return; }
    if (np !== cp) { msg.textContent = t("两次输入不一致","Passwords do not match"); return; }
    const { error } = await supabaseClient.auth.updateUser({ password: np });
    if (error) { msg.textContent = t("修改失败: ","Failed: ") + error.message; return; }
    alert(t("密码修改成功","Password updated"));
    closePwdModal();
  } finally {
    savingPwd = false;
  }
}

// ============ 页面切换 ============
function hideAll() {
  ["mainPage","dashboardPage","logsPage","reportPage","sysLogsPage","invoicePage","agingPage","inventoryPage"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

function goToDashboard() {
  hideAll();
  document.getElementById("dashboardPage").style.display = "block";
  document.getElementById("userEmail2").textContent = document.getElementById("userEmail").textContent;
  loadDashboard();
  colorizeButtons();
  applyRoleUI();
}

function goToProducts() {
  hideAll();
  document.getElementById("mainPage").style.display = "block";
  applyRoleUI();
}

function showLogs() {
  hideAll();
  document.getElementById("logsPage").style.display = "block";
  document.getElementById("userEmailLogs").textContent = document.getElementById("userEmail").textContent;
  document.getElementById("logDateFrom").value = "";
  document.getElementById("logDateTo").value = "";
  document.getElementById("logSearch").value = "";
  document.getElementById("logType").value = "";
  loadLogs();
}
function backToMain() { hideAll(); document.getElementById("mainPage").style.display = "block"; }

function showReport() {
  hideAll();
  document.getElementById("reportPage").style.display = "block";
  const now = new Date();
  document.getElementById("reportMonth").value =
    `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  document.getElementById("userEmailReport").textContent = document.getElementById("userEmail").textContent;
  loadReport();
}
function backToMainFromReport() { hideAll(); document.getElementById("mainPage").style.display = "block"; }

function showSysLogs() {
  hideAll();
  document.getElementById("sysLogsPage").style.display = "block";
  document.getElementById("userEmailSysLogs").textContent = document.getElementById("userEmail").textContent;
  document.getElementById("sysLogDateFrom").value = "";
  document.getElementById("sysLogDateTo").value = "";
  document.getElementById("sysLogSearch").value = "";
  document.getElementById("sysLogAction").value = "";
  loadSysLogs();
}
function backToMainFromSysLogs() { hideAll(); document.getElementById("mainPage").style.display = "block"; }

// ============ 发票汇总 ============
function showInvoiceReport() {
  hideAll();
  document.getElementById("invoicePage").style.display = "block";
  document.getElementById("userEmailInvoice").textContent = document.getElementById("userEmail").textContent;
  const now = new Date();
  document.getElementById("invoiceMonth").value =
    `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  loadInvoiceReport();
}
function backToMainFromInvoice() { hideAll(); document.getElementById("mainPage").style.display = "block"; }

async function loadInvoiceReport() {
  const month = document.getElementById("invoiceMonth").value;
  if (!month) return;
  const [y, m] = month.split("-").map(Number);
  const firstDay = `${month}-01`;
  const lastDay = new Date(y, m, 0).toISOString().slice(0, 10);

  // ⭐ 改成从 moves 表查（出运流水），按发票号分组
  const { data, error } = await supabaseClient
    .from(TB.moves)
    .select("*, fg_products(inspection_no, pattern_no, grade, category, cost_price)")
    .eq("move_type", "out")
    .gte("move_date", firstDay)
    .lte("move_date", lastDay);
  if (error) { alert(t("加载失败: ","Load failed: ") + error.message); return; }

  const rows = (data || []).filter(m => (m.invoice_no || "").trim() !== "");
  const groups = {};
  rows.forEach(m => {
    const key = (m.invoice_no || "").trim();
    if (!key) return;
    if (!groups[key]) groups[key] = {
      invoice: key,
      outDate: m.move_date || "",
      customer: m.customer || "",
      category: getCategoryOf({ category: m.category || m.fg_products?.category }),
      rolls: 0, length: 0, value: 0, gA: 0, gB: 0, gC: 0, gP: 0
    };
    if (!groups[key].outDate && m.move_date) groups[key].outDate = m.move_date;
    if (!groups[key].customer && m.customer) groups[key].customer = m.customer;

    groups[key].rolls += 1;                         // ⭐ 卷数 = 计数
    const qty = Number(m.quantity) || 0;            // ⭐ 布长从 move.quantity 取
    const price = Number(m.unit_price) || 0;
    groups[key].length += qty;                      // ⭐ 总布长 = 求和
    groups[key].value += qty * price;               // ⭐ 总金额 = 求和

    const g = (m.fg_products?.grade || "").toUpperCase().trim();
     if (g === "A") groups[key].gA += qty;
    else if (g === "B") groups[key].gB += qty;
       else if (g === "C") groups[key].gC += qty;
     else if (g === "P") groups[key].gP += qty;
  });

  currentInvoiceData = Object.values(groups).sort((a, b) => a.invoice.localeCompare(b.invoice));
  document.getElementById("invCount").textContent = currentInvoiceData.length;
  document.getElementById("invRolls").textContent = currentInvoiceData.reduce((s, r) => s + r.rolls, 0);
  document.getElementById("invLength").textContent = currentInvoiceData.reduce((s, r) => s + r.length, 0).toFixed(2);
  document.getElementById("invValue").textContent = currentInvoiceData.reduce((s, r) => s + r.value, 0).toFixed(2);
  currentInvoicePage = 1;
  renderInvoiceReport(currentInvoiceData);
}

function renderInvoiceReport(data) {
  const total = (data || []).length;
  const totalPages = Math.max(1, Math.ceil(total / INVOICE_PAGE_SIZE));
  if (currentInvoicePage > totalPages) currentInvoicePage = totalPages;
  const start = (currentInvoicePage - 1) * INVOICE_PAGE_SIZE;
  const pageItems = (data || []).slice(start, start + INVOICE_PAGE_SIZE);

  const tbody = document.getElementById("invoiceBody");
  tbody.innerHTML = pageItems.map((r, idx) => {
    const seq = start + idx + 1;
    return `
    <tr>
      <td>${seq}</td>
      <td>${r.outDate || ""}</td>
      <td>${r.invoice}</td>
      <td>${r.customer || ""}</td>
      <td>${displayCategory(r.category)}</td>
      <td>${r.rolls}</td>
      <td>${r.length.toFixed(2)}</td>
      <td>${r.value.toFixed(2)}</td>
      <td>${r.gA}</td>
      <td>${r.gB}</td>
      <td>${r.gC}</td>
      <td>${r.gP}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="12" style="text-align:center;color:#999;">${t("本月无数据","No data")}</td></tr>`;

  const el = document.getElementById("invRepPageInfo");
  if (el) el.textContent = `${currentInvoicePage} / ${totalPages}  (${total})`;

  const pageLen = pageItems.reduce((s, r) => s + r.length, 0);
  const allLen  = currentInvoiceData.reduce((s, r) => s + r.length, 0);
  const pageVal = pageItems.reduce((s, r) => s + r.value, 0);
  const allVal  = currentInvoiceData.reduce((s, r) => s + r.value, 0);
  const pageRolls = pageItems.reduce((s, r) => s + r.rolls, 0);
  const allRolls  = currentInvoiceData.reduce((s, r) => s + r.rolls, 0);
  renderCustomSummary("invoiceSummary",
    `<span class="summary-label">${t("当前页","Page")}:</span> <span class="summary-value">${pageLen.toFixed(2)} Y</span> <span class="summary-label">/ $</span> <span class="summary-value">${pageVal.toFixed(2)}</span> <span class="summary-label">/</span> <span class="summary-value">${pageRolls}</span> <span class="summary-label">${t("卷","rolls")}</span>`,
    `<span class="summary-label">${t("全部","Total")}:</span> <span class="summary-value">${allLen.toFixed(2)} Y</span> <span class="summary-label">/ $</span> <span class="summary-value">${allVal.toFixed(2)}</span> <span class="summary-label">/</span> <span class="summary-value">${allRolls}</span> <span class="summary-label">${t("卷","rolls")}</span>`
  );
}
function invPrevPage() { if (currentInvoicePage > 1) { currentInvoicePage--; renderInvoiceReport(currentInvoiceData); } }
function invNextPage() {
  const totalPages = Math.ceil(currentInvoiceData.length / INVOICE_PAGE_SIZE);
  if (currentInvoicePage < totalPages) { currentInvoicePage++; renderInvoiceReport(currentInvoiceData); }
}
function invRepGotoPage() {
  const input = document.getElementById("invRepGotoPage");
  const totalPages = Math.ceil(currentInvoiceData.length / INVOICE_PAGE_SIZE) || 1;
  let n = parseInt(input.value); if (!n || n < 1) n = 1; if (n > totalPages) n = totalPages;
  currentInvoicePage = n; renderInvoiceReport(currentInvoiceData); input.value = "";
}

function printInvoiceReport() {
  const month = document.getElementById("invoiceMonth").value;
  const printArea = document.getElementById("invoicePrintArea").innerHTML;
  const cards = document.querySelector("#invoicePage .dash-cards").outerHTML;
  const win = window.open("", "", "width=1000,height=700");
  win.document.write(`
    <html><head><title>Invoice Summary - ${month}</title>
    <style>
      body { font-family: "Microsoft YaHei", Arial; padding: 20px; }
      .brand-logo-print { text-align:center; font-size:26px; font-weight:bold; color:#1e3a8a;
        letter-spacing:2px; margin-bottom:10px; padding-bottom:10px; border-bottom:2px solid #1e3a8a; }
      h1 { font-size: 18px; text-align: center; }
      p { font-size: 12px; text-align: center; color: #666; }
      .dash-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 15px 0; }
      .dash-card { border: 1px solid #ddd; padding: 10px; border-radius: 6px; }
      .dash-label { font-size: 11px; color: #666; }
      .dash-value { font-size: 20px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f0f0f0; }
    </style></head><body>
    <div class="brand-logo-print">JP TEXTILE ETHIOPIA PLC</div>
    <h1>Invoice Summary</h1>
    <p>Month: ${month} · Printed: ${new Date().toLocaleString()}</p>
    ${cards}${printArea}</body></html>`);
  win.document.close();
  win.print();
}

function exportInvoiceReport() {
  if (!currentInvoiceData.length) { alert(t("没有数据","No data")); return; }
  const month = document.getElementById("invoiceMonth").value;
  const headers = ["OutDate","Invoice","Customer","Category","Rolls","Length (Y)","Value ($)","A","B","C","P"];
  const rows = currentInvoiceData.map(r => [
    r.outDate || "", r.invoice, r.customer || "", r.category || "",
    r.rolls, r.length.toFixed(2), r.value.toFixed(2),
    r.gA, r.gB, r.gC, r.gP
  ].map(v => `"${(v ?? "").toString().replace(/"/g,'""')}"`).join(","));
  const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "invoice_" + month + ".csv";
  a.click();
}

// ============ 库存分析 ============
function showAgingReport() {
  hideAll();
  document.getElementById("agingPage").style.display = "block";
  document.getElementById("userEmailAging").textContent = document.getElementById("userEmail").textContent;
  const sel = document.getElementById("agingCategoryFilter");
  if (sel) sel.value = "";
  loadAgingReport();
}
function backToMainFromAging() { hideAll(); document.getElementById("mainPage").style.display = "block"; }

function loadAgingReport() {
  const catFilter = document.getElementById("agingCategoryFilter")?.value || "";

  const products = allProducts.filter(p => {
 // ⭐ 排除已出运的（length=0）
   if (Number(p.length) === 0) return false;
    if (!catFilter) return true;
    const cat = getCategoryOf(p);
    if (catFilter === CAT_FILTER_UNCAT) return cat === "未分类";
    return cat === catFilter;
  });

  const buckets = Array.from({length: 9}, () => ({ count: 0, length: 0, value: 0 }));
  const rows = [];
  products.forEach(p => {
    const days = getAgingDays(p);
    const len = Number(p.length) || 0;
    const val = len * (Number(p.cost_price) || 0);
    let idx;
    if (days <= 30) idx = 0;
    else if (days <= 90) idx = 1;
    else if (days <= 180) idx = 2;
    else if (days <= 365) idx = 3;
    else if (days <= 730) idx = 4;
    else if (days <= 1095) idx = 5;
    else if (days <= 1456) idx = 6;
    else if (days <= 1825) idx = 7;
    else idx = 8;
    buckets[idx].count++;
    buckets[idx].length += len;
    buckets[idx].value += val;
    rows.push({
      inspection: p.inspection_no || "",
      pattern: p.pattern_no || "",
      category: getCategoryOf(p),
      inDate: (p.scan_time || p.created_at || "").toString().slice(0,10),
      days: days, length: len,
      cost: Number(p.cost_price) || 0, value: val,
    });
  });

  ["0","1","2","3","4","5","6","7","8"].forEach((n, i) => {
    const s = buckets[i];
    const cEl = document.getElementById("age" + n + "Count");
    const lEl = document.getElementById("age" + n + "Length");
    const vEl = document.getElementById("age" + n + "Value");
    if (cEl) cEl.textContent = s.count;
    if (lEl) lEl.textContent = s.length.toFixed(2);
    if (vEl) vEl.textContent = s.value.toFixed(2);
  });

  rows.sort((a, b) => b.days - a.days);
  currentAgingData = rows;
  currentAgingPage = 1;
  renderAgingReport(rows);
}

function renderAgingReport(data) {
  const total = (data || []).length;
  const totalPages = Math.max(1, Math.ceil(total / AGING_PAGE_SIZE));
  if (currentAgingPage > totalPages) currentAgingPage = totalPages;
  const start = (currentAgingPage - 1) * AGING_PAGE_SIZE;
  const pageItems = (data || []).slice(start, start + AGING_PAGE_SIZE);

  const tbody = document.getElementById("agingBody");
  tbody.innerHTML = pageItems.map((r, idx) => {
    const seq = start + idx + 1;
    const esc = s => String(s || "").replace(/"/g, "&quot;");
    return `
    <tr style="${r.days > 90 ? 'background:#fee2e2;' : ''}">
      <td>${seq}</td>
      <td>${r.inspection}</td>
      <td class="cell-ellipsis" title="${esc(r.pattern)}">${r.pattern}</td>
      <td>${displayCategory(r.category)}</td>
      <td>${r.inDate}</td>
      <td style="color:${r.days > 90 ? '#dc2626' : '#333'};font-weight:${r.days > 90 ? 'bold' : 'normal'};">${r.days}</td>
      <td>${r.length.toFixed(2)}</td>
      <td>${r.cost.toFixed(2)}</td>
      <td>${r.value.toFixed(2)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="9" style="text-align:center;color:#999;">${t("暂无数据","No data")}</td></tr>`;

  const el = document.getElementById("agePageInfo");
  if (el) el.textContent = `${currentAgingPage} / ${totalPages}  (${total})`;

  const pageLen = pageItems.reduce((s, r) => s + r.length, 0);
  const allLen  = (currentAgingData || []).reduce((s, r) => s + r.length, 0);
  const pageVal = pageItems.reduce((s, r) => s + r.value, 0);
  const allVal  = (currentAgingData || []).reduce((s, r) => s + r.value, 0);
  renderCustomSummary("agingSummary",
    `<span class="summary-label">${t("当前页","Page")}:</span> <span class="summary-value">${pageLen.toFixed(2)} Y</span> <span class="summary-label">/ $</span> <span class="summary-value">${pageVal.toFixed(2)}</span> <span class="summary-label">/</span> <span class="summary-value">${pageItems.length}</span> <span class="summary-label">${t("卷","rolls")}</span>`,
    `<span class="summary-label">${t("全部","Total")}:</span> <span class="summary-value">${allLen.toFixed(2)} Y</span> <span class="summary-label">/ $</span> <span class="summary-value">${allVal.toFixed(2)}</span> <span class="summary-label">/</span> <span class="summary-value">${(currentAgingData || []).length}</span> <span class="summary-label">${t("卷","rolls")}</span>`
  );
}
function agePrevPage() { if (currentAgingPage > 1) { currentAgingPage--; renderAgingReport(currentAgingData); } }
function ageNextPage() {
  const totalPages = Math.ceil(currentAgingData.length / AGING_PAGE_SIZE);
  if (currentAgingPage < totalPages) { currentAgingPage++; renderAgingReport(currentAgingData); }
}
function ageGotoPage() {
  const input = document.getElementById("ageGotoPage");
  const totalPages = Math.ceil(currentAgingData.length / AGING_PAGE_SIZE) || 1;
  let n = parseInt(input.value); if (!n || n < 1) n = 1; if (n > totalPages) n = totalPages;
  currentAgingPage = n; renderAgingReport(currentAgingData); input.value = "";
}

function printAgingReport() {
  const printArea = document.getElementById("agingPrintArea").innerHTML;
  const cards = document.querySelector("#agingPage .dash-cards").outerHTML;
  const win = window.open("", "", "width=1000,height=700");
  win.document.write(`
    <html><head><title>Aging Analysis</title>
    <style>
      body { font-family: "Microsoft YaHei", Arial; padding: 20px; }
      .brand-logo-print { text-align:center; font-size:26px; font-weight:bold; color:#1e3a8a;
        letter-spacing:2px; margin-bottom:10px; padding-bottom:10px; border-bottom:2px solid #1e3a8a; }
      h1 { font-size: 18px; text-align: center; }
      p { font-size: 12px; text-align: center; color: #666; }
      .dash-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0; }
      .dash-card { border: 1px solid #ddd; padding: 10px; border-radius: 6px; }
      .dash-label { font-size: 11px; color: #666; }
      .dash-value { font-size: 20px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f0f0f0; }
    </style></head><body>
    <div class="brand-logo-print">JP TEXTILE ETHIOPIA PLC</div>
    <h1>Aging Analysis</h1>
    <p>Printed: ${new Date().toLocaleString()}</p>
    ${cards}${printArea}</body></html>`);
  win.document.close();
  win.print();
}

function exportAgingReport() {
  if (!currentAgingData.length) { alert(t("没有数据","No data")); return; }
  const headers = ["Inspection","Pattern","Category","InDate","Aging(d)","Length (Y)","Cost ($)","Value ($)"];
  const rows = currentAgingData.map(r => [
    r.inspection, r.pattern, r.category, r.inDate, r.days,
    r.length.toFixed(2), r.cost.toFixed(2), r.value.toFixed(2)
  ].map(v => `"${(v ?? "").toString().replace(/"/g,'""')}"`).join(","));
  const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "aging_" + new Date().toISOString().slice(0,10) + ".csv";
  a.click();
}

// ============ 月度报表 ============
async function loadReport() {
  const month = document.getElementById("reportMonth").value;
  if (!month) return;
  const [y, m] = month.split("-").map(Number);
  const firstDay = `${month}-01`;
  const lastDay = new Date(y, m, 0).toISOString().slice(0, 10);

  const { data: movesRaw, error } = await supabaseClient.from(TB.moves)
    .select("*, fg_products(inspection_no, pattern_no, grade, category)")
    .gte("move_date", firstDay).lte("move_date", lastDay);
  if (error) { alert(t("加载失败: ","Load failed: ") + error.message); return; }

  const rows = (movesRaw || []).filter(x => !isInitMove(x));

  const cats = ["样布","出口订单","库存纱","内销订单","未分类"];
  const catLabels = {
    "样布":     t("样布","Sample"),
    "出口订单": t("出口订单","Export Order"),
    "库存纱":   t("库存纱","Stock Yarn"),
    "内销订单": t("内销订单","Domestic Order"),
    "未分类":   t("未分类","Uncategorized")
  };
  const summary = {};
  cats.forEach(c => {
    summary[c] = {
      in:  { A:0, B:0, C:0, P:0, total:0 },
      out: { A:0, B:0, C:0, P:0, total:0 },
      remain: { A:0, B:0, C:0, P:0, total:0 }
    };
  });

  rows.forEach(r => {
    let cat = (r.category || r.fg_products?.category || "").trim();
    if (!cats.includes(cat)) cat = "未分类";
    const g = (r.fg_products?.grade || "").toUpperCase().trim();
    const q = Number(r.quantity || 0);
    if (r.move_type === "in") {
      summary[cat].in.total += q;
      if (["A","B","C","P"].includes(g)) summary[cat].in[g] += q;
    } else {
      summary[cat].out.total += q;
      if (["A","B","C","P"].includes(g)) summary[cat].out[g] += q;
    }
  });

  const stats = {};
  rows.forEach(r => {
    const pid = r.product_id; if (!pid) return;
    if (!stats[pid]) stats[pid] = {
      inspection: r.fg_products?.inspection_no || "",
      pattern: r.fg_products?.pattern_no || "",
      category: (r.category || r.fg_products?.category || "").trim() || "未分类",
      grade: r.fg_products?.grade || "",
      inQty: 0, outQty: 0, net: 0,
    };
    const q = Number(r.quantity || 0);
    if (r.move_type === "in") { stats[pid].inQty += q; stats[pid].net += q; }
    else { stats[pid].outQty += q; stats[pid].net -= q; }
  });

  const { data: beforeRaw } = await supabaseClient.from(TB.moves)
    .select("product_id, move_type, quantity, note").lt("move_date", firstDay);

  const before = {};
  (beforeRaw || []).filter(r => !(r.note||"").startsWith("[初始库存]")).forEach(r => {
    if (!r.product_id) return;
    if (!before[r.product_id]) before[r.product_id] = 0;
    before[r.product_id] += (r.move_type === "in" ? Number(r.quantity||0) : -Number(r.quantity||0));
  });

  Object.keys(stats).forEach(pid => {
    const s = stats[pid];
    const opening = before[pid] || 0;
    const closing = opening + s.inQty - s.outQty;
    const cat = cats.includes(s.category) ? s.category : "未分类";
    const g = (s.grade || "").toUpperCase().trim();
    summary[cat].remain.total += closing;
    if (["A","B","C","P"].includes(g)) summary[cat].remain[g] += closing;
  });

  renderReportSummary(summary, cats, catLabels);

  currentReportData = Object.keys(stats).map(pid => {
    const s = stats[pid];
    const opening = before[pid] || 0;
    return { ...s, opening, closing: opening + s.net };
  });

  currentReportPage = 1;
  renderReport(currentReportData);
}

function renderReportSummary(summary, cats, catLabels) {
  const tbody = document.getElementById("reportSummaryBody");
  if (!tbody) return;

  const fmt = v => (Number(v) || 0).toFixed(2);

  function rowHtml(label, data, isTotal) {
    return `
      <tr class="${isTotal ? 'total-row' : ''}">
        <td class="cat-cell">${label}</td>
        <td>${fmt(data.in.A)}</td><td>${fmt(data.in.B)}</td><td>${fmt(data.in.C)}</td><td>${fmt(data.in.P)}</td>
        <td class="subtotal">${fmt(data.in.total)}</td>
        <td>${fmt(data.out.A)}</td><td>${fmt(data.out.B)}</td><td>${fmt(data.out.C)}</td><td>${fmt(data.out.P)}</td>
        <td class="subtotal">${fmt(data.out.total)}</td>
        <td>${fmt(data.remain.A)}</td><td>${fmt(data.remain.B)}</td><td>${fmt(data.remain.C)}</td><td>${fmt(data.remain.P)}</td>
        <td class="subtotal">${fmt(data.remain.total)}</td>
      </tr>`;
  }

  let html = cats.map(c => rowHtml(catLabels[c] || c, summary[c], false)).join("");

  const totalRow = {
    in:  { A:0, B:0, C:0, P:0, total:0 },
    out: { A:0, B:0, C:0, P:0, total:0 },
    remain: { A:0, B:0, C:0, P:0, total:0 }
  };
  cats.forEach(c => {
    ["A","B","C","P","total"].forEach(g => {
      totalRow.in[g]     += summary[c].in[g];
      totalRow.out[g]    += summary[c].out[g];
      totalRow.remain[g] += summary[c].remain[g];
    });
  });
  html += rowHtml(t("合计","Total"), totalRow, true);

  tbody.innerHTML = html;
}

function renderReport(data) {
  const total = (data || []).length;
  const totalPages = Math.max(1, Math.ceil(total / REPORT_PAGE_SIZE));
  if (currentReportPage > totalPages) currentReportPage = totalPages;
  const start = (currentReportPage - 1) * REPORT_PAGE_SIZE;
  const pageItems = (data || []).slice(start, start + REPORT_PAGE_SIZE);

  const tbody = document.getElementById("reportBody");
  tbody.innerHTML = pageItems.map((r, idx) => {
    const seq = start + idx + 1;
    const esc = s => String(s || "").replace(/"/g, "&quot;");
    return `
    <tr>
      <td>${seq}</td>
      <td>${r.inspection}</td>
      <td class="cell-ellipsis" title="${esc(r.pattern)}">${r.pattern}</td>
      <td>${displayCategory(r.category)}</td>
      <td>${r.grade}</td>
      <td>${r.opening.toFixed(2)}</td>
      <td style="color:#16a34a;">+${r.inQty.toFixed(2)}</td>
      <td style="color:#dc2626;">-${r.outQty.toFixed(2)}</td>
      <td><b>${r.closing.toFixed(2)}</b></td>
    </tr>`;
  }).join("") || `<tr><td colspan="9" style="text-align:center;color:#999;">${t("本月无数据","No data")}</td></tr>`;

  const el = document.getElementById("repPageInfo");
  if (el) el.textContent = `${currentReportPage} / ${totalPages}  (${total})`;

  const pageIn = pageItems.reduce((s, r) => s + r.inQty, 0);
  const allIn  = (currentReportData || []).reduce((s, r) => s + r.inQty, 0);
  const pageOut = pageItems.reduce((s, r) => s + r.outQty, 0);
  const allOut  = (currentReportData || []).reduce((s, r) => s + r.outQty, 0);
  renderCustomSummary("reportSummary",
    `<span class="summary-label">${t("当前页","Page")}:</span> <span class="summary-label">${t("入","In")}</span> <span class="summary-value">${pageIn.toFixed(2)} Y</span> <span class="summary-label">${t("出","Out")}</span> <span class="summary-value">${pageOut.toFixed(2)} Y</span> <span class="summary-label">/</span> <span class="summary-value">${pageItems.length}</span> <span class="summary-label">${t("笔","moves")}</span>`,
    `<span class="summary-label">${t("全部","Total")}:</span> <span class="summary-label">${t("入","In")}</span> <span class="summary-value">${allIn.toFixed(2)} Y</span> <span class="summary-label">${t("出","Out")}</span> <span class="summary-value">${allOut.toFixed(2)} Y</span> <span class="summary-label">/</span> <span class="summary-value">${(currentReportData || []).length}</span> <span class="summary-label">${t("笔","moves")}</span>`
  );
}

function repPrevPage() { if (currentReportPage > 1) { currentReportPage--; renderReport(currentReportData); } }
function repNextPage() {
  const totalPages = Math.ceil(currentReportData.length / REPORT_PAGE_SIZE);
  if (currentReportPage < totalPages) { currentReportPage++; renderReport(currentReportData); }
}
function repGotoPage() {
  const input = document.getElementById("repGotoPage");
  const totalPages = Math.ceil(currentReportData.length / REPORT_PAGE_SIZE) || 1;
  let n = parseInt(input.value); if (!n || n < 1) n = 1; if (n > totalPages) n = totalPages;
  currentReportPage = n; renderReport(currentReportData); input.value = "";
}

function exportReport() {
  if (!currentReportData.length) { alert(t("没有数据","No data")); return; }
  const month = document.getElementById("reportMonth").value;
  const headers = ["Inspection","Pattern","Category","Grade","Opening (Y)","In (Y)","Out (Y)","Closing (Y)"];
  const rows = currentReportData.map(r => [
    r.inspection, r.pattern, r.category, r.grade, r.opening, r.inQty, r.outQty, r.closing
  ].map(v => `"${(v ?? "").toString().replace(/"/g,'""')}"`).join(","));
  const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fg_report_" + month + ".csv";
  a.click();
}

// ============ 月度盘点 ============
function showInventoryReport() {
  hideAll();
  document.getElementById("inventoryPage").style.display = "block";
  document.getElementById("userEmailInventory").textContent = document.getElementById("userEmail").textContent;
  const now = new Date();
  document.getElementById("inventoryMonth").value =
    `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  invCurrentPage = 1;
  loadInventoryReport();
}
function backToMainFromInventory() { hideAll(); document.getElementById("mainPage").style.display = "block"; }

async function loadInventoryReport() {
  const month = document.getElementById("inventoryMonth").value;
  if (!month) return;

  const [y, m] = month.split("-").map(Number);
  const firstDay = `${month}-01`;
  const lastDay = new Date(y, m, 0).toISOString().slice(0, 10);

  const { data: prods, error: e1 } = await supabaseClient
    .from(TB.products).select("*");
  if (e1) { alert(t("加载失败: ","Load failed: ") + e1.message); return; }

  const { data: monthMoves, error: e2 } = await supabaseClient
    .from(TB.moves)
    .select("*, fg_products(grade, category)")
    .gte("move_date", firstDay).lte("move_date", lastDay);
  if (e2) { alert(t("加载失败: ","Load failed: ") + e2.message); return; }

  const { data: beforeMoves, error: e3 } = await supabaseClient
    .from(TB.moves)
    .select("product_id, move_type, quantity, note, category, fg_products(grade, category)")
    .lt("move_date", firstDay);
  if (e3) { alert(t("加载失败: ","Load failed: ") + e3.message); return; }

  // ⭐ 有流水的 product_id 集合
  const activeIds = new Set((monthMoves || []).map(m => m.product_id));

  // ⭐ 只保留：有库存的 OR 本月有流水的
  const validProds = (prods || []).filter(p =>
    Number(p.length) > 0 || activeIds.has(p.id)
  );

  const stat = {};
  (validProds || []).forEach(p => {
    stat[p.id] = {
      opening: 0, inLen: 0, outLen: 0,
      grade: (p.grade || "").toUpperCase().trim(),
      category: (p.category || "").trim() || "未分类"
    };
  });

  (beforeMoves || []).forEach(r => {
    if (!stat[r.product_id]) return;
    const q = Number(r.quantity || 0);
    stat[r.product_id].opening += (r.move_type === "in" ? q : -q);
  });

  (monthMoves || []).forEach(r => {
    if (!stat[r.product_id]) return;
    const q = Number(r.quantity || 0);
    if (r.move_type === "in") stat[r.product_id].inLen += q;
    else stat[r.product_id].outLen += q;
  });

  const cats = ["样布","出口订单","库存纱","内销订单","未分类"];
  const catLabels = {
    "样布":     t("样布","Sample"),
    "出口订单": t("出口订单","Export Order"),
    "库存纱":   t("库存纱","Stock Yarn"),
    "内销订单": t("内销订单","Domestic Order"),
    "未分类":   t("未分类","Uncategorized")
  };
  const summary = {};
  cats.forEach(c => {
    summary[c] = {
      open:   { A:0, B:0, C:0, P:0, total:0 },
      in:     { A:0, B:0, C:0, P:0, total:0 },
      out:    { A:0, B:0, C:0, P:0, total:0 },
      close:  { A:0, B:0, C:0, P:0, total:0 }
    };
  });

  Object.values(stat).forEach(s => {
    const cat = cats.includes(s.category) ? s.category : "未分类";
    const g = s.grade;
    const opening = s.opening;
    const closing = s.opening + s.inLen - s.outLen;

    summary[cat].open.total  += opening;
    summary[cat].in.total    += s.inLen;
    summary[cat].out.total   += s.outLen;
    summary[cat].close.total += closing;

    if (["A","B","C","P"].includes(g)) {
      summary[cat].open[g]  += opening;
      summary[cat].in[g]    += s.inLen;
      summary[cat].out[g]   += s.outLen;
      summary[cat].close[g] += closing;
    }
  });

  renderInventorySummary(summary, cats, catLabels);

  // ⭐ 用 validProds，不是 prods
  const rows = (validProds || []).map(p => {
    const s = stat[p.id] || { opening: 0, inLen: 0, outLen: 0, grade: "", category: "未分类" };
    return {
      inspection: p.inspection_no || "",
      pattern: p.pattern_no || "",
      category: s.category,
      grade: p.grade || "",
      opening: s.opening,
      inLen: s.inLen,
      outLen: s.outLen,
      closing: s.opening + s.inLen - s.outLen,
    };
  });

  currentInventoryData = rows;
  invCurrentPage = 1;
  renderInventoryReport();
}

function renderInventorySummary(summary, cats, catLabels) {
  const tbody = document.getElementById("inventorySummaryBody");
  if (!tbody) return;

  const fmt = v => (Number(v) || 0).toFixed(2);

  function rowHtml(label, data, isTotal) {
    return `
      <tr class="${isTotal ? 'total-row' : ''}">
        <td class="cat-cell">${label}</td>
        <td>${fmt(data.open.A)}</td><td>${fmt(data.open.B)}</td><td>${fmt(data.open.C)}</td><td>${fmt(data.open.P)}</td>
        <td class="subtotal">${fmt(data.open.total)}</td>
        <td>${fmt(data.in.A)}</td><td>${fmt(data.in.B)}</td><td>${fmt(data.in.C)}</td><td>${fmt(data.in.P)}</td>
        <td class="subtotal">${fmt(data.in.total)}</td>
        <td>${fmt(data.out.A)}</td><td>${fmt(data.out.B)}</td><td>${fmt(data.out.C)}</td><td>${fmt(data.out.P)}</td>
        <td class="subtotal">${fmt(data.out.total)}</td>
        <td>${fmt(data.close.A)}</td><td>${fmt(data.close.B)}</td><td>${fmt(data.close.C)}</td><td>${fmt(data.close.P)}</td>
        <td class="subtotal">${fmt(data.close.total)}</td>
      </tr>`;
  }

  let html = cats.map(c => rowHtml(catLabels[c] || c, summary[c], false)).join("");

  const totalRow = {
    open:  { A:0, B:0, C:0, P:0, total:0 },
    in:    { A:0, B:0, C:0, P:0, total:0 },
    out:   { A:0, B:0, C:0, P:0, total:0 },
    close: { A:0, B:0, C:0, P:0, total:0 }
  };
  cats.forEach(c => {
    ["A","B","C","P","total"].forEach(g => {
      totalRow.open[g]  += summary[c].open[g];
      totalRow.in[g]    += summary[c].in[g];
      totalRow.out[g]   += summary[c].out[g];
      totalRow.close[g] += summary[c].close[g];
    });
  });
  html += rowHtml(t("合计","Total"), totalRow, true);

  tbody.innerHTML = html;
}

function renderInventoryReport() {
  const total = currentInventoryData.length;
  const totalPages = Math.max(1, Math.ceil(total / INV_PAGE_SIZE));
  if (invCurrentPage > totalPages) invCurrentPage = totalPages;
  const start = (invCurrentPage - 1) * INV_PAGE_SIZE;
  const pageItems = currentInventoryData.slice(start, start + INV_PAGE_SIZE);

  const tbody = document.getElementById("inventoryBody");
  tbody.innerHTML = pageItems.map((r, idx) => {
    const seq = start + idx + 1;
    const esc = s => String(s || "").replace(/"/g, "&quot;");
    return `
    <tr>
      <td>${seq}</td>
      <td>${r.inspection}</td>
      <td class="cell-ellipsis" title="${esc(r.pattern)}">${r.pattern}</td>
      <td>${displayCategory(r.category)}</td>
      <td>${r.grade}</td>
      <td>${r.opening.toFixed(2)}</td>
      <td style="color:#16a34a;">+${r.inLen.toFixed(2)}</td>
      <td style="color:#dc2626;">-${r.outLen.toFixed(2)}</td>
      <td><b>${r.closing.toFixed(2)}</b></td>
    </tr>`;
  }).join("") || `<tr><td colspan="9" style="text-align:center;color:#999;">${t("暂无数据","No data")}</td></tr>`;

  document.getElementById("invPageInfo").textContent =
    `${invCurrentPage} / ${totalPages}  (${total})`;

  const pageOpen = pageItems.reduce((s, r) => s + r.opening, 0);
  const pageIn   = pageItems.reduce((s, r) => s + r.inLen, 0);
  const pageOut  = pageItems.reduce((s, r) => s + r.outLen, 0);
  const pageClose = pageItems.reduce((s, r) => s + r.closing, 0);
  const allOpen  = currentInventoryData.reduce((s, r) => s + r.opening, 0);
  const allIn    = currentInventoryData.reduce((s, r) => s + r.inLen, 0);
  const allOut   = currentInventoryData.reduce((s, r) => s + r.outLen, 0);
  const allClose = currentInventoryData.reduce((s, r) => s + r.closing, 0);
  renderCustomSummary("inventorySummary",
    `<span class="summary-label">${t("当前页","Page")}:</span> <span class="summary-label">${t("期","Open")}</span> <span class="summary-value">${pageOpen.toFixed(2)} Y</span> <span class="summary-label">${t("入","In")}</span> <span class="summary-value">${pageIn.toFixed(2)} Y</span> <span class="summary-label">${t("出","Out")}</span> <span class="summary-value">${pageOut.toFixed(2)} Y</span> <span class="summary-label">${t("结","Close")}</span> <span class="summary-value">${pageClose.toFixed(2)} Y</span>`,
    `<span class="summary-label">${t("全部","Total")}:</span> <span class="summary-label">${t("期","Open")}</span> <span class="summary-value">${allOpen.toFixed(2)} Y</span> <span class="summary-label">${t("入","In")}</span> <span class="summary-value">${allIn.toFixed(2)} Y</span> <span class="summary-label">${t("出","Out")}</span> <span class="summary-value">${allOut.toFixed(2)} Y</span> <span class="summary-label">${t("结","Close")}</span> <span class="summary-value">${allClose.toFixed(2)} Y</span>`
  );
}

function invPagePrev() { if (invCurrentPage > 1) { invCurrentPage--; renderInventoryReport(); } }
function invPageNext() {
  const totalPages = Math.ceil(currentInventoryData.length / INV_PAGE_SIZE);
  if (invCurrentPage < totalPages) { invCurrentPage++; renderInventoryReport(); }
}
function invPageGoto() {
  const input = document.getElementById("invGotoPage");
  const totalPages = Math.ceil(currentInventoryData.length / INV_PAGE_SIZE) || 1;
  let n = parseInt(input.value); if (!n || n < 1) n = 1; if (n > totalPages) n = totalPages;
  invCurrentPage = n; renderInventoryReport(); input.value = "";
}

function exportInventoryReport() {
  if (!currentInventoryData.length) { alert(t("没有数据","No data")); return; }
  const month = document.getElementById("inventoryMonth").value;
  const headers = ["Inspection","Pattern","Category","Grade","Opening (Y)","In (Y)","Out (Y)","Closing (Y)"];
  const rows = currentInventoryData.map(r => [
    r.inspection, r.pattern, r.category, r.grade,
    r.opening.toFixed(2), r.inLen.toFixed(2), r.outLen.toFixed(2), r.closing.toFixed(2)
  ].map(v => `"${(v ?? "").toString().replace(/"/g,'""')}"`).join(","));
  const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "inventory_" + month + ".csv";
  a.click();
}

// ============ 操作记录 ============
function resetLogFilter() {
  document.getElementById("logDateFrom").value = "";
  document.getElementById("logDateTo").value = "";
  document.getElementById("logSearch").value = "";
  document.getElementById("logType").value = "";
  loadLogs();
}

async function loadLogs() {
  const from = document.getElementById("logDateFrom").value;
  const to = document.getElementById("logDateTo").value;
  const keyword = document.getElementById("logSearch").value.trim().toLowerCase();
  const type = document.getElementById("logType").value;

  let q = supabaseClient.from(TB.moves).select("*, fg_products(inspection_no, pattern_no, roll_no, category)")
    .order("created_at", { ascending: false }).limit(10000);
  if (from) q = q.gte("move_date", from);
  if (to) q = q.lte("move_date", to);
  const { data: movesData, error: e1 } = await q;
  if (e1) { alert(t("加载失败: ","Load failed: ") + e1.message); return; }

  let lq = supabaseClient.from(TB.logs)
    .select("*")
    .in("action", ["add_product", "edit_product", "delete_product"])
    .order("created_at", { ascending: false }).limit(5000);
  if (from) lq = lq.gte("created_at", from + "T00:00:00");
  if (to) lq = lq.lte("created_at", to + "T23:59:59");
  const { data: logsData, error: e2 } = await lq;
  if (e2) { alert(t("加载失败: ","Load failed: ") + e2.message); return; }

  let moveRows = movesData || [];
  if (type === "init") moveRows = moveRows.filter(r => isInitMove(r));
  else if (type === "in") moveRows = moveRows.filter(r => r.move_type === "in" && !isInitMove(r) && !r.is_return && !r.is_rework && !r.is_internal);
  else if (type === "out") moveRows = moveRows.filter(r => r.move_type === "out" && !r.is_return && !r.is_rework && !r.is_internal);
  else if (type === "return") moveRows = moveRows.filter(r => r.is_return === true);
  else if (type === "rework") moveRows = moveRows.filter(r => r.is_rework === true);
  else if (type === "internal") moveRows = moveRows.filter(r => r.is_internal === true);

  let logRows = logsData || [];
  if (type === "add")         logRows = logRows.filter(l => l.action === "add_product");
  else if (type === "edit")   logRows = logRows.filter(l => l.action === "edit_product");
  else if (type === "delete") logRows = logRows.filter(l => l.action === "delete_product");
  else if (["init","in","out","return","rework","internal"].includes(type)) {
    logRows = [];
  }

  if (keyword) {
    moveRows = moveRows.filter(m =>
      (m.fg_products?.inspection_no || "").toLowerCase().includes(keyword) ||
      (m.fg_products?.pattern_no || "").toLowerCase().includes(keyword) ||
      (m.fg_products?.roll_no || "").toLowerCase().includes(keyword));
    logRows = logRows.filter(l =>
      (l.detail || "").toLowerCase().includes(keyword) ||
      (l.user_email || "").toLowerCase().includes(keyword));
  }

  const merged = [
    ...moveRows.map(m => ({ _kind: "move", _time: m.created_at || "", ...m })),
    ...logRows.map(l => ({ _kind: "log",  _time: l.created_at || "", ...l })),
  ].sort((a, b) => (b._time || "").localeCompare(a._time || ""));

  currentLogs = merged;
  currentLogsPage = 1;
  renderLogs(merged);
}

function getMoveSubTypeKey(m) {
  if (m._kind === "log") return "";
  if (isInitMove(m)) return "init";
  if (m.is_return === true) {
    if (m.return_type === "customer_return") return "return_customer";
    if (m.return_type === "purchase_return") return "return_purchase";
    if (m.return_type === "internal_return") return "return_internal";
    return "return_customer";
  }
  if (m.is_rework === true) {
    return m.rework_stage === "to_workshop" ? "rework_out" : "rework_in";
  }
  if (m.is_internal === true) return "internal_use";
  return m.move_type === "in" ? "purchase" : "sale";
}

function renderLogs(rows) {
  const total = (rows || []).length;
  const totalPages = Math.max(1, Math.ceil(total / LOGS_PAGE_SIZE));
  if (currentLogsPage > totalPages) currentLogsPage = totalPages;
  const start = (currentLogsPage - 1) * LOGS_PAGE_SIZE;
  const pageItems = (rows || []).slice(start, start + LOGS_PAGE_SIZE);

  const tbody = document.getElementById("logBody");
  tbody.innerHTML = pageItems.map((m, idx) => {
    const seq = start + idx + 1;
    const esc = s => String(s || "").replace(/"/g, "&quot;");

    if (m._kind === "log") {
      const typeLabel = m.action === "add_product" ? t("新增","Add")
                      : m.action === "edit_product" ? t("编辑","Edit")
                      : m.action === "delete_product" ? t("删除","Delete") : m.action;
      const bg = m.action === "edit_product" ? "#fef9c3"
               : m.action === "delete_product" ? "#fee2e2" : "";
      const refNo    = m.ref_no || "—";
      const pattern  = m.pattern_no || "—";
      const cat      = m.category ? displayCategory(m.category) : "—";
      const len      = (m.length ?? null) !== null ? Number(m.length).toFixed(2) : "—";
      const price    = (m.unit_price ?? null) !== null ? Number(m.unit_price).toFixed(2) : "—";
      const changes  = m.changes || "";
      return `
      <tr style="background:${bg};">
        <td>${seq}</td>
        <td>${(m.created_at || "").slice(0,19).replace("T"," ")}</td>
        <td>${refNo}</td>
        <td class="cell-ellipsis" title="${esc(pattern)}">${pattern}</td>
        <td>${cat}</td>
        <td>${len}</td>
        <td>${price}</td>
        <td><b>${typeLabel}</b></td>
        <td>${m.user_email || ""}</td>
        <td class="cell-ellipsis" title="${esc(changes)}" style="white-space:pre-line;">${changes}</td>
        <td>—</td>
      </tr>`;
    }

    const cat = displayCategory((m.category || m.fg_products?.category || "").trim() || "未分类");
    const subKey = getMoveSubTypeKey(m);
    const typeLabel = isInitMove(m) ? t("初始库存","Initial") : getMoveTypeLabel(m.move_type, subKey);
    const canReworkIn = (subKey === "rework_out" && m.product_id);
    const actionBtn = canReworkIn
      ? `<button class="edit" onclick="openReworkInModal('${m.id}','${m.product_id}')" data-role="operator">${t("返工入库","Rework In")}</button>`
      : "";
    return `
    <tr>
      <td>${seq}</td>
      <td>${(m.created_at || "").slice(0,19).replace("T"," ")}</td>
      <td>${m.fg_products?.inspection_no || ""}</td>
      <td class="cell-ellipsis" title="${esc(m.fg_products?.pattern_no)}">${m.fg_products?.pattern_no || ""}</td>
      <td>${cat}</td>
      <td>${m.quantity}</td>
      <td>${m.unit_price || 0}</td>
      <td>${typeLabel}</td>
      <td>${m.operator || ""}</td>
      <td class="cell-ellipsis" title="${esc(m.note)}">${m.note || ""}</td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="11" style="text-align:center;color:#999;">${t("暂无记录","No records")}</td></tr>`;

  const el = document.getElementById("logPageInfo");
  if (el) el.textContent = `${currentLogsPage} / ${totalPages}  (${total})`;

  const pageMoves = pageItems.filter(m => m._kind === "move");
  const allMoves  = (rows || []).filter(m => m._kind === "move");
  const pageLen = pageMoves.reduce((s, m) => s + (Number(m.quantity) || 0), 0);
  const allLen  = allMoves.reduce((s, m) => s + (Number(m.quantity) || 0), 0);
  renderCustomSummary("logSummary",
    `<span class="summary-label">${t("当前页","Page")}:</span> <span class="summary-value">${pageLen.toFixed(2)} Y</span> <span class="summary-label">/</span> <span class="summary-value">${pageItems.length}</span> <span class="summary-label">${t("条","rows")}</span>`,
    `<span class="summary-label">${t("全部","Total")}:</span> <span class="summary-value">${allLen.toFixed(2)} Y</span> <span class="summary-label">/</span> <span class="summary-value">${(rows || []).length}</span> <span class="summary-label">${t("条","rows")}</span>`
  );
}

function logPrevPage() { if (currentLogsPage > 1) { currentLogsPage--; renderLogs(currentLogs); } }
function logNextPage() {
  const totalPages = Math.ceil(currentLogs.length / LOGS_PAGE_SIZE);
  if (currentLogsPage < totalPages) { currentLogsPage++; renderLogs(currentLogs); }
}
function logGotoPage() {
  const input = document.getElementById("logGotoPage");
  const totalPages = Math.ceil(currentLogs.length / LOGS_PAGE_SIZE) || 1;
  let n = parseInt(input.value); if (!n || n < 1) n = 1; if (n > totalPages) n = totalPages;
  currentLogsPage = n; renderLogs(currentLogs); input.value = "";
}

function printLogs() {
  const printArea = document.getElementById("printArea").innerHTML;
  const win = window.open("", "", "width=1000,height=700");
  win.document.write(`
    <html><head><title>Activity Logs</title>
    <style>
      body { font-family: "Microsoft YaHei", Arial; padding: 20px; }
      .brand-logo-print { text-align:center; font-size:20px; font-weight:bold; color:#1e3a8a;
        letter-spacing:1px; margin-bottom:10px; padding-bottom:10px; border-bottom:2px solid #1e3a8a; }
      h1 { font-size: 18px; text-align: center; }
      p { font-size: 12px; text-align: center; color: #666; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f0f0f0; }
    </style></head><body>
    <div class="brand-logo-print">JP TEXTILE ETHIOPIA PLC</div>
    <h1>FG Activity Logs</h1>
    <p>Printed: ${new Date().toLocaleString()}</p>
    ${printArea}</body></html>`);
  win.document.close();
  win.print();
}

function exportLogs() {
  if (!currentLogs.length) { alert(t("没有数据","No data")); return; }
  const headers = ["Time","Inspection","Pattern","Category","Length (Y)","Price ($)","Type","Operator","Note"];
  const rows = currentLogs.map(m => [
    (m.created_at || "").slice(0,19).replace("T"," "),
    m.fg_products?.inspection_no || m.ref_no || "",
    m.fg_products?.pattern_no || m.pattern_no || "",
    (m.category || m.fg_products?.category || "").trim() || "未分类",
    m.quantity ?? m.length ?? "", m.unit_price || 0,
    m._kind === "log" ? (m.action || "") : getMoveTypeLabel(m.move_type, getMoveSubTypeKey(m)),
    m.operator || m.user_email || "", m.note || m.changes || ""
  ].map(v => `"${(v ?? "").toString().replace(/"/g,'""')}"`).join(","));
  const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fg_logs_" + new Date().toISOString().slice(0,10) + ".csv";
  a.click();
}

// ============ 返工入库（从操作记录点） ============
function openReworkInModal(moveId, productId) {
  const p = allProducts.find(x => x.id === productId);
  if (!p) { alert(t("找不到原产品","Original product not found")); return; }

  editingId = null;
  document.getElementById("modalTitle").textContent = t("返工入库（新建成品）","Rework In (New Product)");
  document.getElementById("modalTitle").style.color = "#16a34a";

  const map = {
    f_scan_time: "scan_time", f_inspection_no: "inspection_no",
    f_spec: "spec", f_item_no: "item_no", f_pattern_no: "pattern_no",
    f_composition: "composition", f_width: "width", f_unit: "unit",
    f_length: "length", f_roll_no: "roll_no", f_net_weight: "net_weight",
    f_gross_weight: "gross_weight", f_location: "location",
    f_cost_price: "cost_price", f_out_date: "out_date",
    f_invoice_no: "invoice_no", f_customer: "customer", f_note: "note",
  };
  Object.entries(map).forEach(([inputId, field]) => {
    const el = document.getElementById(inputId);
    if (el) el.value = p[field] ?? "";
  });
  const catEl = document.getElementById("f_category");
  if (catEl) catEl.value = p.category || "";
  const grEl = document.getElementById("f_grade");
  if (grEl) grEl.value = (p.grade || "").toUpperCase().trim();

  document.getElementById("f_inspection_no").value = "";

  window.__reworkRefMoveId = moveId;

  const lenInput = document.getElementById("f_length");
  if (lenInput) lenInput.disabled = false;
  const cb = document.getElementById("f_is_inbound");
  if (cb) { cb.checked = false; cb.disabled = true; }

  document.getElementById("modal").style.display = "flex";
}

// ============ 系统日志 ============
function resetSysLogFilter() {
  document.getElementById("sysLogDateFrom").value = "";
  document.getElementById("sysLogDateTo").value = "";
  document.getElementById("sysLogSearch").value = "";
  document.getElementById("sysLogAction").value = "";
  loadSysLogs();
}

async function loadSysLogs() {
  const from = document.getElementById("sysLogDateFrom").value;
  const to = document.getElementById("sysLogDateTo").value;
  const kw = document.getElementById("sysLogSearch").value.trim().toLowerCase();
  const action = document.getElementById("sysLogAction").value;

  let q = supabaseClient.from(TB.logs).select("*").order("created_at", { ascending: false }).limit(1000);
  if (from) q = q.gte("created_at", from + "T00:00:00");
  if (to) q = q.lte("created_at", to + "T23:59:59");
  if (action) q = q.eq("action", action);

  const { data, error } = await q;
  if (error) { alert(t("加载失败: ","Load failed: ") + error.message); return; }

  let rows = data || [];
  if (kw) rows = rows.filter(r => (r.user_email||"").toLowerCase().includes(kw) || (r.detail||"").toLowerCase().includes(kw));
  currentSysLogs = rows;
  currentSysLogsPage = 1;
  renderSysLogs(rows);
}

function renderSysLogs(rows) {
  const total = (rows || []).length;
  const totalPages = Math.max(1, Math.ceil(total / SYSLOGS_PAGE_SIZE));
  if (currentSysLogsPage > totalPages) currentSysLogsPage = totalPages;
  const start = (currentSysLogsPage - 1) * SYSLOGS_PAGE_SIZE;
  const pageItems = (rows || []).slice(start, start + SYSLOGS_PAGE_SIZE);

  const tbody = document.getElementById("sysLogBody");
  const label = a => a === "add_product" ? "Add" : a === "edit_product" ? "Edit" : a === "delete_product" ? "Delete" : (a === "batch_ship" ? "Batch Ship" : (a || ""));
  tbody.innerHTML = pageItems.map((r, idx) => {
    const seq = start + idx + 1;
    return `
    <tr>
      <td>${seq}</td>
      <td>${(r.created_at || "").slice(0,19).replace("T"," ")}</td>
      <td>${r.user_email || ""}</td>
      <td>${label(r.action)}</td>
      <td>${r.detail || ""}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="5" style="text-align:center;color:#999;">${t("暂无日志","No logs")}</td></tr>`;

  const el = document.getElementById("sysPageInfo");
  if (el) el.textContent = `${currentSysLogsPage} / ${totalPages}  (${total})`;

  renderCustomSummary("sysLogSummary",
    `<span class="summary-label">${t("当前页","Page")}:</span> <span class="summary-value">${pageItems.length}</span> <span class="summary-label">${t("条","rows")}</span>`,
    `<span class="summary-label">${t("全部","Total")}:</span> <span class="summary-value">${(rows || []).length}</span> <span class="summary-label">${t("条","rows")}</span>`
  );
}
function sysPrevPage() { if (currentSysLogsPage > 1) { currentSysLogsPage--; renderSysLogs(currentSysLogs); } }
function sysNextPage() {
  const totalPages = Math.ceil(currentSysLogs.length / SYSLOGS_PAGE_SIZE);
  if (currentSysLogsPage < totalPages) { currentSysLogsPage++; renderSysLogs(currentSysLogs); }
}
function sysGotoPage() {
  const input = document.getElementById("sysGotoPage");
  const totalPages = Math.ceil(currentSysLogs.length / SYSLOGS_PAGE_SIZE) || 1;
  let n = parseInt(input.value); if (!n || n < 1) n = 1; if (n > totalPages) n = totalPages;
  currentSysLogsPage = n; renderSysLogs(currentSysLogs); input.value = "";
}

function printSysLogs() {
  const printArea = document.getElementById("sysLogPrintArea").innerHTML;
  const win = window.open("", "", "width=1000,height=700");
  win.document.write(`
    <html><head><title>System Logs</title>
    <style>
      body { font-family: "Microsoft YaHei", Arial; padding: 20px; }
      .brand-logo-print { text-align:center; font-size:20px; font-weight:bold; color:#1e3a8a;
        letter-spacing:1px; margin-bottom:10px; padding-bottom:10px; border-bottom:2px solid #1e3a8a; }
      h1 { font-size: 18px; text-align: center; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f0f0f0; }
    </style></head><body>
    <div class="brand-logo-print">JP TEXTILE ETHIOPIA PLC</div>
    <h1>FG System Logs</h1>
    <p>Printed: ${new Date().toLocaleString()}</p>
    ${printArea}</body></html>`);
  win.document.close();
  win.print();
}

function exportSysLogs() {
  if (!currentSysLogs.length) { alert(t("没有数据","No data")); return; }
  const headers = ["Time","Operator","Action","Detail"];
  const rows = currentSysLogs.map(r => [
    (r.created_at || "").slice(0,19).replace("T"," "),
    r.user_email || "", r.action || "", r.detail || ""
  ].map(v => `"${(v ?? "").toString().replace(/"/g,'""')}"`).join(","));
  const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fg_syslogs_" + new Date().toISOString().slice(0,10) + ".csv";
  a.click();
}

// ============ 仪表盘 ============
async function loadDashboard() {
  // ⭐ 只统计还有布长的（出运后 length=0 的不算）
  const inStock = allProducts.filter(p => Number(p.length) > 0);

  const totalCount = inStock.length;
  const totalLength = inStock.reduce((s, p) => s + (Number(p.length) || 0), 0);
  const totalValue = inStock.reduce((s, p) =>
    s + (Number(p.length) || 0) * (Number(p.cost_price) || 0), 0);

  document.getElementById("dashCount").textContent = totalCount;
  document.getElementById("dashLength").textContent = totalLength.toFixed(2);
  document.getElementById("dashValue").textContent = totalValue.toFixed(2);

  const cats = ["样布","出口订单","库存纱","内销订单","未分类"];
  const catStats = {};
  cats.forEach(c => catStats[c] = { total: 0, A: 0, B: 0, C: 0, P: 0 });

  // ⭐ 分类汇总也只算还有布长的
  inStock.forEach(p => {
    const cat = getCategoryOf(p);
    const g = getGradeOf(p);
    const len = Number(p.length) || 0;
    catStats[cat].total += len;
    if (g && ["A","B","C","P"].includes(g)) catStats[cat][g] += len;
  });

  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v.toFixed(2); };
  setTxt("dashCatSaleTotal", catStats["样布"].total);
  setTxt("dashCatSaleA", catStats["样布"].A);
  setTxt("dashCatSaleB", catStats["样布"].B);
  setTxt("dashCatSaleC", catStats["样布"].C);
  setTxt("dashCatSaleP", catStats["样布"].P);
  setTxt("dashCatExportTotal", catStats["出口订单"].total);
  setTxt("dashCatExportA", catStats["出口订单"].A);
  setTxt("dashCatExportB", catStats["出口订单"].B);
  setTxt("dashCatExportC", catStats["出口订单"].C);
  setTxt("dashCatExportP", catStats["出口订单"].P);
  setTxt("dashCatStockTotal", catStats["库存纱"].total);
  setTxt("dashCatStockA", catStats["库存纱"].A);
  setTxt("dashCatStockB", catStats["库存纱"].B);
  setTxt("dashCatStockC", catStats["库存纱"].C);
  setTxt("dashCatStockP", catStats["库存纱"].P);
  setTxt("dashCatDomTotal", catStats["内销订单"].total);
  setTxt("dashCatDomA", catStats["内销订单"].A);
  setTxt("dashCatDomB", catStats["内销订单"].B);
  setTxt("dashCatDomC", catStats["内销订单"].C);
  setTxt("dashCatDomP", catStats["内销订单"].P);
  setTxt("dashCatOtherTotal", catStats["未分类"].total);
  setTxt("dashCatOtherA", catStats["未分类"].A);
  setTxt("dashCatOtherB", catStats["未分类"].B);
  setTxt("dashCatOtherC", catStats["未分类"].C);
  setTxt("dashCatOtherP", catStats["未分类"].P);

  const tot = { total: 0, A: 0, B: 0, C: 0, P: 0 };
  cats.forEach(c => {
    tot.total += catStats[c].total;
    tot.A += catStats[c].A;
    tot.B += catStats[c].B;
    tot.C += catStats[c].C;
    tot.P += catStats[c].P;
  });
  setTxt("dashCatTotalTotal", tot.total);
  setTxt("dashCatTotalA", tot.A);
  setTxt("dashCatTotalB", tot.B);
  setTxt("dashCatTotalC", tot.C);
  setTxt("dashCatTotalP", tot.P);

  const since = new Date(); since.setDate(since.getDate() - 7);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: movesRaw } = await supabaseClient.from(TB.moves)
    .select("*, fg_products(inspection_no, pattern_no, category)")
    .gte("move_date", sinceStr)
    .order("created_at", { ascending: false });

  const moves = (movesRaw || []).filter(m => !isInitMove(m));
  const inLen = moves.filter(m => m.move_type === "in").reduce((s, m) => s + Number(m.quantity || 0), 0);
  const outLen = moves.filter(m => m.move_type === "out").reduce((s, m) => s + Number(m.quantity || 0), 0);
  document.getElementById("dashIn7").textContent = inLen.toFixed(2);
  document.getElementById("dashOut7").textContent = outLen.toFixed(2);

  currentDashRecent = moves.slice(0, 100);
  currentDashPage = 1;
  renderDashRecent();
}

function renderDashRecent() {
  const total = currentDashRecent.length;
  const totalPages = Math.max(1, Math.ceil(total / DASH_PAGE_SIZE));
  if (currentDashPage > totalPages) currentDashPage = totalPages;
  const start = (currentDashPage - 1) * DASH_PAGE_SIZE;
  const pageItems = currentDashRecent.slice(start, start + DASH_PAGE_SIZE);

  document.getElementById("dashRecentBody").innerHTML = pageItems.map(m => {
    const cat = displayCategory((m.category || m.fg_products?.category || "").trim() || "未分类");
    const subKey = getMoveSubTypeKey(m);
    const typeLabel = getMoveTypeLabel(m.move_type, subKey);
    const esc = s => String(s || "").replace(/"/g, "&quot;");
    return `
    <tr>
      <td>${(m.created_at || "").slice(0,19).replace("T"," ")}</td>
      <td>${m.fg_products?.inspection_no || ""}</td>
      <td class="cell-ellipsis" title="${esc(m.fg_products?.pattern_no)}">${m.fg_products?.pattern_no || ""}</td>
      <td>${cat}</td>
      <td>${m.quantity}</td>
      <td>${m.unit_price || 0}</td>
      <td>${typeLabel}</td>
      <td>${m.operator || ""}</td>
      <td class="cell-ellipsis" title="${esc(m.note)}">${m.note || ""}</td>
      <td>—</td>
    </tr>`;
  }).join("") || `<tr><td colspan="10" style="text-align:center;color:#999;">${t("暂无数据","No data")}</td></tr>`;

  const el = document.getElementById("dashRecentPageInfo");
  if (el) el.textContent = `${currentDashPage} / ${totalPages}  (${total})`;

  const pageLen = pageItems.reduce((s, m) => s + (Number(m.quantity) || 0), 0);
  const allLen  = currentDashRecent.reduce((s, m) => s + (Number(m.quantity) || 0), 0);
  renderCustomSummary("dashRecentSummary",
    `<span class="summary-label">${t("当前页","Page")}:</span> <span class="summary-value">${pageLen.toFixed(2)} Y</span> <span class="summary-label">/</span> <span class="summary-value">${pageItems.length}</span> <span class="summary-label">${t("笔","moves")}</span>`,
    `<span class="summary-label">${t("全部","Total")}:</span> <span class="summary-value">${allLen.toFixed(2)} Y</span> <span class="summary-label">/</span> <span class="summary-value">${currentDashRecent.length}</span> <span class="summary-label">${t("笔","moves")}</span>`
  );
}

function dashPrevPage() { if (currentDashPage > 1) { currentDashPage--; renderDashRecent(); } }
function dashNextPage() {
  const totalPages = Math.ceil(currentDashRecent.length / DASH_PAGE_SIZE);
  if (currentDashPage < totalPages) { currentDashPage++; renderDashRecent(); }
}

// ============ 打印选项 ============
function openPrintChoice(page) {
  const modal = document.createElement("div");
  modal.className = "print-choice-modal";
  modal.id = "printChoiceModal";
  modal.innerHTML = `
    <div class="print-choice-box">
      <h3>${t("选择打印内容","Choose Print Content")}</h3>
      <label>
        <input type="radio" name="printChoice" value="summary" checked />
        <span>${t("只打汇总表","Summary Table Only")}</span>
      </label>
      <label>
        <input type="radio" name="printChoice" value="detail" />
        <span>${t("只打明细清单","Detail List Only")}</span>
      </label>
      <div class="print-choice-actions">
        <button onclick="doPrint('${page}')">${t("确认打印","Print")}</button>
        <button class="cancel" onclick="closePrintChoice()">${t("取消","Cancel")}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function closePrintChoice() {
  const m = document.getElementById("printChoiceModal");
  if (m) m.remove();
}

function doPrint(page) {
  const choice = document.querySelector('input[name="printChoice"]:checked')?.value || "summary";

  let title = "";
  let htmlContent = "";
  let monthLabel = "";

  if (page === "report") {
    monthLabel = document.getElementById("reportMonth").value;
    title = "FG Monthly Report";
    if (choice === "summary") {
      htmlContent = document.getElementById("reportSummaryWrap").innerHTML;
    } else {
      htmlContent = document.getElementById("reportPrintArea").innerHTML;
    }
  } else if (page === "inventory") {
    monthLabel = document.getElementById("inventoryMonth").value;
    title = "FG Monthly Inventory";
    if (choice === "summary") {
      htmlContent = document.getElementById("inventorySummaryWrap").innerHTML;
    } else {
      htmlContent = document.getElementById("inventoryPrintArea").innerHTML;
    }
  }

  const win = window.open("", "", "width=1200,height=800");
  win.document.write(`
    <html><head><title>${title} - ${monthLabel}</title>
    <style>
      body { font-family: "Microsoft YaHei", Arial; padding: 20px; }
      .brand-logo-print { text-align:center; font-size:24px; font-weight:bold; color:#1e3a8a;
        letter-spacing:2px; margin-bottom:10px; padding-bottom:10px; border-bottom:2px solid #1e3a8a; }
      h1 { font-size: 18px; text-align: center; }
      p { font-size: 12px; text-align: center; color: #666; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
      th, td { border: 1px solid #999; padding: 5px 8px; text-align: right; }
      th { background: #f0f0f0; text-align: center; }
      td.cat-cell { text-align: left; font-weight: bold; }
      td.subtotal { background: #f3f4f6; font-weight: 600; }
      tr.total-row td { background: #fef9c3; font-weight: bold; }
      .summary-table th.group-in { background: #dcfce7; }
      .summary-table th.group-out { background: #fee2e2; }
      .summary-table th.group-close { background: #dbeafe; }
      .summary-table th.group-open { background: #fef3c7; }
    </style></head><body>
    <div class="brand-logo-print">JP TEXTILE ETHIOPIA PLC</div>
    <h1>${title}</h1>
    <p>Month: ${monthLabel} · Printed: ${new Date().toLocaleString()}</p>
    ${htmlContent}</body></html>`);
  win.document.close();
  win.print();
  closePrintChoice();
}

// ============ 启动 ============
(async function init() {
  initLang();
  const loginPage = document.getElementById("loginPage");
  const emailInput = document.getElementById("email");
  const pwdInput = document.getElementById("password");
  const rememberBox = document.getElementById("rememberMe");
  const remembered = localStorage.getItem("remember_email");
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    if (remembered) {
      await loadUserRole();
      document.getElementById("loginPage").style.display = "none";
      document.getElementById("userEmail").textContent = data.session.user.email;
      await loadProducts();
      goToDashboard();
      colorizeButtons();
      return;
    } else {
      await supabaseClient.auth.signOut();
    }
  }

  if (loginPage) loginPage.style.display = "flex";
  if (emailInput && remembered) emailInput.value = remembered;
  if (rememberBox && remembered) rememberBox.checked = true;
  if (pwdInput) pwdInput.focus();
})();

