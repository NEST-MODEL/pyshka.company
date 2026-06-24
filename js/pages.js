import { db, auth } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

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

        document.getElementById('dash-orders').innerText = dailyOrdersCount;
        document.getElementById('dash-sales').innerText = dailySalesVolume.toLocaleString() + ' ₸';
        document.getElementById('dash-agents').innerText = agentsCount;
        document.getElementById('dash-drivers').innerText = driversCount;
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
        const snap = await getDocs(collection(db, "clients"));
        tbody.innerHTML = '';

        let hasContent = false;
        snap.forEach(docSnap => {
            const c = docSnap.data();
            // АКБ — точки со статусом "Активен", ОКБ — абсолютно все (включая потенциальные)
            if (type === 'akb' && c.status !== 'Активен') return;
            hasContent = true;

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

        if (!hasContent) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">База данных пуста.</td></tr>`;
        }
    },

    // --- СОЗДАНИЕ ЗАЯВОК ТОРГОВЫМ ПРЕДСТАВИТЕЛЕМ ---
    async createOrder() {
        return `
            <div class="card" style="max-width: 650px; margin: 0 auto;">
                <h2>Оформление новой заявки на поставку</h2>
                <form id="order-form" style="margin-top:20px;">
                    <div class="form-group">
                        <label>Название магазина</label>
                        <input type="text" id="ord-name" required placeholder="Магазин 'Арман'">
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
                        <label>Список хлебобулочных изделий (Наименование, количество)</label>
                        <textarea id="ord-items" rows="3" required placeholder="Пышки — 100 шт, Булки — 50 шт"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Общая сумма заказа (₸)</label>
                        <input type="number" id="ord-total" required placeholder="25000">
                    </div>
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
        document.getElementById('order-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('ord-name').value;
            const ip = document.getElementById('ord-ip').value;
            const address = document.getElementById('ord-address').value;
            const phone = document.getElementById('ord-phone').value;
            const items = document.getElementById('ord-items').value;
            const total = Number(document.getElementById('ord-total').value);
            const comment = document.getElementById('ord-comment').value;

            // 1. Сохраняем заявку в общую ленту заказов
            await addDoc(collection(db, "orders"), {
                name, ip, address, phone, items, total, comment,
                status: 'Новая',
                agentEmail: auth.currentUser ? auth.currentUser.email : 'Система',
                createdAt: new Date().toISOString()
            });

            // 2. Дублируем клиента в общую базу клиентов (ОКБ), если его там еще нет
            await addDoc(collection(db, "clients"), {
                name, ip, address, phone,
                status: 'Активен'
            });

            alert('Заявка успешно отправлена на склад и добавлена в базу клиентов!');
            document.getElementById('order-form').reset();
        });
    },

    // --- РАБОЧАЯ ГЕОКАРТА (GOOGLE MAPS) ---
    async map() {
        return `
            <div class="card">
                <h2>Живая карта логистики Шымкента</h2>
                <p style="color:var(--text-muted); margin-bottom:15px;">Автоматическая генерация маркеров заявок и трассировка путей доставки.</p>
                <div id="google-map" class="map-container" style="height: 550px;"></div>
            </div>
        `;
    },

    async initMapPage() {
        const shymkentCenter = { lat: 42.3174, lng: 69.5901 }; // Координаты центра Шымкента
        
        if (typeof google === 'undefined' || !google.maps) {
            document.getElementById('google-map').innerHTML = `<p style="padding:20px; color:red;">Ошибка загрузки Google Maps API. Проверьте ваш API Ключ в index.html.</p>`;
            return;
        }

        const map = new google.maps.Map(document.getElementById("google-map"), {
            zoom: 12,
            center: shymkentCenter
        });

        const geocoder = new google.maps.Geocoder();
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({ map: map, suppressMarkers: true });

        const snap = await getDocs(collection(db, "orders"));
        const waypoints = [];

        for (const docSnap of snap.docs) {
            const order = docSnap.data();
            const fullAddress = order.address.includes("Шымкент") ? order.address : `Казахстан, Шымкент, ${order.address}`;

            // Геокодируем адрес на лету
            await new Promise((resolve) => {
                geocoder.geocode({ address: fullAddress }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        const position = results[0].geometry.location;
                        waypoints.push({ location: position, stopover: true });

                        // Ставим маркер магазина
                        const marker = new google.maps.Marker({
                            position: position,
                            map: map,
                            title: order.name,
                            icon: 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png'
                        });

                        const infoWindow = new google.maps.InfoWindow({
                            content: `<strong>${order.name}</strong><br>${order.address}<br>Сумма: ${order.total} ₸<br>Статус: <b>${order.status}</b>`
                        });

                        marker.addListener('click', () => infoWindow.open(map, marker));
                    }
                    setTimeout(resolve, 200); // Защита от лимитов запросов (Query Limit)
                });
            });
        }

        // Если есть хотя бы 2 заявки — строим оптимальный маршрут доставки для водителя по дорогам
        if (waypoints.length >= 2) {
            const origin = waypoints[0].location;
            const destination = waypoints[waypoints.length - 1].location;
            const midPoints = waypoints.slice(1, waypoints.length - 1);

            directionsService.route({
                origin: origin,
                destination: destination,
                waypoints: midPoints,
                optimizeWaypoints: true,
                travelMode: google.maps.TravelMode.DRIVING
            }, (response, status) => {
                if (status === 'OK') {
                    directionsRenderer.setDirections(response);
                }
            });
        }
    },

    // --- МОДУЛЬ ДЛЯ ВОДИТЕЛЕЙ (УПРАВЛЕНИЕ СТАТУСАМИ ДОСТАВКИ) ---
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
                    <td><strong>${o.name}</strong><br><small>${o.ip}</small></td>
                    <td>${o.address}</td>
                    <td><a href="tel:${o.phone}">${o.phone}</a></td>
                    <td><strong>${o.total.toLocaleString()} ₸</strong></td>
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
                
                await updateDoc(doc(db, "orders", orderId), { status: updatedStatus });
                alert('Статус успешно изменен на "' + updatedStatus + '"!');
                Pages.initDriverPage(); // Мгновенный перерендер таблицы
            });
        });
    },

    // --- ОТЧЁТЫ И АНАЛИТИКА ДЛЯ РУКОВОДСТВА ---
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
        const snap = await getDocs(collection(db, "orders"));

        const agentMap = {};
        const clientMap = {};

        snap.forEach(docSnap => {
            const o = docSnap.data();
            
            // Расчет по торговым
            const agent = o.agentEmail || 'Не указан';
            if (!agentMap[agent]) agentMap[agent] = { count: 0, total: 0 };
            agentMap[agent].count++;
            agentMap[agent].total += Number(o.total || 0);

            // Расчет по точкам
            const client = o.name;
            if (!clientMap[client]) clientMap[client] = { address: o.address, total: 0 };
            clientMap[client].total += Number(o.total || 0);
        });

        // Отрисовка торговых
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

        // Отрисовка лучших клиентов
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
    },

    // --- УПРАВЛЕНИЕ СОТРУДНИКАМИ И ДОСТУПОМ (ДЛЯ АДМИНИСТРАТОРА) ---
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

        // Изменение роли сотрудника
        document.querySelectorAll('.role-changer-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const uid = e.target.getAttribute('data-uid');
                const nextRole = e.target.value;
                await updateDoc(doc(db, "users", uid), { role: nextRole });
                alert('Права доступа изменены в реальном времени!');
                Pages.initEmployeesPage();
            });
        });

        // Удаление сотрудника из БД
        document.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Вы уверены, что хотите заблокировать и удалить этого сотрудника?')) {
                    const uid = btn.closest('button').getAttribute('data-uid');
                    await deleteDoc(doc(db, "users", uid));
                    alert('Сотрудник успешно удален.');
                    Pages.initEmployeesPage();
                }
            });
        });
    }
};
