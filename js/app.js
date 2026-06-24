import { AuthModule } from './auth.js';
import { Components } from './components.js';
import { Pages } from './pages.js';

const appLoader = document.getElementById('app-loader');
const appContainer = document.getElementById('app');
const authScreen = document.getElementById('auth-screen');
const authForm = document.getElementById('auth-form');
const registerForm = document.getElementById('register-form');

const loginBlock = document.getElementById('login-block');
const registerBlock = document.getElementById('register-block');

document.addEventListener('DOMContentLoaded', () => {
    AuthModule.init(handleAuthStateChange);
    setupEventListeners();
});

function handleAuthStateChange(user, role) {
    appLoader.classList.add('hidden');
    
    if (user) {
        authScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        document.getElementById('user-display-name').innerText = user.email;
        document.getElementById('user-role-badge').innerText = role;

        Components.renderSidebar(role);
        setupSidebarLinks();
        navigateTo('dashboard');
    } else {
        appContainer.classList.add('hidden');
        authScreen.classList.remove('hidden');
    }
}

function setupEventListeners() {
    // Вход в систему
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

    // Регистрация нового сотрудника
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const role = document.getElementById('reg-role').value;
        const password = document.getElementById('reg-password').value;
        const errDiv = document.getElementById('reg-error');

        try {
            errDiv.classList.add('hidden');
            await AuthModule.register(email, password, name, role);
            alert('Сотрудник успешно создан! Вход выполнен.');
        } catch (error) {
            errDiv.innerText = error.message;
            errDiv.classList.remove('hidden');
        }
    });

    // Переключатели экранов Вход / Регистрация
    document.getElementById('to-register').addEventListener('click', (e) => {
        e.preventDefault();
        loginBlock.classList.add('hidden');
        registerBlock.classList.remove('hidden');
    });

    document.getElementById('to-login').addEventListener('click', (e) => {
        e.preventDefault();
        registerBlock.classList.add('hidden');
        loginBlock.classList.remove('hidden');
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        AuthModule.logout();
    });

    document.getElementById('toggle-menu').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('mobile-open');
    });
}

function setupSidebarLinks() {
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.getAttribute('data-page');
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            document.getElementById('sidebar').classList.remove('mobile-open');
            navigateTo(pageId);
        });
    });
}

async function navigateTo(pageId) {
    const mainContent = document.getElementById('main-content');
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
            await Pages.initReportsPage();
            break;
        case 'employees':
            mainContent.innerHTML = await Pages.employees();
            await Pages.initEmployeesPage();
            break;
    }
}
