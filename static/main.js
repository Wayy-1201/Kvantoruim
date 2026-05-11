const API_BASE = '/api';
const tg = window.Telegram?.WebApp;
// ================= ДАННЫЕ ПОЛЬЗОВАТЕЛЯ =================
const userData = {
    telegram_id: 0,
    username: 'Игрок',
    balance: 0,
    stars: 0,
    level: 1,
    clickPower: 1,
    passiveIncome: 0,
    progress: 0,
    totalClicks: 0,
    totalEarned: 0,
    clickUpgrades: {
        power1: { count: 0, base: 100, power: 1 },
        power2: { count: 0, base: 500, power: 3 },
        power3: { count: 0, base: 1000, power: 5 }
    },
    farmUpgrades: {
        worker: { count: 0, base: 200, income: 1 },
        farmer: { count: 0, base: 800, income: 3 },
        harvester: { count: 0, base: 2000, income: 5 }
    },
    bonusUpgrades: {
        luck: { count: 0, base: 300 },
        crit: { count: 0, base: 1500 }
    },
    donors: {
        x2: false,
        x2sek: false,
        superclick: false
    },
    myRating: { avg: 0, count: 0 }
};

let mySticker = null;
let currentStickerLevel = userData.level; 

// ================= ИНИЦИАЛИЗАЦИЯ =================
document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById("sticker_container");

    
    if (tg) {
        tg.ready();
        tg.expand();
        
        const telegramUser = tg.initDataUnsafe?.user;
        if (telegramUser) {
            userData.telegram_id = telegramUser.id;
            userData.username = telegramUser.first_name + (telegramUser.last_name ? ' ' + telegramUser.last_name : '');
            
            console.log('Telegram пользователь:', userData.username);
            
            // Регистрируемся на сервере
            fetch(API_BASE + '/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: userData.telegram_id,
                    username: userData.username
                })
            })
            .then(r => r.json())
            .then(data => {
                if (data.ok && !data.is_new && data.user) {

                    userData.balance = data.user.balance;
                    userData.stars = data.user.stars;
                    userData.level = data.user.level;
                    userData.clickPower = data.user.click_power;
                    userData.passiveIncome = data.user.passive_income;
                    userData.progress = data.user.progress;
                    userData.totalClicks = data.user.total_clicks;
                    userData.totalEarned = data.user.total_earned;

                    // ================= CLICK UPGRADES =================
                    userData.clickUpgrades.power1.count = data.user.click_upgrades.power1 || 0;
                    userData.clickUpgrades.power2.count = data.user.click_upgrades.power2 || 0;
                    userData.clickUpgrades.power3.count = data.user.click_upgrades.power3 || 0;

                    // ================= FARM UPGRADES =================
                    userData.farmUpgrades.worker.count = data.user.farm_upgrades.worker || 0;
                    userData.farmUpgrades.farmer.count = data.user.farm_upgrades.farmer || 0;
                    userData.farmUpgrades.harvester.count = data.user.farm_upgrades.harvester || 0;

                    // ================= BONUS UPGRADES =================
                    userData.bonusUpgrades.luck.count = data.user.bonus_upgrades.luck || 0;
                    userData.bonusUpgrades.crit.count = data.user.bonus_upgrades.crit || 0;

                    // ================= DONATE =================
                    userData.donors = data.user.donors || {
                        x2: false,
                        x2sek: false,
                        superclick: false
                    };
}
                updateUI();
            })
            .catch(() => {
                console.log('Сервер недоступен');
                updateUI();
            });
        } else {
            // Демо-режим
            userData.telegram_id = Math.floor(Math.random() * 900000) + 100000;
            userData.username = 'Тест_' + (userData.telegram_id % 10000);
            updateUI();
        }
    } else {
        // Не в Telegram
        userData.telegram_id = Math.floor(Math.random() * 900000) + 100000;
        userData.username = 'Демо_' + (userData.telegram_id % 10000);
        updateUI();
    }
    
    // === ЗАГРУЗКА СТИКЕРА ===
    function loadSticker(level) {
        if (level === currentStickerLevel && mySticker) {
            return;
        }
        
        let path = 'static/imgs/for_img_crystal/AnimatedSticker.json';
        
        if (level == 1) path = 'static/imgs/for_img_crystal/AnimatedSticker2.json';
        else if (level == 2) path = 'static/imgs/for_img_crystal/AnimatedSticker.json';
        else if (level == 3) path = 'static/imgs/for_img_crystal/AnimatedSticker3.json';
        
        if (mySticker) {
            mySticker.destroy();
            mySticker = null;
        }
        
        mySticker = lottie.loadAnimation({
            container: container,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: path
        });
        
        currentStickerLevel = level;
    }
    
    // Загружаем начальный стикер
    loadSticker(userData.level);
    
    // Добавляем обработчик клика
    if (container) {
        container.addEventListener('click', handleClick);
    }
    
    // Сохраняем и переопределяем checkLevel
    const originalCheckLevel = checkLevel;
    checkLevel = function() {
        let oldLevel = userData.level;
        originalCheckLevel();
        if (oldLevel !== userData.level) {
            loadSticker(userData.level);
        }
    };
    
    // Инициализация остальных компонентов
    initNavigation();
    initCategorySwitching();
    initUpgradeHandlers();
    initDonateShop();
    initAds();
    initPromos();
    initRatingTabs();
    initRateModal();
    startBubbles();

    // Пассивный доход
    setInterval(passiveTick, 1000);
    setInterval(syncToServer, 10000);
});


// ================= УРОВНИ =================
const levelConfig = {
    base: 150,
    multi: 3,
    get(lvl) { return this.base * Math.pow(this.multi, lvl - 1); }
};

// ================= ЦЕНА =================
function getPrice(base, count) {
    return Math.floor(base * Math.pow(1.5, count));
}

// ================= ФОРМАТ =================
function format(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
}

// ================= УВЕДОМЛЕНИЯ =================
function showNotification(text, isGood) {
    const n = document.createElement('div');
    n.className = 'game-notification';
    n.textContent = text;
    n.style.background = isGood ? 'var(--success)' : 'var(--error)';
    n.style.color = '#fff';
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2000);
}

// ================= ОБНОВЛЕНИЕ UI =================
function updateUI() {
    const el = (id) => document.getElementById(id);
    const tg = window.Telegram?.WebApp;
    el('user_content_coin_lol').textContent = format(userData.balance);
    el('user_content_coin_lol_for_2').textContent = format(userData.balance);
    el('user_content_coin_lol_for_3').textContent = format(userData.balance);
    el('userStars').textContent = userData.stars;
    el('userName').textContent = userData.username;

    // АВАТАР //
    const avatarEl = el('userAvatar'); //получаем img
    if(tg?.initDataUnsafe?.user?.photo_url){ // если есть фото в телеге, то ставим его - знак вопроса - обрабатывает ошибки, если фото нет или не удалось загрузить
        const avatarURL = tg.initDataUnsafe.user.photo_url; //выносим ссылку
        avatarEl.src = avatarURL; //непосредственно ставим ее
    }
    else{
        avatarEl.src = "/static/imgs/users_api/monetka.svg"; // иначе - дефолт
    }

    // Сила клика с учетом X2
    let displayClick = userData.clickPower;
    if (userData.donors.x2) displayClick *= 2;
    el('user_upgrade').textContent = displayClick;

    // Пассивный доход с X2sek
    let displayPassive = userData.passiveIncome;
    if (userData.donors.x2sek) displayPassive *= 2;
    el('user_upgrade_sek').textContent = displayPassive;

    // Уровень и прогресс
    const need = levelConfig.get(userData.level);
    const pct = Math.min((userData.progress / need) * 100, 100);
    el('progress-fill').style.width = pct + '%';
    el('level').textContent = userData.level;
    el('required-for-level').textContent = format(need);

    // Цены
    el('price_1').textContent = format(getPrice(100, userData.clickUpgrades.power1.count));
    el('price_2').textContent = format(getPrice(500, userData.clickUpgrades.power2.count));
    el('price_3').textContent = format(getPrice(1000, userData.clickUpgrades.power3.count));
    el('price_2_1').textContent = format(getPrice(200, userData.farmUpgrades.worker.count));
    el('price_2_2').textContent = format(getPrice(800, userData.farmUpgrades.farmer.count));
    el('price_2_3').textContent = format(getPrice(2000, userData.farmUpgrades.harvester.count));
    el('price3_1').textContent = format(getPrice(300, userData.bonusUpgrades.luck.count));
    el('price_3_2').textContent = format(getPrice(1500, userData.bonusUpgrades.crit.count));

    // Количества
    document.querySelectorAll('.category-click .upgrade-count')[0].textContent = userData.clickUpgrades.power1.count;
    document.querySelectorAll('.category-click .upgrade-count')[1].textContent = userData.clickUpgrades.power2.count;
    document.querySelectorAll('.category-click .upgrade-count')[2].textContent = userData.clickUpgrades.power3.count;
    document.querySelectorAll('.category-farm .upgrade-count')[0].textContent = userData.farmUpgrades.worker.count;
    document.querySelectorAll('.category-farm .upgrade-count')[1].textContent = userData.farmUpgrades.farmer.count;
    document.querySelectorAll('.category-farm .upgrade-count')[2].textContent = userData.farmUpgrades.harvester.count;
    document.querySelectorAll('.category-bonus .upgrade-count')[0].textContent = userData.bonusUpgrades.luck.count;
    document.querySelectorAll('.category-bonus .upgrade-count')[1].textContent = userData.bonusUpgrades.crit.count;

    // Донат статус
    updateDonateStatus();

    // Мой рейтинг
    el('myRatingValue').textContent = userData.myRating.avg.toFixed(1);
    el('myRatingStars').textContent = renderStars(userData.myRating.avg);
    el('myRatingCount').textContent = userData.myRating.count + ' оценок';
}

function renderStars(avg) {
    let s = '';
    for (let i = 1; i <= 5; i++) {
        s += i <= Math.round(avg) ? '★' : '☆';
    }
    return s;
}

function updateDonateStatus() {
    const items = [
        { id: 'donate-x2', key: 'x2' },
        { id: 'donate-plus100k', key: null },
        { id: 'donate-x2sek', key: 'x2sek' },
        { id: 'donate-superclick', key: 'superclick' }
    ];
    items.forEach(item => {
        const el = document.getElementById(item.id);
        const dot = el ? el.querySelector('.red_green') : null;
        if (dot) {
            dot.style.backgroundColor = (item.key && userData.donors[item.key]) ? 'var(--success)' : 'var(--error)';
        }
    });
}

// ================= КЛИК =================
function handleClick(e) {
    let earned = userData.clickPower;

    // Крит
    const critChance = Math.min(userData.bonusUpgrades.crit.count * 0.05, 0.3);
    if (critChance > 0 && Math.random() < critChance) {
        earned *= 5;
        showNotification('КРИТИЧЕСКИЙ УДАР! x5', true);
    }

    // Удача
    if (userData.bonusUpgrades.luck.count > 0) {
        earned = Math.floor(earned * (1 + userData.bonusUpgrades.luck.count * 0.05));
    }

    // Донор X2
    if (userData.donors.x2) earned *= 2;

    userData.balance += earned;
    userData.progress += userData.clickPower;
    userData.totalClicks++;
    userData.totalEarned += earned;

    checkLevel();
    updateUI();
    createFloatText(e.clientX || e.touches?.[0]?.clientX || 200, e.clientY || e.touches?.[0]?.clientY || 400, earned);
}

function checkLevel() {
    let need = levelConfig.get(userData.level);
    while (userData.progress >= need && userData.level < 10) {
        userData.progress -= need;
        userData.level++;
        userData.clickPower++;
        const bonus = 50 * userData.level;
        userData.balance += bonus;
        need = levelConfig.get(userData.level);
        showNotification('УРОВЕНЬ ' + userData.level + '! +' + bonus + ' монет', true);
    };
}

function createFloatText(x, y, value) {
    const f = document.createElement('div');
    f.textContent = '+' + format(value);
    f.style.cssText =
        'position:fixed;left:' + x + 'px;top:' + y + 'px;color:#fffff;font-size:26px;' +
        'font-weight:900;text-shadow:0 0 15px #4082ce,2px 2px 2px #4672ec;pointer-events:none;' +
        'z-index:1000;animation:floatUp 1s ease-out forwards;font-family:var(--font);';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1000);
}

// ================= ПАССИВНЫЙ ДОХОД =================
function passiveTick() {
    let income = userData.passiveIncome;
    if (userData.donors.x2sek) income *= 2;
    if (income > 0) {
        userData.balance += income;
        userData.totalEarned += income;
        updateUI();
    }
}

// ================= ПОКУПКА УЛУЧШЕНИЙ =================
function buyUpgrade(type, key) {
    let upg, price;
    if (type === 'click') {
        upg = userData.clickUpgrades[key];
        price = getPrice(upg.base, upg.count);
        if (userData.balance < price) { showNotification('Недостаточно монет!', false); return; }
        userData.balance -= price;
        upg.count++;
        userData.clickPower += upg.power;
        showNotification('+' + upg.power + ' к клику!', true);
    } else if (type === 'farm') {
        upg = userData.farmUpgrades[key];
        price = getPrice(upg.base, upg.count);
        if (userData.balance < price) { showNotification('Недостаточно монет!', false); return; }
        userData.balance -= price;
        upg.count++;
        userData.passiveIncome += upg.income;
        showNotification('+' + upg.income + ' монет/сек!', true);
    } else if (type === 'bonus') {
        upg = userData.bonusUpgrades[key];
        price = getPrice(upg.base, upg.count);
        if (userData.balance < price) { showNotification('Недостаточно монет!', false); return; }
        userData.balance -= price;
        upg.count++;
        showNotification(key === 'luck' ? 'Удача +5%!' : 'Шанс крита +5%!', true);
    }
    updateUI();
    syncToServer();
}

// ================= ДОНАТ ПОКУПКИ =================
function initDonateShop() {
    const handlers = {
        'donate-x2': { stars: 15, key: 'x2', msg: 'X2 монет навсегда!' },
        'donate-plus100k': { stars: 20, key: null, msg: '+100 000 монет!' },
        'donate-x2sek': { stars: 25, key: 'x2sek', msg: 'X2 монет в секунду!' },
        'donate-superclick': { stars: 30, key: 'superclick', msg: 'Супер-клик +5!' }
    };

    Object.entries(handlers).forEach(function(entry) {
        var id = entry[0];
        var cfg = entry[1];
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', function() {
            if (cfg.key && userData.donors[cfg.key]) { showNotification('Уже куплено!', false); return; }
            if (userData.stars < cfg.stars) { showNotification('Нужно ' + cfg.stars + ' ⭐!', false); return; }
            userData.stars -= cfg.stars;
            if (cfg.key) userData.donors[cfg.key] = true;
            if (id === 'donate-plus100k') userData.balance += 100000;
            if (id === 'donate-superclick') userData.clickPower += 5;
            updateUI();
            syncToServer();
            showNotification(cfg.msg, true);
        });
    });
}

// ================= НАВИГАЦИЯ =================
function initNavigation() {
    var links = document.querySelectorAll('footer a');
    links.forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            links.forEach(function(l) { l.classList.remove('active'); });
            link.classList.add('active');
            var view = link.getAttribute('data-view');
            document.querySelectorAll('.model-view').forEach(function(v) { v.classList.remove('active-view'); });
            var target = document.querySelector('.model-view[data-view="' + view + '"]');
            if (target) target.classList.add('active-view');

            // Обновить лидерборд при открытии вкладки рейтинга
            if (view === '4') loadLeaderboard();
        });
    });
}

// ================= КАТЕГОРИИ =================
function initCategorySwitching() {
    var blocks = document.querySelectorAll('.category-block');
    blocks.forEach(function(block) {
        block.addEventListener('click', function() {
            blocks.forEach(function(b) { b.classList.remove('active-category'); });
            block.classList.add('active-category');
            var cat = block.getAttribute('data-category');
            document.getElementById('cat-click').style.display = cat === 'click' ? 'flex' : 'none';
            document.getElementById('cat-farm').style.display = cat === 'farm' ? 'flex' : 'none';
            document.getElementById('cat-bonus').style.display = cat === 'bonus' ? 'flex' : 'none';
        });
    });
}

// ================= УЛУЧШЕНИЯ - ОБРАБОТЧИКИ =================
function initUpgradeHandlers() {
    document.querySelectorAll('.upgrade-item').forEach(function(item) {
        item.addEventListener('click', function() {
            var parts = item.getAttribute('data-upg').split(':');
            buyUpgrade(parts[0], parts[1]);
        });
    });
}

// ================= РЕКЛАМА =================
function initAds() {
    const adsBtn = document.getElementById('ads-btn');
    const adsBtn2 = document.getElementById("ads-btn2");
    if (adsBtn) {
        adsBtn.addEventListener('click', function() {showAdModal();});
    }
    if (adsBtn2) {
        adsBtn2.addEventListener('click' , function() {showAdModal2();});
    }
}

function showAdModal() {
    const overlay = document.getElementById('adOverlay');
    const btn = document.getElementById('adBtn');

    overlay.classList.add('active');
    function hideAdModal() {overlay.classList.remove('active');}

    btn.addEventListener('click', function () {
    userData.stars += 1;
    updateUI();
    syncToServer();
    showNotification('+1 звезда!', true);
    hideAdModal();
    });

    overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
        hideAdModal();
    }
    });
}

function showAdModal2(){
    const overlay = document.getElementById('adOverlay2');
    const btn = document.getElementById('adBtn2');
    overlay.classList.add("active");

    function hideAdModal2() {overlay.classList.remove('active');}
    btn.addEventListener('click', function () {
        userData.stars += 2;
        updateUI();
        syncToServer();
        showNotification('+2 звезды!', true);
        hideAdModal2();
    });
    overlay.addEventListener('click' , function(e){
        if (e.target === overlay) {
            hideAdModal2();
        }
    })
}






// ================= ПРОМОКОДЫ =================
function initPromos() {
    var bought = [false, false, false];
    document.querySelectorAll('.promo-buy-btn').forEach(function(btn, i) {
        btn.addEventListener('click', function() {
            if (bought[i]) { showNotification('Промокод уже куплен!', false); return; }
            var price = parseInt(btn.getAttribute('data-price'));
            if (userData.balance < price) { showNotification('Недостаточно монет!', false); return; }
            userData.balance -= price;
            bought[i] = true;
            var code = '';
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            for (var c = 0; c < 8; c++) code += chars[Math.floor(Math.random() * chars.length)];
            var card = btn.closest('.promo-card');
            var promoDiv = document.createElement('div');
            promoDiv.textContent = 'Промокод: ' + code;
            promoDiv.style.cssText =
                'background:var(--bg-card);color:var(--accent-gold);padding:10px;border-radius:10px;' +
                'font-family:monospace;font-size:15px;text-align:center;margin-top:10px;' +
                'border:1px dashed var(--accent-gold);';
            card.appendChild(promoDiv);
            btn.textContent = 'Куплено ✓';
            btn.disabled = true;
            btn.style.opacity = '0.5';
            updateUI();
            syncToServer();
        });
    });
}

// ================= ПУЗЫРЬКИ =================
var bubbleActive = false;
function startBubbles() {
    scheduleNextBubble();
}
function scheduleNextBubble() {
    var delay = Math.random() * 15000 + 3000;
    setTimeout(function() {
        if (!bubbleActive) createBubble();
        scheduleNextBubble();
    }, delay);
}
function createBubble() {
    if (bubbleActive) return;
    let container = document.getElementById('gameRoot');
    let rect = container.getBoundingClientRect();
    if (rect.width === 0) return;

    let bubble = document.createElement('div');
    bubble.className = 'bubble';
    let size = 50 + Math.random() * 1.0004
    bubble.style.width = size + 'px';
    bubble.style.height = size + 'px';
    bubble.style.left = Math.floor(Math.random() * (rect.width - size)) + 'px';
    bubble.style.bottom = '0px';
    bubble.style.position = 'absolute';
    let dur = (Math.random() * 1 + 2).toFixed(1);
    bubble.style.animationDuration = dur + 's';
    let reward = Math.floor(Math.random() * 500) + 20;
    bubble.setAttribute('data-reward', reward);
    bubble.textContent = '+' + reward;
    bubble.onclick = function(e) {
        e.stopPropagation();
        var r = parseInt(this.getAttribute('data-reward'));
        userData.balance += r;
        userData.totalEarned += r;
        createFloatText(e.clientX, e.clientY, r);
        showNotification('+' + r + ' монет!', true);
        updateUI();
        this.remove();
        bubbleActive = false;
    };
    bubble.onanimationend = function() {
        this.remove();
        bubbleActive = false;
    };
    container.appendChild(bubble);
    bubbleActive = true;
}

// =================================================================
//  РЕЙТИНГ И ЛИДЕРБОРД
// =================================================================

var currentSort = 'balance';
var leaderboardData = [];
var currentRateTarget = null;
var selectedStarScore = 0;

// Моковые данные лидерборда (работают без сервера)
var mockLeaderboard = [
    { rank: 1, telegram_id: 101, username: 'КристалМастер', level: 10, balance: 8500000, total_earned: 12000000, avg_rating: 4.8, rating_count: 24 },
    { rank: 2, telegram_id: 102, username: 'ДиамондКинг', level: 9, balance: 5200000, total_earned: 7800000, avg_rating: 4.5, rating_count: 18 },
    { rank: 3, telegram_id: 103, username: 'КликМашина', level: 8, balance: 3100000, total_earned: 5600000, avg_rating: 4.2, rating_count: 12 },
    { rank: 4, telegram_id: 104, username: 'ФермерПро', level: 7, balance: 1800000, total_earned: 3200000, avg_rating: 3.9, rating_count: 8 },
    { rank: 5, telegram_id: 105, username: 'НовичокЛаки', level: 6, balance: 950000, total_earned: 1400000, avg_rating: 4.0, rating_count: 5 },
    { rank: 6, telegram_id: 106, username: 'ТурбоТаппер', level: 5, balance: 620000, total_earned: 890000, avg_rating: 3.7, rating_count: 9 },
    { rank: 7, telegram_id: 107, username: 'КриптоФарм', level: 5, balance: 410000, total_earned: 670000, avg_rating: 4.1, rating_count: 6 },
    { rank: 8, telegram_id: 108, username: 'МегаКликер', level: 4, balance: 280000, total_earned: 450000, avg_rating: 3.5, rating_count: 3 },
    { rank: 9, telegram_id: 109, username: 'ЗолотойЖук', level: 3, balance: 150000, total_earned: 220000, avg_rating: 4.3, rating_count: 7 },
    { rank: 10, telegram_id: 110, username: 'СтартАп', level: 2, balance: 50000, total_earned: 75000, avg_rating: 3.0, rating_count: 2 }
];

// ---------- Загрузка лидерборда ----------
function loadLeaderboard() {
    var listEl = document.getElementById('statsList');
    // Показываем скелетон
    listEl.innerHTML =
        '<div class="skeleton skeleton-item"></div>' +
        '<div class="skeleton skeleton-item"></div>' +
        '<div class="skeleton skeleton-item"></div>' +
        '<div class="skeleton skeleton-item"></div>' +
        '<div class="skeleton skeleton-item"></div>';

    // Пробуем загрузить с сервера
    fetchLeaderboard(currentSort)
        .then(function(data) {
            leaderboardData = data.leaderboard;
            document.getElementById('totalUsers').textContent = 'Всего игроков: ' + data.total_users;
            renderLeaderboard();
        })
        .catch(function() {
            // Фоллбек на моковые данные
            leaderboardData = sortMockData(currentSort);
            // Добавляем текущего пользователя в список
            addCurrentUserToMock();
            document.getElementById('totalUsers').textContent = 'Всего игроков: ' + leaderboardData.length + ' (демо)';
            renderLeaderboard();
        });
}

function addCurrentUserToMock() {
    // Добавляем текущего игрока если его нет
    var found = leaderboardData.find(function(u) { return u.telegram_id === userData.telegram_id; });
    if (!found) {
        leaderboardData.push({
            rank: 0,
            telegram_id: userData.telegram_id,
            username: userData.username,
            level: userData.level,
            balance: userData.balance,
            total_earned: userData.totalEarned,
            avg_rating: userData.myRating.avg,
            rating_count: userData.myRating.count
        });
    } else {
        found.balance = userData.balance;
        found.level = userData.level;
        found.total_earned = userData.totalEarned;
    }
    // Пересортировка
    leaderboardData = sortMockData(currentSort, leaderboardData);
}

function sortMockData(sort, arr) {
    var list = (arr || mockLeaderboard).slice();
    if (sort === 'balance') list.sort(function(a, b) { return b.balance - a.balance; });
    else if (sort === 'level') list.sort(function(a, b) { return b.level - a.level || b.balance - a.balance; });
    else if (sort === 'rating') list.sort(function(a, b) { return b.avg_rating - a.avg_rating || b.rating_count - a.rating_count; });
    list.forEach(function(item, i) { item.rank = i + 1; });
    return list;
}

// ---------- API вызовы ----------
function fetchLeaderboard(sort) {
    return fetch(API_BASE + '/leaderboard?sort=' + sort + '&limit=50')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.ok) throw new Error('API error');
            return data;
        });
}

function syncToServer() {
    // Пробуем отправить данные на сервер (без блокировки UI)
    var payload = {
        telegram_id: userData.telegram_id,
        balance: userData.balance,
        stars: userData.stars,
        level: userData.level,
        click_power: userData.clickPower,
        passive_income: userData.passiveIncome,
        progress: userData.progress,
        total_clicks: userData.totalClicks,
        total_earned: userData.totalEarned,
        click_upgrades: {
            power1: userData.clickUpgrades.power1.count,
            power2: userData.clickUpgrades.power2.count,
            power3: userData.clickUpgrades.power3.count
        },
        farm_upgrades: {
            worker: userData.farmUpgrades.worker.count,
            farmer: userData.farmUpgrades.farmer.count,
            harvester: userData.farmUpgrades.harvester.count
        },
        bonus_upgrades: {
            luck: userData.bonusUpgrades.luck.count,
            crit: userData.bonusUpgrades.crit.count
        },
        donors: userData.donors
    };

    fetch(API_BASE + '/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(function() { /* Тихий фоллбек — без сервера работаем оффлайн */ });
}

function submitRating(toUser, score, comment) {
    return fetch(API_BASE + '/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from_user: userData.telegram_id,
            to_user: toUser,
            score: score,
            comment: comment
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.ok) return data.rating;
        throw new Error('Rate failed');
    });
}

// ---------- Рендер лидерборда ----------
function renderLeaderboard() {
    var listEl = document.getElementById('statsList');
    if (leaderboardData.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary);font-weight:600;">Пока нет данных</div>';
        return;
    }

    var html = '';
    leaderboardData.forEach(function(player) {
        var isMe = player.telegram_id === userData.telegram_id;
        var initial = player.username.charAt(0).toUpperCase();
        var valueLabel = '';
        var valueNum = '';
        if(tg?.initDataUnsafe?.user?.photo_url){ 
        const avatarURLforratings = tg.initDataUnsafe.user.photo_url; 
        avatarHTML = "<img style='width:34px;height:34px;border-radius:50%;' src='" + avatarURLforratings + "' alt='" + player.username + "' class='stats-avatar-img'>";
        }
        else{
            avatarHTML = "<div class='stats-avatar-placeholder'>" + initial + "</div>";
        }
        if (currentSort === 'balance') {
            valueNum = format(player.balance);
            valueLabel = 'монет';
        } else if (currentSort === 'level') {
            valueNum = 'Ур. ' + player.level;
            valueLabel = format(player.balance) + ' монет';
        } else if (currentSort === 'rating') {
            valueNum = player.avg_rating.toFixed(1) + ' ★';
            valueLabel = player.rating_count + ' оценок';
        }



        html += '<div class="stats-item' + (isMe ? ' current-user-highlight' : '') + '" data-tid="' + player.telegram_id + '" data-name="' + player.username + '">';
        html += '<div class="stats-rank">' + player.rank + '</div>';
        html += '<div class="stats-avatar">' + avatarHTML + '</div>';
        html += '<div class="stats-user-info"><div class="stats-user">' + player.username + (isMe ? ' (Вы)' : '') + '</div>';
        html += '<div class="stats-user-level">Уровень ' + player.level + '</div></div>';
        html += '<div class="stats-value"><div class="stats-clicks">' + valueNum + '</div>';
        html += '<div class="stats-sublabel">' + valueLabel + '</div></div></div>';
    });

    listEl.innerHTML = html;

    // Клик на игрока → открыть модалку рейтинга
    listEl.querySelectorAll('.stats-item').forEach(function(item) {
        item.addEventListener('click', function() {
            var tid = parseInt(item.getAttribute('data-tid'));
            var name = item.getAttribute('data-name');
            if (tid === userData.telegram_id) {
                showNotification('Нельзя оценить себя!', false);
                return;
            }
            openRateModal(tid, name);
        });
    });
}

// ---------- Табы сортировки ----------
function initRatingTabs() {
    document.querySelectorAll('.rating-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.rating-tab').forEach(function(t) { t.classList.remove('active-tab'); });
            tab.classList.add('active-tab');
            currentSort = tab.getAttribute('data-sort');
            loadLeaderboard();
        });
    });
}

// ---------- Модалка оценки ----------
function openRateModal(tid, name) {
    currentRateTarget = tid;
    selectedStarScore = 0;
    document.getElementById('rateModalTitle').textContent = 'Оценить: ' + name;
    document.getElementById('rateComment').value = '';
    document.querySelectorAll('#starSelect span').forEach(function(s) { s.classList.remove('selected'); });
    document.getElementById('rateModalOverlay').classList.add('visible');
}

function closeRateModal() {
    document.getElementById('rateModalOverlay').classList.remove('visible');
    currentRateTarget = null;
    selectedStarScore = 0;
}

function initRateModal() {
    // Звёзды
    document.querySelectorAll('#starSelect span').forEach(function(star) {
        star.addEventListener('click', function() {
            selectedStarScore = parseInt(star.getAttribute('data-star'));
            document.querySelectorAll('#starSelect span').forEach(function(s) {
                var sv = parseInt(s.getAttribute('data-star'));
                if (sv <= selectedStarScore) s.classList.add('selected');
                else s.classList.remove('selected');
            });
        });
    });

    // Кнопки
    document.getElementById('rateCancelBtn').addEventListener('click', closeRateModal);
    document.getElementById('rateModalOverlay').addEventListener('click', function(e) {
        if (e.target === this) closeRateModal();
    });

    document.getElementById('rateSubmitBtn').addEventListener('click', function() {
        if (selectedStarScore < 1) { showNotification('Выберите оценку!', false); return; }
        if (!currentRateTarget) return;
        var comment = document.getElementById('rateComment').value.trim();

        // Пробуем отправить на сервер
        submitRating(currentRateTarget, selectedStarScore, comment)
            .then(function(rating) {
                showNotification('Оценка отправлена!', true);
                // Обновляем рейтинг в моковых данных
                var player = leaderboardData.find(function(p) { return p.telegram_id === currentRateTarget; });
                if (player) {
                    player.avg_rating = rating.avg;
                    player.rating_count = rating.count;
                }
                renderLeaderboard();
                closeRateModal();
            })
            .catch(function() {
                // Оффлайн — обновляем локально
                var player = leaderboardData.find(function(p) { return p.telegram_id === currentRateTarget; });
                if (player) {
                    var total = player.avg_rating * player.rating_count + selectedStarScore;
                    player.rating_count++;
                    player.avg_rating = Math.round((total / player.rating_count) * 10) / 10;
                }
                showNotification('Оценка сохранена (демо)', true);
                renderLeaderboard();
                closeRateModal();
            });
    });
}