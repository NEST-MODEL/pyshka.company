export const Components = {
    renderSidebar(role) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        
        const menuItems = [
            { 
                id: 'dashboard', 
                label: 'Главная панель', 
                icon: 'fa-chart-pie', 
                roles: ['Администратор', 'Руководитель', 'Бухгалтер', 'Торговый представитель', 'Водитель'] 
            },
            { 
                id: 'akb', 
                label: 'База АКБ', 
                icon: 'fa-users-line', 
                roles: ['Администратор', 'Руководитель', 'Бухгалтер', 'Торговый представитель'] 
            },
            { 
                id: 'okb', 
                label: 'База ОКБ', 
                icon: 'fa-address-book', 
                roles: ['Администратор', 'Руководитель', 'Бухгалтер', 'Торговый представитель'] 
            },
            { 
                id: 'create-order', 
                label: 'Создать заявку', 
                icon: 'fa-square-plus', 
                roles: ['Администратор', 'Руководитель', 'Торговый представитель'] 
            },
            { 
                id: 'all-orders', 
                label: 'Журнал заявок (Финансы)', 
                icon: 'fa-file-invoice-dollar', 
                roles: ['Администратор', 'Руководитель', 'Бухгалтер'] 
            },
            { 
                id: 'map', 
                label: 'Логистика / Карта', 
                icon: 'fa-map-location-dot', 
                roles: ['Администратор', 'Руководитель', 'Водитель'] 
            },
            { 
                id: 'driver', 
                label: 'Заявки водителя', 
                icon: 'fa-truck-ramp-box', 
                roles: ['Администратор', 'Руководитель', 'Водитель'] 
            },
            { 
                id: 'reports', 
                label: 'Отчёты и аналитика', 
                icon: 'fa-chart-bar', 
                roles: ['Администратор', 'Руководитель', 'Бухгалтер'] 
            },
            { 
                id: 'employees', 
                label: 'Сотрудники', 
                icon: 'fa-user-gear', 
                roles: ['Администратор', 'Руководитель'] 
            },
        ];

        let menuHtml = `
            <div class="sidebar-brand">
                <i class="fa-solid fa-bread-slice"></i>
                <span>Пышка CRM</span>
            </div>
            <ul class="sidebar-menu">
        `;

        menuItems.forEach(item => {
            if (item.roles.includes(role)) {
                menuHtml += `
                    <li class="sidebar-item" data-page="${item.id}">
                        <a><i class="fa-solid ${item.icon}"></i><span>${item.label}</span></a>
                    </li>
                `;
            }
        });

        menuHtml += `</ul>`;
        sidebar.innerHTML = menuHtml;
    }
};
