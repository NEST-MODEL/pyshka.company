import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, updateDoc, addDoc, query, where, deleteDoc }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ─── Константы расчёта зарплаты (меняй здесь, если ставки изменятся) ───
const SALARY_RATE_OKB = 100;   // ₸ за визит (ОКБ)
const SALARY_RATE_AKB = 300;   // ₸ за заявку (АКБ)
const SALARY_PERCENT  = 0.03;  // 3% с продаж

export const Pages = {

    // ═══════════════════════════════════════════════════
    // ГЛАВНАЯ ПАНЕЛЬ
    // ═══════════════════════════════════════════════════
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
            const usersSnap  = await getDocs(collection(db, "users"));

            let dailyOrdersCount = 0, dailySalesVolume = 0;
            ordersSnap.forEach(d => {
                dailyOrdersCount++;
                dailySalesVolume += Number(d.data().total || 0);
            });

            let agentsCount = 0, driversCount = 0;
            usersSnap.forEach(d => {
                const u = d.data();
                if (u.role === 'Торговый представитель') agentsCount++;
                if (u.role === 'Водитель') driversCount++;
            });

            const el = (id) => document.getElementById(id);
            if (el('dash-orders'))  el('dash-orders').innerText  = dailyOrdersCount;
            if (el('dash-sales'))   el('dash-sales').innerText   = dailySalesVolume.toLocaleString() + ' ₸';
            if (el('dash-agents'))  el('dash-agents').innerText  = agentsCount;
            if (el('dash-drivers')) el('dash-drivers').innerText = driversCount;
        } catch (e) { console.error("Ошибка дашборда:", e); }
    },

    // ═══════════════════════════════════════════════════
    // АКБ / ОКБ
    // ═══════════════════════════════════════════════════
    async clients(type) {
        return `
            <div class="card">
                <h2>${type === 'akb' ? 'Активная клиентская база (АКБ)' : 'Общая клиентская база (ОКБ)'}</h2>
                <p style="color:var(--text-muted); margin-bottom:20px;">Список торговых точек, закрепленных в системе.</p>
                <div class="table-responsive">
                    <table>
                        <thead><tr>
                            <th>Название магазина</th><th>ИП</th><th>Адрес</th><th>Телефон</th><th>Статус</th>
                        </tr></thead>
                        <tbody id="clients-table-body">
                            <tr><td colspan="5">Загрузка данных...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>`;
    },

    async initClients(type) {
        const tbody = document.getElementById('clients-table-body');
        if (!tbody) return;
        try {
            const snap = await getDocs(collection(db, "clients"));
            tbody.innerHTML = '';
            let hasContent = false;
            snap.forEach(d => {
                const c = d.data();
                if (type === 'akb' && c.status !== 'Активен') return;
                hasContent = true;
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${c.name}</strong></td>
                        <td>${c.ip || '—'}</td>
                        <td>${c.address || '—'}</td>
                        <td>${c.phone || '—'}</td>
                        <td><span class="badge ${c.status === 'Активен' ? 'badge-delivered' : 'badge-accepted'}">${c.status}</span></td>
                    </tr>`;
            });
            if (!hasContent) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">База данных пуста.</td></tr>`;
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;">Ошибка загрузки.</td></tr>`;
        }
    },

    // ═══════════════════════════════════════════════════
    // СОЗДАНИЕ ЗАЯВКИ — с геокодингом адреса
    // ═══════════════════════════════════════════════════
    async createOrder() {
        return `
            <div class="card" style="max-width:680px; margin:0 auto;">
                <h2><i class="fa-solid fa-square-plus" style="color:var(--primary);"></i> Оформление новой заявки</h2>

                <div id="step-select-shop" style="margin-top:20px;">
                    <label style="font-weight:600; font-size:1rem;">Выберите магазин из вашей базы:</label>
                    <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
                        <select id="shop-selector" style="flex:1; min-width:180px; padding:10px 14px; border-radius:8px; border:1.5px solid var(--border); font-size:0.97rem; background:var(--surface); color:var(--text);">
                            <option value="">⏳ Загрузка магазинов...</option>
                        </select>
                        <button id="btn-new-shop" style="padding:10px 18px; background:var(--primary); color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; white-space:nowrap;">
                            <i class="fa-solid fa-plus"></i> Новый магазин
                        </button>
                        <button type="button" id="btn-mark-visit" style="padding:10px 18px; background:#3b82f6; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; white-space:nowrap;">
                            <i class="fa-solid fa-shoe-prints"></i> Отметить визит
                        </button>
                    </div>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-top:8px;">
                        <i class="fa-solid fa-circle-info"></i> Выберите магазин — данные заполнятся автоматически. «Отметить визит» — если зашли в магазин без заявки (засчитывается ОКБ +100₸).
                    </p>
                </div>

                <hr style="margin:20px 0; border-color:var(--border);">

                <form id="order-form">
                    <div id="shop-info-block" style="background:var(--surface); border:1.5px solid var(--border); border-radius:10px; padding:16px; margin-bottom:18px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <span style="font-weight:700; color:var(--primary);"><i class="fa-solid fa-store"></i> Данные торговой точки</span>
                            <span id="shop-badge" style="display:none; background:#dbeafe; color:#2563eb; padding:3px 10px; border-radius:20px; font-size:0.8rem; font-weight:600;">Автозаполнение ✓</span>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                            <div class="form-group" style="margin:0;"><label>Название магазина</label><input type="text" id="ord-name" required placeholder="Магазин 'Arman'"></div>
                            <div class="form-group" style="margin:0;"><label>ИП владельца</label><input type="text" id="ord-ip" required placeholder="ИП Смаилов"></div>
                            <div class="form-group" style="margin:0; grid-column:1/-1;">
                                <label>Адрес</label>
                                <div style="display:flex; gap:8px;">
                                    <input type="text" id="ord-address" required placeholder="ул. Рыскулова, дом 45, Шымкент" style="flex:1;">
                                    <button type="button" id="btn-geocode" title="Найти адрес на карте" style="padding:8px 14px; background:var(--primary); color:#fff; border:none; border-radius:8px; cursor:pointer; white-space:nowrap; font-size:0.85rem;">
                                        <i class="fa-solid fa-magnifying-glass-location"></i> Найти
                                    </button>
                                </div>
                            </div>
                            <div class="form-group" style="margin:0;"><label>Телефон владельца</label><input type="text" id="ord-phone" required placeholder="+7 (701) 555-4433"></div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label><i class="fa-solid fa-bread-slice" style="color:var(--primary);"></i> Список изделий</label>
                        <textarea id="ord-items" rows="3" required placeholder="Пышки — 100 шт, Булки — 50 шт, Батон — 30 шт"></textarea>
                    </div>
                    <div class="form-group">
                        <label><i class="fa-solid fa-tenge-sign" style="color:var(--primary);"></i> Сумма заказа (₸)</label>
                        <input type="number" id="ord-total" required placeholder="25000" style="font-size:1.1rem; font-weight:600;">
                    </div>

                    <div class="form-group">
                        <label style="font-weight:600;">
                            <i class="fa-solid fa-map-pin" style="color:var(--primary);"></i>
                            Расположение на карте <span style="color:var(--text-muted); font-weight:400;">(кликните или нажмите «Найти» по адресу)</span>
                        </label>
                        <div id="picker-map" style="height:260px; width:100%; border-radius:10px; margin-top:6px; border:1.5px solid var(--border); z-index:1;"></div>
                        <p style="font-size:0.83rem; color:var(--text-muted); margin-top:5px;">
                            <i class="fa-solid fa-location-dot"></i> Координаты: <span id="coords-display">42.3174, 69.5901</span>
                        </p>
                    </div>

                    <input type="hidden" id="ord-lat" value="42.3174">
                    <input type="hidden" id="ord-lng" value="69.5901">
                    <input type="hidden" id="ord-shop-id" value="">

                    <div class="form-group">
                        <label>Комментарий для водителя</label>
                        <textarea id="ord-comment" rows="2" placeholder="Доставка строго до 09:00, позвонить заранее"></textarea>
                    </div>

                    <button type="submit" class="btn btn-primary btn-block" style="padding:14px; font-size:1.05rem; font-weight:700;">
                        <i class="fa-solid fa-paper-plane"></i> Сохранить и передать на доставку
                    </button>
                </form>
            </div>

            <!-- МОДАЛКА: Новый магазин -->
            <div id="modal-new-shop" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
                <div style="background:var(--surface); border-radius:14px; padding:28px; width:90%; max-width:460px; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                    <h3 style="margin-bottom:18px;"><i class="fa-solid fa-store" style="color:var(--primary);"></i> Добавить новый магазин</h3>
                    <div class="form-group"><label>Название *</label><input type="text" id="new-shop-name" placeholder="Магазин 'Бахыт'"></div>
                    <div class="form-group"><label>ИП владельца *</label><input type="text" id="new-shop-ip" placeholder="ИП Жуманов А.Б."></div>
                    <div class="form-group"><label>Адрес *</label><input type="text" id="new-shop-address" placeholder="пр. Республики, д. 12, Шымкент"></div>
                    <div class="form-group"><label>Телефон *</label><input type="text" id="new-shop-phone" placeholder="+7 (700) 123-4567"></div>
                    <div style="display:flex; gap:10px; margin-top:8px;">
                        <button id="btn-save-new-shop" style="flex:1; padding:11px; background:var(--primary); color:#fff; border:none; border-radius:8px; font-weight:700; cursor:pointer;">
                            <i class="fa-solid fa-floppy-disk"></i> Сохранить
                        </button>
                        <button id="btn-cancel-modal" style="padding:11px 18px; background:var(--border); color:var(--text); border:none; border-radius:8px; cursor:pointer; font-weight:600;">Отмена</button>
                    </div>
                </div>
            </div>`;
    },

    async initCreateOrder() {
        const pickerContainer = document.getElementById('picker-map');
        if (!pickerContainer) return;

        const pickerMap = L.map('picker-map').setView([42.3174, 69.5901], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(pickerMap);

        let currentMarker = L.marker([42.3174, 69.5901]).addTo(pickerMap);
        const coordsDisplay = document.getElementById('coords-display');

        function setMarker(lat, lng) {
            currentMarker.setLatLng([lat, lng]);
            pickerMap.setView([lat, lng], 16);
            document.getElementById('ord-lat').value = lat.toFixed(6);
            document.getElementById('ord-lng').value = lng.toFixed(6);
            if (coordsDisplay) coordsDisplay.innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }

        pickerMap.on('click', (e) => setMarker(e.latlng.lat, e.latlng.lng));

        // ГЕОКОДИНГ по адресу (Nominatim — бесплатно)
        document.getElementById('btn-geocode').addEventListener('click', async () => {
            const address = document.getElementById('ord-address').value.trim();
            if (!address) { alert('Введите адрес для поиска!'); return; }

            const btn = document.getElementById('btn-geocode');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btn.disabled = true;

            try {
                const searchQuery = address.toLowerCase().includes('шымкент') || address.toLowerCase().includes('shymkent')
                    ? address
                    : address + ', Шымкент, Казахстан';

                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`,
                    { headers: { 'Accept-Language': 'ru' } }
                );
                const data = await res.json();

                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lng = parseFloat(data[0].lon);
                    setMarker(lat, lng);
                } else {
                    alert('Адрес не найден. Попробуйте уточнить (добавьте "Шымкент") или поставьте метку вручную.');
                }
            } catch (e) {
                alert('Ошибка геокодинга. Поставьте метку вручную на карте.');
            } finally {
                btn.innerHTML = '<i class="fa-solid fa-magnifying-glass-location"></i> Найти';
                btn.disabled = false;
            }
        });

        // ЗАГРУЗКА МАГАЗИНОВ
        const selector = document.getElementById('shop-selector');
        const agentEmail = auth.currentUser ? auth.currentUser.email : null;
        let myShops = [];

        async function loadMyShops() {
            if (!agentEmail) { selector.innerHTML = '<option value="">Ошибка: не определён пользователь</option>'; return; }
            try {
                const q = query(collection(db, "salesRepShops"), where("agentEmail", "==", agentEmail));
                const snap = await getDocs(q);
                myShops = [];
                snap.forEach(d => myShops.push({ id: d.id, ...d.data() }));
                selector.innerHTML = '<option value="">— Выберите магазин —</option>';
                myShops.forEach(s => { selector.innerHTML += `<option value="${s.id}">${s.name} (${s.ip})</option>`; });
                if (myShops.length === 0) selector.innerHTML = '<option value="">Нет магазинов — добавьте первый</option>';
            } catch (e) {
                selector.innerHTML = '<option value="">Ошибка загрузки</option>';
            }
        }

        await loadMyShops();

        // АВТОЗАПОЛНЕНИЕ
        selector.addEventListener('change', () => {
            const shopId = selector.value;
            document.getElementById('ord-shop-id').value = shopId;
            const badge = document.getElementById('shop-badge');
            if (!shopId) {
                ['ord-name','ord-ip','ord-address','ord-phone'].forEach(id => document.getElementById(id).value = '');
                if (badge) badge.style.display = 'none';
                return;
            }
            const shop = myShops.find(s => s.id === shopId);
            if (!shop) return;
            document.getElementById('ord-name').value    = shop.name    || '';
            document.getElementById('ord-ip').value      = shop.ip      || '';
            document.getElementById('ord-address').value = shop.address  || '';
            document.getElementById('ord-phone').value   = shop.phone   || '';
            if (shop.lat && shop.lng) setMarker(Number(shop.lat), Number(shop.lng));
            if (badge) badge.style.display = 'inline';
        });

        // --- ОТМЕТИТЬ ВИЗИТ (без создания заявки, только ОКБ) ---
        document.getElementById('btn-mark-visit')?.addEventListener('click', async () => {
            const shopName = document.getElementById('ord-name').value.trim();

            if (!shopName) {
                alert('Выберите магазин из списка или впишите его название в поле "Название магазина" перед отметкой визита.');
                return;
            }

            if (!confirm(`Отметить визит в "${shopName}"? Засчитается как ОКБ (+${SALARY_RATE_OKB} ₸) без оформления заявки.`)) {
                return;
            }

            const btn = document.getElementById('btn-mark-visit');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                await Pages.markVisit(shopName);
                alert(`✅ Визит отмечен! +${SALARY_RATE_OKB} ₸ к зарплате за сегодня.`);
            } catch (err) {
                alert('Ошибка: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-shoe-prints"></i> Отметить визит';
            }
        });

        // МОДАЛКА
        const modal = document.getElementById('modal-new-shop');
        document.getElementById('btn-new-shop').addEventListener('click', () => modal.style.display = 'flex');
        document.getElementById('btn-cancel-modal').addEventListener('click', () => modal.style.display = 'none');
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

        document.getElementById('btn-save-new-shop').addEventListener('click', async () => {
            const name    = document.getElementById('new-shop-name').value.trim();
            const ip      = document.getElementById('new-shop-ip').value.trim();
            const address = document.getElementById('new-shop-address').value.trim();
            const phone   = document.getElementById('new-shop-phone').value.trim();
            if (!name || !ip || !address || !phone) { alert('Заполните все поля!'); return; }

            const btn = document.getElementById('btn-save-new-shop');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Сохраняю...';
            btn.disabled = true;

            try {
                const newShop = { name, ip, address, phone, agentEmail, lat: 42.3174, lng: 69.5901, createdAt: new Date().toISOString() };
                const docRef = await addDoc(collection(db, "salesRepShops"), newShop);
                myShops.push({ id: docRef.id, ...newShop });
                const opt = document.createElement('option');
                opt.value = docRef.id;
                opt.text = `${name} (${ip})`;
                selector.appendChild(opt);
                selector.value = docRef.id;
                selector.dispatchEvent(new Event('change'));
                modal.style.display = 'none';
                ['new-shop-name','new-shop-ip','new-shop-address','new-shop-phone'].forEach(id => document.getElementById(id).value = '');
            } catch (err) {
                alert('Ошибка: ' + err.message);
            } finally {
                btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Сохранить';
                btn.disabled = false;
            }
        });

        // ОТПРАВКА
        document.getElementById('order-form').addEventListener('submit', async (e) => {
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

            const submitBtn = e.target.querySelector('[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Сохраняю...';

            try {
                await addDoc(collection(db, "orders"), {
                    name, ip, address, phone, items, total, lat, lng, comment,
                    shopId: shopId || null,
                    status: 'Новая',
                    agentEmail: auth.currentUser?.email || 'Система',
                    createdAt: new Date().toISOString()
                });

                if (shopId) {
                    const shop = myShops.find(s => s.id === shopId);
                    if (shop && shop.lat === 42.3174) {
                        await updateDoc(doc(db, "salesRepShops", shopId), { lat, lng }).catch(() => {});
                    }
                }

                const clientsSnap = await getDocs(query(collection(db, "clients"), where("ip", "==", ip)));
                if (clientsSnap.empty) {
                    await addDoc(collection(db, "clients"), { name, ip, address, phone, status: 'Активен' });
                }

                alert('✅ Заявка создана и передана на доставку!');
                e.target.reset();
                selector.value = '';
                document.getElementById('shop-badge').style.display = 'none';
                setMarker(42.3174, 69.5901);
                pickerMap.setView([42.3174, 69.5901], 13);
            } catch (err) {
                alert('Ошибка сохранения: ' + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Сохранить и передать на доставку';
            }
        });
    },

    // ═══════════════════════════════════════════════════
    // КАРТА ВОДИТЕЛЯ — улучшенная
    // ═══════════════════════════════════════════════════
    async map() {
        return `
            <div class="card">
                <h2><i class="fa-solid fa-map-location-dot" style="color:var(--primary);"></i> Навигатор водителя</h2>

                <!-- Панель активного маршрута -->
                <div id="driver-actions-panel" style="display:none; margin-bottom:15px; padding:15px; background:#e0f2fe; border:1px solid #bae6fd; border-radius:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <div>
                            <div style="color:#0369a1; font-weight:700; font-size:1rem;">
                                <i class="fa-solid fa-truck-moving fa-bounce"></i> Маршрут активен
                            </div>
                            <div id="active-order-info" style="color:#0369a1; font-size:0.88rem; margin-top:3px;"></div>
                        </div>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <button id="btn-call-client" style="background:#059669; color:white; border:none; padding:9px 14px; border-radius:7px; font-weight:600; cursor:pointer; display:none;">
                                <i class="fa-solid fa-phone"></i> Позвонить
                            </button>
                            <button id="btn-complete-delivery" style="background:#6366f1; color:white; border:none; padding:9px 16px; border-radius:7px; font-weight:bold; cursor:pointer;">
                                <i class="fa-solid fa-square-check"></i> Завершить доставку
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Список точек -->
                <div id="orders-list-panel" style="margin-bottom:15px; display:flex; gap:8px; flex-wrap:wrap;" ></div>

                <div id="leaflet-map" style="height:520px; width:100%; border-radius:10px; z-index:1;"></div>

                <p style="color:var(--text-muted); font-size:0.83rem; margin-top:8px;">
                    <i class="fa-solid fa-circle-info"></i> Нажмите на метку → «Поехать сюда» для построения маршрута
                </p>
            </div>`;
    },

    async initMapPage() {
        const mapContainer = document.getElementById('leaflet-map');
        if (!mapContainer) return;

        const map = L.map('leaflet-map').setView([42.3174, 69.5901], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(map);

        let userCoords = null;
        let routingControl = null;
        let activeOrderId = null;
        let activeOrderPhone = null;

        // Иконки
        const driverIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34], shadowSize: [41,41]
        });
        const shopIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34], shadowSize: [41,41]
        });

        // GPS водителя — с таймаутом и fallback
        const getGPS = () => new Promise((resolve) => {
            if (!navigator.geolocation) { resolve(null); return; }
            const timer = setTimeout(() => resolve(null), 8000);
            navigator.geolocation.getCurrentPosition(
                (pos) => { clearTimeout(timer); resolve([pos.coords.latitude, pos.coords.longitude]); },
                () => { clearTimeout(timer); resolve(null); },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        });

        userCoords = await getGPS();
        if (userCoords) {
            map.setView(userCoords, 14);
            L.marker(userCoords, { icon: driverIcon }).addTo(map).bindPopup('<b>📍 Вы здесь</b>').openPopup();
        } else {
            // Fallback — центр Шымкента
            map.setView([42.3174, 69.5901], 12);
        }

        // ЗАГРУЗКА ЗАЯВОК
        try {
            const snap = await getDocs(collection(db, "orders"));
            const ordersListPanel = document.getElementById('orders-list-panel');
            let orderNum = 0;

            snap.forEach(docSnap => {
                const order = docSnap.data();
                const id = docSnap.id;
                if (!order.lat || !order.lng || order.status === 'Доставлено' || order.status === 'Доставлена') return;

                orderNum++;
                const num = orderNum;

                // Бейдж статуса
                const statusColor = order.status === 'В пути' ? '#f59e0b' : '#6366f1';

                // Кнопка-точка в списке
                if (ordersListPanel) {
                    const btn = document.createElement('button');
                    btn.innerHTML = `<i class="fa-solid fa-store"></i> ${num}. ${order.name}`;
                    btn.style.cssText = `padding:7px 13px; background:${statusColor}; color:#fff; border:none; border-radius:20px; cursor:pointer; font-size:0.85rem; font-weight:600;`;
                    btn.onclick = () => {
                        map.setView([order.lat, order.lng], 16);
                        map.openPopup && map.closePopup();
                    };
                    ordersListPanel.appendChild(btn);
                }

                const popupContent = `
                    <div style="font-family:sans-serif; line-height:1.5; min-width:200px;">
                        <div style="background:${statusColor}; color:#fff; margin:-13px -19px 12px; padding:10px 14px; border-radius:6px 6px 0 0; font-weight:700; font-size:1rem;">
                            #${num} ${order.name}
                        </div>
                        <b>Адрес:</b> ${order.address}<br>
                        <b>Телефон:</b> <a href="tel:${order.phone}" style="color:#6366f1;">${order.phone || '—'}</a><br>
                        <b>Товары:</b> <span style="color:#666; font-size:0.88rem;">${order.items || '—'}</span><br>
                        <b>Сумма:</b> <span style="color:#059669; font-weight:700;">${Number(order.total||0).toLocaleString()} ₸</span><br>
                        <b>Статус:</b> <span style="color:${statusColor}; font-weight:600;">${order.status}</span>
                        <hr style="margin:10px 0; border-color:#eee;">
                        <div style="display:flex; gap:6px;">
                            <a href="tel:${order.phone}" style="flex:1; background:#059669; color:#fff; text-decoration:none; padding:8px; border-radius:6px; text-align:center; font-weight:600; font-size:0.88rem;">
                                <i class="fa-solid fa-phone"></i> Позвонить
                            </a>
                            <button class="btn-route-start" data-id="${id}" data-lat="${order.lat}" data-lng="${order.lng}" data-name="${order.name}" data-phone="${order.phone||''}"
                                style="flex:1; background:#6366f1; color:#fff; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.88rem;">
                                <i class="fa-solid fa-route"></i> Поехать
                            </button>
                        </div>
                    </div>`;

                L.marker([order.lat, order.lng], { icon: shopIcon }).addTo(map).bindPopup(popupContent, { maxWidth: 240 });
            });

            if (orderNum === 0) {
                if (ordersListPanel) ordersListPanel.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;"><i class="fa-solid fa-check-circle" style="color:#059669;"></i> Все доставки выполнены!</p>';
            }

            // КЛИК «Поехать сюда»
            map.on('popupopen', () => {
                const btnStart = document.querySelector('.btn-route-start');
                if (!btnStart) return;
                btnStart.onclick = async () => {
                    const targetLat = parseFloat(btnStart.dataset.lat);
                    const targetLng = parseFloat(btnStart.dataset.lng);
                    const orderId   = btnStart.dataset.id;
                    const orderName = btnStart.dataset.name;
                    const orderPhone= btnStart.dataset.phone;

                    if (!userCoords) {
                        alert("GPS недоступен. Включите геолокацию в браузере и обновите страницу.");
                        return;
                    }

                    activeOrderId    = orderId;
                    activeOrderPhone = orderPhone;

                    // Статус → В пути
                    await updateDoc(doc(db, "orders", orderId), { status: 'В пути' }).catch(console.error);

                    // Убираем старый маршрут
                    if (routingControl) { map.removeControl(routingControl); routingControl = null; }

                    // Строим маршрут
                    routingControl = L.Routing.control({
                        waypoints: [L.latLng(userCoords[0], userCoords[1]), L.latLng(targetLat, targetLng)],
                        lineOptions: { styles: [{ color: '#6366f1', weight: 6, opacity: 0.85 }] },
                        router: L.Routing.osrmv1({
                            serviceUrl: 'https://routing.openstreetmap.de/routed-car/route/v1',
                            profile: 'driving'
                        }),
                        show: false,
                        addWaypoints: false,
                        collapsible: true,
                        language: 'ru'
                    }).addTo(map);

                    map.closePopup();

                    // Показываем панель
                    const panel = document.getElementById('driver-actions-panel');
                    if (panel) panel.style.display = 'block';

                    const info = document.getElementById('active-order-info');
                    if (info) info.innerText = `Едем к: ${orderName}`;

                    const btnCall = document.getElementById('btn-call-client');
                    if (btnCall && orderPhone) {
                        btnCall.style.display = 'inline-block';
                        btnCall.onclick = () => window.open(`tel:${orderPhone}`);
                    }
                };
            });

            // ЗАВЕРШИТЬ ДОСТАВКУ
            document.getElementById('btn-complete-delivery').onclick = async () => {
                if (!activeOrderId) return;
                if (confirm("Доставка завершена? Перевести статус в «Доставлено»?")) {
                    try {
                        await updateDoc(doc(db, "orders", activeOrderId), { status: 'Доставлено' });
                        if (routingControl) { map.removeControl(routingControl); routingControl = null; }
                        document.getElementById('driver-actions-panel').style.display = 'none';
                        activeOrderId = null;
                        map.off(); map.remove();
                        Pages.initMapPage();
                    } catch (err) { console.error(err); }
                }
            };

        } catch (e) { console.error("Ошибка карты:", e); }
    },

    // ═══════════════════════════════════════════════════
    // ЖУРНАЛ ЗАЯВОК — с фильтрами, итогами, экспортом
    // ═══════════════════════════════════════════════════
    async allOrders() {
        return `
            <div class="card">
                <h2><i class="fa-solid fa-file-invoice-dollar" style="color:var(--primary);"></i> Финансовый журнал заявок</h2>

                <!-- Фильтры -->
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin:16px 0; align-items:center;">
                    <select id="filter-period" style="padding:9px 14px; border-radius:8px; border:1.5px solid var(--border); background:var(--surface); color:var(--text); font-size:0.9rem;">
                        <option value="all">📅 Все время</option>
                        <option value="today">Сегодня</option>
                        <option value="week">Эта неделя</option>
                        <option value="month" selected>Этот месяц</option>
                    </select>
                    <select id="filter-status" style="padding:9px 14px; border-radius:8px; border:1.5px solid var(--border); background:var(--surface); color:var(--text); font-size:0.9rem;">
                        <option value="all">Все статусы</option>
                        <option value="Новая">Новая</option>
                        <option value="В пути">В пути</option>
                        <option value="Доставлено">Доставлено</option>
                        <option value="Доставлена">Доставлена</option>
                    </select>
                    <input type="text" id="filter-search" placeholder="🔍 Поиск по магазину..." style="padding:9px 14px; border-radius:8px; border:1.5px solid var(--border); background:var(--surface); color:var(--text); font-size:0.9rem; flex:1; min-width:180px;">
                    <button id="btn-export-excel" style="padding:9px 16px; background:#059669; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9rem; white-space:nowrap;">
                        <i class="fa-solid fa-file-excel"></i> Экспорт Excel
                    </button>
                </div>

                <!-- Итоги -->
                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px;">
                    <div style="background:#dbeafe; border-radius:8px; padding:10px 18px; flex:1; min-width:140px;">
                        <div style="font-size:0.8rem; color:#2563eb;">Заявок в выборке</div>
                        <div id="summary-count" style="font-size:1.4rem; font-weight:800; color:#2563eb;">0</div>
                    </div>
                    <div style="background:#d1fae5; border-radius:8px; padding:10px 18px; flex:1; min-width:140px;">
                        <div style="font-size:0.8rem; color:#059669;">Общая сумма</div>
                        <div id="summary-total" style="font-size:1.4rem; font-weight:800; color:#059669;">0 ₸</div>
                    </div>
                    <div style="background:#fef3c7; border-radius:8px; padding:10px 18px; flex:1; min-width:140px;">
                        <div style="font-size:0.8rem; color:#d97706;">Доставлено</div>
                        <div id="summary-delivered" style="font-size:1.4rem; font-weight:800; color:#d97706;">0</div>
                    </div>
                </div>

                <div class="table-responsive">
                    <table>
                        <thead><tr>
                            <th>Дата</th>
                            <th>Магазин / ИП</th>
                            <th>Товары</th>
                            <th>Торговый</th>
                            <th>Сумма</th>
                            <th>Статус</th>
                        </tr></thead>
                        <tbody id="all-orders-table-body">
                            <tr><td colspan="6" style="text-align:center;">Загрузка...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>`;
    },

    async initAllOrdersPage() {
        const tbody = document.getElementById('all-orders-table-body');
        if (!tbody) return;

        let allOrders = [];

        try {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Загрузка данных...</td></tr>';
            const snap = await getDocs(collection(db, "orders"));

            snap.docs.forEach(d => allOrders.push({ id: d.id, ...d.data() }));
            allOrders.sort((a, b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));

            renderTable();
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Ошибка: ${err.message}</td></tr>`;
        }

        function getDateRange(period) {
            const now = new Date();
            if (period === 'today') {
                const start = new Date(now); start.setHours(0,0,0,0);
                return { start, end: now };
            }
            if (period === 'week') {
                const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1); start.setHours(0,0,0,0);
                return { start, end: now };
            }
            if (period === 'month') {
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                return { start, end: now };
            }
            return null;
        }

        function renderTable() {
            const period  = document.getElementById('filter-period')?.value || 'all';
            const status  = document.getElementById('filter-status')?.value || 'all';
            const search  = (document.getElementById('filter-search')?.value || '').toLowerCase();
            const range   = getDateRange(period);

            const filtered = allOrders.filter(o => {
                if (range && o.createdAt) {
                    const d = new Date(o.createdAt);
                    if (d < range.start || d > range.end) return false;
                }
                if (status !== 'all' && o.status !== status) return false;
                if (search && !((o.name||'').toLowerCase().includes(search) || (o.ip||'').toLowerCase().includes(search))) return false;
                return true;
            });

            // Итоги
            const totalSum   = filtered.reduce((s, o) => s + Number(o.total||0), 0);
            const delivered  = filtered.filter(o => o.status === 'Доставлено' || o.status === 'Доставлена').length;
            document.getElementById('summary-count').innerText     = filtered.length;
            document.getElementById('summary-total').innerText     = totalSum.toLocaleString() + ' ₸';
            document.getElementById('summary-delivered').innerText = delivered;

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">Нет заявок по выбранным фильтрам</td></tr>`;
                return;
            }

            tbody.innerHTML = filtered.map(o => {
                const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('ru-RU') : '—';
                const total = Number(o.total||0).toLocaleString();
                let badgeClass = 'badge-new';
                if (o.status === 'Принята')  badgeClass = 'badge-accepted';
                if (o.status === 'В пути')   badgeClass = 'badge-intransit';
                if (o.status === 'Доставлено' || o.status === 'Доставлена') badgeClass = 'badge-delivered';
                return `
                    <tr>
                        <td>${date}</td>
                        <td><strong>${o.name||'—'}</strong><br><small style="color:var(--text-muted);">${o.ip||'—'}</small></td>
                        <td><span style="font-size:0.88rem; color:var(--text-muted);">${o.items||'—'}</span></td>
                        <td style="font-size:0.88rem;">${o.agentEmail||'—'}</td>
                        <td><strong style="color:var(--primary);">${total} ₸</strong></td>
                        <td><span class="badge ${badgeClass}">${o.status||'Новая'}</span></td>
                    </tr>`;
            }).join('');
        }

        // Слушатели фильтров
        ['filter-period','filter-status'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', renderTable);
        });
        document.getElementById('filter-search')?.addEventListener('input', renderTable);

        // ЭКСПОРТ EXCEL (через SheetJS CDN)
        document.getElementById('btn-export-excel')?.addEventListener('click', async () => {
            const btn = document.getElementById('btn-export-excel');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Экспорт...';
            btn.disabled = true;

            try {
                // Загружаем SheetJS если ещё не загружен
                if (!window.XLSX) {
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                        s.onload = resolve; s.onerror = reject;
                        document.head.appendChild(s);
                    });
                }

                const period = document.getElementById('filter-period')?.value || 'all';
                const status = document.getElementById('filter-status')?.value || 'all';
                const search = (document.getElementById('filter-search')?.value || '').toLowerCase();
                const range  = getDateRange(period);

                const filtered = allOrders.filter(o => {
                    if (range && o.createdAt && new Date(o.createdAt) < range.start) return false;
                    if (status !== 'all' && o.status !== status) return false;
                    if (search && !((o.name||'').toLowerCase().includes(search))) return false;
                    return true;
                });

                const rows = filtered.map(o => ({
                    'Дата':                o.createdAt ? new Date(o.createdAt).toLocaleDateString('ru-RU') : '—',
                    'Магазин':             o.name || '—',
                    'ИП':                  o.ip || '—',
                    'Адрес':               o.address || '—',
                    'Телефон':             o.phone || '—',
                    'Товары':              o.items || '—',
                    'Торговый':            o.agentEmail || '—',
                    'Сумма (₸)':           Number(o.total || 0),
                    'Статус':              o.status || '—',
                }));

                // Итоговая строка
                const totalSum = filtered.reduce((s,o) => s + Number(o.total||0), 0);
                rows.push({ 'Дата': '', 'Магазин': '', 'ИП': '', 'Адрес': '', 'Телефон': '', 'Товары': '', 'Торговый': 'ИТОГО:', 'Сумма (₸)': totalSum, 'Статус': '' });

                const ws = XLSX.utils.json_to_sheet(rows);
                ws['!cols'] = [10,20,18,25,15,30,25,14,12].map(w => ({ wch: w }));
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Заявки');

                const dateStr = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-');
                XLSX.writeFile(wb, `Пышка_заявки_${dateStr}.xlsx`);
            } catch (err) {
                alert('Ошибка экспорта: ' + err.message);
            } finally {
                btn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Экспорт Excel';
                btn.disabled = false;
            }
        });
    },

    // ═══════════════════════════════════════════════════
    // ПУТЕВОЙ ЛИСТ ВОДИТЕЛЯ
    // ═══════════════════════════════════════════════════
    async driver() {
        return `
            <div class="card">
                <h2><i class="fa-solid fa-truck-ramp-box" style="color:var(--primary);"></i> Путевой лист заказов</h2>
                <p style="color:var(--text-muted); margin-bottom:20px;">Меняйте статус по мере продвижения по маршруту.</p>
                <div class="table-responsive">
                    <table>
                        <thead><tr>
                            <th>#</th><th>Магазин</th><th>Адрес</th><th>Телефон</th><th>Сумма</th><th>Статус</th><th>Изменить</th>
                        </tr></thead>
                        <tbody id="driver-table-body">
                            <tr><td colspan="7">Загрузка...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>`;
    },

    async initDriverPage() {
        const tbody = document.getElementById('driver-table-body');
        if (!tbody) return;
        try {
            const snap = await getDocs(collection(db, "orders"));
            tbody.innerHTML = '';
            if (snap.empty) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">Заявок на сегодня нет.</td></tr>`;
                return;
            }

            let num = 0;
            snap.forEach(docSnap => {
                const id = docSnap.id;
                const o  = docSnap.data();
                if (o.status === 'Доставлено' || o.status === 'Доставлена') return;
                num++;

                let badgeClass = 'badge-new';
                if (o.status === 'Принята') badgeClass = 'badge-accepted';
                if (o.status === 'В пути')  badgeClass = 'badge-intransit';

                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:700; color:var(--primary);">${num}</td>
                        <td><strong>${o.name}</strong><br><small style="color:var(--text-muted);">${o.ip||'ИП'}</small></td>
                        <td>${o.address||'—'}</td>
                        <td><a href="tel:${o.phone}" style="color:var(--primary); font-weight:600;">${o.phone||'—'}</a></td>
                        <td><strong>${o.total ? Number(o.total).toLocaleString() : 0} ₸</strong></td>
                        <td><span class="badge ${badgeClass}">${o.status}</span></td>
                        <td>
                            <select class="status-select" data-id="${id}" style="padding:6px; border-radius:6px; border:1px solid var(--border);">
                                <option value="Новая"   ${o.status==='Новая'   ?'selected':''}>Новая</option>
                                <option value="Принята" ${o.status==='Принята' ?'selected':''}>Принята</option>
                                <option value="В пути"  ${o.status==='В пути'  ?'selected':''}>В пути</option>
                                <option value="Доставлено" ${o.status==='Доставлено'?'selected':''}>Доставлено</option>
                            </select>
                        </td>
                    </tr>`;
            });

            if (num === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#059669;"><i class="fa-solid fa-circle-check"></i> Все доставки выполнены!</td></tr>`;
            }

            document.querySelectorAll('.status-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const orderId = e.target.dataset.id;
                    try {
                        await updateDoc(doc(db, "orders", orderId), { status: e.target.value });
                        Pages.initDriverPage();
                    } catch (err) { alert("Ошибка: " + err.message); }
                });
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Ошибка загрузки.</td></tr>`;
        }
    },

    // ═══════════════════════════════════════════════════
    // ОТЧЁТЫ И АНАЛИТИКА — с графиком
    // ═══════════════════════════════════════════════════
    async reports() {
        return `
            <div class="card">
                <h2><i class="fa-solid fa-chart-bar" style="color:var(--primary);"></i> Аналитика и отчёты</h2>

                <!-- График продаж -->
                <div style="margin:20px 0 30px;">
                    <h3 style="margin-bottom:15px;">📈 Продажи по дням (последние 14 дней)</h3>
                    <canvas id="sales-chart" style="max-height:250px;"></canvas>
                </div>

                <h3 style="margin-bottom:12px;">👤 Показатели по торговым представителям</h3>
                <div class="table-responsive" style="margin-bottom:30px;">
                    <table>
                        <thead><tr>
                            <th>Торговый представитель</th><th>Заявок</th><th>Оборот (₸)</th><th>Ср. чек (₸)</th>
                        </tr></thead>
                        <tbody id="reports-agents-body"><tr><td colspan="4">Загрузка...</td></tr></tbody>
                    </table>
                </div>

                <h3 style="margin-bottom:12px;">🏆 Топ клиентов по выручке</h3>
                <div class="table-responsive">
                    <table>
                        <thead><tr>
                            <th>Магазин</th><th>Адрес</th><th>Сумма выкупа (₸)</th><th>Заявок</th>
                        </tr></thead>
                        <tbody id="reports-clients-body"><tr><td colspan="4">Загрузка...</td></tr></tbody>
                    </table>
                </div>
            </div>`;
    },

    async initReportsPage() {
        const agentsTbody   = document.getElementById('reports-agents-body');
        const clientsTbody  = document.getElementById('reports-clients-body');
        if (!agentsTbody || !clientsTbody) return;

        try {
            const snap = await getDocs(collection(db, "orders"));
            const agentMap  = {};
            const clientMap = {};
            const dayMap    = {};

            snap.forEach(d => {
                const o = d.data();

                // По агентам
                const agent = o.agentEmail || 'Не указан';
                if (!agentMap[agent]) agentMap[agent] = { count: 0, total: 0 };
                agentMap[agent].count++;
                agentMap[agent].total += Number(o.total || 0);

                // По клиентам
                const client = o.name || 'Неизвестный';
                if (!clientMap[client]) clientMap[client] = { address: o.address||'—', total: 0, count: 0 };
                clientMap[client].total += Number(o.total || 0);
                clientMap[client].count++;

                // По дням (для графика)
                if (o.createdAt) {
                    const day = new Date(o.createdAt).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' });
                    if (!dayMap[day]) dayMap[day] = 0;
                    dayMap[day] += Number(o.total || 0);
                }
            });

            // Таблица агентов
            agentsTbody.innerHTML = '';
            Object.entries(agentMap).sort((a,b) => b[1].total - a[1].total).forEach(([key, v]) => {
                const avg = v.count ? Math.round(v.total / v.count) : 0;
                agentsTbody.innerHTML += `
                    <tr>
                        <td><strong>${key}</strong></td>
                        <td>${v.count} шт</td>
                        <td><strong style="color:var(--primary);">${v.total.toLocaleString()} ₸</strong></td>
                        <td>${avg.toLocaleString()} ₸</td>
                    </tr>`;
            });
            if (!Object.keys(agentMap).length) agentsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Нет данных</td></tr>';

            // Таблица клиентов
            clientsTbody.innerHTML = '';
            Object.entries(clientMap).sort((a,b) => b[1].total - a[1].total).slice(0, 10).forEach(([name, data]) => {
                clientsTbody.innerHTML += `
                    <tr>
                        <td><strong>${name}</strong></td>
                        <td>${data.address}</td>
                        <td><span style="color:#059669; font-weight:700;">${data.total.toLocaleString()} ₸</span></td>
                        <td>${data.count} шт</td>
                    </tr>`;
            });
            if (!Object.keys(clientMap).length) clientsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Нет данных</td></tr>';

            // ГРАФИК (Chart.js через CDN)
            if (!window.Chart) {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js';
                    s.onload = resolve; s.onerror = reject;
                    document.head.appendChild(s);
                });
            }

            // Последние 14 дней
            const labels = [];
            const values = [];
            for (let i = 13; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const label = d.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' });
                labels.push(label);
                values.push(dayMap[label] || 0);
            }

            const ctx = document.getElementById('sales-chart');
            if (ctx) {
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Продажи (₸)',
                            data: values,
                            backgroundColor: 'rgba(99,102,241,0.7)',
                            borderColor: '#6366f1',
                            borderWidth: 2,
                            borderRadius: 6,
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => ' ' + ctx.parsed.y.toLocaleString() + ' ₸'
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { callback: v => v.toLocaleString() + ' ₸' }
                            }
                        }
                    }
                });
            }

        } catch (e) { console.error("Ошибка отчётов:", e); }
    },

    // ═══════════════════════════════════════════════════
    // СОТРУДНИКИ
    // ═══════════════════════════════════════════════════
    async employees() {
        return `
            <div class="card">
                <h2><i class="fa-solid fa-user-gear" style="color:var(--primary);"></i> Сотрудники и доступы</h2>
                <p style="color:var(--text-muted); margin-bottom:20px;">Управляйте ролями и учётными записями сотрудников.</p>
                <div class="table-responsive">
                    <table>
                        <thead><tr>
                            <th>ФИО</th><th>Email</th><th>Роль</th><th>Изменить роль</th><th>Удалить</th>
                        </tr></thead>
                        <tbody id="employees-table-body"></tbody>
                    </table>
                </div>
            </div>`;
    },

    async initEmployeesPage() {
        const tbody = document.getElementById('employees-table-body');
        if (!tbody) return;
        try {
            const snap = await getDocs(collection(db, "users"));
            tbody.innerHTML = '';

            snap.forEach(docSnap => {
                const uid = docSnap.id;
                const u   = docSnap.data();
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${u.name||'Не заполнено'}</strong></td>
                        <td>${u.email}</td>
                        <td><span class="badge badge-intransit">${u.role}</span></td>
                        <td>
                            <select class="role-changer-select" data-uid="${uid}" style="padding:6px; border-radius:6px;">
                                <option value="Торговый представитель" ${u.role==='Торговый представитель'?'selected':''}>Торговый представитель</option>
                                <option value="Водитель"               ${u.role==='Водитель'              ?'selected':''}>Водитель</option>
                                <option value="Бухгалтер"              ${u.role==='Бухгалтер'             ?'selected':''}>Бухгалтер</option>
                                <option value="Руководитель"           ${u.role==='Руководитель'          ?'selected':''}>Руководитель</option>
                                <option value="Администратор"          ${u.role==='Администратор'         ?'selected':''}>Администратор</option>
                            </select>
                        </td>
                        <td>
                            <button class="btn-delete-user" data-uid="${uid}" style="background:#ef4444; color:white; padding:6px 12px; border-radius:6px; border:none; cursor:pointer;">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </td>
                    </tr>`;
            });

            document.querySelectorAll('.role-changer-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const uid = e.target.dataset.uid;
                    try {
                        await updateDoc(doc(db, "users", uid), { role: e.target.value });
                        alert('Роль изменена!');
                    } catch (err) { alert("Ошибка: " + err.message); }
                });
            });

            document.querySelectorAll('.btn-delete-user').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm('Удалить сотрудника из CRM?')) {
                        const uid = btn.dataset.uid;
                        try {
                            await deleteDoc(doc(db, "users", uid));
                            alert('Сотрудник удалён.');
                            Pages.initEmployeesPage();
                        } catch (err) { alert("Ошибка: " + err.message); }
                    }
                });
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Ошибка загрузки.</td></tr>`;
        }
    },

    // ═══════════════════════════════════════════════════
    // ОТМЕТИТЬ ВИЗИТ (вызывается с кнопки в createOrder)
    // ═══════════════════════════════════════════════════
    async markVisit(shopName) {
        const agentEmail = auth.currentUser ? auth.currentUser.email : null;
        if (!agentEmail) { alert('Ошибка: пользователь не определён'); return false; }
        try {
            await addDoc(collection(db, "visits"), {
                agentEmail,
                shopName: shopName || 'Без названия',
                createdAt: new Date().toISOString()
            });
            return true;
        } catch (err) {
            alert('Ошибка при отметке визита: ' + err.message);
            return false;
        }
    },

    // ═══════════════════════════════════════════════════
    // РАЗДЕЛ "ЗАРПЛАТА" — список сотрудников (бухгалтер/руководитель)
    // ═══════════════════════════════════════════════════
    async salary() {
        return `
            <div class="card">
                <h2><i class="fa-solid fa-money-bill-wave" style="color:var(--primary);"></i> Расчёт зарплаты</h2>
                <p style="color:var(--text-muted); margin-bottom:20px;">Автоматический расчёт на основе посещений, заявок и продаж за текущий месяц.</p>
                <div id="salary-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
                    <p style="color:var(--text-muted);">Загрузка сотрудников...</p>
                </div>
            </div>

            <div id="modal-salary-card" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999; align-items:flex-start; justify-content:center; overflow-y:auto; padding:30px 16px;">
                <div style="background:var(--surface); border-radius:16px; padding:0; width:100%; max-width:680px; box-shadow:0 20px 60px rgba(0,0,0,0.4); overflow:hidden;">
                    <div id="salary-card-content" style="padding:28px;">Загрузка...</div>
                </div>
            </div>`;
    },

    async initSalaryPage() {
        const grid = document.getElementById('salary-grid');
        if (!grid) return;
        try {
            const [usersSnap, ordersSnap, visitsSnap] = await Promise.all([
                getDocs(collection(db, "users")),
                getDocs(collection(db, "orders")),
                getDocs(collection(db, "visits"))
            ]);

            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const agents = [];
            usersSnap.forEach(d => {
                const u = d.data();
                if (u.role === 'Торговый представитель') agents.push({ uid: d.id, ...u });
            });

            if (agents.length === 0) {
                grid.innerHTML = '<p style="color:var(--text-muted);">Нет торговых представителей в системе.</p>';
                return;
            }

            const stats = {};
            agents.forEach(a => { stats[a.email] = { okbMonth: 0, akbMonth: 0, salesMonth: 0 }; });

            ordersSnap.forEach(d => {
                const o = d.data();
                if (!o.agentEmail || !stats[o.agentEmail]) return;
                if (!o.createdAt || new Date(o.createdAt) < monthStart) return;
                stats[o.agentEmail].akbMonth++;
                stats[o.agentEmail].salesMonth += Number(o.total || 0);
            });

            visitsSnap.forEach(d => {
                const v = d.data();
                if (!v.agentEmail || !stats[v.agentEmail]) return;
                if (!v.createdAt || new Date(v.createdAt) < monthStart) return;
                stats[v.agentEmail].okbMonth++;
            });

            grid.innerHTML = '';
            agents.forEach(a => {
                const s = stats[a.email] || { okbMonth: 0, akbMonth: 0, salesMonth: 0 };
                const earnOkb = s.okbMonth * SALARY_RATE_OKB;
                const earnAkb = s.akbMonth * SALARY_RATE_AKB;
                const earnPercent = Math.round(s.salesMonth * SALARY_PERCENT);
                const totalSalary = earnOkb + earnAkb + earnPercent;

                grid.innerHTML += `
                    <div class="salary-employee-card" data-email="${a.email}" data-name="${a.name||a.email}"
                        style="background:var(--surface); border:1.5px solid var(--border); border-radius:14px; padding:20px; cursor:pointer; transition:0.2s;">
                        <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
                            <div style="width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:1.1rem;">
                                ${(a.name||a.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight:700; font-size:1rem;">${a.name || 'Без имени'}</div>
                                <div style="font-size:0.8rem; color:var(--text-muted);">${a.role}</div>
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px; font-size:0.85rem;">
                            <div style="background:#dbeafe; border-radius:8px; padding:8px 10px;">
                                <div style="color:#2563eb; font-size:0.75rem;">ОКБ за месяц</div>
                                <div style="font-weight:700; color:#2563eb;">${s.okbMonth}</div>
                            </div>
                            <div style="background:#fef3c7; border-radius:8px; padding:8px 10px;">
                                <div style="color:#d97706; font-size:0.75rem;">АКБ за месяц</div>
                                <div style="font-weight:700; color:#d97706;">${s.akbMonth}</div>
                            </div>
                        </div>
                        <div style="border-top:1.5px solid var(--border); padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.85rem; color:var(--text-muted);">Зарплата (мес.)</span>
                            <span style="font-size:1.25rem; font-weight:800; color:#059669;">${totalSalary.toLocaleString()} ₸</span>
                        </div>
                    </div>`;
            });

            document.querySelectorAll('.salary-employee-card').forEach(card => {
                card.addEventListener('click', () => {
                    Pages.openSalaryCard(card.dataset.email, card.dataset.name);
                });
            });
        } catch (e) {
            console.error("Ошибка зарплаты:", e);
            grid.innerHTML = `<p style="color:red;">Ошибка загрузки: ${e.message}</p>`;
        }
    },

    // ═══════════════════════════════════════════════════
    // ПОДРОБНАЯ КАРТОЧКА СОТРУДНИКА (модалка)
    // ═══════════════════════════════════════════════════
    async openSalaryCard(agentEmail, agentName) {
        const modal = document.getElementById('modal-salary-card');
        const content = document.getElementById('salary-card-content');
        if (!modal || !content) return;
        modal.style.display = 'flex';
        content.innerHTML = '<div class="spinner" style="margin:40px auto;"></div>';

        try {
            const [ordersSnap, visitsSnap] = await Promise.all([
                getDocs(query(collection(db, "orders"), where("agentEmail", "==", agentEmail))),
                getDocs(query(collection(db, "visits"), where("agentEmail", "==", agentEmail)))
            ]);

            const now = new Date();
            const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            let okbToday=0, akbToday=0, salesToday=0;
            let okbMonth=0, akbMonth=0, salesMonth=0;
            const shopsVisited = new Set();

            ordersSnap.forEach(d => {
                const o = d.data();
                if (!o.createdAt) return;
                const date = new Date(o.createdAt);
                const total = Number(o.total||0);
                if (date >= monthStart) { akbMonth++; salesMonth += total; }
                if (date >= todayStart) { akbToday++; salesToday += total; }
                if (o.name) shopsVisited.add(o.name);
            });

            visitsSnap.forEach(d => {
                const v = d.data();
                if (!v.createdAt) return;
                const date = new Date(v.createdAt);
                if (date >= monthStart) okbMonth++;
                if (date >= todayStart) okbToday++;
                if (v.shopName) shopsVisited.add(v.shopName);
            });

            const earnOkbToday = okbToday * SALARY_RATE_OKB;
            const earnAkbToday = akbToday * SALARY_RATE_AKB;
            const earnPercentToday = Math.round(salesToday * SALARY_PERCENT);
            const totalToday = earnOkbToday + earnAkbToday + earnPercentToday;

            const earnOkbMonth = okbMonth * SALARY_RATE_OKB;
            const earnAkbMonth = akbMonth * SALARY_RATE_AKB;
            const earnPercentMonth = Math.round(salesMonth * SALARY_PERCENT);
            const totalMonth = earnOkbMonth + earnAkbMonth + earnPercentMonth;

            const routeProgress = shopsVisited.size > 0 ? Math.min(100, Math.round((okbMonth / (okbMonth+5)) * 100)) : 0;

            content.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
                    <div style="display:flex; align-items:center; gap:14px;">
                        <div style="width:54px; height:54px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:1.4rem;">
                            ${agentName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight:800; font-size:1.2rem;">${agentName}</div>
                            <div style="font-size:0.85rem; color:var(--text-muted);">${agentEmail}</div>
                        </div>
                    </div>
                    <button id="btn-close-salary-modal" style="background:none; border:none; font-size:1.3rem; cursor:pointer; color:var(--text-muted);">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <h3 style="font-size:0.95rem; color:var(--text-muted); margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">📅 Сегодня</h3>
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px;">
                    <div style="background:#dbeafe; border-radius:10px; padding:12px; text-align:center;">
                        <div style="font-size:1.4rem; font-weight:800; color:#2563eb;">${okbToday}</div>
                        <div style="font-size:0.75rem; color:#2563eb;">ОКБ (визиты)</div>
                    </div>
                    <div style="background:#fef3c7; border-radius:10px; padding:12px; text-align:center;">
                        <div style="font-size:1.4rem; font-weight:800; color:#d97706;">${akbToday}</div>
                        <div style="font-size:0.75rem; color:#d97706;">АКБ (заявки)</div>
                    </div>
                    <div style="background:#d1fae5; border-radius:10px; padding:12px; text-align:center;">
                        <div style="font-size:1.2rem; font-weight:800; color:#059669;">${salesToday.toLocaleString()}₸</div>
                        <div style="font-size:0.75rem; color:#059669;">Продажи</div>
                    </div>
                </div>

                <div style="background:var(--bg, #f8fafc); border:1.5px solid var(--border); border-radius:12px; padding:16px; margin-bottom:24px;">
                    <div style="font-weight:700; margin-bottom:10px; font-size:0.9rem;">💰 Заработано сегодня</div>
                    <div style="display:flex; justify-content:space-between; font-size:0.88rem; padding:4px 0; color:var(--text-muted);">
                        <span>За обходы (${okbToday} × ${SALARY_RATE_OKB}₸)</span><span>${earnOkbToday.toLocaleString()} ₸</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.88rem; padding:4px 0; color:var(--text-muted);">
                        <span>За заявки (${akbToday} × ${SALARY_RATE_AKB}₸)</span><span>${earnAkbToday.toLocaleString()} ₸</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.88rem; padding:4px 0 10px; color:var(--text-muted); border-bottom:1px solid var(--border);">
                        <span>Процент с продаж (${(SALARY_PERCENT*100)}%)</span><span>${earnPercentToday.toLocaleString()} ₸</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-weight:800; font-size:1.1rem; padding-top:10px; color:#059669;">
                        <span>Итого за день</span><span>${totalToday.toLocaleString()} ₸</span>
                    </div>
                </div>

                <h3 style="font-size:0.95rem; color:var(--text-muted); margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">📊 За месяц</h3>
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px;">
                    <div style="background:#dbeafe; border-radius:10px; padding:12px; text-align:center;">
                        <div style="font-size:1.4rem; font-weight:800; color:#2563eb;">${okbMonth}</div>
                        <div style="font-size:0.75rem; color:#2563eb;">ОКБ всего</div>
                    </div>
                    <div style="background:#fef3c7; border-radius:10px; padding:12px; text-align:center;">
                        <div style="font-size:1.4rem; font-weight:800; color:#d97706;">${akbMonth}</div>
                        <div style="font-size:0.75rem; color:#d97706;">АКБ всего</div>
                    </div>
                    <div style="background:#f3e8ff; border-radius:10px; padding:12px; text-align:center;">
                        <div style="font-size:1.2rem; font-weight:800; color:#7c3aed;">${routeProgress}%</div>
                        <div style="font-size:0.75rem; color:#7c3aed;">Маршрут</div>
                    </div>
                </div>

                <div style="background:linear-gradient(135deg,#059669,#10b981); border-radius:14px; padding:20px; text-align:center; color:#fff; box-shadow:0 8px 20px rgba(5,150,105,0.3);">
                    <div style="font-size:0.85rem; opacity:0.9; margin-bottom:4px;">Итоговая зарплата за месяц</div>
                    <div style="font-size:2rem; font-weight:900;">${totalMonth.toLocaleString()} ₸</div>
                    <div style="font-size:0.78rem; opacity:0.85; margin-top:6px;">
                        ОКБ: ${earnOkbMonth.toLocaleString()}₸ • АКБ: ${earnAkbMonth.toLocaleString()}₸ • %: ${earnPercentMonth.toLocaleString()}₸
                    </div>
                </div>
            `;

            document.getElementById('btn-close-salary-modal').onclick = () => { modal.style.display = 'none'; };
            modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        } catch (e) {
            content.innerHTML = `<p style="color:red;">Ошибка загрузки: ${e.message}</p>`;
        }
    },

    // ═══════════════════════════════════════════════════
    // ЛИЧНЫЙ КАБИНЕТ ТОРГОВОГО — своя зарплата
    // ═══════════════════════════════════════════════════
    async myEarnings() {
        return `
            <div class="card" style="max-width:680px; margin:0 auto;">
                <h2><i class="fa-solid fa-wallet" style="color:var(--primary);"></i> Моя зарплата</h2>
                <div id="my-earnings-content" style="margin-top:20px;">
                    <div class="spinner" style="margin:40px auto;"></div>
                </div>
            </div>`;
    },

    async initMyEarningsPage() {
        const container = document.getElementById('my-earnings-content');
        if (!container) return;
        const agentEmail = auth.currentUser ? auth.currentUser.email : null;
        if (!agentEmail) { container.innerHTML = '<p>Ошибка: не определён пользователь</p>'; return; }

        try {
            const [ordersSnap, visitsSnap] = await Promise.all([
                getDocs(query(collection(db, "orders"), where("agentEmail", "==", agentEmail))),
                getDocs(query(collection(db, "visits"), where("agentEmail", "==", agentEmail)))
            ]);

            const now = new Date();
            const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            let okbToday=0, akbToday=0, salesToday=0;
            let okbMonth=0, akbMonth=0, salesMonth=0;

            ordersSnap.forEach(d => {
                const o = d.data();
                if (!o.createdAt) return;
                const date = new Date(o.createdAt);
                const total = Number(o.total||0);
                if (date >= monthStart) { akbMonth++; salesMonth += total; }
                if (date >= todayStart) { akbToday++; salesToday += total; }
            });
            visitsSnap.forEach(d => {
                const v = d.data();
                if (!v.createdAt) return;
                const date = new Date(v.createdAt);
                if (date >= monthStart) okbMonth++;
                if (date >= todayStart) okbToday++;
            });

            const earnOkbToday = okbToday * SALARY_RATE_OKB;
            const earnAkbToday = akbToday * SALARY_RATE_AKB;
            const earnPercentToday = Math.round(salesToday * SALARY_PERCENT);
            const totalToday = earnOkbToday + earnAkbToday + earnPercentToday;

            const earnOkbMonth = okbMonth * SALARY_RATE_OKB;
            const earnAkbMonth = akbMonth * SALARY_RATE_AKB;
            const earnPercentMonth = Math.round(salesMonth * SALARY_PERCENT);
            const totalMonth = earnOkbMonth + earnAkbMonth + earnPercentMonth;

            container.innerHTML = `
                <h3 style="font-size:0.9rem; color:var(--text-muted); margin-bottom:10px; text-transform:uppercase;">Сегодня</h3>
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px;">
                    <div style="background:#dbeafe; border-radius:10px; padding:14px; text-align:center;">
                        <div style="font-size:1.5rem; font-weight:800; color:#2563eb;">${okbToday}</div>
                        <div style="font-size:0.78rem; color:#2563eb;">Магазинов посещено</div>
                    </div>
                    <div style="background:#fef3c7; border-radius:10px; padding:14px; text-align:center;">
                        <div style="font-size:1.5rem; font-weight:800; color:#d97706;">${akbToday}</div>
                        <div style="font-size:0.78rem; color:#d97706;">Заявок (АКБ)</div>
                    </div>
                    <div style="background:#d1fae5; border-radius:10px; padding:14px; text-align:center;">
                        <div style="font-size:1.25rem; font-weight:800; color:#059669;">${salesToday.toLocaleString()}₸</div>
                        <div style="font-size:0.78rem; color:#059669;">Сумма продаж</div>
                    </div>
                </div>

                <div style="background:var(--bg,#f8fafc); border:1.5px solid var(--border); border-radius:12px; padding:18px; margin-bottom:24px;">
                    <div style="font-weight:700; margin-bottom:10px;">💰 Заработано сегодня</div>
                    <div style="display:flex; justify-content:space-between; padding:5px 0; color:var(--text-muted);"><span>За обходы (${okbToday} × ${SALARY_RATE_OKB}₸)</span><span>${earnOkbToday.toLocaleString()} ₸</span></div>
                    <div style="display:flex; justify-content:space-between; padding:5px 0; color:var(--text-muted);"><span>За заявки (${akbToday} × ${SALARY_RATE_AKB}₸)</span><span>${earnAkbToday.toLocaleString()} ₸</span></div>
                    <div style="display:flex; justify-content:space-between; padding:5px 0 12px; color:var(--text-muted); border-bottom:1.5px solid var(--border);"><span>Процент (${SALARY_PERCENT*100}%)</span><span>${earnPercentToday.toLocaleString()} ₸</span></div>
                    <div style="display:flex; justify-content:space-between; font-weight:800; font-size:1.15rem; padding-top:12px; color:#059669;"><span>Итог за сегодня</span><span>${totalToday.toLocaleString()} ₸</span></div>
                </div>

                <h3 style="font-size:0.9rem; color:var(--text-muted); margin-bottom:10px; text-transform:uppercase;">За месяц</h3>
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px;">
                    <div style="background:#dbeafe; border-radius:10px; padding:14px; text-align:center;">
                        <div style="font-size:1.5rem; font-weight:800; color:#2563eb;">${okbMonth}</div>
                        <div style="font-size:0.78rem; color:#2563eb;">ОКБ</div>
                    </div>
                    <div style="background:#fef3c7; border-radius:10px; padding:14px; text-align:center;">
                        <div style="font-size:1.5rem; font-weight:800; color:#d97706;">${akbMonth}</div>
                        <div style="font-size:0.78rem; color:#d97706;">АКБ</div>
                    </div>
                    <div style="background:#d1fae5; border-radius:10px; padding:14px; text-align:center;">
                        <div style="font-size:1.25rem; font-weight:800; color:#059669;">${salesMonth.toLocaleString()}₸</div>
                        <div style="font-size:0.78rem; color:#059669;">Продажи</div>
                    </div>
                </div>

                <div style="background:linear-gradient(135deg,#059669,#10b981); border-radius:16px; padding:24px; text-align:center; color:#fff; box-shadow:0 10px 25px rgba(5,150,105,0.35);">
                    <div style="font-size:0.9rem; opacity:0.9;">Итоговая зарплата за месяц</div>
                    <div style="font-size:2.2rem; font-weight:900; margin:6px 0;">${totalMonth.toLocaleString()} ₸</div>
                </div>

                <div style="text-align:center; margin-top:20px;">
                    <button id="btn-go-history" style="background:none; border:1.5px solid var(--primary); color:var(--primary); padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:600;">
                        <i class="fa-solid fa-clock-rotate-left"></i> Посмотреть историю по дням
                    </button>
                </div>
            `;

            document.getElementById('btn-go-history')?.addEventListener('click', () => {
                document.querySelector('[data-page="salary-history"]')?.click();
            });
        } catch (e) {
            container.innerHTML = `<p style="color:red;">Ошибка: ${e.message}</p>`;
        }
    },

    // ═══════════════════════════════════════════════════
    // ИСТОРИЯ НАЧИСЛЕНИЙ ПО ДНЯМ
    // ═══════════════════════════════════════════════════
    async salaryHistory() {
        return `
            <div class="card" style="max-width:680px; margin:0 auto;">
                <h2><i class="fa-solid fa-clock-rotate-left" style="color:var(--primary);"></i> История начислений</h2>
                <p style="color:var(--text-muted); margin-bottom:16px;">Подробный расчёт зарплаты по дням за текущий месяц.</p>
                <div id="salary-history-list">
                    <div class="spinner" style="margin:40px auto;"></div>
                </div>
            </div>`;
    },

    async initSalaryHistoryPage() {
        const container = document.getElementById('salary-history-list');
        if (!container) return;
        const agentEmail = auth.currentUser ? auth.currentUser.email : null;
        if (!agentEmail) { container.innerHTML = '<p>Ошибка пользователя</p>'; return; }

        try {
            const [ordersSnap, visitsSnap] = await Promise.all([
                getDocs(query(collection(db, "orders"), where("agentEmail", "==", agentEmail))),
                getDocs(query(collection(db, "visits"), where("agentEmail", "==", agentEmail)))
            ]);

            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const dayMap = {};

            ordersSnap.forEach(d => {
                const o = d.data();
                if (!o.createdAt) return;
                const date = new Date(o.createdAt);
                if (date < monthStart) return;
                const key = date.toLocaleDateString('ru-RU');
                if (!dayMap[key]) dayMap[key] = { okb: 0, akb: 0, sales: 0, _date: date };
                dayMap[key].akb++;
                dayMap[key].sales += Number(o.total || 0);
            });

            visitsSnap.forEach(d => {
                const v = d.data();
                if (!v.createdAt) return;
                const date = new Date(v.createdAt);
                if (date < monthStart) return;
                const key = date.toLocaleDateString('ru-RU');
                if (!dayMap[key]) dayMap[key] = { okb: 0, akb: 0, sales: 0, _date: date };
                dayMap[key].okb++;
            });

            const days = Object.entries(dayMap).sort((a,b) => b[1]._date - a[1]._date);

            if (days.length === 0) {
                container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:30px;">Нет начислений за этот месяц.</p>';
                return;
            }

            container.innerHTML = days.map(([dateStr, d]) => {
                const earnOkb = d.okb * SALARY_RATE_OKB;
                const earnAkb = d.akb * SALARY_RATE_AKB;
                const earnPercent = Math.round(d.sales * SALARY_PERCENT);
                const total = earnOkb + earnAkb + earnPercent;
                return `
                    <div style="background:var(--surface); border:1.5px solid var(--border); border-radius:12px; padding:16px; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <strong style="font-size:1rem;"><i class="fa-solid fa-calendar-day" style="color:var(--primary);"></i> ${dateStr}</strong>
                            <span style="font-weight:800; color:#059669; font-size:1.1rem;">${total.toLocaleString()} ₸</span>
                        </div>
                        <div style="font-size:0.85rem; color:var(--text-muted); line-height:1.7;">
                            ОКБ: ${d.okb} × ${SALARY_RATE_OKB} ₸ = <strong style="color:var(--text);">${earnOkb.toLocaleString()} ₸</strong><br>
                            АКБ: ${d.akb} × ${SALARY_RATE_AKB} ₸ = <strong style="color:var(--text);">${earnAkb.toLocaleString()} ₸</strong><br>
                            Продажи: ${d.sales.toLocaleString()} ₸ × ${SALARY_PERCENT*100}% = <strong style="color:var(--text);">${earnPercent.toLocaleString()} ₸</strong>
                        </div>
                    </div>`;
            }).join('');
        } catch (e) {
            container.innerHTML = `<p style="color:red;">Ошибка: ${e.message}</p>`;
        }
    }
};
