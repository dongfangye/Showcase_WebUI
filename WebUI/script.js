// ============ 数据 ============
const itemData = [
    // 电子产品
    { id: 1, name: 'MacBook Pro 14"', category: 'electronics', emoji: '💻', price: '¥12,999' },
    { id: 2, name: 'Sony WH-1000XM5', category: 'electronics', emoji: '🎧', price: '¥1,999' },
    { id: 3, name: 'iPad Air', category: 'electronics', emoji: '📱', price: '¥4,799' },
    { id: 4, name: '机械键盘', category: 'electronics', emoji: '⌨️', price: '¥599' },
    // 家具装饰
    { id: 5, name: '北欧沙发', category: 'furniture', emoji: '🛋️', price: '¥3,299' },
    { id: 6, name: '落地灯', category: 'furniture', emoji: '💡', price: '¥459' },
    { id: 7, name: '实木书桌', category: 'furniture', emoji: '🪑', price: '¥1,899' },
    { id: 8, name: '地毯', category: 'furniture', emoji: '🧶', price: '¥699' },
    // 艺术品
    { id: 9, name: '蒙德里安画作', category: 'art', emoji: '🖼️', price: '¥2,500' },
    { id: 10, name: '陶瓷花瓶', category: 'art', emoji: '🏺', price: '¥380' },
    { id: 11, name: '雕塑摆件', category: 'art', emoji: '🗿', price: '¥650' },
    // 书籍文具
    { id: 12, name: '设计心理学', category: 'books', emoji: '📖', price: '¥89' },
    { id: 13, name: '国誉笔记本', category: 'books', emoji: '📓', price: '¥35' },
    { id: 14, name: 'LAMY 钢笔', category: 'books', emoji: '🖊️', price: '¥299' },
    // 服饰配件
    { id: 15, name: '羊绒围巾', category: 'clothing', emoji: '🧣', price: '¥459' },
    { id: 16, name: '皮质背包', category: 'clothing', emoji: '🎒', price: '¥899' },
    { id: 17, name: '运动手表', category: 'clothing', emoji: '⌚', price: '¥1,299' },
];

// 分类名称映射
const categoryMap = {
    all: '全部物品',
    electronics: '电子产品',
    furniture: '家具装饰',
    art: '艺术品',
    books: '书籍文具',
    clothing: '服饰配件'
};

// ============ DOM 引用 ============
const grid = document.getElementById('item-grid');
const categoryTitle = document.getElementById('category-title');
const itemCount = document.getElementById('item-count');
const navItems = document.querySelectorAll('.nav-item');
const refreshBtn = document.getElementById('refresh-btn');

// 当前选中的分类
let currentCategory = 'all';

// ============ 渲染函数 ============
function renderItems(category) {
    // 过滤数据
    let filtered = itemData;
    if (category !== 'all') {
        filtered = itemData.filter(item => item.category === category);
    }

    // 更新标题和计数
    categoryTitle.textContent = categoryMap[category] || '全部物品';
    itemCount.textContent = `共 ${filtered.length} 件`;

    // 空状态
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span class="big-icon">🔍</span>
                该分类下暂无物品
            </div>
        `;
        return;
    }

    // 生成卡片
    const cardsHTML = filtered.map(item => `
        <div class="item-card" data-id="${item.id}">
            <div class="image-placeholder">${item.emoji}</div>
            <div class="card-body">
                <h3>${item.name}</h3>
                <span class="category-tag">${categoryMap[item.category] || item.category}</span>
                <div class="price">${item.price}</div>
            </div>
        </div>
    `).join('');

    grid.innerHTML = cardsHTML;
}

// ============ 导航切换 ============
function switchCategory(category) {
    currentCategory = category;

    // 更新导航高亮
    navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.category === category);
    });

    renderItems(category);
}

// ============ 事件绑定 ============
// 导航点击
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const category = item.dataset.category;
        if (category !== currentCategory) {
            switchCategory(category);
        }
    });
});

// 刷新按钮
refreshBtn.addEventListener('click', () => {
    // 简单的动画反馈
    refreshBtn.textContent = '⏳ 刷新中...';
    refreshBtn.disabled = true;

    setTimeout(() => {
        renderItems(currentCategory);
        refreshBtn.textContent = '🔄 刷新';
        refreshBtn.disabled = false;
    }, 400);
});

// ============ 初始化 ============
renderItems('all');