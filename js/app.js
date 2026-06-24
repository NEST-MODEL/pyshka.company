import { AuthModule } from './auth.js';
import { Components } from './components.js';
import { Pages } from './pages.js';

const appLoader = document.getElementById('app-loader');
const appContainer = document.getElementById('app');
const authScreen = document.getElementById('auth-screen');
const authForm = document.getElementById('auth-form');
const mainContent = document.getElementById('main-content');

// Точка входа приложения
document.addEventListener('DOMContentLoaded', () => {
    AuthModule.init(handleAuthStateChange);
    setupEventListeners();
});

// Реагирование на изменение статуса сессии
function handleAuthStateChange(user, role) {
    appLoader.classList.add('hidden');
    
    if (user) {
        // Пользователь авторизован
        authScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        // Обновляем метаданные юзера в шапке
        document.getElementById('user-display-name').innerText = user.email;
        document.getElementById('user-role-badge').innerText = role;
        document.getElementById('user-role-badge').className = `badge badge-new`;

        // Отрендерить меню под роль
        Components.renderSidebar(role);
        
        // Навесить клики на новые элементы сайдбара
        setupSidebarLinks();
        
        // Открываем страницу по умолчанию
        navigateTo('dashboard');
    } else {
        // Сессии нет — открываем окно логина
        appContainer.classList.add('hidden');
        authScreen.classList.remove('hidden');
    }
}

// Настройка основных глобальных переключателей
function setupEventListeners() {
    // Обработка отправки формы логина
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const errDiv = document.getElementById('auth-error');
        
        try {
            errDiv.classList.add('hidden');
            await AuthModule.login(email, password);
        } catch (error) {
            errDiv.innerText = error.message;
            errDiv.classList.remove('hidden');
        }
    });

    // Выход из системы
    document.getElementById('btn-logout').addEventListener('click', () => {
        AuthModule.logout();
    });

    // Мобильный триггер сайдбара
    document.getElementById('toggle-menu').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('mobile-open');
    });
}

function setupSidebarLinks() {
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const pageId = item.getAttribute('data-page');
            
            // Убираем класс активности у всех и добавляем текущему
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Закрываем мобильное меню при переходе
            document.getElementById('sidebar').classList.remove('mobile-open');
            
            navigateTo(pageId);
        });
    });
}

// Клиентский SPA Роутер
async function navigateTo(pageId) {
    mainContent.innerHTML = '<div class="spinner" style="margin: 40px auto;"></div>';
    
    switch (pageId) {
        case 'dashboard':
            mainContent.innerHTML = await Pages.dashboard();
            await Pages.initDashboard();
            break;
        case 'akb':
            mainContent.innerHTML = await Pages.clients('akb');
            await Pages.initClients('akb');
            break;
        case 'okb':
            mainContent.innerHTML = await Pages.clients('okb');
            await Pages.initClients('okb');
            break;
        case 'create-order':
            mainContent.innerHTML = await Pages.createOrder();
            await Pages.initCreateOrder();
            break;
        case 'map':
            mainContent.innerHTML = await Pages.map();
            await Pages.initMapPage();
            break;
        case 'driver':
            mainContent.innerHTML = await Pages.driver();
            await Pages.initDriverPage();
            break;
        case 'reports':
            mainContent.innerHTML = await Pages.reports();
            break;
        case 'employees':
            mainContent.innerHTML = await Pages.employees();
            await Pages.initEmployeesPage();
            break;
        default:
            mainContent.innerHTML = `<h2>Страница в разработке</h2>`;
    }
}
