import { db } from './firebase-config.js';
import { AuthModule } from './auth.js';
import { collection, getDocs, addDoc, doc, updateDoc, query, where, serverTimestamp, orderBy } from 'firebase/firestore';

// Геокодирование адреса через Nominatim (бесплатно, без ключей)
async function geocodeAddress(address) {
    const fullAddress = `${address}, Шымкент, Казахстан`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullAddress)}&format=json&limit=1`;
    try {
        const res = await fetch(url, { headers: { 'Accept-Language': 'ru' } });
        const data = await res.json();
        if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
    } catch (e) {
        console.warn('Геокодинг не удался:', e);
    }
    return null;
}

export const Pages = {

    // ─── 1. ДАШБОРД ───────────────────────────────────────────────────────────
    async dashboard() {
        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-info"><p>Заявки за сегодня</p><h3 id="dash-orders">...</h3></div>
                    <div class="stat-icon"><i class="fa-solid fa-file-invoice-dollar"></i></div>
                </div>
                <div class="stat-card">
                    <div class="stat-info"><p>Продажи (тг)</p><h3 id="dash-sales">...</h3></div>
                    <div class="stat-icon"><i class="fa-solid fa-chart-line"></i></div>
                </div>
                <div class="stat-card">
                    <div class="stat-info"><p>Торговые в полях</p><h3 id="dash-agents">...</h3></div>
                    <div class="stat-icon"><i class="fa-solid fa-user-tie"></i></div>
                </div>
                <div class="stat-card">
                    <div class="stat-info"><p>Водители на маршруте</p><h3 id="dash-drivers">...</h3></div>
                    <div class="stat-icon"><i class="fa-solid fa-truck"></i></div>
                </div>
            </div>
            <div class="card">
                <h2>Оперативная сводка CRM</h2>
                <p>Добро пожаловать в рабочую экосистему компании «Пышка» (Шымкент).</p>
            </div>
        `;
    },

    async initDashboard() {
        const q = query(collection(db, "orders"));
        const snap = await getDocs(q);
        document.getElementById('dash-orders').innerText = snap.size;
        let totalSales = 0;
        snap.forEach(d => totalSales += Number(d.data().total || 0));
        document.getElementById('dash-sales').innerText = totalSales.toLocaleString() + ' ₸';
        document.getElementById('dash-agents').innerText = '5';
        document.getElementById('dash-drivers').innerText = '3';
    },

    // ─── 2. КЛИЕНТЫ АКБ / ОКБ ─────────────────────────────────────────────────
    async clients(type) {
        return `
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2>${type === 'akb' ? 'Активная клиентская база (АКБ)' : 'Общая клиентская база (ОКБ)'}</h2>
                </div>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Магазин</th><th>ИП</th><th>Адрес</th><th>Телефон</th><th>Статус</th>
                            </tr>
                        </thead>
                        <tbody id="clients-table-body">
                            <tr><td colspan="5">Загрузка клиентов...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async initClients(type) {
        const tbody = document.getElementById('clients-table-body');
        const q = query(collection(db, "clients"), where("type", "==", type));
        const snap = await getDocs(q);
        tbody.innerHTML = '';
        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="5">Клиенты не найдены.</td></tr>`;
            return;
        }
        snap.forEach(docSnap => {
            const c = docSnap.data();
            tbody.innerHTML += `
                <tr>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.ip}</td>
                    <td>${c.address}</td>
                    <td>${c.phone}</td>
                    <td><span class="badge ${c.status === 'Активен' ? 'badge-delivered' : 'badge-accepted'}">${c.status}</span></td>
                </tr>
            `;
        });
    },

    // ─── 3. СОЗДАНИЕ ЗАЯВКИ ────────────────────────────────────────────────────
    async createOrder() {
        return `
            <div class="card" style="max-width:640px; margin:0 auto;">
                <h2><i class="fa-solid fa-square-plus" style="color:var(--primary); margin-right:8px;"></i>Новая заявка</h2>
                <form id="order-form" style="margin-top:20px;">
                    <div class="form-group">
                        <label>Название магазина</label>
                        <input type="text" id="ord-name" required placeholder="Магазин «Вкусный»">
                    </div>
                    <div class="form-group">
                        <label>ИП</label>
                        <input type="text" id="ord-ip" required placeholder="ИП Мамедов">
                    </div>
                    <div class="form-group">
                        <label>Точный адрес <small style="color:var(--text-muted)">(используется для маркера на карте)</small></label>
                        <input type="text" id="ord-address" required placeholder="ул. Аймаутова 12">
                    </div>
                    <div class="form-group">
                        <label>Телефон владельца</label>
                        <input type="text" id="ord-phone" required placeholder="+7 (707) 123-4567">
                    </div>
                    <div class="form-group">
                        <label>Позиции заявки</label>
                        <textarea id="ord-items" rows="3" required placeholder="Хлеб формовой — 50 шт&#10;Баурсаки — 5 кг"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Общая сумма (₸)</label>
                        <input type="number" id="ord-total" required placeholder="15000">
                    </div>
                    <div class="form-group">
                        <label>Комментарий</label>
                        <textarea id="ord-comment" rows="2" placeholder="Необязательно"></textarea>
                    </div>
                    <div id="order-status-msg" class="hidden" style="padding:10px; border-radius:8px; margin-bottom:12px; font-size:14px;"></div>
                    <button type="submit" class="btn btn-primary btn-block" id="order-submit-btn">
                        <i class="fa-solid fa-paper-plane"></i> Отправить заявку
                    </button>
                </form>
            </div>
        `;
    },

    async initCreateOrder() {
        document.getElementById('order-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('order-submit-btn');
            const msg = document.getElementById('order-status-msg');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Геокодинг адреса...';

            const address = document.getElementById('ord-address').value;
            const coords = await geocodeAddress(address);

            const orderData = {
                name: document.getElementById('ord-name').value,
                ip: document.getElementById('ord-ip').value,
                address: address,
                phone: document.getElementById('ord-phone').value,
                items: document.getElementById('ord-items').value,
                total: Number(document.getElementById('ord-total').value),
                comment: document.getElementById('ord-comment').value,
                status: 'Новая',
                lat: coords ? coords.lat : null,
                lng: coords ? coords.lng : null,
                createdAt: new Date().toISOString(),
                createdBy: AuthModule.currentUser ? AuthModule.currentUser.email : 'unknown'
            };

            await addDoc(collection(db, "orders"), orderData);

            msg.style.background = 'rgba(34,197,94,0.15)';
            msg.style.color = '#22c55e';
            msg.style.border = '1px solid rgba(34,197,94,0.3)';
            msg.innerHTML = coords
                ? '<i class="fa-solid fa-check-circle"></i> Заявка отправлена! Адрес найден на карте.'
                : '<i class="fa-solid fa-check-circle"></i> Заявка отправлена! Адрес не удалось определить на карте — маркер не появится.';
            msg.classList.remove('hidden');

            document.getElementById('order-form').reset();
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Отправить заявку';
        });
    },

    // ─── 4. КАРТА (LEAFLET) ────────────────────────────────────────────────────
    async map() {
        return `
            <div class="card" style="padding-bottom:0;">
                <h2><i class="fa-solid fa-map-location-dot" style="color:var(--primary); margin-right:8px;"></i>Логистическая карта — Шымкент</h2>
                <p style="color:var(--text-muted); margin-bottom:12px;">Активные заявки на карте. Нажмите маркер для подробностей.</p>
                <div style="display:flex; gap:12px; margin-bottom:14px; flex-wrap:wrap;">
                    <span style="display:flex;align-items:center;gap:6px;font-size:13px;"><span style="width:12px;height:12px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>Новая</span>
                    <span style="display:flex;align-items:center;gap:6px;font-size:13px;"><span style="width:12px;height:12px;border-radius:50%;background:#3b82f6;display:inline-block;"></span>Принята</span>
                    <span style="display:flex;align-items:center;gap:6px;font-size:13px;"><span style="width:12px;height:12px;border-radius:50%;background:#8b5cf6;display:inline-block;"></span>В пути</span>
                    <span style="display:flex;align-items:center;gap:6px;font-size:13px;"><span style="width:12px;height:12px;border-radius:50%;background:#22c55e;display:inline-block;"></span>Доставлена</span>
                </div>
                <div id="leaflet-map" style="width:100%; height:520px; border-radius:12px; overflow:hidden;"></div>
            </div>
        `;
    },

    async initMapPage() {
        const shymkent = [42.3417, 69.5901];
        const map = L.map('leaflet-map').setView(shymkent, 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        const statusColors = {
            'Новая': '#f59e0b',
            'Принята': '#3b82f6',
            'В пути': '#8b5cf6',
            'Доставлена': '#22c55e'
        };

        const snap = await getDocs(collection(db, "orders"));
        let hasMarkers = false;

        snap.forEach(docSnap => {
            const o = docSnap.data();
            if (!o.lat || !o.lng) return;
            hasMarkers = true;

            const color = statusColors[o.status] || '#f59e0b';

            const icon = L.divIcon({
                className: '',
                html: `<div style="
                    background:${color};
                    width:36px; height:36px;
                    border-radius:50% 50% 50% 0;
                    transform:rotate(-45deg);
                    border:3px solid white;
                    box-shadow:0 2px 8px rgba(0,0,0,0.35);
                "></div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 36],
                popupAnchor: [0, -36]
            });

            const marker = L.marker([o.lat, o.lng], { icon }).addTo(map);
            marker.bindPopup(`
                <div style="min-width:200px; font-family:Inter,sans-serif;">
                    <strong style="font-size:15px;">${o.name}</strong><br>
                    <span style="color:#666; font-size:12px;">${o.ip}</span>
                    <hr style="margin:8px 0; border-color:#eee;">
                    <div style="font-size:13px; line-height:1.7;">
                        <i class="fa-solid fa-location-dot" style="color:#f59e0b;"></i> ${o.address}<br>
                        <i class="fa-solid fa-phone" style="color:#3b82f6;"></i> ${o.phone}<br>
                        <i class="fa-solid fa-list" style="color:#8b5cf6;"></i> ${o.items || '—'}<br>
                        <i class="fa-solid fa-money-bill" style="color:#22c55e;"></i> <strong>${Number(o.total).toLocaleString()} ₸</strong>
                    </div>
                    <div style="margin-top:10px; display:flex; gap:6px;">
                        <span style="background:${color}22; color:${color}; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; border:1px solid ${color}44;">${o.status}</span>
                        <a href="https://yandex.ru/maps/?text=${encodeURIComponent(o.address + ', Шымкент')}" 
                           target="_blank"
                           style="background:#f59e0b; color:white; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; text-decoration:none;">
                           <i class="fa-solid fa-route"></i> Маршрут
                        </a>
                    </div>
                </div>
            `);
        });

        if (!hasMarkers) {
            const info = L.control({ position: 'topright' });
            info.onAdd = () => {
                const div = L.DomUtil.create('div');
                div.innerHTML = '<div style="background:white;padding:10px 14px;border-radius:8px;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">Нет заявок с адресом на карте</div>';
                return div;
            };
            info.addTo(map);
        }
    },

    // ─── 5. ВОДИТЕЛЬ ──────────────────────────────────────────────────────────
    async driver() {
        return `
            <div style="display:grid; gap:20px;">
                <div class="card" style="padding-bottom:0;">
                    <h2><i class="fa-solid fa-map-location-dot" style="color:var(--primary); margin-right:8px;"></i>Карта маршрута</h2>
                    <p style="color:var(--text-muted); margin-bottom:14px;">Нажмите на маркер → кнопка «Маршрут» откроет Яндекс.Карты.</p>
                    <div id="driver-map" style="width:100%; height:380px; border-radius:12px; overflow:hidden;"></div>
                </div>
                <div class="card">
                    <h2><i class="fa-solid fa-truck-ramp-box" style="color:var(--primary); margin-right:8px;"></i>Список заявок</h2>
                    <div class="table-responsive" style="margin-top:16px;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Магазин</th><th>Адрес</th><th>Телефон</th><th>Позиции</th><th>Сумма</th><th>Статус</th><th>Действие</th>
                                </tr>
                            </thead>
                            <tbody id="driver-table-body">
                                <tr><td colspan="7">Загрузка...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    async initDriverPage() {
        const tbody = document.getElementById('driver-table-body');
        const snap = await getDocs(collection(db, "orders"));
        tbody.innerHTML = '';

        const statusColors = {
            'Новая': '#f59e0b',
            'Принята': '#3b82f6',
            'В пути': '#8b5cf6',
            'Доставлена': '#22c55e'
        };

        const shymkent = [42.3417, 69.5901];
        const driverMap = L.map('driver-map').setView(shymkent, 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(driverMap);

        snap.forEach(docSnap => {
            const id = docSnap.id;
            const o = docSnap.data();

            // Маркеры на карте водителя
            if (o.lat && o.lng) {
                const color = statusColors[o.status] || '#f59e0b';
                const icon = L.divIcon({
                    className: '',
                    html: `<div style="background:${color};width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 30],
                    popupAnchor: [0, -30]
                });
                L.marker([o.lat, o.lng], { icon }).addTo(driverMap)
                    .bindPopup(`
                        <strong>${o.name}</strong><br>
                        ${o.address}<br>
                        <a href="https://yandex.ru/maps/?text=${encodeURIComponent(o.address + ', Шымкент')}" 
                           target="_blank" 
                           style="display:inline-block;margin-top:6px;background:#f59e0b;color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;text-decoration:none;">
                           <i class="fa-solid fa-route"></i> Маршрут
                        </a>
                    `);
            }

            let statusClass = 'badge-new';
            if (o.status === 'Принята') statusClass = 'badge-accepted';
            if (o.status === 'В пути') statusClass = 'badge-intransit';
            if (o.status === 'Доставлена') statusClass = 'badge-delivered';

            tbody.innerHTML += `
                <tr>
                    <td><strong>${o.name}</strong></td>
                    <td>
                        ${o.address}
                        <br>
                        <a href="https://yandex.ru/maps/?text=${encodeURIComponent(o.address + ', Шымкент')}" 
                           target="_blank"
                           style="font-size:12px; color:var(--primary); text-decoration:none;">
                           <i class="fa-solid fa-route"></i> Маршрут
                        </a>
                    </td>
                    <td><a href="tel:${o.phone}" style="color:inherit;">${o.phone}</a></td>
                    <td style="font-size:13px; max-width:180px;">${o.items || '—'}</td>
                    <td><strong>${Number(o.total).toLocaleString()} ₸</strong></td>
                    <td><span class="badge ${statusClass}">${o.status}</span></td>
                    <td>
                        <select class="status-updater" data-id="${id}" style="padding:4px 8px; border-radius:6px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-size:13px;">
                            <option value="Новая" ${o.status === 'Новая' ? 'selected' : ''}>Новая</option>
                            <option value="Принята" ${o.status === 'Принята' ? 'selected' : ''}>Принята</option>
                            <option value="В пути" ${o.status === 'В пути' ? 'selected' : ''}>В пути</option>
                            <option value="Доставлена" ${o.status === 'Доставлена' ? 'selected' : ''}>Доставлена</option>
                        </select>
                    </td>
                </tr>
            `;
        });

        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="7">Нет активных заявок.</td></tr>`;
        }

        document.querySelectorAll('.status-updater').forEach(select => {
            select.addEventListener('change', async (e) => {
                const orderId = e.target.getAttribute('data-id');
                const newStatus = e.target.value;
                await updateDoc(doc(db, "orders", orderId), { status: newStatus });
                Pages.initDriverPage();
            });
        });
    },

    // ─── 6. ОКБ / АКБ / ПРОДАЖИ — ИТОГИ ДНЯ ──────────────────────────────────
    async dailyReport() {
        const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        return `
            <div style="display:grid; gap:20px; max-width:860px;">
                <div class="card">
                    <h2><i class="fa-solid fa-clipboard-list" style="color:var(--primary); margin-right:8px;"></i>Итоги дня — ${today}</h2>
                    <p style="color:var(--text-muted); margin-bottom:20px;">Торговый вводит данные по обходу района после завершения дня.</p>
                    <form id="daily-report-form">

                        <!-- ПРОДАЖИ -->
                        <div class="report-section">
                            <div class="report-section-title">
                                <i class="fa-solid fa-money-bill-trend-up"></i> Продажи
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Район / Маршрут</label>
                                    <input type="text" id="rp-district" placeholder="Аль-Фараби, Абай..." required>
                                </div>
                                <div class="form-group">
                                    <label>Сумма продаж (₸)</label>
                                    <input type="number" id="rp-sales" placeholder="150000" required>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Количество заказов</label>
                                    <input type="number" id="rp-orders-count" placeholder="12" required>
                                </div>
                                <div class="form-group">
                                    <label>Средний чек (₸)</label>
                                    <input type="number" id="rp-avg-check" placeholder="12500">
                                </div>
                            </div>
                        </div>

                        <!-- АКБ -->
                        <div class="report-section">
                            <div class="report-section-title">
                                <i class="fa-solid fa-users-line"></i> АКБ — Активная клиентская база
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Посещено торговых точек</label>
                                    <input type="number" id="rp-akb-visited" placeholder="18" required>
                                </div>
                                <div class="form-group">
                                    <label>Сделали заказ</label>
                                    <input type="number" id="rp-akb-ordered" placeholder="12" required>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Отказали</label>
                                    <input type="number" id="rp-akb-refused" placeholder="3">
                                </div>
                                <div class="form-group">
                                    <label>Причина отказа (кратко)</label>
                                    <input type="text" id="rp-akb-refuse-reason" placeholder="Нет денег, склад полный...">
                                </div>
                            </div>
                        </div>

                        <!-- ОКБ -->
                        <div class="report-section">
                            <div class="report-section-title">
                                <i class="fa-solid fa-address-book"></i> ОКБ — Общая клиентская база
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Новых точек охвачено</label>
                                    <input type="number" id="rp-okb-new" placeholder="5">
                                </div>
                                <div class="form-group">
                                    <label>Из них заинтересованы</label>
                                    <input type="number" id="rp-okb-interested" placeholder="2">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Новые контакты (имя, адрес, телефон)</label>
                                <textarea id="rp-okb-contacts" rows="3" placeholder="Магазин Алия, ул. Байдибек би 33, +7 701 234 56 78&#10;ТД Нур, проспект Республики 11, +7 777 987 65 43"></textarea>
                            </div>
                        </div>

                        <!-- КОММЕНТАРИЙ -->
                        <div class="form-group">
                            <label><i class="fa-solid fa-comment"></i> Общий комментарий / проблемы дня</label>
                            <textarea id="rp-comment" rows="3" placeholder="Что случилось сегодня, что важно знать руководителю..."></textarea>
                        </div>

                        <div id="daily-report-msg" class="hidden" style="padding:12px; border-radius:8px; margin-bottom:14px; font-size:14px;"></div>
                        <button type="submit" class="btn btn-primary btn-block" id="daily-report-btn">
                            <i class="fa-solid fa-floppy-disk"></i> Сохранить итоги дня
                        </button>
                    </form>
                </div>

                <!-- ИСТОРИЯ ОТЧЁТОВ -->
                <div class="card">
                    <h2><i class="fa-solid fa-clock-rotate-left" style="color:var(--text-muted); margin-right:8px;"></i>Последние отчёты</h2>
                    <div id="daily-reports-history" style="margin-top:16px;">
                        <div class="spinner" style="margin:20px auto;"></div>
                    </div>
                </div>
            </div>
        `;
    },

    async initDailyReport() {
        // Загрузка истории
        await this._loadReportsHistory();

        document.getElementById('daily-report-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('daily-report-btn');
            const msg = document.getElementById('daily-report-msg');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Сохраняю...';

            const reportData = {
                author: AuthModule.currentUser ? AuthModule.currentUser.email : 'unknown',
                district: document.getElementById('rp-district').value,
                sales: Number(document.getElementById('rp-sales').value),
                ordersCount: Number(document.getElementById('rp-orders-count').value),
                avgCheck: Number(document.getElementById('rp-avg-check').value) || 0,
                akbVisited: Number(document.getElementById('rp-akb-visited').value),
                akbOrdered: Number(document.getElementById('rp-akb-ordered').value),
                akbRefused: Number(document.getElementById('rp-akb-refused').value) || 0,
                akbRefuseReason: document.getElementById('rp-akb-refuse-reason').value,
                okbNew: Number(document.getElementById('rp-okb-new').value) || 0,
                okbInterested: Number(document.getElementById('rp-okb-interested').value) || 0,
                okbContacts: document.getElementById('rp-okb-contacts').value,
                comment: document.getElementById('rp-comment').value,
                date: new Date().toISOString(),
                dateDisplay: new Date().toLocaleDateString('ru-RU')
            };

            await addDoc(collection(db, "daily_reports"), reportData);

            msg.style.cssText = 'background:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.3);';
            msg.innerHTML = '<i class="fa-solid fa-check-circle"></i> Отчёт сохранён!';
            msg.classList.remove('hidden');

            document.getElementById('daily-report-form').reset();
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Сохранить итоги дня';

            await this._loadReportsHistory();
        });
    },

    async _loadReportsHistory() {
        const container = document.getElementById('daily-reports-history');
        if (!container) return;

        const snap = await getDocs(collection(db, "daily_reports"));

        if (snap.empty) {
            container.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">Отчётов пока нет.</p>';
            return;
        }

        // Сортируем по дате, новые первые
        const reports = [];
        snap.forEach(d => reports.push({ id: d.id, ...d.data() }));
        reports.sort((a, b) => new Date(b.date) - new Date(a.date));

        container.innerHTML = reports.slice(0, 10).map(r => `
            <div style="border:1px solid var(--border); border-radius:10px; padding:14px 18px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                    <div>
                        <strong>${r.author}</strong>
                        <span style="color:var(--text-muted); font-size:13px; margin-left:8px;">${r.dateDisplay} • ${r.district}</span>
                    </div>
                    <span style="font-size:18px; font-weight:700; color:var(--primary);">${Number(r.sales).toLocaleString()} ₸</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px,1fr)); gap:10px; font-size:13px;">
                    <div class="mini-stat"><div class="mini-stat-val">${r.ordersCount}</div><div class="mini-stat-label">заказов</div></div>
                    <div class="mini-stat"><div class="mini-stat-val">${r.akbVisited}</div><div class="mini-stat-label">точек АКБ</div></div>
                    <div class="mini-stat"><div class="mini-stat-val">${r.akbOrdered}</div><div class="mini-stat-label">оформили заказ</div></div>
                    <div class="mini-stat"><div class="mini-stat-val">${r.okbNew}</div><div class="mini-stat-label">новых ОКБ</div></div>
                </div>
                ${r.comment ? `<div style="margin-top:10px; font-size:13px; color:var(--text-muted); border-top:1px solid var(--border); padding-top:8px;">${r.comment}</div>` : ''}
            </div>
        `).join('');
    },

    // ─── 7. ОТЧЁТЫ ────────────────────────────────────────────────────────────
    async reports() {
        return `
            <div class="card">
                <h2>Аналитические отчёты компании</h2>
                <div class="stats-grid" style="margin-top:20px;">
                    <div class="stat-card" style="border-left:4px solid var(--primary);">
                        <div class="stat-info"><p>Продажи текущий месяц</p><h3>1,420,000 ₸</h3></div>
                    </div>
                    <div class="stat-card" style="border-left:4px solid var(--color-delivered);">
                        <div class="stat-info"><p>Выполнено заявок</p><h3>184 шт</h3></div>
                    </div>
                </div>
                <div style="margin-top:20px;">
                    <h3>Топ клиентов (Шымкент)</h3>
                    <table style="margin-top:10px;">
                        <thead><tr><th>Клиент</th><th>Кол-во заказов</th><th>Сумма (₸)</th></tr></thead>
                        <tbody>
                            <tr><td><strong>ТД Рахмет</strong></td><td>32</td><td>480,000 ₸</td></tr>
                            <tr><td><strong>Минимаркет Алия</strong></td><td>28</td><td>310,000 ₸</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // ─── 8. СОТРУДНИКИ ────────────────────────────────────────────────────────
    async employees() {
        return `
            <div class="card">
                <h2>Управление персоналом CRM</h2>
                <div class="table-responsive" style="margin-top:20px;">
                    <table>
                        <thead>
                            <tr>
                                <th>Имя сотрудника</th><th>Email</th><th>Текущая роль</th><th>Действия</th>
                            </tr>
                        </thead>
                        <tbody id="employees-table-body"></tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async initEmployeesPage() {
        const tbody = document.getElementById('employees-table-body');
        const snap = await getDocs(collection(db, "users"));
        tbody.innerHTML = '';

        snap.forEach(docSnap => {
            const uid = docSnap.id;
            const u = docSnap.data();
            tbody.innerHTML += `
                <tr>
                    <td><strong>${u.name || 'Сотрудник'}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge badge-new">${u.role}</span></td>
                    <td>
                        <select class="role-changer" data-uid="${uid}" style="padding:4px 8px; border-radius:6px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-size:13px;">
                            <option value="Администратор" ${u.role === 'Администратор' ? 'selected' : ''}>Администратор</option>
                            <option value="Руководитель" ${u.role === 'Руководитель' ? 'selected' : ''}>Руководитель</option>
                            <option value="Торговый представитель" ${u.role === 'Торговый представитель' ? 'selected' : ''}>Торговый представитель</option>
                            <option value="Водитель" ${u.role === 'Водитель' ? 'selected' : ''}>Водитель</option>
                        </select>
                    </td>
                </tr>
            `;
        });

        document.querySelectorAll('.role-changer').forEach(select => {
            select.addEventListener('change', async (e) => {
                const userUid = e.target.getAttribute('data-uid');
                const newRole = e.target.value;
                await updateDoc(doc(db, "users", userUid), { role: newRole });
                alert('Роль сотрудника обновлена!');
            });
        });
    }
};
