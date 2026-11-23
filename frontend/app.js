const state = {
  token: localStorage.getItem('supplychain_token') || '',
  user: null,
  tab: 'dashboard',
  authMode: 'login',
  eventSource: null,
};

const app = document.querySelector('#app');

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function toast(message, isError = false) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.innerHTML = `<span class="${isError ? 'error' : 'ok'}">${esc(message)}</span>`;
  document.body.append(node);
  setTimeout(() => node.remove(), 4000);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && !headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return null;
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === 'string' ? detail : data?.message || `HTTP ${response.status}`);
  }
  return data;
}

function authScreen() {
  app.innerHTML = `
    <main class="auth-screen">
      <section class="card auth-card">
        <h1 class="brand">Supply<span>Chain</span></h1>
        <p class="muted">Единый кабинет микросервисной платформы</p>
        <div class="auth-tabs">
          <button id="login-tab" class="${state.authMode === 'login' ? 'active' : ''}">Вход</button>
          <button id="register-tab" class="${state.authMode === 'register' ? 'active' : ''}">Регистрация</button>
        </div>
        <form id="auth-form"></form>
        <p id="auth-error" class="error"></p>
      </section>
    </main>`;

  document.querySelector('#login-tab').onclick = () => { state.authMode = 'login'; authScreen(); };
  document.querySelector('#register-tab').onclick = () => { state.authMode = 'register'; authScreen(); };
  document.querySelector('#auth-form').innerHTML = state.authMode === 'login'
    ? `<div class="field"><label>Логин или email</label><input name="username" required></div>
       <div class="field"><label>Пароль</label><input name="password" type="password" required></div>
       <button type="submit">Войти</button>`
    : `<div class="form-grid">
         <div class="field"><label>Username</label><input name="username" minlength="3" required></div>
         <div class="field"><label>Email</label><input name="email" type="email" required></div>
         <div class="field full"><label>Пароль</label><input name="password" type="password" minlength="6" required></div>
         <div class="field full"><label>Telegram (необязательно)</label><input name="telegram"></div>
       </div><button type="submit">Создать аккаунт</button>`;

  document.querySelector('#auth-form').onsubmit = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const error = document.querySelector('#auth-error');
    error.textContent = '';
    try {
      if (state.authMode === 'register') {
        try {
          await api('/auth/register', {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(form)),
          });
          toast('Аккаунт создан');
        } catch (registrationError) {
          const message = String(registrationError.message).toLowerCase();
          if (!message.includes('already') && !message.includes('уже') && !message.includes('taken')) {
            throw registrationError;
          }
          toast('Аккаунт уже существует, выполняется вход');
        }
      }
      const body =
        `username=${encodeURIComponent(String(form.get('username')))}&` +
        `password=${encodeURIComponent(String(form.get('password')))}`;
      const result = await api('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      state.token = result.access_token;
      localStorage.setItem('supplychain_token', state.token);
      await initializeApp();
    } catch (err) {
      error.textContent = err.message;
    }
  };
}

const tabs = [
  ['dashboard', 'Обзор'], ['orders', 'Заказы'], ['suppliers', 'Поставщики'],
  ['products', 'Товары'], ['deliveries', 'Доставки'], ['social', 'Профиль'],
];

function shell(content) {
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand">Supply<span>Chain</span></div>
        <div class="top-actions">
          <span class="muted">${esc(state.user?.username || '')}</span>
          <button class="secondary" id="logout">Выйти</button>
        </div>
      </header>
      <div class="layout">
        <nav class="sidebar">
          ${tabs.map(([id, label]) => `<button class="nav-button ${state.tab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}
        </nav>
        <main class="content">${content}</main>
      </div>
    </div>`;
  document.querySelector('#logout').onclick = logout;
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.onclick = () => { state.tab = button.dataset.tab; renderTab(); };
  });
}

function logout() {
  if (state.eventSource) state.eventSource.close();
  state.token = '';
  state.user = null;
  localStorage.removeItem('supplychain_token');
  authScreen();
}

async function initializeApp() {
  try {
    state.user = await api('/users/me');
    await renderTab();
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('Unauthorized')) logout();
    else toast(err.message, true);
  }
}

async function renderTab() {
  shell('<p class="muted">Загрузка...</p>');
  try {
    if (state.tab === 'dashboard') await dashboard();
    if (state.tab === 'orders') await orders();
    if (state.tab === 'suppliers') await suppliers();
    if (state.tab === 'products') await products();
    if (state.tab === 'deliveries') await deliveries();
    if (state.tab === 'social') await social();
  } catch (err) {
    document.querySelector('.content').innerHTML = `<div class="card"><h2>Ошибка</h2><p class="error">${esc(err.message)}</p></div>`;
  }
}

async function dashboard() {
  const [orders, suppliers, products, deliveries, notifications] = await Promise.all([
    api('/api/orders').catch(() => []),
    api('/api/suppliers').catch(() => []),
    api('/api/products').catch(() => []),
    api('/api/deliveries').catch(() => []),
    api('/notifications/unread_count').catch(() => ({ unread_count: 0 })),
  ]);
  shell(`
    <h1>Обзор</h1>
    <div class="grid grid-3">
      ${stat('Заказы', orders.length)} ${stat('Поставщики', suppliers.length)}
      ${stat('Товары', products.length)} ${stat('Доставки', deliveries.length)}
      ${stat('Непрочитанные', notifications.unread_count)}
    </div>
  `);
  document.querySelector('#logout').onclick = logout;
  document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { state.tab = button.dataset.tab; renderTab(); });
}

function stat(title, value) {
  return `<div class="card"><p class="muted">${title}</p><h2>${esc(value)}</h2></div>`;
}

async function suppliers() {
  const suppliers = await api('/api/suppliers');
  shell(`
    <h1>Поставщики</h1>
    <div class="grid grid-2">
      <section class="card">
        <h2>Новый поставщик</h2>
        <form id="supplier-form">
          <div class="form-grid">
            <div class="field"><label>Название</label><input name="name" minlength="2" required></div>
            <div class="field"><label>Email</label><input name="email" type="email" required></div>
            <div class="field"><label>Телефон</label><input name="phone"></div>
            <div class="field"><label>Адрес</label><input name="address" minlength="2" required></div>
          </div>
          <button>Добавить</button>
        </form>
      </section>
      <section class="card">
        <h2>Список</h2>
        <div class="table-wrap"><table><thead><tr><th>Название</th><th>Email</th><th>Адрес</th></tr></thead>
        <tbody>${suppliers.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.email)}</td><td>${esc(s.address)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Нет поставщиков</td></tr>'}</tbody></table></div>
      </section>
    </div>`);
  bindShell();
  document.querySelector('#supplier-form').onsubmit = async event => {
    event.preventDefault();
    try {
      await api('/api/suppliers', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      toast('Поставщик добавлен'); await suppliers();
    } catch (err) { toast(err.message, true); }
  };
}

async function products() {
  const [products, suppliers] = await Promise.all([api('/api/products'), api('/api/suppliers')]);
  shell(`
    <h1>Товары</h1>
    <div class="grid grid-2">
      <section class="card">
        <h2>Новый товар</h2>
        <form id="product-form">
          <div class="form-grid">
            <div class="field"><label>Поставщик</label><select name="supplier_id" required>${suppliers.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Название</label><input name="name" minlength="2" required></div>
            <div class="field"><label>Цена</label><input name="price" type="number" min="0.01" step="0.01" required></div>
            <div class="field"><label>Количество</label><input name="quantity" type="number" min="0" required></div>
            <div class="field full"><label>Описание</label><textarea name="description"></textarea></div>
          </div>
          <button ${suppliers.length ? '' : 'disabled'}>Добавить</button>
        </form>
      </section>
      <section class="card">
        <h2>Каталог</h2>
        <div class="table-wrap"><table><thead><tr><th>Товар</th><th>Цена</th><th>Остаток</th><th>Статус</th></tr></thead>
        <tbody>${products.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.price)}</td><td>${esc(p.quantity)}</td><td><span class="badge">${p.available ? 'В наличии' : 'Нет в наличии'}</span></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Нет товаров</td></tr>'}</tbody></table></div>
      </section>
    </div>`);
  bindShell();
  document.querySelector('#product-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    data.price = Number(data.price);
    data.quantity = Number(data.quantity);
    try { await api('/api/products', { method: 'POST', body: JSON.stringify(data) }); toast('Товар добавлен'); await products(); }
    catch (err) { toast(err.message, true); }
  });
}

async function orders() {
  const [orders, products] = await Promise.all([api('/api/orders'), api('/api/products')]);
  shell(`
    <h1>Заказы</h1>
    <div class="grid grid-2">
      <section class="card">
        <h2>Новый заказ</h2>
        <form id="order-form">
          <div class="form-grid">
            <div class="field"><label>Customer ID</label><input name="customerId" required></div>
            <div class="field"><label>Товар</label><select name="productId" required>${products.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Количество</label><input name="quantity" type="number" min="1" value="1" required></div>
            <div class="field"><label>Адрес доставки</label><input name="deliveryAddress" required></div>
          </div>
          <button ${products.length ? '' : 'disabled'}>Создать</button>
        </form>
      </section>
      <section class="card">
        <h2>SSE события</h2>
        <div id="sse-log" class="sse-log muted">Выберите заказ ниже для подписки...</div>
      </section>
      <section class="card full" style="grid-column:1/-1">
        <h2>Список</h2>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Customer</th><th>Статус</th><th>Адрес</th><th>Действия</th></tr></thead>
        <tbody>${orders.map(o => `<tr><td>${esc(o.id)}</td><td>${esc(o.customerId)}</td><td><span class="badge">${esc(o.status)}</span></td><td>${esc(o.deliveryAddress)}</td><td><button class="secondary" data-events="${esc(o.id)}">Live</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Нет заказов</td></tr>'}</tbody></table></div>
      </section>
    </div>`);
  bindShell();
  document.querySelector('#order-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    data.quantity = Number(data.quantity);
    try { await api('/api/orders', { method: 'POST', body: JSON.stringify(data) }); toast('Заказ создан'); await orders(); }
    catch (err) { toast(err.message, true); }
  });
  document.querySelectorAll('[data-events]').forEach(button => button.onclick = () => subscribeEvents(button.dataset.events));
}

function subscribeEvents(orderId) {
  const log = document.querySelector('#sse-log');
  log.textContent = `Подписка на ${orderId}...\n`;
  const url = `/api/orders/${orderId}/events`;
  fetch(url, {
    headers: { Authorization: `Bearer ${state.token}` },
  }).then(async response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';
      frames.forEach(frame => {
        const dataLine = frame.split('\n').find(line => line.startsWith('data:'));
        if (dataLine) {
          log.textContent += `${dataLine.slice(5).trim()}\n`;
          log.scrollTop = log.scrollHeight;
        }
      });
    }
  }).catch(err => {
    log.textContent += `Ошибка: ${err.message}\n`;
  });
}

async function deliveries() {
  const deliveries = await api('/api/deliveries');
  shell(`
    <h1>Доставки</h1>
    <div class="grid grid-2">
      <section class="card">
        <h2>Новая доставка</h2>
        <form id="delivery-form">
          <div class="form-grid">
            <div class="field"><label>Order ID</label><input name="orderId" required></div>
            <div class="field"><label>Адрес</label><input name="deliveryAddress" required></div>
            <div class="field full"><label>Курьер</label><input name="courierName"></div>
          </div>
          <button>Создать</button>
        </form>
      </section>
      <section class="card">
        <h2>Список</h2>
        <div class="table-wrap"><table><thead><tr><th>Order</th><th>Курьер</th><th>Статус</th><th>Изменить</th></tr></thead>
        <tbody>${deliveries.map(d => `<tr><td>${esc(d.orderId)}</td><td>${esc(d.courierName || '-')}</td><td><span class="badge">${esc(d.status)}</span></td>
        <td><select data-status="${esc(d.id)}">${['CREATED','ASSIGNED','IN_TRANSIT','DELIVERED','CANCELLED'].map(s => `<option ${d.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Нет доставок</td></tr>'}</tbody></table></div>
      </section>
    </div>`);
  bindShell();
  document.querySelector('#delivery-form').onsubmit = async event => {
    event.preventDefault();
    try { await api('/api/deliveries', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); toast('Доставка создана'); await deliveries(); }
    catch (err) { toast(err.message, true); }
  };
  document.querySelectorAll('[data-status]').forEach(select => select.onchange = async () => {
    try { await api(`/api/deliveries/${select.dataset.status}/status?status=${encodeURIComponent(select.value)}`, { method: 'PATCH' }); toast('Статус обновлен'); await deliveries(); }
    catch (err) { toast(err.message, true); }
  });
}

async function social() {
  const [profile, friends, notifications, achievements] = await Promise.all([
    api('/users/me'),
    api('/friends/'),
    api('/notifications/'),
    api('/users/me/achievements'),
  ]);
  shell(`
    <h1>Профиль и сеть</h1>
    <div class="grid grid-3">
      <section class="card">
        <h2>Профиль</h2>
        <p><span class="muted">Логин:</span> ${esc(profile.username)}</p>
        <p><span class="muted">Email:</span> ${esc(profile.email)}</p>
      </section>
      <section class="card">
        <h2>Друзья (${friends.total || 0})</h2>
        ${(friends.friends || []).map(f => `<p>${esc(f.username)}</p>`).join('') || '<p class="empty">Нет друзей</p>'}
      </section>
      <section class="card">
        <h2>Достижения (${achievements.total || 0})</h2>
        ${(achievements.achievements || []).map(a => `<p>${esc(a.title)}</p>`).join('') || '<p class="empty">Нет достижений</p>'}
      </section>
    </div>
    <section class="card" style="margin-top:16px">
      <div class="actions"><h2 style="margin-right:auto">Уведомления</h2><button class="secondary" id="mark-read">Прочитать все</button></div>
      ${(notifications.notifications || []).map(n => `<p><span class="${n.is_read ? 'muted' : 'ok'}">${esc(n.message)}</span></p>`).join('') || '<p class="empty">Нет уведомлений</p>'}
    </section>`);
  bindShell();
  document.querySelector('#mark-read').onclick = async () => {
    const ids = (notifications.notifications || []).map(n => n.id);
    try { await api('/notifications/mark_read', { method: 'POST', body: JSON.stringify({ notification_ids: ids }) }); toast('Уведомления прочитаны'); await social(); }
    catch (err) { toast(err.message, true); }
  };
}

function bindShell() {
  document.querySelector('#logout').onclick = logout;
  document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { state.tab = button.dataset.tab; renderTab(); });
}

if (state.token) initializeApp();
else authScreen();
