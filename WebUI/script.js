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
            <li class="nav-item parent" data-category="${catId}" data-parent="true">
                ${iconDisplay}
                <span>${cat.name}</span>
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
                        <span>${sub.name}</span>
                    </li>
                `;
      });
      html += `</ul>`;
    }
  });

  navMenu.innerHTML = html;
  bindNavEvents();
}

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

// 打开

settingsBtn.addEventListener("click", () => {
  settingsPanel.classList.add("show");
});

// 关闭

closeSettings.addEventListener("click", () => {
  settingsPanel.classList.remove("show");
});

// Tab切换（事件委托，动态生成的按钮也能生效）
function bindSettingTabs() {
  const tabsContainer = document.getElementById("settings-tabs");
  if (!tabsContainer) return;

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

// 根据 default 值推断控件类型
function inferSettingType(value) {
  if (Array.isArray(value)) return "select";
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "range";
  return "text";
}

async function loadSettings() {
  try {
    const response = await fetch(SETTING_JSON_PATH);

    if (!response.ok) throw new Error(`setting.json 读取失败: HTTP ${response.status}`);

    const data = await response.json();

    // 统一转换成 { tabs: [{ id, name, items: [{ key, label, type, value, options }] }] }
    return {
      tabs: Object.entries(data.tabs || {}).map(([tabId, tabItems]) => ({
        id: tabId,
        name: tabId,
        items: Object.entries(tabItems || {}).map(([key, val]) => {
          const def = val.default;
          const type = inferSettingType(def);
          return {
            key,
            label: val.ch_Name || key,
            type,
            value: Array.isArray(def) ? def[0] : def,
            options: Array.isArray(def) ? def : undefined,
          };
        }),
      })),
    };
  } catch (error) {
    console.error(error);

    return {
      tabs: [],
    };
  }
}

function generateSettingTabs(settings) {
  const tabs = document.getElementById("settings-tabs");

  const content = document.getElementById("settings-content");

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
                value="${item.value ?? ""}">
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
                  .map(
                    (o) =>
                      `<option value="${o}" ${o === item.value ? "selected" : ""}>${o}</option>`,
                  )
                  .join("")}
                </select>
                `;
          break;

        case "range":
          control = `
                <input
                type="range"
                data-key="${item.key}"
                min="1"
                max="${Math.max(10, (item.value || 0) * 2)}"
                value="${item.value || 0}">
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

init();
