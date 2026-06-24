import { AuthModule } from './auth.js';
import { Components } from './components.js';
import { Pages } from './pages.js';

const appLoader = document.getElementById('app-loader');
const appContainer = document.getElementById('app');
const authScreen = document.getElementById('auth-screen');

document.addEventListener('DOMContentLoaded', () => {
    AuthModule.init(handleAuthStateChange);
    setupEventListeners();
});

function handleAuthStateChange(user, role) {
    if (appLoader) appLoader.classList.add('hidden');
    
    if (user) {
        if (authScreen) authScreen.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
        
        const nameField = document.getElementById('user-display-name');
        const roleBadge = document.getElementById('user-role-badge');
        if (nameField) nameField.innerText = user.email;
        if (roleBadge) {
            roleBadge.innerText = role;
            roleBadge.className = `badge badge-accepted`;
        }

        Components.renderSidebar(role);
        setupSidebarLinks();
        navigateTo('dashboard');
    } else {
        if (appContainer) appContainer.classList.add('hidden');
        if (authScreen) authScreen.classList.remove('hidden');
    }
}

function setupEventListeners() {
    const authForm = document.getElementById('auth-form');
    const registerForm = document.getElementById('register-form');
    const loginBlock = document.getElementById('login-block');
    const registerBlock = document.getElementById('register-block');

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const errDiv = document.getElementById('auth-error');
            try {
                if (errDiv) errDiv.classList.add('hidden');
                await AuthModule.login(email, password);
            } catch (error) {
                if (errDiv) { errDiv.innerText = error.message; errDiv.classList.remove('hidden'); }
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const role = document.getElementById('reg-role').value;
            const password = document.getElementById('reg-password').value;
            const errDiv = document.getElementById('reg-error');

            try {
                if (errDiv) errDiv.classList.add('hidden');
                await AuthModule.register(email, password, name, role);
                alert('Регистрация успешна!');
            } catch (error) {
                if (errDiv) { errDiv.innerText = error.message; errDiv.classList.remove('hidden'); }
            }
        });
    }

    const toRegisterBtn = document.getElementById('to-register');
    if (toRegisterBtn) {
        toRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault(); loginBlock.classList.add('hidden'); registerBlock.classList.remove('hidden');
        });
    }

    const toLoginBtn = document.getElementById('to-login');
    if (toLoginBtn) {
        toLoginBtn.addEventListener('click', (e) => {
            e.preventDefault(); registerBlock.classList.add('hidden'); loginBlock.classList.remove('hidden');
        });
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) { logoutBtn.addEventListener('click', () => { AuthModule.logout(); }); }
}

function setupSidebarLinks() {
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.getAttribute('data-page');
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            navigateTo(pageId);
        });
    });
}

async function navigateTo(pageId) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    mainContent.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--primary)"></i></div>';
    
    switch (pageId) {
        case 'dashboard':
            mainContent.innerHTML = await Pages.dashboard(); await Pages.initDashboard(); break;
        case 'akb':
            mainContent.innerHTML = await Pages.clients('akb'); await Pages.initClients('akb'); break;
        case 'okb':
            mainContent.innerHTML = await Pages.clients('okb'); await Pages.initClients('okb'); break;
        case 'create-order':
            mainContent.innerHTML = await Pages.createOrder(); await Pages.initCreateOrder(); break;
        case 'all-orders':
            mainContent.innerHTML = await Pages.allOrders(); await Pages.initAllOrdersPage(); break;
        case 'map':
            mainContent.innerHTML = await Pages.map(); await Pages.initMapPage(); break;
        case 'driver':
            mainContent.innerHTML = await Pages.driver(); await Pages.initDriverPage(); break;
        case 'reports':
            mainContent.innerHTML = await Pages.reports(); await Pages.initReportsPage(); break;
        case 'employees':
            mainContent.innerHTML = await Pages.employees(); await Pages.initEmployeesPage(); break;
    }
}
