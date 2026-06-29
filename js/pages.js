import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, updateDoc, addDoc, query, where }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const Pages = {
    // --- ГЛАВНАЯ ПАНЕЛЬ (ЖИВАЯ СТАТИСТИКА) ---
    async dashboard() {
        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-info"><p>Активные заявки за день</p><h3 id="dash-orders">0</h3></div>
                    <div class="stat-icon" style="background:#dbeafe; color:#2563eb;"><i class="fa-solid fa-file-invoice-dollar"></i></div>
                </div>
                <div class="stat-card">
                    <div class="stat-info"><p>Продажи за сегодня</p><h3 id="dash-sales">0 ₸</h3></div>
                    <div class="stat-icon" style="background:#d1fae5; color:#059669;"><i class="fa-solid fa-chart-line"></i></div>
                </div>
                <div class="stat-card">
                    <div class="stat-info"><p>Активные Торговые</p><h3 id="dash-agents">0</h3></div>
                    <div class="stat-icon" style="background:#fef3c7; color:#d97706;"><i class="fa-solid fa-user-tie"></i></div>
                </div>
                <div class="stat-card">
                    <div class="stat-info"><p>Водители на маршрутах</p><h3 id="dash-drivers">0</h3></div>
                    <div class="stat-icon" style="background:#f3e8ff; color:#7c3aed;"><i class="fa-solid fa-truck"></i></div>
                </div>
            </div>
            <div class="card">
                <h2>Оперативная деятельность компании «Пышка»</h2>
                <p style="color:var(--text-muted); margin-top: 10px;">CRM-система запущена в режиме реального времени. Все операции синхронизируются с филиалом в г. Шымкент.</p>
            </div>
        `;
    },

    async initDashboard() {
        try {
            const ordersSnap = await getDocs(collection(db, "orders"));
            const usersSnap = await getDocs(collection(db, "users"));

            let dailyOrdersCount = 0;
            let dailySalesVolume = 0;
            ordersSnap.forEach(d => {
                const data = d.data();
                dailyOrdersCount++;
                dailySalesVolume += Number(data.total || 0);
            });

            let agentsCount = 0;
            let driversCount = 0;
            usersSnap.forEach(d => {
                const u = d.data();
                if (u.role === 'Торговый представитель') agentsCount++;
                if (u.role === 'Водитель') driversCount++;
            });

            const elOrders = document.getElementById('dash-orders');
            const elSales = document.getElementById('dash-sales');
            const elAgents = document.getElementById('dash-agents');
            const elDrivers = document.getElementById('dash-drivers');

            if (elOrders) elOrders.innerText = dailyOrdersCount;
            if (elSales) elSales.innerText = dailySalesVolume.toLocaleString() + ' ₸';
            if (elAgents) elAgents.innerText = agentsCount;
            if (elDrivers) elDrivers.innerText = driversCount;
        } catch (e) {
            console.error("Ошибка дашборда:", e);
        }
    },

    // --- УЧЁТ КЛИЕНТСКИХ БАЗ (АКБ / ОКБ) ---
    async clients(type) {
        return `
            <div class="card">
                <h2>${type === 'akb' ? 'Активная клиентская база (АКБ)' : 'Общая клиентская база (ОКБ)'}</h2>
                <p style="color:var(--text-muted); margin-bottom:20px;">Список торговых точек, закрепленных в системе.</p>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Название магазина</th>
                                <th>ИП</th>
                                <th>Адрес</th>
                                <th>Телефон владельца</th>
                                <th>Статус</th>
                            </tr>
                        </thead>
                        <tbody id="clients-table-body">
                            <tr><td colspan="5">Загрузка данных из Firestore...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async initClients(type) {
        const tbody = document.getElementById('clients-table-body');
        if (!tbody) return;
        try {
            const snap = await getDocs(collection(db, "clients"));
            tbody.innerHTML = '';

            let hasContent = false;
            snap.forEach(docSnap => {
                const c = docSnap.data();
                if (type === 'akb' && c.status !== 'Активен') return;
                hasContent = true;

                tbody.innerHTML += `
                    <tr>
                        <td><strong>${c.name}</strong></td>
                        <td>${c.ip || '—'}</td>
                        <td>${c.address || '—'}</td>
                        <td>${c.phone || '—'}</td>
                        <td><span class="badge ${c.status === 'Активен' ? 'badge-delivered' : 'badge-accepted'}">${c.status}</span></td>
                    </tr>
                `;
            });

            if (!hasContent) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">База данных пуста.</td></tr>`;
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Ошибка загрузки базы клиентов.</td></tr>`;
        }
    },


    async createOrder() {
        return `
            <div class="card" style="max-width: 680px; margin: 0 auto;">
                <h2><i class="fa-solid fa-square-plus" style="color:var(--primary);"></i> Оформление новой заявки</h2>

                <!-- ШАГ 1: Выбор магазина -->
                <div id="step-select-shop" style="margin-top:20px;">
                    <label style="font-weight:600; font-size:1rem;">Выберите магазин из вашей базы:</label>
                    <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
                        <select id="shop-selector" style="flex:1; padding:10px 14px; border-radius:8px; border:1.5px solid var(--border); font-size:0.97rem; background:var(--surface); color:var(--text);">
                            <option value="">⏳ Загрузка ваших магазинов...</option>
                        </select>
                        <button id="btn-new-shop" style="padding:10px 18px; background:var(--primary); color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; white-space:nowrap;">
                            <i class="fa-solid fa-plus"></i> Новый магазин
                        </button>
                    </div>
                    <p id="shop-hint" style="font-size:0.85rem; color:var(--text-muted); margin-top:8px;">
                        <i class="fa-solid fa-circle-info"></i> Выберите магазин — данные заполнятся автоматически
                    </p>
                </div>

                <hr style="margin:20px 0; border-color:var(--border);">

                <!-- ФОРМА ЗАЯВКИ -->
                <form id="order-form" style="margin-top:4px;">

                    <!-- Блок данных магазина (автозаполнение) -->
                    <div id="shop-info-block" style="background:var(--surface); border:1.5px solid var(--border); border-radius:10px; padding:16px; margin-bottom:18px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <span style="font-weight:700; color:var(--primary);"><i class="fa-solid fa-store"></i> Данные торговой точки</span>
                            <span id="shop-badge" style="display:none; background:#dbeafe; color:#2563eb; padding:3px 10px; border-radius:20px; font-size:0.8rem; font-weight:600;">Автозаполнение ✓</span>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                            <div class="form-group" style="margin:0;">
                                <label>Название магазина</label>
                                <input type="text" id="ord-name" required placeholder="Магазин 'Arman'">
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label>ИП владельца</label>
                                <input type="text" id="ord-ip" required placeholder="ИП Смаилов">
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label>Адрес</label>
                                <input type="text" id="ord-address" required placeholder="ул. Рыскулова, дом 45">
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label>Телефон владельца</label>
                                <input type="text" id="ord-phone" required placeholder="+7 (701) 555-4433">
                            </div>
                        </div>
                    </div>

                    <!-- Заказ -->
                    <div class="form-group">
                        <label><i class="fa-solid fa-bread-slice" style="color:var(--primary);"></i> Список изделий</label>
                        <textarea id="ord-items" rows="3" required placeholder="Пышки — 100 шт, Булки — 50 шт, Батон — 30 шт"></textarea>
                    </div>
                    <div class="form-group">
                        <label><i class="fa-solid fa-tenge-sign" style="color:var(--primary);"></i> Сумма заказа (₸)</label>
                        <input type="number" id="ord-total" required placeholder="25000" style="font-size:1.1rem; font-weight:600;">
                    </div>

                    <!-- Карта -->
                    <div class="form-group">
                        <label style="font-weight:600;">
                            <i class="fa-solid fa-map-pin" style="color:var(--primary);"></i>
                            Расположение магазина <span style="color:var(--text-muted); font-weight:400;">(кликните по карте)</span>
                        </label>
                        <div id="picker-map" style="height:260px; width:100%; border-radius:10px; margin-top:6px; border:1.5px solid var(--border); z-index:1;"></div>
                        <p id="coords-hint" style="font-size:0.83rem; color:var(--text-muted); margin-top:5px;">
                            <i class="fa-solid fa-location-dot"></i> Координаты: <span id="coords-display">42.3174, 69.5901</span>
                        </p>
                    </div>

                    <input type="hidden" id="ord-lat" value="42.3174">
                    <input type="hidden" id="ord-lng" value="69.5901">
                    <input type="hidden" id="ord-shop-id" value="">

                    <div class="form-group">
                        <label>Комментарий для водителя</label>
                        <textarea id="ord-comment" rows="2" placeholder="Доставка строго до 09:00 утра, позвонить заранее"></textarea>
                    </div>

                    <button type="submit" class="btn btn-primary btn-block" style="padding:14px; font-size:1.05rem; font-weight:700;">
                        <i class="fa-solid fa-paper-plane"></i> Сохранить и передать на доставку
                    </button>
                </form>
            </div>

            <!-- МОДАЛКА: Добавить новый магазин -->
            <div id="modal-new-shop" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
                <div style="background:var(--surface); border-radius:14px; padding:28px; width:90%; max-width:460px; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                    <h3 style="margin-bottom:18px;"><i class="fa-solid fa-store" style="color:var(--primary);"></i> Добавить новый магазин</h3>
                    <div class="form-group">
                        <label>Название магазина *</label>
                        <input type="text" id="new-shop-name" placeholder="Магазин 'Бахыт'" required>
                    </div>
                    <div class="form-group">
                        <label>ИП владельца *</label>
                        <input type="text" id="new-shop-ip" placeholder="ИП Жуманов А.Б." required>
                    </div>
                    <div class="form-group">
                        <label>Адрес *</label>
                        <input type="text" id="new-shop-address" placeholder="пр. Республики, д. 12" required>
                    </div>
                    <div class="form-group">
                        <label>Телефон *</label>
                        <input type="text" id="new-shop-phone" placeholder="+7 (700) 123-4567" required>
                    </div>
                    <div style="display:flex; gap:10px; margin-top:8px;">
                        <button id="btn-save-new-shop" style="flex:1; padding:11px; background:var(--primary); color:#fff; border:none; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.97rem;">
                            <i class="fa-solid fa-floppy-disk"></i> Сохранить магазин
                        </button>
                        <button id="btn-cancel-modal" style="padding:11px 18px; background:var(--border); color:var(--text); border:none; border-radius:8px; cursor:pointer; font-weight:600;">
                            Отмена
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    async initCreateOrder() {
        // --- КАРТА ---
        const pickerContainer = document.getElementById('picker-map');
        if (!pickerContainer) return;

        const pickerMap = L.map('picker-map').setView([42.3174, 69.5901], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OSM'
        }).addTo(pickerMap);

        let currentMarker = L.marker([42.3174, 69.5901]).addTo(pickerMap);
        const coordsDisplay = document.getElementById('coords-display');

        pickerMap.on('click', (e) => {
            const { lat, lng } = e.latlng;
            currentMarker.setLatLng([lat, lng]);
            document.getElementById('ord-lat').value = lat.toFixed(6);
            document.getElementById('ord-lng').value = lng.toFixed(6);
            if (coordsDisplay) coordsDisplay.innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        });

        // --- ЗАГРУЗКА МАГАЗИНОВ ТОРГОВОГО ---
        const selector = document.getElementById('shop-selector');
        const agentEmail = auth.currentUser ? auth.currentUser.email : null;
        let myShops = []; // кеш магазинов

        async function loadMyShops() {
            if (!agentEmail) {
                selector.innerHTML = '<option value="">Ошибка: пользователь не определён</option>';
                return;
            }
            try {
                // Берём все магазины закреплённые за этим торговым
                const q = query(
                    collection(db, "salesRepShops"),
                    where("agentEmail", "==", agentEmail)
                );
                const snap = await getDocs(q);
                myShops = [];
                snap.forEach(d => myShops.push({ id: d.id, ...d.data() }));

                selector.innerHTML = '<option value="">— Выберите магазин —</option>';
                myShops.forEach(shop => {
                    selector.innerHTML += `<option value="${shop.id}">${shop.name} (${shop.ip})</option>`;
                });

                if (myShops.length === 0) {
                    selector.innerHTML = '<option value="">У вас пока нет магазинов — добавьте первый</option>';
                }
            } catch (e) {
                selector.innerHTML = '<option value="">Ошибка загрузки магазинов</option>';
                console.error(e);
            }
        }

        await loadMyShops();

        // --- АВТОЗАПОЛНЕНИЕ при выборе магазина ---
        selector.addEventListener('change', () => {
            const shopId = selector.value;
            const badge = document.getElementById('shop-badge');
            document.getElementById('ord-shop-id').value = shopId;

            if (!shopId) {
                // Очищаем поля
                ['ord-name','ord-ip','ord-address','ord-phone'].forEach(id => {
                    document.getElementById(id).value = '';
                    document.getElementById(id).removeAttribute('readonly');
                });
                if (badge) badge.style.display = 'none';
                return;
            }

            const shop = myShops.find(s => s.id === shopId);
            if (!shop) return;

            // Автозаполняем и блокируем поля (чтобы не путались)
            document.getElementById('ord-name').value    = shop.name    || '';
            document.getElementById('ord-ip').value      = shop.ip      || '';
            document.getElementById('ord-address').value = shop.address  || '';
            document.getElementById('ord-phone').value   = shop.phone   || '';

            // Ставим маркер на карте если есть координаты
            if (shop.lat && shop.lng) {
                currentMarker.setLatLng([shop.lat, shop.lng]);
                pickerMap.setView([shop.lat, shop.lng], 15);
                document.getElementById('ord-lat').value = shop.lat;
                document.getElementById('ord-lng').value = shop.lng;
                if (coordsDisplay) coordsDisplay.innerText = `${Number(shop.lat).toFixed(4)}, ${Number(shop.lng).toFixed(4)}`;
            }

            if (badge) badge.style.display = 'inline';
        });

        // --- МОДАЛКА: Добавить новый магазин ---
        const modal = document.getElementById('modal-new-shop');

        document.getElementById('btn-new-shop').addEventListener('click', () => {
            modal.style.display = 'flex';
        });
        document.getElementById('btn-cancel-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        // Закрыть по клику вне модалки
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });

        document.getElementById('btn-save-new-shop').addEventListener('click', async () => {
            const name    = document.getElementById('new-shop-name').value.trim();
            const ip      = document.getElementById('new-shop-ip').value.trim();
            const address = document.getElementById('new-shop-address').value.trim();
            const phone   = document.getElementById('new-shop-phone').value.trim();

            if (!name || !ip || !address || !phone) {
                alert('Заполните все поля магазина!');
                return;
            }

            try {
                const btn = document.getElementById('btn-save-new-shop');
                btn.innerText = 'Сохраняю...';
                btn.disabled = true;

                const newShop = {
                    name, ip, address, phone,
                    agentEmail: agentEmail,
                    lat: 42.3174,
                    lng: 69.5901,
                    createdAt: new Date().toISOString()
                };

                const docRef = await addDoc(collection(db, "salesRepShops"), newShop);

                // Добавляем в локальный кеш и в селектор
                myShops.push({ id: docRef.id, ...newShop });
                const opt = document.createElement('option');
                opt.value = docRef.id;
                opt.text = `${name} (${ip})`;
                selector.appendChild(opt);
                selector.value = docRef.id;
                selector.dispatchEvent(new Event('change')); // автозаполняем форму

                modal.style.display = 'none';

                // Очищаем поля модалки
                ['new-shop-name','new-shop-ip','new-shop-address','new-shop-phone']
                    .forEach(id => document.getElementById(id).value = '');

                btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Сохранить магазин';
                btn.disabled = false;

            } catch (err) {
                alert('Ошибка при сохранении магазина: ' + err.message);
                document.getElementById('btn-save-new-shop').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Сохранить магазин';
                document.getElementById('btn-save-new-shop').disabled = false;
            }
        });

        // --- ОТПРАВКА ЗАЯВКИ ---
        const form = document.getElementById('order-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name    = document.getElementById('ord-name').value.trim();
            const ip      = document.getElementById('ord-ip').value.trim();
            const address = document.getElementById('ord-address').value.trim();
            const phone   = document.getElementById('ord-phone').value.trim();
            const items   = document.getElementById('ord-items').value.trim();
            const total   = Number(document.getElementById('ord-total').value);
            const lat     = Number(document.getElementById('ord-lat').value);
            const lng     = Number(document.getElementById('ord-lng').value);
            const comment = document.getElementById('ord-comment').value.trim();
            const shopId  = document.getElementById('ord-shop-id').value;

            const submitBtn = form.querySelector('[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Сохраняю...';

            try {
                // Сохраняем заявку
                await addDoc(collection(db, "orders"), {
                    name, ip, address, phone, items, total, lat, lng, comment,
                    shopId: shopId || null,
                    status: 'Новая',
                    agentEmail: auth.currentUser ? auth.currentUser.email : 'Система',
                    createdAt: new Date().toISOString()
                });

                // Обновляем координаты магазина если их не было
                if (shopId) {
                    const shop = myShops.find(s => s.id === shopId);
                    if (shop && (!shop.lat || shop.lat === 42.3174)) {
                        try {
                            await updateDoc(doc(db, "salesRepShops", shopId), { lat, lng });
                        } catch (_) {}
                    }
                }

                // Также добавляем в clients (для АКБ/ОКБ) если нет дубля
                const clientsSnap = await getDocs(query(
                    collection(db, "clients"),
                    where("ip", "==", ip)
                ));
                if (clientsSnap.empty) {
                    await addDoc(collection(db, "clients"), {
                        name, ip, address, phone, status: 'Активен'
                    });
                }

                alert('✅ Заявка успешно создана и передана на доставку!');
                form.reset();
                selector.value = '';
                document.getElementById('shop-badge').style.display = 'none';
                currentMarker.setLatLng([42.3174, 69.5901]);
                pickerMap.setView([42.3174, 69.5901], 13);
                if (coordsDisplay) coordsDisplay.innerText = '42.3174, 69.5901';

            } catch (err) {
                alert('Ошибка сохранения: ' + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Сохранить и передать на доставку';
            }
        });
    },
    // --- КАРТА ЛОГИСТИКИ С АВТО-СТАТУСАМИ ДЛЯ ВОДИТЕЛЯ ---
    // --- КАРТА ЛОГИСТИКИ С АВТО-СТАТУСАМИ ДЛЯ ВОДИТЕЛЯ ---
    async map() {
        return `
            <div class="card">
                <h2>Умный навигатор водителя</h2>
                <p style="color:var(--text-muted); margin-bottom:15px;">
                    <i class="fa-solid fa-location-arrow" style="color:var(--primary);"></i> 
                    Выберите магазин на карте и нажмите «Поехать сюда», чтобы открыть маршрут.
                </p>
                
                <div id="driver-actions-panel" class="hidden" style="margin-bottom: 15px; padding: 15px; background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #0369a1; font-weight: 600;">
                        <i class="fa-solid fa-truck-moving fa-bounce"></i> Вы находитесь на маршруте
                    </span>
                    <button id="btn-complete-delivery" style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
                        <i class="fa-solid fa-square-check"></i> Завершить доставку
                    </button>
                </div>

                <div id="leaflet-map" style="height: 550px; width: 100%; border-radius: 8px; z-index: 1;"></div>
            </div>
        `;
    },

    async initMapPage() {
        const mapContainer = document.getElementById('leaflet-map');
        if (!mapContainer) return;

        // Центр Шымкента
        const map = L.map('leaflet-map').setView([42.3174, 69.5901], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        let userCoords = null;
        let routingControl = null;
        let activeOrderId = null; // ID заказа, к которому едем
        itineraryClassName: 'hidden'

        const driverIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });

        // Запрашиваем геопозицию водителя
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    userCoords = [pos.coords.latitude, pos.coords.longitude];
                    map.setView(userCoords, 14);
                    L.marker(userCoords, { icon: driverIcon }).addTo(map).bindPopup('<b>Вы здесь</b>').openPopup();
                },
                (err) => { console.warn("GPS отключен или недоступен."); },
                { enableHighAccuracy: true }
            );
        }

        try {
            const snap = await getDocs(collection(db, "orders"));
            
            snap.forEach(docSnap => {
                const order = docSnap.data();
                const id = docSnap.id;
                
                // Выводим только не доставленные заказы
                if (order.lat && order.lng && order.status !== 'Доставлено') {
                    
                    const popupContent = `
                        <div style="font-family: sans-serif; line-height: 1.4; min-width: 190px;">
                            <strong style="color:#6366f1; font-size:1.1rem;">${order.name}</strong><br>
                            <b>Адрес:</b> ${order.address}<br>
                            <b>Сумма:</b> ${Number(order.total || 0).toLocaleString()} ₸<br>
                            <b>Статус:</b> ${order.status}<br><br>
                            
                            <button class="btn-route-start" data-id="${id}" data-lat="${order.lat}" data-lng="${order.lng}" 
                                style="background:#6366f1; color:white; border:none; padding:8px 10px; border-radius:4px; width:100%; cursor:pointer; font-weight:bold;">
                                <i class="fa-solid fa-route"></i> Поехать сюда
                            </button>
                        </div>
                    `;

                    L.marker([order.lat, order.lng]).addTo(map).bindPopup(popupContent);
                }
            });

            // Ловим клик по кнопке "Поехать сюда" внутри балуна
            map.on('popupopen', () => {
                const btnStart = document.querySelector('.btn-route-start');
                if (btnStart) {
                    btnStart.onclick = async () => {
                        const targetLat = parseFloat(btnStart.getAttribute('data-lat'));
                        const targetLng = parseFloat(btnStart.getAttribute('data-lng'));
                        const orderId = btnStart.getAttribute('data-id');

                        if (!userCoords) {
                            alert("Включите GPS на телефоне, чтобы построить маршрут от вас!");
                            return;
                        }

                        activeOrderId = orderId;

                        // 1. Меняем статус в Firebase на "В пути"
                        await updateDoc(doc(db, "orders", activeOrderId), { status: 'В пути' });

                        // 2. Строим линию маршрута на карте по дорогам
                        if (routingControl) map.removeControl(routingControl);
                        
// Очищаем старые маршруты и линии перед созданием нового
                        if (routingControl) map.removeControl(routingControl);
                        if (backupLine) map.removeLayer(backupLine);

                        // Строим маршрут без лишнего текста на экране телефона
                        routingControl = L.Routing.control({
                            waypoints: [L.latLng(userCoords[0], userCoords[1]), L.latLng(targetLat, targetLng)],
                            lineOptions: { styles: [{ color: '#6366f1', weight: 6, opacity: 0.8 }] },
                            router: L.Routing.osrmv1({ 
                                serviceUrl: 'https://routing.openstreetmap.de/routed-car/route/v1',
                                profile: 'driving'
                            }),
                            show: false,
                            addWaypoints: false,
                            itineraryClassName: 'hidden', // Маскируем прозрачный блок
                            language: 'ru'
                        }).addTo(map);
                        map.closePopup();

                        // 3. Показываем верхнюю панель с кнопкой завершения
                        const panel = document.getElementById('driver-actions-panel');
                        if (panel) panel.classList.remove('hidden');
                    };
                }
            });

            // 4. Клик по кнопке "Завершить доставку"
// Клик по кнопке "Завершить доставку"
            const btnComplete = document.getElementById('btn-complete-delivery');
            if (btnComplete) {
                btnComplete.onclick = async () => {
                    if (!activeOrderId) return;
                    if (confirm("Доставка завершена? Перевести статус в «Доставлено»?")) {
                        try {
                            // Меняем статус в Firebase
                            await updateDoc(doc(db, "orders", activeOrderId), { status: 'Доставлено' });
                            alert("Заказ выполнен!");
                            if (routingControl) map.removeControl(routingControl);
                            if (backupLine) map.removeLayer(backupLine);
                        
                            const panel = document.getElementById('driver-actions-panel');
                            if (panel) panel.classList.add('hidden');

                            activeOrderId = null;
                            
                            // Перерисовываем карту (метка исчезнет)
                            map.off();
                            map.remove();
                            Pages.initMapPage();

                        } catch (err) {
                            console.error("Ошибка обновления статуса:", err);
                        }
                    }
                };
            }

        } catch (e) {
            console.error("Ошибка:", e);
        }
    },

    // --- ЖУРНАЛ ВСЕХ ЗАЯВОК ДЛЯ БУХГАЛТЕРА, РУКОВОДИТЕЛЯ И АДМИНА ---
    async allOrders() {
        return `
            <div class="card">
                <h2>Финансовый журнал заявок</h2>
                <p style="color:var(--text-muted); margin-bottom: 20px;">Контроль входящих заказов, сумм и кассовых поступлений.</p>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Магазин / Торговая точка</th>
                                <th>Товары</th>
                                <th>Торговый представитель</th>
                                <th>Сумма</th>
                                <th>Статус</th>
                            </tr>
                        </thead>
                        <tbody id="all-orders-table-body">
                            <tr><td colspan="6">Загрузка данных...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async initAllOrdersPage() {
        const tbody = document.getElementById('all-orders-table-body');
        if (!tbody) return;

        try {
            tbody.innerHTML = '<tr><td colspan="6">Загрузка данных из базы...</td></tr>';
            
            const snap = await getDocs(collection(db, "orders"));
            tbody.innerHTML = '';

            if (!snap || snap.empty) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Заявки отсутствуют.</td></tr>`;
                return;
            }

            const sortedDocs = snap.docs.sort((a, b) => {
                const dateA = a.data().createdAt ? new Date(a.data().createdAt) : 0;
                const dateB = b.data().createdAt ? new Date(b.data().createdAt) : 0;
                return dateB - dateA;
            });

            sortedDocs.forEach(docSnap => {
                const o = docSnap.data();
                const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('ru-RU') : '—';
                const totalSum = o.total ? Number(o.total).toLocaleString() : '0';
                
                let badgeClass = 'badge-new';
                if (o.status === 'Принята') badgeClass = 'badge-accepted';
                if (o.status === 'В пути') badgeClass = 'badge-intransit';
                if (o.status === 'Доставлена') badgeClass = 'badge-delivered';

                tbody.innerHTML += `
                    <tr>
                        <td>${date}</td>
                        <td><strong>${o.name || 'Без названия'}</strong><br><small>${o.ip || 'ИП'}</small></td>
                        <td><span style="font-size:0.9rem; color:var(--text-muted);">${o.items || '—'}</span></td>
                        <td>${o.agentEmail || '—'}</td>
                        <td><strong style="color:var(--primary);">${totalSum} ₸</strong></td>
                        <td><span class="badge ${badgeClass}">${o.status || 'Новая'}</span></td>
                    </tr>
                `;
            });
        } catch (error) {
            console.error("Критическая ошибка в журнале заявок:", error);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444; font-weight:600; padding: 20px;">
                Ошибка доступа к данным.<br>
                <small style="color: gray; font-weight: normal;">Код ошибки: ${error.code || error.message}</small><br>
                <span style="font-size: 0.85rem; color: var(--text-muted);">Убедитесь, что у роли Бухгалтер есть доступ в правилах Firestore.</span>
            </td></tr>`;
        }
    },

    // --- МОДУЛЬ ДЛЯ ВОДИТЕЛЕЙ ---
    async driver() {
        return `
            <div class="card">
                <h2>Ваш текущий путевой лист заказов</h2>
                <p style="color:var(--text-muted); margin-bottom: 20px;">Меняйте статус заказа по мере продвижения по маршруту.</p>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Магазин</th>
                                <th>Адрес доставки</th>
                                <th>Телефон</th>
                                <th>Сумма заказа</th>
                                <th>Текущий статус</th>
                                <th>Изменить статус</th>
                            </tr>
                        </thead>
                        <tbody id="driver-table-body">
                            <tr><td colspan="6">Загрузка ваших путевых листов...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async initDriverPage() {
        const tbody = document.getElementById('driver-table-body');
        if (!tbody) return;
        try {
            const snap = await getDocs(collection(db, "orders"));
            tbody.innerHTML = '';

            if (snap.empty) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Назначенных заявок на сегодня нет.</td></tr>`;
                return;
            }

            snap.forEach(docSnap => {
                const id = docSnap.id;
                const o = docSnap.data();
                
                let badgeClass = 'badge-new';
                if (o.status === 'Принята') badgeClass = 'badge-accepted';
                if (o.status === 'В пути') badgeClass = 'badge-intransit';
                if (o.status === 'Доставлена') badgeClass = 'badge-delivered';

                tbody.innerHTML += `
                    <tr>
                        <td><strong>${o.name}</strong><br><small>${o.ip || 'ИП'}</small></td>
                        <td>${o.address || '—'}</td>
                        <td><a href="tel:${o.phone}">${o.phone || '—'}</a></td>
                        <td><strong>${o.total ? Number(o.total).toLocaleString() : 0} ₸</strong></td>
                        <td><span class="badge ${badgeClass}">${o.status}</span></td>
                        <td>
                            <select class="status-select" data-id="${id}" style="padding:6px; border-radius:6px; border:1px solid var(--border);">
                                <option value="Новая" ${o.status === 'Новая' ? 'selected' : ''}>Новая</option>
                                <option value="Принята" ${o.status === 'Принята' ? 'selected' : ''}>Принята</option>
                                <option value="В пути" ${o.status === 'В пути' ? 'selected' : ''}>В пути</option>
                                <option value="Доставлена" ${o.status === 'Доставлена' ? 'selected' : ''}>Доставлена</option>
                            </select>
                        </td>
                    </tr>
                `;
            });

            document.querySelectorAll('.status-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const orderId = e.target.getAttribute('data-id');
                    const updatedStatus = e.target.value;
                    try {
                        await updateDoc(doc(db, "orders", orderId), { status: updatedStatus });
                        alert('Статус изменен!');
                        Pages.initDriverPage();
                    } catch (err) {
                        alert("Не удалось обновить статус: " + err.message);
                    }
                });
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Ошибка загрузки путевых листов.</td></tr>`;
        }
    },

    // --- ОТЧЁТЫ И АНАЛИТИКА ---
    async reports() {
        return `
            <div class="card">
                <h2>Генератор аналитических отчётов</h2>
                <div class="table-responsive" style="margin-top:20px;">
                    <h3>Сводные показатели продаж по Торговым Представителям</h3>
                    <table style="margin-top:10px; margin-bottom:30px;">
                        <thead>
                            <tr>
                                <th>Торговый представитель (Email)</th>
                                <th>Количество оформленных заявок</th>
                                <th>Общий оборот компании (₸)</th>
                            </tr>
                        </thead>
                        <tbody id="reports-agents-body"></tbody>
                    </table>

                    <h3>Рейтинг лучших клиентов (по объёму выручки)</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Название торговой точки</th>
                                <th>Адрес</th>
                                <th>Сумма выкупленного товара</th>
                            </tr>
                        </thead>
                        <tbody id="reports-clients-body"></tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async initReportsPage() {
        const agentsTbody = document.getElementById('reports-agents-body');
        const clientsTbody = document.getElementById('reports-clients-body');
        if (!agentsTbody || !clientsTbody) return;

        try {
            const snap = await getDocs(collection(db, "orders"));
            const agentMap = {};
            const clientMap = {};

            snap.forEach(docSnap => {
                const o = docSnap.data();
                const agent = o.agentEmail || 'Не указан';
                if (!agentMap[agent]) agentMap[agent] = { count: 0, total: 0 };
                agentMap[agent].count++;
                agentMap[agent].total += Number(o.total || 0);

                const client = o.name || 'Неизвестный магазин';
                if (!clientMap[client]) clientMap[client] = { address: o.address || '—', total: 0 };
                clientMap[client].total += Number(o.total || 0);
            });

            agentsTbody.innerHTML = '';
            for (const key in agentMap) {
                agentsTbody.innerHTML += `
                    <tr>
                        <td><strong>${key}</strong></td>
                        <td>${agentMap[key].count} шт</td>
                        <td>${agentMap[key].total.toLocaleString()} ₸</td>
                    </tr>
                `;
            }

            const sortedClients = Object.entries(clientMap).sort((a,b) => b[1].total - a[1].total);
            clientsTbody.innerHTML = '';
            sortedClients.forEach(([name, data]) => {
                clientsTbody.innerHTML += `
                    <tr>
                        <td><strong>${name}</strong></td>
                        <td>${data.address}</td>
                        <td><span style="color:#059669; font-weight:600;">${data.total.toLocaleString()} ₸</span></td>
                    </tr>
                `;
            });
        } catch (e) {
            console.error("Ошибка отчетов:", e);
        }
    },

    // --- УПРАВЛЕНИЕ СОТРУДНИКАМИ ---
    async employees() {
        return `
            <div class="card">
                <h2>Сотрудники и доступы к CRM</h2>
                <p style="color:var(--text-muted); margin-bottom: 20px;">Изменяйте внутренние роли или удаляйте учетные записи уволенных сотрудников.</p>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>ФИО Сотрудника</th>
                                <th>Email в системе</th>
                                <th>Текущая роль</th>
                                <th>Изменить роль</th>
                                <th>Удалить из CRM</th>
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
        if (!tbody) return;
        try {
            const snap = await getDocs(collection(db, "users"));
            tbody.innerHTML = '';

            snap.forEach(docSnap => {
                const uid = docSnap.id;
                const u = docSnap.data();

                tbody.innerHTML += `
                    <tr>
                        <td><strong>${u.name || 'Не заполнено'}</strong></td>
                        <td>${u.email}</td>
                        <td><span class="badge badge-intransit">${u.role}</span></td>
                        <td>
                            <select class="role-changer-select" data-uid="${uid}" style="padding:6px; border-radius:6px;">
                                <option value="Торговый представитель" ${u.role === 'Торговый представитель' ? 'selected' : ''}>Торговый представитель</option>
                                <option value="Водитель" ${u.role === 'Водитель' ? 'selected' : ''}>Водитель</option>
                                <option value="Бухгалтер" ${u.role === 'Бухгалтер' ? 'selected' : ''}>Бухгалтер</option>
                                <option value="Руководитель" ${u.role === 'Руководитель' ? 'selected' : ''}>Руководитель</option>
                                <option value="Администратор" ${u.role === 'Администратор' ? 'selected' : ''}>Администратор</option>
                            </select>
                        </td>
                        <td>
                            <button class="btn-delete-user" data-uid="${uid}" style="background:#ef4444; color:white; padding:6px 12px; border-radius:6px; border:none; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></button>
                        </td>
                    </tr>
                `;
            });

            document.querySelectorAll('.role-changer-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const uid = e.target.getAttribute('data-uid');
                    const nextRole = e.target.value;
                    try {
                        await updateDoc(doc(db, "users", uid), { role: nextRole });
                        alert('Права доступа изменены!');
                        Pages.initEmployeesPage();
                    } catch (err) {
                        alert("Ошибка смены роли: " + err.message);
                    }
                });
            });

            document.querySelectorAll('.btn-delete-user').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Удалить сотрудника?')) {
                        const uid = btn.closest('button').getAttribute('data-uid');
                        try {
                            await deleteDoc(doc(db, "users", uid));
                            alert('Сотрудник удален.');
                            Pages.initEmployeesPage();
                        } catch (err) {
                            alert("Ошибка удаления: " + err.message);
                        }
                    }
                });
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Ошибка загрузки списка сотрудников.</td></tr>`;
        }
    }
};
