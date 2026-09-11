// ============ 配置 ============
const DES_JSON_PATH = "../Warehouse/des.json";
const sidebar_icon_path = "../Warehouse/icons/"; // 侧边栏图标文件夹路径
const SETTING_JSON_PATH = "setting.json"; // 设置文件路径

// ============ 全局状态 ============
let categoryData = [];
let currentCategory = "all";
let currentSubCategory = null;

// ============ DOM 引用 ============
const navMenu = document.getElementById("nav-menu");
const grid = document.getElementById("item-grid");
const categoryTitle = document.getElementById("category-title");
const itemCount = document.getElementById("item-count");
const refreshBtn = document.getElementById("refresh-btn");

// ============ 加载 JSON ============
async function loadCategoryData() {
  try {
    const response = await fetch(DES_JSON_PATH);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    categoryData = data.categories || [];
    return categoryData;
  } catch (error) {
    console.error("加载 des.json 失败:", error);
    navMenu.innerHTML = `
            <li class="nav-item" style="color: #f87171; padding: 20px; text-align: center;">
                ❌ 加载分类数据失败<br>
                <span style="font-size: 12px; color: #94a3b8;">请检查 des.json 文件是否存在</span>
            </li>
        `;
    return [];
  }
}

async function postJson(url, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || `HTTP ${response.status}`);
  }

  return result;
}

// ============ 生成图标 HTML ============
function getIconHtml(iconPath, altText) {
  if (iconPath && iconPath.trim() !== "") {
    return `<img src="${iconPath}" alt="${altText || ""}" class="nav-icon" />`;
  }
  return ""; // 空路径不显示图标
}

// ============ 生成导航菜单 ============
function generateNavMenu(categories) {
  if (!categories || categories.length === 0) {
    navMenu.innerHTML = `
            <li class="nav-item" style="color: #94a3b8; padding: 20px; text-align: center;">
                暂无分类数据
            </li>
        `;
    return;
  }

  let html = "";

  // "全部" 选项（无图标）
  html += `
        <li class="nav-item parent active" data-category="all" data-parent="true">
            <span>全部物品</span>
        </li>
    `;

  // 遍历一级分类
  categories.forEach((cat) => {
    const hasChildren = cat.sub_categories && cat.sub_categories.length > 0;
    const catId = cat.id || cat.name;

    const iconHtml = getIconHtml(cat.icon, cat.name);
    // 如果无图标，用空占位保持对齐
    const iconDisplay = iconHtml || `<span class="icon-placeholder"></span>`;

    html += `
    <li
      class="nav-item parent"
      data-category="${catId}"
      data-parent="true"
    >
        ${iconDisplay}

        <span class="nav-label">
            ${escapeHtml(cat.name)}
        </span>

        <button
          class="add-subcategory-btn"
          type="button"
          title="新增子分类"
        >
            ＋
        </button>

        ${hasChildren ? `<span class="toggle-icon">▶</span>` : ""}
    </li>
`;

    // 子分类
    if (hasChildren) {
      html += `<ul class="sub-menu" data-parent="${catId}">`;
      cat.sub_categories.forEach((sub) => {
        const subId = sub.id || sub.name;
        const subIconHtml = getIconHtml(sub.icon, sub.name);
        const subIconDisplay =
          subIconHtml || `<span class="icon-placeholder"></span>`;
        html += `
                    <li class="nav-item child" data-category="${catId}" data-sub="${subId}">
                        ${subIconDisplay}
                        <span class="nav-label">
                          ${escapeHtml(sub.name)}
                        </span>
                    </li>
                `;
      });
      html += `</ul>`;
    }
  });
  html += `
    <li
      class="nav-item add-category-item"
      id="add-category-item"
    >
        <span>＋ 新增分类</span>
    </li>
`;
  navMenu.innerHTML = html;
  bindNavEvents();
}

navMenu.addEventListener("click", async function (event) {
  // =========================
  // 新增一级分类
  // =========================
  const addCategory = event.target.closest("#add-category-item");

  if (addCategory) {
    event.preventDefault();
    event.stopPropagation();

    await createCategory(null);

    return;
  }

  // =========================
  // 新增二级分类
  // =========================
  const addSubBtn = event.target.closest(".add-subcategory-btn");

  if (addSubBtn) {
    event.preventDefault();
    event.stopPropagation();

    const parent = addSubBtn.closest(".nav-item.parent");

    if (!parent) return;

    await createCategory(parent.dataset.category);
  }
});

function startRenameCategory(navItem, label) {
  if (navItem.classList.contains("editing")) {
    return;
  }

  navItem.classList.add("editing");

  const oldName = label.textContent.trim();

  // 二级分类用 data-sub
  // 一级分类用 data-category
  const categoryId = navItem.classList.contains("child")
    ? navItem.dataset.sub
    : navItem.dataset.category;

  const input = document.createElement("input");

  input.type = "text";
  input.className = "nav-edit-input";
  input.value = oldName;

  label.style.display = "none";

  label.insertAdjacentElement("afterend", input);

  input.focus();
  input.select();

  let finished = false;

  async function finish(save) {
    if (finished) return;

    finished = true;

    const newName = input.value.trim();

    // Esc 或空字符串
    if (!save || !newName || newName === oldName) {
      input.remove();
      label.style.display = "";
      navItem.classList.remove("editing");
      return;
    }

    try {
      input.disabled = true;

      const result = await postJson("/api/category/rename", {
        id: categoryId,
        name: newName,
      });

      // 使用后端返回的新 JSON
      categoryData = result.data.categories || [];

      // 如果当前页面正显示这个分类，
      // 顺便更新标题
      if (currentCategory === categoryId || currentSubCategory === categoryId) {
        categoryTitle.textContent = newName;
      }

      generateNavMenu(categoryData);

      restoreNavSelection();
    } catch (error) {
      console.error("修改分类失败:", error);

      alert(`修改失败：${error.message}`);

      input.remove();
      label.style.display = "";
      navItem.classList.remove("editing");
    }
  }

  input.addEventListener("keydown", function (event) {
    event.stopPropagation();

    if (event.key === "Enter") {
      event.preventDefault();

      finish(true);
    }

    if (event.key === "Escape") {
      event.preventDefault();

      finish(false);
    }
  });

  input.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  input.addEventListener("dblclick", (event) => {
    event.stopPropagation();
  });

  input.addEventListener("blur", () => {
    finish(true);
  });
}

navMenu.addEventListener("dblclick", function (event) {
  const label = event.target.closest(".nav-label");

  if (!label) return;

  const navItem = label.closest(".nav-item");

  if (!navItem) return;

  // “全部物品”不允许修改
  if (navItem.dataset.category === "all") {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  startRenameCategory(navItem, label);
});

// ============ 绑定导航事件 ============
function bindNavEvents() {
  const navItems = navMenu.querySelectorAll(".nav-item");
  const parentItems = navMenu.querySelectorAll(".nav-item.parent");
  const childItems = navMenu.querySelectorAll(".nav-item.child");

  // 父级点击
  parentItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.stopPropagation();
      const category = this.dataset.category;

      // 处理 "全部"
      if (category === "all") {
        navItems.forEach((n) => n.classList.remove("active"));
        this.classList.add("active");
        document
          .querySelectorAll(".sub-menu")
          .forEach((menu) => menu.classList.remove("open"));
        document
          .querySelectorAll(".toggle-icon")
          .forEach((icon) => icon.classList.remove("expanded"));
        currentCategory = "all";
        currentSubCategory = null;
        renderItems("all", null);
        return;
      }

      // 切换子菜单折叠
      const subMenu = this.nextElementSibling;
      if (subMenu && subMenu.classList.contains("sub-menu")) {
        subMenu.classList.toggle("open");
        const toggleIcon = this.querySelector(".toggle-icon");
        if (toggleIcon) toggleIcon.classList.toggle("expanded");
      }

      // 高亮当前父级，取消其他父级高亮
      parentItems.forEach((p) => p.classList.remove("active"));
      this.classList.add("active");
      // 取消所有子级高亮
      childItems.forEach((c) => c.classList.remove("active"));

      // 如果有子菜单，默认选中第一个子级
      const sub = this.nextElementSibling;
      if (sub && sub.classList.contains("sub-menu")) {
        const firstChild = sub.querySelector(".nav-item.child");
        if (firstChild) {
          firstChild.classList.add("active");
          currentCategory = category;
          currentSubCategory = firstChild.dataset.sub;
          renderItems(category, currentSubCategory);
          return;
        }
      }

      // 无子级，直接筛选一级分类
      currentCategory = category;
      currentSubCategory = null;
      renderItems(category, null);
    });
  });

  // 子级点击
  childItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.stopPropagation();
      const category = this.dataset.category;
      const sub = this.dataset.sub;

      // ✅ 清除所有子级的高亮（更彻底）
      childItems.forEach((c) => c.classList.remove("active"));
      this.classList.add("active");

      // 确保父级高亮
      const parentLi = this.closest(".sub-menu").previousElementSibling;
      if (parentLi && parentLi.classList.contains("parent")) {
        parentItems.forEach((p) => p.classList.remove("active"));
        parentLi.classList.add("active");
        // 展开父级菜单
        const subMenu = parentLi.nextElementSibling;
        if (subMenu && subMenu.classList.contains("sub-menu")) {
          subMenu.classList.add("open");
          const toggleIcon = parentLi.querySelector(".toggle-icon");
          if (toggleIcon) toggleIcon.classList.add("expanded");
        }
      }

      currentCategory = category;
      currentSubCategory = sub;
      renderItems(category, sub);
    });
  });
}

// ============ 渲染物品（演示用） ============
function renderItems(category, subCategory) {
  // 生成模拟物品数据
  let filtered = generateDemoItems(category, subCategory);

  // 更新标题
  let title = "全部物品";
  if (category !== "all") {
    const cat = categoryData.find(
      (c) => c.id === category || c.name === category,
    );
    if (cat) {
      title = cat.name;
      if (subCategory) {
        const sub = cat.sub_categories.find(
          (s) => s.id === subCategory || s.name === subCategory,
        );
        if (sub) title = sub.name;
      }
    }
  }
  categoryTitle.textContent = title;
  itemCount.textContent = `共 ${filtered.length} 件`;

  if (filtered.length === 0) {
    grid.innerHTML = `
            <div class="empty-state">
                <span class="big-icon">📭</span>
                该分类下暂无物品
            </div>
        `;
    return;
  }

  const cardsHTML = filtered
    .map(
      (item) => `
        <div class="item-card" data-id="${item.id}">
            <div class="image-placeholder">${item.emoji || "📦"}</div>
            <div class="card-body">
                <h3>${item.name}</h3>
                <span class="category-tag">${item.category}</span>
                <div class="price">${item.price || "价格待定"}</div>
            </div>
        </div>
    `,
    )
    .join("");
  grid.innerHTML = cardsHTML;
}

// ============ 生成示例物品 ============
function generateDemoItems(category, subCategory) {
  const demoMap = {
    clothing: ["T恤", "牛仔裤", "外套", "衬衫"],
    tops: ["短袖T恤", "长袖衬衫", "卫衣", "毛衣"],
    bottoms: ["牛仔裤", "休闲裤", "短裤", "半身裙"],
    outerwear: ["风衣", "夹克", "羽绒服", "大衣"],
    electronics: ["手机", "耳机", "笔记本", "平板"],
    phones: ["iPhone 15", "Samsung S24", "小米14", "华为P60"],
    laptops: ["MacBook Pro", "ThinkPad", "Dell XPS", "华为MateBook"],
    furniture: ["沙发", "书桌", "椅子", "柜子"],
  };

  let names = [];
  if (category === "all") {
    names = ["物品A", "物品B", "物品C", "物品D"];
  } else {
    const cat = categoryData.find(
      (c) => c.id === category || c.name === category,
    );
    if (cat) {
      if (subCategory) {
        const sub = cat.sub_categories.find(
          (s) => s.id === subCategory || s.name === subCategory,
        );
        if (sub) {
          names = demoMap[sub.id] ||
            demoMap[sub.name] || [`${sub.name} 样品1`, `${sub.name} 样品2`];
        }
      } else {
        names = demoMap[cat.id] ||
          demoMap[cat.name] || [`${cat.name} 样品1`, `${cat.name} 样品2`];
      }
    }
  }

  return names.map((name, idx) => ({
    id: `demo-${idx}`,
    name: name,
    category:
      category === "all"
        ? "示例"
        : categoryData.find((c) => c.id === category)?.name || category,
    emoji: "📦",
    price: `¥${(Math.random() * 1000 + 100).toFixed(0)}`,
  }));
}

// ============ 刷新 ============
refreshBtn.addEventListener("click", () => {
  refreshBtn.textContent = "⏳ 刷新中...";
  refreshBtn.disabled = true;
  setTimeout(() => {
    renderItems(currentCategory, currentSubCategory);
    refreshBtn.textContent = "🔄 刷新";
    refreshBtn.disabled = false;
  }, 400);
});

// ============ 初始化 ============
async function init() {
  const categories = await loadCategoryData();
  if (categories.length > 0) {
    generateNavMenu(categories);
    // 默认高亮“全部”
    const allItem = document.querySelector('.nav-item[data-category="all"]');
    if (allItem) allItem.classList.add("active");
    renderItems("all", null);
  } else {
    grid.innerHTML = `
            <div class="empty-state">
                <span class="big-icon">⚠️</span>
                无法加载分类数据<br>
                <span style="font-size: 14px; color: #94a3b8;">请确保 Warehouse/des.json 存在且格式正确</span>
            </div>
        `;
  }
  // ✅ 在数据加载完成后初始化折叠功能
  initSidebarToggle();
}
// ============ 侧边栏折叠功能 ============

function initSidebarToggle() {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("sidebarToggle");

  if (!sidebar || !toggleBtn) {
    console.warn("侧边栏或按钮不存在");
    return;
  }

  // 恢复状态
  const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";

  if (isCollapsed) {
    sidebar.classList.add("collapsed");

    toggleBtn.classList.add("collapsed");
  }

  toggleBtn.addEventListener("click", function (e) {
    e.stopPropagation();

    sidebar.classList.toggle("collapsed");

    const collapsed = sidebar.classList.contains("collapsed");

    toggleBtn.classList.toggle("collapsed", collapsed);

    localStorage.setItem("sidebarCollapsed", collapsed);

    window.dispatchEvent(new Event("resize"));
  });
}

// ============================
// 设置面板
// ============================

const settingsBtn = document.getElementById("settings-btn");

const settingsPanel = document.getElementById("settings-panel");

const closeSettings = document.getElementById("close-settings");

// 设置是否已加载，避免重复请求 / 重复绑定
let settingsLoaded = false;

// 打开（首次打开时加载 setting.json 并渲染）

settingsBtn.addEventListener("click", async () => {
  if (!settingsLoaded) {
    const settings = await loadSettings();

    generateSettingTabs(settings);

    settingsLoaded = settings.tabs.length > 0;
  }

  settingsPanel.classList.add("show");
});

// 关闭

closeSettings.addEventListener("click", () => {
  settingsPanel.classList.remove("show");
});

// Tab切换（事件委托，动态生成的按钮也能生效）
let settingTabsBound = false;

function bindSettingTabs() {
  const tabsContainer = document.getElementById("settings-tabs");
  if (!tabsContainer || settingTabsBound) return;

  settingTabsBound = true;

  tabsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;

    const tab = btn.dataset.tab;

    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));

    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));

    btn.classList.add("active");

    const panel = document.getElementById(tab);
    if (panel) panel.classList.add("active");
  });
}

// 支持的控件类型
const SETTING_TYPES = [
  "text",
  "number",
  "textarea",
  "checkbox",
  "select",
  "range",
];

// HTML 属性转义，避免配置里的引号 / 尖括号破坏结构
function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// 去掉 // 与 /* */ 注释（字符串内部的 // 不会被误删）
function stripJsonComments(text) {
  let result = "";

  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    // 行注释：直到换行为止
    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    // 块注释：直到 */
    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    // 字符串内部：原样保留（处理 \" 转义）
    if (inString) {
      result += char;

      if (char === "\\") {
        if (next !== undefined) {
          result += next;
          i++;
        }
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    result += char;
  }

  return result;
}

// 去掉对象 / 数组结尾的多余逗号（字符串内部的逗号不受影响）
function stripTrailingCommas(text) {
  let result = "";
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      result += char;

      if (char === "\\") {
        if (i + 1 < text.length) {
          result += text[i + 1];
          i++;
        }
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;

      // 后面紧跟 } 或 ]，说明是多余逗号，跳过
      if (text[j] === "}" || text[j] === "]") continue;
    }

    result += char;
  }

  return result;
}

// 解析配置文本：允许注释与多余逗号（JSONC）
function parseJsonc(text) {
  return JSON.parse(stripTrailingCommas(stripJsonComments(text)));
}

// 根据 default 值推断控件类型
function inferSettingType(value) {
  if (Array.isArray(value)) return "select";
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "range";
  return "text";
}

// 决定最终控件类型：显式 type 优先，否则按 default 推断
function resolveSettingType(val) {
  if (val.type && SETTING_TYPES.includes(val.type)) return val.type;
  return inferSettingType(val.default);
}

// 把 setting.json 里的单个字段配置转成统一的 item 结构
function buildSettingItem(key, rawVal) {
  // 兼容简写："col_num": 3 等价于 { "default": 3 }
  const val =
    rawVal && typeof rawVal === "object" && !Array.isArray(rawVal)
      ? rawVal
      : { default: rawVal };

  const type = resolveSettingType(val);

  // 下拉框选项：options 优先，其次用 default 数组
  let options = val.options;
  if (!Array.isArray(options) && Array.isArray(val.default)) {
    options = val.default;
  }

  let value = val.value !== undefined ? val.value : val.default;

  if (type === "select") {
    if (value === undefined || Array.isArray(value)) {
      value = (options || [])[0];
    }
  } else if (Array.isArray(value)) {
    value = value[0];
  }

  return {
    key,
    label: val.ch_Name || key,
    type,
    value,
    options,
    min: val.min,
    max: val.max,
    step: val.step,
    placeholder: val.placeholder,
  };
}

async function loadSettings() {
  try {
    // 加上 no-store，避免浏览器缓存旧的 setting.json
    const response = await fetch(SETTING_JSON_PATH, { cache: "no-store" });

    if (!response.ok)
      throw new Error(`setting.json 读取失败: HTTP ${response.status}`);

    // setting.json 允许写注释（JSONC），所以先取文本再手动解析
    const text = await response.text();

    const data = parseJsonc(text);

    // 统一转换成 { tabs: [{ id, name, items: [{ key, label, type, value, options }] }] }
    return {
      tabs: Object.entries(data.tabs || {}).map(([tabId, tabItems]) => ({
        id: tabId,
        name: tabId,
        items: Object.entries(tabItems || {}).map(([key, val]) =>
          buildSettingItem(key, val),
        ),
      })),
    };
  } catch (error) {
    console.error(error);

    return {
      tabs: [],
      error: error.message,
    };
  }
}

function generateSettingTabs(settings) {
  const tabs = document.getElementById("settings-tabs");

  const content = document.getElementById("settings-content");

  if (!tabs || !content) {
    console.error("找不到 #settings-tabs 或 #settings-content 容器");
    return;
  }

  // 没有读到任何配置时给出提示，方便排查
  if (!settings.tabs || settings.tabs.length === 0) {
    tabs.innerHTML = "";

    const reason = settings.error
      ? `解析失败：${settings.error}`
      : "未找到配置项；请通过 http 服务器打开页面（直接双击 html 会被浏览器拦截）";

    content.innerHTML = `
      <div class="empty-state">
        <span class="big-icon">⚠️</span>
        未能加载 setting.json<br>
        <span style="font-size: 14px; color: #94a3b8;">${escapeAttr(reason)}</span>
      </div>
    `;

    return;
  }

  let tabHTML = "";
  let contentHTML = "";

  settings.tabs.forEach((tab, index) => {
    tabHTML += `
        <button
        class="tab-btn ${index === 0 ? "active" : ""}"
        data-tab="${tab.id}">
        ${tab.name}
        </button>
        `;

    contentHTML += `
        <div
        class="tab-content ${index === 0 ? "active" : ""}"
        id="${tab.id}">
        ${generateSettingItems(tab.items)}
        </div>
        `;
  });

  tabs.innerHTML = tabHTML;

  content.innerHTML = contentHTML;

  bindSettingTabs();

  // 允许外部读取当前设置值
  window.getSettingsValues = () => {
    const values = {};

    content.querySelectorAll("[data-key]").forEach((el) => {
      if (el.type === "checkbox") values[el.dataset.key] = el.checked;
      else if (el.type === "range" || el.type === "number")
        values[el.dataset.key] = Number(el.value);
      else values[el.dataset.key] = el.value;
    });

    return values;
  };
}

function generateSettingItems(items) {
  return items
    .map((item) => {
      let control = "";

      switch (item.type) {
        case "text":
          control = `
                <input
                type="text"
                data-key="${item.key}"
                placeholder="${escapeAttr(item.placeholder)}"
                value="${escapeAttr(item.value)}">
                `;
          break;

        case "number":
          control = `
                <input
                type="number"
                data-key="${item.key}"
                placeholder="${escapeAttr(item.placeholder)}"
                ${item.min !== undefined ? `min="${escapeAttr(item.min)}"` : ""}
                ${item.max !== undefined ? `max="${escapeAttr(item.max)}"` : ""}
                ${item.step !== undefined ? `step="${escapeAttr(item.step)}"` : ""}
                value="${escapeAttr(item.value)}">
                `;
          break;

        case "textarea":
          control = `
                <textarea
                data-key="${item.key}"
                rows="3"
                placeholder="${escapeAttr(item.placeholder)}">${escapeAttr(item.value)}</textarea>
                `;
          break;

        case "checkbox":
          control = `
                <input
                type="checkbox"
                data-key="${item.key}"
                ${item.value ? "checked" : ""}>
                `;
          break;

        case "select":
          control = `
                <select data-key="${item.key}">
                ${(item.options || [])
                  .map((o) => {
                    const optValue = o && typeof o === "object" ? o.value : o;
                    const optLabel =
                      o && typeof o === "object" ? (o.label ?? o.value) : o;
                    return `<option value="${escapeAttr(optValue)}" ${
                      String(optValue) === String(item.value) ? "selected" : ""
                    }>${escapeAttr(optLabel)}</option>`;
                  })
                  .join("")}
                </select>
                `;
          break;

        case "range":
          control = `
                <input
                type="range"
                data-key="${item.key}"
                min="${item.min ?? 1}"
                max="${item.max ?? Math.max(10, (item.value || 0) * 2)}"
                step="${item.step ?? 1}"
                value="${item.value || 0}"
                oninput="this.nextElementSibling.textContent = this.value">
                <span class="range-value">${item.value || 0}</span>
                `;
          break;
      }

      return `
        <div class="setting-item">
        <label>${item.label}</label>
        ${control}
        </div>
        `;
    })
    .join("");
}

const contextMenu = document.getElementById("custom-context-menu");

// 当前右键点击的元素
let currentTarget = null;

// ==============================
// 监听鼠标右键
// ==============================

document.addEventListener("contextmenu", function (event) {
  // 阻止浏览器原生右键菜单
  event.preventDefault();

  // 保存当前点击对象
  currentTarget = event.target;

  // 显示自己的右键菜单
  showContextMenu(event.clientX, event.clientY);
});

// ==============================
// 显示右键菜单
// ==============================

function showContextMenu(x, y) {
  contextMenu.style.display = "block";

  const menuWidth = contextMenu.offsetWidth;
  const menuHeight = contextMenu.offsetHeight;

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  // 防止菜单跑出屏幕右边
  if (x + menuWidth > screenWidth) {
    x = screenWidth - menuWidth - 5;
  }

  // 防止菜单跑出屏幕下面
  if (y + menuHeight > screenHeight) {
    y = screenHeight - menuHeight - 5;
  }

  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
}

// ==============================
// 隐藏右键菜单
// ==============================

function hideContextMenu() {
  contextMenu.style.display = "none";
}

// 点击其他位置关闭菜单
document.addEventListener("click", function () {
  hideContextMenu();
});

// ESC关闭菜单
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    hideContextMenu();
  }
});

// 页面滚动时关闭
window.addEventListener("scroll", function () {
  hideContextMenu();
});

// ==============================
// 右键菜单功能
// ==============================

contextMenu.addEventListener("click", function (event) {
  const item = event.target.closest(".context-menu-item");

  if (!item) {
    return;
  }

  const action = item.dataset.action;

  switch (action) {
    case "refresh":
      location.reload();

      break;

    case "copy":
      copyContent();

      break;

    case "select-all":
      selectAll();

      break;

    case "custom":
      customFunction();

      break;
  }

  hideContextMenu();
});

function copyContent() {
  const selection = window.getSelection().toString();

  if (selection) {
    navigator.clipboard.writeText(selection);

    console.log("已复制：", selection);
  } else {
    console.log("当前没有选中文字");
  }
}

function selectAll() {
  const range = document.createRange();

  range.selectNodeContents(document.body);

  const selection = window.getSelection();

  selection.removeAllRanges();
  selection.addRange(range);
}

function customFunction() {
  console.log("执行我的自定义功能");

  console.log("当前右键元素：", currentTarget);

  alert("执行自定义功能");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
