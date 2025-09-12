// Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.currentSection = 'overview';
        this.charts = {};
        this.currentPage = 1;
        this.usersPerPage = 50;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthentication();
        this.loadDashboardData();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSection(link.dataset.section);
            });
        });

        // Analytics tabs
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                const target = e.target.getAttribute('data-bs-target');
                if (target === '#user-analytics') {
                    this.loadUserAnalytics();
                } else if (target === '#subscription-analytics') {
                    this.loadSubscriptionAnalytics();
                } else if (target === '#security-analytics') {
                    this.loadSecurityAnalytics();
                }
            });
        });

        // User filters
        document.getElementById('user-period-select')?.addEventListener('change', () => {
            this.loadUserAnalytics();
        });

        // User management filters
        document.getElementById('user-search')?.addEventListener('input', this.debounce(() => {
            this.loadUsers();
        }, 500));

        document.getElementById('role-filter')?.addEventListener('change', () => {
            this.loadUsers();
        });

        document.getElementById('subscription-filter')?.addEventListener('change', () => {
            this.loadUsers();
        });

        document.getElementById('sort-by')?.addEventListener('change', () => {
            this.loadUsers();
        });

        document.getElementById('sort-order')?.addEventListener('change', () => {
            this.loadUsers();
        });

        // Auto-refresh dashboard every 5 minutes
        setInterval(() => {
            if (this.currentSection === 'overview') {
                this.loadDashboardData();
            }
        }, 300000);
    }

    checkAuthentication() {
        const token = sessionManager.getAccessToken();
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        // Verify user has super_admin role
        this.verifyAdminAccess();
    }

    async verifyAdminAccess() {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${sessionManager.getAccessToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Authentication failed');
            }

            const data = await response.json();
            if (data.user.role !== 'super_admin') {
                alert('Access denied. Super Admin privileges required.');
                window.location.href = 'index.html';
                return;
            }
        } catch (error) {
            console.error('Admin access verification failed:', error);
            window.location.href = 'login.html';
        }
    }

    showSection(section) {
        // Hide all sections
        document.querySelectorAll('.dashboard-section').forEach(sec => {
            sec.style.display = 'none';
        });

        // Show selected section
        document.getElementById(`${section}-section`).style.display = 'block';

        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        this.currentSection = section;

        // Load section-specific data
        switch (section) {
            case 'overview':
                this.loadDashboardData();
                break;
            case 'analytics':
                this.loadUserAnalytics();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'security':
                this.loadSecurityData();
                break;
            case 'system':
                this.loadSystemData();
                break;
        }
    }

    async loadDashboardData() {
        try {
            const response = await fetch('/api/admin/dashboard/overview', {
                headers: {
                    'Authorization': `Bearer ${sessionManager.getAccessToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load dashboard data');
            }

            const data = await response.json();
            this.updateOverviewCards(data.data.overview);
            this.updateRoleDistributionChart(data.data.roleDistribution);
            this.updateRecentActivity(data.data.recentRegistrations, data.data.recentLogins);
            this.updateSystemHealth(data.data.systemHealth);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    updateOverviewCards(overview) {
        document.getElementById('total-users').textContent = overview.totalUsers.toLocaleString();
        document.getElementById('active-users').textContent = overview.activeUsers24h.toLocaleString();
        document.getElementById('premium-users').textContent = overview.premiumUsers.toLocaleString();
        document.getElementById('locked-accounts').textContent = overview.lockedAccounts.toLocaleString();
    }

    updateRoleDistributionChart(roleDistribution) {
        const ctx = document.getElementById('roleDistributionChart').getContext('2d');
        
        if (this.charts.roleDistribution) {
            this.charts.roleDistribution.destroy();
        }

        const colors = ['#2c3e50', '#3498db', '#e74c3c', '#f39c12', '#27ae60', '#9b59b6', '#34495e'];
        
        this.charts.roleDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: roleDistribution.map(item => this.formatRoleName(item._id)),
                datasets: [{
                    data: roleDistribution.map(item => item.count),
                    backgroundColor: colors.slice(0, roleDistribution.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    updateRecentActivity(registrations, logins) {
        this.updateActivityList('recent-registrations', registrations, 'registration');
        this.updateActivityList('recent-logins', logins, 'login');
    }

    updateActivityList(containerId, activities, type) {
        const container = document.getElementById(containerId);
        
        if (!activities || activities.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No recent activity</div>';
            return;
        }

        const iconClass = type === 'registration' ? 'fa-user-plus' : 'fa-sign-in-alt';
        const iconBg = type === 'registration' ? 'bg-success' : 'bg-primary';
        const titleText = type === 'registration' ? 'New Registration' : 'User Login';

        container.innerHTML = activities.map(activity => `
            <div class="activity-item d-flex align-items-center">
                <div class="activity-icon ${iconBg}">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${titleText}</div>
                    <div class="activity-subtitle">${activity.firstName} ${activity.lastName}</div>
                    <div class="activity-time">${this.formatTime(activity.createdAt || activity.activeSessions?.[0]?.lastActivity)}</div>
                </div>
            </div>
        `).join('');
    }

    updateSystemHealth(systemHealth) {
        const uptimeHours = Math.floor(systemHealth.uptime / 3600);
        const uptimeMinutes = Math.floor((systemHealth.uptime % 3600) / 60);
        
        document.getElementById('system-uptime').textContent = `${uptimeHours}h ${uptimeMinutes}m`;
        
        const memoryMB = Math.round(systemHealth.memoryUsage.heapUsed / 1024 / 1024);
        document.getElementById('memory-usage').textContent = `${memoryMB} MB`;
    }

    async loadUserAnalytics() {
        try {
            const period = document.getElementById('user-period-select')?.value || '30d';
            const response = await fetch(`/api/admin/analytics/users?period=${period}`, {
                headers: {
                    'Authorization': `Bearer ${sessionManager.getAccessToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load user analytics');
            }

            const data = await response.json();
            this.updateUserGrowthChart(data.data.userGrowth);
            this.updateGeographicDistribution(data.data.geographicDistribution);
            this.updateUserDemographicsChart(data.data.userDemographics);
        } catch (error) {
            console.error('Error loading user analytics:', error);
            this.showError('Failed to load user analytics');
        }
    }

    updateUserGrowthChart(userGrowth) {
        const ctx = document.getElementById('userGrowthAnalyticsChart').getContext('2d');
        
        if (this.charts.userGrowth) {
            this.charts.userGrowth.destroy();
        }

        const labels = userGrowth.map(item => `${item._id.month}/${item._id.day}`);
        const data = userGrowth.map(item => item.count);

        this.charts.userGrowth = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'New Users',
                    data: data,
                    borderColor: '#2c3e50',
                    backgroundColor: 'rgba(44, 62, 80, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    updateGeographicDistribution(geographicData) {
        const container = document.getElementById('geographic-distribution');
        
        if (!geographicData || geographicData.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No geographic data available</div>';
            return;
        }

        container.innerHTML = geographicData.slice(0, 10).map(item => `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span>${item._id}</span>
                <span class="badge bg-primary">${item.count}</span>
            </div>
        `).join('');
    }

    updateUserDemographicsChart(demographics) {
        const ctx = document.getElementById('userDemographicsChart').getContext('2d');
        
        if (this.charts.userDemographics) {
            this.charts.userDemographics.destroy();
        }

        const roleData = {};
        demographics.forEach(item => {
            const role = item._id.role || 'Unknown';
            if (!roleData[role]) {
                roleData[role] = 0;
            }
            roleData[role] += item.count;
        });

        const labels = Object.keys(roleData);
        const data = Object.values(roleData);
        const colors = ['#2c3e50', '#3498db', '#e74c3c', '#f39c12', '#27ae60', '#9b59b6'];

        this.charts.userDemographics = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.map(label => this.formatRoleName(label)),
                datasets: [{
                    label: 'Users',
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    async loadSubscriptionAnalytics() {
        try {
            const response = await fetch('/api/admin/analytics/subscriptions', {
                headers: {
                    'Authorization': `Bearer ${sessionManager.getAccessToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load subscription analytics');
            }

            const data = await response.json();
            this.updateRevenueChart(data.data.revenueAnalytics);
            this.updateSubscriptionStatusChart(data.data.subscriptionStatus);
            this.updateRecentSubscriptions(data.data.recentSubscriptions);
            this.updateChurnedUsers(data.data.churnedUsers);
        } catch (error) {
            console.error('Error loading subscription analytics:', error);
            this.showError('Failed to load subscription analytics');
        }
    }

    updateRevenueChart(revenueData) {
        const ctx = document.getElementById('revenueChart').getContext('2d');
        
        if (this.charts.revenue) {
            this.charts.revenue.destroy();
        }

        const labels = revenueData.map(item => this.formatPlanName(item._id));
        const data = revenueData.map(item => item.totalRevenue || 0);

        this.charts.revenue = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#2c3e50', '#3498db', '#e74c3c'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    updateSubscriptionStatusChart(statusData) {
        const ctx = document.getElementById('subscriptionStatusChart').getContext('2d');
        
        if (this.charts.subscriptionStatus) {
            this.charts.subscriptionStatus.destroy();
        }

        const labels = statusData.map(item => item._id || 'Unknown');
        const data = statusData.map(item => item.count);

        this.charts.subscriptionStatus = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#27ae60', '#e74c3c', '#f39c12', '#6c757d'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    updateRecentSubscriptions(subscriptions) {
        const container = document.getElementById('recent-subscriptions');
        
        if (!subscriptions || subscriptions.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No recent subscriptions</div>';
            return;
        }

        container.innerHTML = subscriptions.map(sub => `
            <div class="activity-item d-flex align-items-center">
                <div class="activity-icon bg-success">
                    <i class="fas fa-credit-card"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${this.formatPlanName(sub.subscriptionPlan)} Subscription</div>
                    <div class="activity-subtitle">${sub.firstName} ${sub.lastName}</div>
                    <div class="activity-time">₹${sub.subscriptionAmount} - ${this.formatTime(sub.subscriptionStartDate)}</div>
                </div>
            </div>
        `).join('');
    }

    updateChurnedUsers(churnedUsers) {
        const container = document.getElementById('churned-users');
        
        if (!churnedUsers || churnedUsers.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No churned users</div>';
            return;
        }

        container.innerHTML = churnedUsers.map(user => `
            <div class="activity-item d-flex align-items-center">
                <div class="activity-icon bg-danger">
                    <i class="fas fa-user-times"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">Subscription Cancelled</div>
                    <div class="activity-subtitle">${user.firstName} ${user.lastName}</div>
                    <div class="activity-time">${this.formatTime(user.subscriptionEndDate)}</div>
                </div>
            </div>
        `).join('');
    }

    async loadSecurityAnalytics() {
        try {
            const response = await fetch('/api/admin/analytics/security', {
                headers: {
                    'Authorization': `Bearer ${sessionManager.getAccessToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load security analytics');
            }

            const data = await response.json();
            this.updateRiskDistributionChart(data.data.riskDistribution);
            this.updateMFAStatsChart(data.data.mfaStats);
            this.updateSecurityIncidents(data.data.securityIncidents);
            this.updateFailedLogins(data.data.failedLogins);
        } catch (error) {
            console.error('Error loading security analytics:', error);
            this.showError('Failed to load security analytics');
        }
    }

    updateRiskDistributionChart(riskData) {
        const ctx = document.getElementById('riskDistributionChart').getContext('2d');
        
        if (this.charts.riskDistribution) {
            this.charts.riskDistribution.destroy();
        }

        const labels = riskData.map(item => item._id);
        const data = riskData.map(item => item.count);
        const colors = ['#27ae60', '#f39c12', '#e74c3c', '#2c3e50'];

        this.charts.riskDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    updateMFAStatsChart(mfaData) {
        const ctx = document.getElementById('mfaStatsChart').getContext('2d');
        
        if (this.charts.mfaStats) {
            this.charts.mfaStats.destroy();
        }

        const enabled = mfaData.find(item => item._id === true)?.count || 0;
        const disabled = mfaData.find(item => item._id === false)?.count || 0;

        this.charts.mfaStats = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['MFA Enabled', 'MFA Disabled'],
                datasets: [{
                    data: [enabled, disabled],
                    backgroundColor: ['#27ae60', '#e74c3c'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    updateSecurityIncidents(incidents) {
        const container = document.getElementById('security-incidents');
        
        if (!incidents || incidents.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No security incidents</div>';
            return;
        }

        container.innerHTML = incidents.slice(0, 10).map(incident => `
            <div class="activity-item d-flex align-items-center">
                <div class="activity-icon bg-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">Security Incident</div>
                    <div class="activity-subtitle">${incident.firstName} ${incident.lastName}</div>
                    <div class="activity-time">${incident.securityStatus?.securityFlags?.join(', ') || 'Unknown'} - ${this.formatTime(incident.createdAt)}</div>
                </div>
            </div>
        `).join('');
    }

    updateFailedLogins(failedLogins) {
        const container = document.getElementById('failed-logins');
        
        if (!failedLogins || failedLogins.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No failed login attempts</div>';
            return;
        }

        container.innerHTML = failedLogins.map(login => `
            <div class="activity-item d-flex align-items-center">
                <div class="activity-icon bg-danger">
                    <i class="fas fa-times-circle"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">Failed Login Attempt</div>
                    <div class="activity-subtitle">${login.firstName} ${login.lastName}</div>
                    <div class="activity-time">${this.formatTime(login.createdAt)}</div>
                </div>
            </div>
        `).join('');
    }

    async loadUsers() {
        try {
            const search = document.getElementById('user-search')?.value || '';
            const role = document.getElementById('role-filter')?.value || '';
            const subscriptionStatus = document.getElementById('subscription-filter')?.value || '';
            const sortBy = document.getElementById('sort-by')?.value || 'createdAt';
            const sortOrder = document.getElementById('sort-order')?.value || 'desc';

            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.usersPerPage,
                sortBy,
                sortOrder
            });

            if (search) params.append('search', search);
            if (role) params.append('role', role);
            if (subscriptionStatus) params.append('subscriptionStatus', subscriptionStatus);

            const response = await fetch(`/api/admin/users?${params}`, {
                headers: {
                    'Authorization': `Bearer ${sessionManager.getAccessToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load users');
            }

            const data = await response.json();
            this.updateUsersTable(data.data.users);
            this.updateUsersPagination(data.data.pagination);
        } catch (error) {
            console.error('Error loading users:', error);
            this.showError('Failed to load users');
        }
    }

    updateUsersTable(users) {
        const tbody = document.getElementById('users-table-body');
        
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No users found</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.firstName} ${user.lastName}</td>
                <td>${user.email}</td>
                <td><span class="badge bg-${this.getRoleBadgeColor(user.role)}">${this.formatRoleName(user.role)}</span></td>
                <td><span class="badge bg-${this.getSubscriptionBadgeColor(user.subscriptionStatus)}">${user.subscriptionStatus || 'Inactive'}</span></td>
                <td>${this.formatTime(user.createdAt)}</td>
                <td>${user.lastLogin ? this.formatTime(user.lastLogin) : 'Never'}</td>
                <td>
                    <span class="status-indicator ${this.getStatusIndicator(user)}"></span>
                    ${this.getUserStatus(user)}
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="adminDashboard.viewUserDetails('${user._id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning" onclick="adminDashboard.editUserRole('${user._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-${user.securityStatus?.accountLocked ? 'success' : 'danger'}" 
                            onclick="adminDashboard.toggleUserSuspension('${user._id}', ${!user.securityStatus?.accountLocked})">
                        <i class="fas fa-${user.securityStatus?.accountLocked ? 'unlock' : 'lock'}"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    updateUsersPagination(pagination) {
        const container = document.getElementById('users-pagination');
        
        if (pagination.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        
        // Previous button
        if (pagination.hasPrev) {
            html += `<li class="page-item"><a class="page-link" href="#" onclick="adminDashboard.goToPage(${pagination.currentPage - 1})">Previous</a></li>`;
        }

        // Page numbers
        const startPage = Math.max(1, pagination.currentPage - 2);
        const endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            html += `<li class="page-item ${i === pagination.currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="adminDashboard.goToPage(${i})">${i}</a>
            </li>`;
        }

        // Next button
        if (pagination.hasNext) {
            html += `<li class="page-item"><a class="page-link" href="#" onclick="adminDashboard.goToPage(${pagination.currentPage + 1})">Next</a></li>`;
        }

        container.innerHTML = html;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadUsers();
    }

    async viewUserDetails(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${sessionManager.getAccessToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load user details');
            }

            const data = await response.json();
            this.showUserDetailsModal(data.data.user);
        } catch (error) {
            console.error('Error loading user details:', error);
            this.showError('Failed to load user details');
        }
    }

    showUserDetailsModal(user) {
        const modal = new bootstrap.Modal(document.getElementById('userDetailsModal'));
        const content = document.getElementById('user-details-content');
        
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Personal Information</h6>
                    <p><strong>Name:</strong> ${user.firstName} ${user.lastName}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Role:</strong> <span class="badge bg-${this.getRoleBadgeColor(user.role)}">${this.formatRoleName(user.role)}</span></p>
                    <p><strong>Created:</strong> ${this.formatTime(user.createdAt)}</p>
                </div>
                <div class="col-md-6">
                    <h6>Subscription Information</h6>
                    <p><strong>Status:</strong> <span class="badge bg-${this.getSubscriptionBadgeColor(user.subscriptionStatus)}">${user.subscriptionStatus || 'Inactive'}</span></p>
                    <p><strong>Plan:</strong> ${this.formatPlanName(user.subscriptionPlan) || 'None'}</p>
                    <p><strong>Amount:</strong> ${user.subscriptionAmount ? `₹${user.subscriptionAmount}` : 'N/A'}</p>
                    <p><strong>Last Login:</strong> ${user.lastLogin ? this.formatTime(user.lastLogin) : 'Never'}</p>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <h6>Security Information</h6>
                    <p><strong>MFA Enabled:</strong> ${user.mfaEnabled ? 'Yes' : 'No'}</p>
                    <p><strong>Risk Score:</strong> ${user.securityStatus?.riskScore || 0}/100</p>
                    <p><strong>Account Locked:</strong> ${user.securityStatus?.accountLocked ? 'Yes' : 'No'}</p>
                    <p><strong>Trusted Devices:</strong> ${user.trustedDevices?.length || 0}</p>
                </div>
            </div>
        `;
        
        modal.show();
    }

    async editUserRole(userId) {
        const newRole = prompt('Enter new role (super_admin, admin, moderator, premium_user, standard_user, free_user, suspended_user):');
        
        if (!newRole) return;

        try {
            const response = await fetch(`/api/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionManager.getAccessToken()}`
                },
                body: JSON.stringify({ role: newRole })
            });

            if (!response.ok) {
                throw new Error('Failed to update user role');
            }

            this.showSuccess('User role updated successfully');
            this.loadUsers();
        } catch (error) {
            console.error('Error updating user role:', error);
            this.showError('Failed to update user role');
        }
    }

    async toggleUserSuspension(userId, suspend) {
        const action = suspend ? 'suspend' : 'unsuspend';
        const reason = suspend ? prompt('Enter reason for suspension:') : '';
        
        if (suspend && !reason) {
            this.showError('Reason is required for suspension');
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${userId}/suspend`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionManager.getAccessToken()}`
                },
                body: JSON.stringify({ 
                    suspended: suspend,
                    reason: reason || undefined
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to ${action} user`);
            }

            this.showSuccess(`User ${action}ed successfully`);
            this.loadUsers();
        } catch (error) {
            console.error(`Error ${action}ing user:`, error);
            this.showError(`Failed to ${action} user`);
        }
    }

    async loadSecurityData() {
        try {
            const response = await fetch('/api/admin/analytics/security', {
                headers: {
                    'Authorization': `Bearer ${sessionManager.getAccessToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load security data');
            }

            const data = await response.json();
            this.updateSecurityOverview(data.data);
        } catch (error) {
            console.error('Error loading security data:', error);
            this.showError('Failed to load security data');
        }
    }

    updateSecurityOverview(data) {
        // Update security overview cards
        const highRisk = data.riskDistribution.find(item => item._id === 'High' || item._id === 'Critical')?.count || 0;
        document.getElementById('high-risk-users').textContent = highRisk;
        document.getElementById('locked-accounts-security').textContent = data.lockedAccounts.length;
        
        const mfaEnabled = data.mfaStats.find(item => item._id === true)?.count || 0;
        document.getElementById('mfa-enabled').textContent = mfaEnabled;
        
        // Calculate security score
        const totalUsers = data.mfaStats.reduce((sum, item) => sum + item.count, 0);
        const securityScore = totalUsers > 0 ? Math.round((mfaEnabled / totalUsers) * 100) : 0;
        document.getElementById('security-score').textContent = `${securityScore}%`;

        // Update security tables
        this.updateSecurityIncidentsTable(data.securityIncidents);
        this.updateLockedAccountsTable(data.lockedAccounts);
    }

    updateSecurityIncidentsTable(incidents) {
        const container = document.getElementById('security-incidents-table');
        
        if (!incidents || incidents.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No security incidents</div>';
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Incident</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${incidents.slice(0, 10).map(incident => `
                            <tr>
                                <td>${incident.firstName} ${incident.lastName}</td>
                                <td><span class="badge bg-warning">${incident.securityStatus?.securityFlags?.join(', ') || 'Unknown'}</span></td>
                                <td>${this.formatTime(incident.createdAt)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    updateLockedAccountsTable(lockedAccounts) {
        const container = document.getElementById('locked-accounts-table');
        
        if (!lockedAccounts || lockedAccounts.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No locked accounts</div>';
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Reason</th>
                            <th>Date</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lockedAccounts.slice(0, 10).map(account => `
                            <tr>
                                <td>${account.firstName} ${account.lastName}</td>
                                <td><span class="badge bg-danger">${account.securityStatus?.lockReason || 'Unknown'}</span></td>
                                <td>${this.formatTime(account.createdAt)}</td>
                                <td>
                                    <button class="btn btn-sm btn-success" onclick="adminDashboard.toggleUserSuspension('${account._id}', false)">
                                        <i class="fas fa-unlock"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    async loadSystemData() {
        try {
            const [healthResponse, logsResponse] = await Promise.all([
                fetch('/api/admin/system/health', {
                    headers: {
                        'Authorization': `Bearer ${sessionManager.getAccessToken()}`
                    }
                }),
                fetch('/api/admin/system/logs', {
                    headers: {
                        'Authorization': `Bearer ${sessionManager.getAccessToken()}`
                    }
                })
            ]);

            if (!healthResponse.ok || !logsResponse.ok) {
                throw new Error('Failed to load system data');
            }

            const healthData = await healthResponse.json();
            const logsData = await logsResponse.json();

            this.updateSystemOverview(healthData.data.health);
            this.updateSystemLogs(logsData.data.logs);
        } catch (error) {
            console.error('Error loading system data:', error);
            this.showError('Failed to load system data');
        }
    }

    updateSystemOverview(health) {
        document.getElementById('system-status').textContent = health.status;
        document.getElementById('system-status').parentElement.parentElement.className = 
            `card bg-${health.status === 'healthy' ? 'success' : 'danger'} text-white`;
        
        const uptimeHours = Math.floor(health.uptime / 3600);
        const uptimeMinutes = Math.floor((health.uptime % 3600) / 60);
        document.getElementById('system-uptime').textContent = `${uptimeHours}h ${uptimeMinutes}m`;
        
        const memoryMB = Math.round(health.memory.heapUsed / 1024 / 1024);
        document.getElementById('memory-usage').textContent = `${memoryMB} MB`;
        
        document.getElementById('database-status').textContent = health.database;
        document.getElementById('database-status').parentElement.parentElement.className = 
            `card bg-${health.database === 'connected' ? 'success' : 'danger'} text-white`;
    }

    updateSystemLogs(logs) {
        const container = document.getElementById('system-logs');
        
        if (!logs || logs.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No system logs available</div>';
            return;
        }

        container.innerHTML = logs.map(log => `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <div class="small">${log.message}</div>
                    <div class="text-muted" style="font-size: 0.75rem;">${this.formatTime(log.timestamp)}</div>
                </div>
                <span class="badge bg-${this.getLogLevelColor(log.level)}">${log.level}</span>
            </div>
        `).join('');
    }

    updateSystemInfo(health) {
        const container = document.getElementById('system-info');
        
        container.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>System Information</h6>
                    <p><strong>Node Version:</strong> ${health.nodeVersion}</p>
                    <p><strong>Platform:</strong> ${health.platform}</p>
                    <p><strong>Architecture:</strong> ${health.arch}</p>
                    <p><strong>Uptime:</strong> ${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m</p>
                </div>
                <div class="col-md-6">
                    <h6>Memory Usage</h6>
                    <p><strong>Heap Used:</strong> ${Math.round(health.memory.heapUsed / 1024 / 1024)} MB</p>
                    <p><strong>Heap Total:</strong> ${Math.round(health.memory.heapTotal / 1024 / 1024)} MB</p>
                    <p><strong>External:</strong> ${Math.round(health.memory.external / 1024 / 1024)} MB</p>
                    <p><strong>RSS:</strong> ${Math.round(health.memory.rss / 1024 / 1024)} MB</p>
                </div>
            </div>
        `;
    }

    // Utility functions
    formatRoleName(role) {
        const roleNames = {
            'super_admin': 'Super Admin',
            'admin': 'Admin',
            'moderator': 'Moderator',
            'premium_user': 'Premium User',
            'standard_user': 'Standard User',
            'free_user': 'Free User',
            'suspended_user': 'Suspended User'
        };
        return roleNames[role] || role;
    }

    formatPlanName(plan) {
        const planNames = {
            'starter': 'Starter',
            'premium': 'Premium'
        };
        return planNames[plan] || plan;
    }

    getRoleBadgeColor(role) {
        const colors = {
            'super_admin': 'danger',
            'admin': 'warning',
            'moderator': 'info',
            'premium_user': 'success',
            'standard_user': 'primary',
            'free_user': 'secondary',
            'suspended_user': 'danger'
        };
        return colors[role] || 'secondary';
    }

    getSubscriptionBadgeColor(status) {
        const colors = {
            'active': 'success',
            'inactive': 'secondary',
            'cancelled': 'danger',
            'expired': 'warning'
        };
        return colors[status] || 'secondary';
    }

    getStatusIndicator(user) {
        if (user.securityStatus?.accountLocked) return 'danger';
        if (user.activeSessions?.length > 0) return 'online';
        return 'offline';
    }

    getUserStatus(user) {
        if (user.securityStatus?.accountLocked) return 'Locked';
        if (user.activeSessions?.length > 0) return 'Online';
        return 'Offline';
    }

    getLogLevelColor(level) {
        const colors = {
            'error': 'danger',
            'warn': 'warning',
            'info': 'info',
            'debug': 'secondary'
        };
        return colors[level] || 'secondary';
    }

    formatTime(timestamp) {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    showSuccess(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-success border-0 position-fixed top-0 end-0 m-3';
        toast.style.zIndex = '9999';
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        document.body.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            document.body.removeChild(toast);
        });
    }

    showError(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-danger border-0 position-fixed top-0 end-0 m-3';
        toast.style.zIndex = '9999';
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        document.body.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            document.body.removeChild(toast);
        });
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});

// Logout function
function logout() {
    sessionManager.logout();
    window.location.href = 'login.html';
}
