import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, updateDoc, query, where } from 'firebase/firestore';

// Глобальная функция-заглушка для асинхронного вызова Google Maps
window.initMapDeferred = () => {
    // Вызывается автоматически, когда скрипт Google Maps загружен
};

export const Pages = {
    // 1. Главная панель (Дашборд)
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

    // Реализация динамики для Дашборда
    async initDashboard() {
        // Пример чтения данных для сводки
        const q = query(collection(db, "orders"));
        const snap = await getDocs(q);
        document.getElementById('dash-orders').innerText = snap.size;
        let totalSales = 0;
        snap.forEach(doc => totalSales += Number(doc.data().total || 0));
        document.getElementById('dash-sales').innerText = totalSales.toLocaleString() + ' ₸';
        document.getElementById('dash-agents').innerText = '5'; // Статично или из пула сессий
        document.getElementById('dash-drivers').innerText = '3';
    },

    // 2. Клиенты (АКБ / ОКБ разделение по флагам)
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
                                <th>Магазин</th>
                                <th>ИП</th>
                                <th>Адрес</th>
                                <th>Телефон</th>
                                <th>Статус</th>
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
        // Фильтруем по типу базы, если в доке настроено полеisActive
        const q = query(collection(db, "clients"), where("type", "==", type));
        const snap = await getDocs(q);
        tbody.innerHTML = '';
        if(snap.empty) {
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

    // 3. Создание заявок (Для торговых представителей)
    async createOrder() {
        return `
            <div class="card" style="max-width: 600px; margin: 0 auto;">
                <h2>Создать новую заявку</h2>
                <form id="order-form" style="margin-top:20px;">
                    <div class="form-group">
                        <label>Название магазина</label>
                        <input type="text" id="ord-name" required placeholder="Магазин 'Вкусный'">
                    </div>
                    <div class="form-group">
                        <label>ИП</label>
                        <input type="text" id="ord-ip" required placeholder="ИП Мамедов">
                    </div>
                    <div class="form-group">
                        <label>Точный адрес</label>
                        <input type="text" id="ord-address" required placeholder="г. Шымкент, ул. Аймаутова 12">
                    </div>
                    <div class="form-group">
                        <label>Телефон владельца</label>
                        <input type="text" id="ord-phone" required placeholder="+7 (707) 123-4567">
                    </div>
                    <div class="form-group">
                        <label>Список товаров (Позиции, кол-во)</label>
                        <textarea id="ord-items" rows="3" required placeholder="Хлеб формовой - 50 шт, Баурсаки - 5 кг"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Общая сумма заявки (₸)</label>
                        <input type="number" id="ord-total" required placeholder="15000">
                    </div>
                    <div class="form-group">
                        <label>Комментарий</label>
                        <textarea id="ord-comment" rows="2"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Отправить заявку в Firestore</button>
                </form>
            </div>
        `;
    },

    async initCreateOrder() {
        document.getElementById('order-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const orderData = {
                name: document.getElementById('ord-name').value,
                ip: document.getElementById('ord-ip').value,
                address: document.getElementById('ord-address').value,
                phone: document.getElementById('ord-phone').value,
                items: document.getElementById('ord-items').value,
                total: Number(document.getElementById('ord-total').value),
                comment: document.getElementById('ord-comment').value,
                status: 'Новая',
                createdAt: new Date().toISOString()
            };
            await addDoc(collection(db, "orders"), orderData);
            alert('Заявка успешно сохранена!');
            document.getElementById('order-form').reset();
        });
    },

    // 4. Интерактивная карта (Google Maps)
    async map() {
        return `
            <div class="card">
                <h2>Логистическая карта доставки (Шымкент)</h2>
                <div style="margin-bottom:15px; color:var(--text-muted);">Визуализация торговых точек и построенных маршрутов доставки.</div>
                <div id="google-map" class="map-container"></div>
            </div>
        `;
    },

    async initMapPage() {
        // Центр г. Шымкент по умолчанию
        const shymkentCoords = { lat: 42.3417, lng: 69.5901 };
        
        if (typeof google !== 'undefined' && google.maps) {
            const map = new google.maps.Map(document.getElementById("google-map"), {
                zoom: 12,
                center: shymkentCoords,
                styles: [
                    { "featureType": "administrative", "elementType": "labels.text.fill", "stylers": [{ "color": "#444444" }] }
                ]
            });

            // Загружаем заказы из Firestore для расстановки маркеров мест доставки
            const snap = await getDocs(collection(db, "orders"));
            snap.forEach(docSnap => {
                const order = docSnap.data();
                // Для полноценного геокодирования адреса в координаты на проде используйте google.maps.Geocoder
                // В демонстрационных целях ставим маркер со смещением вокруг центра
                const randomOffsetLat = (Math.random() - 0.5) * 0.05;
                const randomOffsetLng = (Math.random() - 0.5) * 0.05;
                
                new google.maps.Marker({
                    position: { lat: shymkentCoords.lat + randomOffsetLat, lng: shymkentCoords.lng + randomOffsetLng },
                    map: map,
                    title: order.name,
                    label: order.name[0]
                });
            });
        }
    },

    // 5. Модуль Водителя
    async driver() {
        return `
            <div class="card">
                <h2>Маршрутный лист водителя</h2>
                <div class="table-responsive" style="margin-top:20px;">
                    <table>
                        <thead>
                            <tr>
                                <th>Магазин</th>
                                <th>Адрес</th>
                                <th>Телефон</th>
                                <th>Сумма</th>
                                <th>Статус</th>
                                <th>Действие</th>
                            </tr>
                        </thead>
                        <tbody id="driver-table-body"></tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async initDriverPage() {
        const tbody = document.getElementById('driver-table-body');
        const snap = await getDocs(collection(db, "orders"));
        tbody.innerHTML = '';
        
        snap.forEach(docSnap => {
            const id = docSnap.id;
            const o = docSnap.data();
            
            let statusClass = 'badge-new';
            if(o.status === 'Принята') statusClass = 'badge-accepted';
            if(o.status === 'В пути') statusClass = 'badge-intransit';
            if(o.status === 'Доставлена') statusClass = 'badge-delivered';

            tbody.innerHTML += `
                <tr>
                    <td><strong>${o.name}</strong></td>
                    <td>${o.address}</td>
                    <td>${o.phone}</td>
                    <td>${o.total} ₸</td>
                    <td><span class="badge ${statusClass}">${o.status}</span></td>
                    <td>
                        <select class="status-updater" data-id="${id}" style="padding:4px; border-radius:4px;">
                            <option value="Новая" ${o.status === 'Новая' ? 'selected' : ''}>Новая</option>
                            <option value="Принята" ${o.status === 'Принята' ? 'selected' : ''}>Принята</option>
                            <option value="В пути" ${o.status === 'В пути' ? 'selected' : ''}>В пути</option>
                            <option value="Доставлена" ${o.status === 'Доставлена' ? 'selected' : ''}>Доставлена</option>
                        </select>
                    </td>
                </tr>
            `;
        });

        // Навешиваем обработчики изменения статуса заказа
        document.querySelectorAll('.status-updater').forEach(select => {
            select.addEventListener('change', async (e) => {
                const orderId = e.target.getAttribute('data-id');
                const newStatus = e.target.value;
                await updateDoc(doc(db, "orders", orderId), { status: newStatus });
                alert('Статус заявки обновлен!');
                Pages.initDriverPage(); // Перерендер
            });
        });
    },

    // 6. Отчеты аналитики
    async reports() {
        return `
            <div class="card">
                <h2>Аналитические отчеты компании</h2>
                <div class="stats-grid" style="margin-top:20px;">
                    <div class="stat-card" style="border-left: 4px solid var(--primary);">
                        <div class="stat-info"><p>Продажи текущий месяц</p><h3>1,420,000 ₸</h3></div>
                    </div>
                    <div class="stat-card" style="border-left: 4px solid var(--color-delivered);">
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

    // 7. Управление сотрудниками (Для Администратора)
    async employees() {
        return `
            <div class="card">
                <h2>Управление персоналом CRM</h2>
                <div class="table-responsive" style="margin-top:20px;">
                    <table>
                        <thead>
                            <tr>
                                <th>Имя сотрудника</th>
                                <th>Email</th>
                                <th>Текущая роль</th>
                                <th>Действия</th>
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
                        <select class="role-changer" data-uid="${uid}" style="padding:4px; border-radius:4px;">
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
                alert('Роль сотрудника успешно обновлена в Firestore!');
            });
        });
    }
};
