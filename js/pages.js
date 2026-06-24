import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

    // --- СОЗДАНИЕ ЗАЯВОК ТОРГОВЫМ ПРЕДСТАВИТЕЛЕМ (КЛИК ПО КАРТЕ) ---
    async createOrder() {
        return `
            <div class="card" style="max-width: 650px; margin: 0 auto;">
                <h2>Оформление новой заявки на поставку</h2>
                <form id="order-form" style="margin-top:20px;">
                    <div class="form-group">
                        <label>Название магазина</label>
                        <input type="text" id="ord-name" required placeholder="Магазин 'Arman'">
                    </div>
                    <div class="form-group">
                        <label>ИП владельца</label>
                        <input type="text" id="ord-ip" required placeholder="ИП Смаилов">
                    </div>
                    <div class="form-group">
                        <label>Точный адрес в г. Шымкент</label>
                        <input type="text" id="ord-address" required placeholder="ул. Рыскулова, дом 45">
                    </div>
                    <div class="form-group">
                        <label>Телефон владельца</label>
                        <input type="text" id="ord-phone" required placeholder="+7 (701) 555-4433">
                    </div>
                    <div class="form-group">
                        <label>Список хлебобулочных изделий</label>
                        <textarea id="ord-items" rows="3" required placeholder="Пышки — 100 шт, Булки — 50 шт"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Общая сумма заказа (₸)</label>
                        <input type="number" id="ord-total" required placeholder="25000">
                    </div>
                    
                    <div class="form-group">
                        <label style="color: var(--primary); font-weight: bold;">Укажите расположение магазина на карте (Просто кликните):</label>
                        <div id="picker-map" style="height: 250px; width: 100%; border-radius: 8px; margin-top: 5px; border: 1px solid var(--border); z-index: 1;"></div>
                    </div>

                    <input type="hidden" id="ord-lat" value="42.3174">
                    <input type="hidden" id="ord-lng" value="69.5901">

                    <div class="form-group">
                        <label>Комментарий для логиста/водителя</label>
                        <textarea id="ord-comment" rows="2" placeholder="Доставка строго до 09:00 утра"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Сохранить и передать на доставку</button>
                </form>
            </div>
        `;
    },

    async initCreateOrder() {
        const pickerContainer = document.getElementById('picker-map');
        if (!pickerContainer) return;

        const pickerMap = L.map('picker-map').setView([42.3174, 69.5901], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OSM'
        }).addTo(pickerMap);

        let currentMarker = L.marker([42.3174, 69.5901]).addTo(pickerMap);

        pickerMap.on('click', (e) => {
            const { lat, lng } = e.latlng;
            currentMarker.setLatLng([lat, lng]);
            document.getElementById('ord-lat').value = lat;
            document.getElementById('ord-lng').value = lng;
        });

        const form = document.getElementById('order-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('ord-name').value;
            const ip = document.getElementById('ord-ip').value;
            const address = document.getElementById('ord-address').value;
            const phone = document.getElementById('ord-phone').value;
            const items = document.getElementById('ord-items').value;
            const total = Number(document.getElementById('ord-total').value);
            const lat = Number(document.getElementById('ord-lat').value);
            const lng = Number(document.getElementById('ord-lng').value);
            const comment = document.getElementById('ord-comment').value;

            try {
                await addDoc(collection(db, "orders"), {
                    name, ip, address, phone, items, total, lat, lng, comment,
                    status: 'Новая',
                    agentEmail: auth.currentUser ? auth.currentUser.email : 'Система',
                    createdAt: new Date().toISOString()
                });

                await addDoc(collection(db, "clients"), {
                    name, ip, address, phone,
                    status: 'Активен'
                });

                alert('Заявка успешно создана!');
                form.reset();
                
                currentMarker.setLatLng([42.3174, 69.5901]);
                pickerMap.setView([42.3174, 69.5901], 12);
            } catch (err) {
                alert('Ошибка сохранения: ' + err.message);
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
