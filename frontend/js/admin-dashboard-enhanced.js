/**
 * Enhanced Super Admin Dashboard
 * Comprehensive monitoring and analytics for JSON4AI platform
 */

class EnhancedAdminDashboard {
    constructor() {
        this.charts = {};
        this.refreshInterval = 30000; // 30 seconds
        this.isLoading = false;
        this.currentSection = 'overview';
        this.dataCache = {};
        
        this.init();
    }

    async init() {
        // Initializing Enhanced Admin Dashboard
        
        // Check authentication first
        if (!this.checkAuthentication()) {
            return;
        }

        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadDashboardData();
        
        // Start auto-refresh
        this.startAutoRefresh();
        
        // Enhanced Admin Dashboard initialized successfully
    }

    checkAuthentication() {
        // Check if admin authentication is available
        if (window.adminAuth && window.adminAuth.isAdminAuthenticated()) {
            const adminUserData = window.adminAuth.getAdminUserData();
            if (adminUserData && adminUserData.role === 'super_admin') {
                return true;
            } else {
                this.showError('Access denied. Super Admin privileges required.');
                setTimeout(() => window.location.href = '/admin-login.html', 3000);
                return false;
            }
        } else {
            // Redirect to admin login
            window.location.href = '/admin-login.html';
            return false;
        }
    }

    setupEventListeners() {
        // Navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const section = tab.dataset.section;
                this.showSection(section);
            });
        });

        // Chart period controls
        document.querySelectorAll('.chart-control').forEach(control => {
            control.addEventListener('click', (e) => {
                e.preventDefault();
                const period = control.dataset.period;
                this.updateChartPeriod(control, period);
            });
        });

        // Real-time toggle
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAutoRefresh();
            } else {
                this.resumeAutoRefresh();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '1': e.preventDefault(); this.showSection('overview'); break;
                    case '2': e.preventDefault(); this.showSection('security'); break;
                    case '3': e.preventDefault(); this.showSection('analytics'); break;
                    case '4': e.preventDefault(); this.showSection('users'); break;
                    case '5': e.preventDefault(); this.showSection('system'); break;
                    case '6': e.preventDefault(); this.showSection('alerts'); break;
                    case 'r': e.preventDefault(); this.refreshData(); break;
                }
            }
        });
    }

    showSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Show section
        document.querySelectorAll('.dashboard-section').forEach(sec => {
            sec.style.display = 'none';
        });
        document.getElementById(`${section}-section`).style.display = 'block';

        this.currentSection = section;

        // Load section-specific data
        this.loadSectionData(section);
    }

    async loadDashboardData() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            const [overviewData, authMetrics, systemHealth, alerts] = await Promise.all([
                this.fetchData('/api/admin/dashboard/overview'),
                this.fetchData('/api/admin/security/auth-metrics'),
                this.fetchData('/api/admin/system/health-metrics'),
                this.fetchData('/api/admin/alerts/active-alerts')
            ]);

            this.updateOverviewMetrics(overviewData);
            this.updateSecurityMetrics(authMetrics);
            this.updateSystemMetrics(systemHealth);
            this.updateAlerts(alerts);

            // Initialize charts
            this.initializeCharts(overviewData);

        } catch (error) {
            // Failed to load dashboard data
            this.showError('Failed to load dashboard data');
        } finally {
            this.isLoading = false;
        }
    }

    async loadSectionData(section) {
        try {
            switch (section) {
                case 'overview':
                    await this.loadOverviewData();
                    break;
                case 'security':
                    await this.loadSecurityData();
                    break;
                case 'analytics':
                    await this.loadAnalyticsData();
                    break;
                case 'users':
                    await this.loadUsersData();
                    break;
                case 'system':
                    await this.loadSystemData();
                    break;
                case 'alerts':
                    await this.loadAlertsData();
                    break;
            }
        } catch (error) {
            // Failed to load section data
            this.showError(`Failed to load ${section} data`);
        }
    }

    async loadOverviewData() {
        const data = await this.fetchData('/api/admin/dashboard/overview');
        this.updateOverviewMetrics(data);
        this.updateRecentActivity(data.recentRegistrations, data.recentLogins);
    }

    async loadSecurityData() {
        const [authMetrics, threatMetrics] = await Promise.all([
            this.fetchData('/api/admin/security/auth-metrics'),
            this.fetchData('/api/admin/security/threat-metrics')
        ]);

        this.updateSecurityMetrics(authMetrics);
        this.updateThreatMetrics(threatMetrics);
    }

    async loadAnalyticsData() {
        const [revenueData, engagementData] = await Promise.all([
            this.fetchData('/api/admin/analytics/revenue-metrics'),
            this.fetchData('/api/admin/analytics/engagement-metrics')
        ]);

        this.updateRevenueAnalytics(revenueData);
        this.updateEngagementAnalytics(engagementData);
    }

    async loadUsersData() {
        const usersData = await this.fetchData('/api/admin/users');
        this.updateUsersTable(usersData);
    }

    async loadSystemData() {
        const systemData = await this.fetchData('/api/admin/system/health-metrics');
        this.updateSystemMetrics(systemData);
        this.updateSystemChart(systemData);
    }

    async loadAlertsData() {
        const alertsData = await this.fetchData('/api/admin/alerts/active-alerts');
        this.updateAlerts(alertsData);
    }

    async fetchData(endpoint) {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`${window.location.origin.replace('3000', '5000')}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.success ? data.data : data;
    }

    updateOverviewMetrics(data) {
        // Update key metrics
        this.updateElement('total-users', data.overview.totalUsers);
        this.updateElement('active-users', data.overview.activeUsers24h);
        this.updateElement('monthly-revenue', `$${data.overview.revenue.toLocaleString()}`);
        this.updateElement('security-score', '98%');

        // Update growth indicators
        this.updateElement('user-growth', `+${data.overview.newUsers30d}`);
        this.updateElement('active-growth', `+${data.overview.activeUsers24h}`);
        this.updateElement('revenue-growth', '+12%');
    }

    updateSecurityMetrics(data) {
        this.updateElement('failed-logins', data.failedLogins.totalFailed);
        this.updateElement('mfa-rate', `${data.mfaStats.mfaEnabled}%`);
        this.updateElement('high-risk-users', data.suspiciousLogins.length);

        // Update security alerts
        this.updateSecurityAlerts(data.suspiciousLogins);
    }

    updateSystemMetrics(data) {
        const uptime = Math.floor(data.systemHealth.uptime / 3600);
        this.updateElement('server-uptime', `${uptime}h`);
        this.updateElement('memory-usage', `${data.systemHealth.memory.usagePercent}%`);
        this.updateElement('api-response-time', `${data.apiMetrics.averageResponseTime}ms`);
    }

    updateAlerts(data) {
        const alertsContainer = document.getElementById('alerts-list');
        if (!data.alerts || data.alerts.length === 0) {
            alertsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bell-slash"></i>
                    <div>No active alerts</div>
                </div>
            `;
            return;
        }

        alertsContainer.innerHTML = data.alerts.map(alert => `
            <div class="alert-item ${alert.severity}">
                <div class="alert-icon ${alert.severity}">
                    <i class="fas fa-${this.getAlertIcon(alert.type)}"></i>
                </div>
                <div class="alert-content">
                    <div class="alert-title">${alert.title}</div>
                    <div class="alert-description">${alert.description}</div>
                    <div class="alert-time">${this.formatTime(alert.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }

    updateRecentActivity(registrations, logins) {
        const tbody = document.getElementById('recent-activity');
        const activities = [
            ...registrations.slice(0, 5).map(reg => ({
                user: `${reg.firstName} ${reg.lastName}`,
                action: 'Registered',
                time: reg.createdAt,
                status: 'success'
            })),
            ...logins.slice(0, 5).map(login => ({
                user: `${login.firstName} ${login.lastName}`,
                action: 'Logged in',
                time: login.lastLogin,
                status: 'success'
            }))
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

        tbody.innerHTML = activities.map(activity => `
            <tr>
                <td>${activity.user}</td>
                <td>${activity.action}</td>
                <td>${this.formatTime(activity.time)}</td>
                <td><span class="status-badge active">${activity.status}</span></td>
            </tr>
        `).join('');
    }

    updateSecurityAlerts(suspiciousLogins) {
        const container = document.getElementById('security-alerts');
        if (!suspiciousLogins || suspiciousLogins.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shield-alt"></i>
                    <div>No security alerts at this time</div>
                </div>
            `;
            return;
        }

        container.innerHTML = suspiciousLogins.map(user => `
            <div class="alert-item high">
                <div class="alert-icon high">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="alert-content">
                    <div class="alert-title">High Risk User: ${user.firstName} ${user.lastName}</div>
                    <div class="alert-description">Risk Score: ${user.securityStatus.riskScore}/100</div>
                    <div class="alert-time">Last login: ${this.formatTime(user.securityStatus.lastLogin)}</div>
                </div>
            </div>
        `).join('');
    }

    updateRevenueAnalytics(data) {
        // Update revenue chart
        if (this.charts.revenue) {
            this.charts.revenue.data.labels = data.churnData.map(item => `${item._id.year}-${item._id.month}`);
            this.charts.revenue.data.datasets[0].data = data.churnData.map(item => item.lostRevenue);
            this.charts.revenue.update();
        }
    }

    updateEngagementAnalytics(data) {
        // Update engagement chart
        if (this.charts.engagement) {
            this.charts.engagement.data.labels = data.retentionCohorts.map(item => item.cohort);
            this.charts.engagement.data.datasets[0].data = data.retentionCohorts.map(item => item.retention);
            this.charts.engagement.update();
        }

        // Update feature usage
        const container = document.getElementById('feature-usage');
        container.innerHTML = data.featureUsage.map(feature => `
            <div class="metric-card" style="margin-bottom: 1rem;">
                <div class="metric-header">
                    <span class="metric-title">${feature.feature}</span>
                    <div class="metric-icon" style="background: var(--admin-primary);">
                        <i class="fas fa-chart-bar"></i>
                    </div>
                </div>
                <div class="metric-value">${feature.usage}%</div>
                <div class="metric-change">
                    <span>Satisfaction: ${feature.satisfaction}/5</span>
                </div>
            </div>
        `).join('');
    }

    updateUsersTable(data) {
        const tbody = document.getElementById('users-table');
        if (!data.users || data.users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-users"></i>
                        <div>No users found</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.users.map(user => `
            <tr>
                <td>${user.firstName} ${user.lastName}</td>
                <td>${user.email}</td>
                <td><span class="status-badge ${user.role === 'super_admin' ? 'danger' : 'active'}">${user.role}</span></td>
                <td><span class="status-badge ${user.subscriptionPlan}">${user.subscriptionPlan}</span></td>
                <td><span class="status-badge ${user.emailVerified ? 'active' : 'warning'}">${user.emailVerified ? 'Verified' : 'Pending'}</span></td>
                <td>${this.formatTime(user.lastLogin)}</td>
                <td>
                    <button class="action-btn" onclick="adminDashboard.viewUser('${user._id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn" onclick="adminDashboard.editUser('${user._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    updateSystemChart(data) {
        if (!this.charts.system) return;

        // Update system performance chart with real-time data
        const now = new Date();
        this.charts.system.data.labels.push(now.toLocaleTimeString());
        this.charts.system.data.datasets[0].data.push(data.systemHealth.memory.usagePercent);
        this.charts.system.data.datasets[1].data.push(data.apiMetrics.averageResponseTime);

        // Keep only last 20 data points
        if (this.charts.system.data.labels.length > 20) {
            this.charts.system.data.labels.shift();
            this.charts.system.data.datasets[0].data.shift();
            this.charts.system.data.datasets[1].data.shift();
        }

        this.charts.system.update('none');
    }

    initializeCharts(data) {
        // User Growth Chart
        this.initUserGrowthChart(data);
        
        // User Distribution Chart
        this.initUserDistributionChart(data.roleDistribution);
        
        // Revenue Chart
        this.initRevenueChart();
        
        // Engagement Chart
        this.initEngagementChart();
        
        // System Chart
        this.initSystemChart();
    }

    initUserGrowthChart(data) {
        const ctx = document.getElementById('userGrowthChart').getContext('2d');
        this.charts.userGrowth = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateDateLabels(7),
                datasets: [{
                    label: 'New Users',
                    data: this.generateMockData(7, 0, 50),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#e2e8f0' }
                    }
                },
                scales: {
                    x: { 
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: { 
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }

    initUserDistributionChart(roleDistribution) {
        const ctx = document.getElementById('userDistributionChart').getContext('2d');
        this.charts.userDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: roleDistribution.map(item => item._id),
                datasets: [{
                    data: roleDistribution.map(item => item.count),
                    backgroundColor: [
                        '#6366f1',
                        '#8b5cf6',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#e2e8f0' }
                    }
                }
            }
        });
    }

    initRevenueChart() {
        const ctx = document.getElementById('revenueChart').getContext('2d');
        this.charts.revenue = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Revenue ($)',
                    data: [12000, 15000, 18000, 22000, 25000, 28000],
                    backgroundColor: 'rgba(99, 102, 241, 0.8)',
                    borderColor: '#6366f1',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#e2e8f0' }
                    }
                },
                scales: {
                    x: { 
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: { 
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }

    initEngagementChart() {
        const ctx = document.getElementById('engagementChart').getContext('2d');
        this.charts.engagement = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Month 2', 'Month 3'],
                datasets: [{
                    label: 'Retention Rate (%)',
                    data: [85, 72, 68, 61, 54, 47],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#e2e8f0' }
                    }
                },
                scales: {
                    x: { 
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: { 
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }

    initSystemChart() {
        const ctx = document.getElementById('systemChart').getContext('2d');
        this.charts.system = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Memory Usage (%)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Response Time (ms)',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        labels: { color: '#e2e8f0' }
                    }
                },
                scales: {
                    x: { 
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        ticks: { color: '#94a3b8' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }

    updateChartPeriod(control, period) {
        // Update active state
        control.parentElement.querySelectorAll('.chart-control').forEach(c => c.classList.remove('active'));
        control.classList.add('active');

        // Update chart data based on period
        // Updating chart period
        // Implementation would depend on specific chart requirements
    }

    startAutoRefresh() {
        this.refreshTimer = setInterval(() => {
            this.refreshData();
        }, this.refreshInterval);
    }

    pauseAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
    }

    resumeAutoRefresh() {
        this.startAutoRefresh();
    }

    async refreshData() {
        if (this.isLoading) return;
        
        // Refreshing dashboard data
        await this.loadSectionData(this.currentSection);
        
        // Update last refresh time
        const indicator = document.querySelector('.real-time-indicator');
        if (indicator) {
            indicator.title = `Last updated: ${new Date().toLocaleTimeString()}`;
        }
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    formatTime(timestamp) {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    getAlertIcon(type) {
        const icons = {
            security: 'shield-alt',
            system: 'server',
            business: 'chart-line',
            user: 'user'
        };
        return icons[type] || 'bell';
    }

    generateDateLabels(days) {
        const labels = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        return labels;
    }

    generateMockData(count, min, max) {
        const data = [];
        for (let i = 0; i < count; i++) {
            data.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        return data;
    }

    showError(message) {
        // Admin Dashboard Error
        // Implementation for showing error notifications
        // Show notification instead of alert
    }

    // User management actions
    viewUser(userId) {
        // Viewing user
        // Implementation for viewing user details
    }

    editUser(userId) {
        // Editing user
        // Implementation for editing user
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new EnhancedAdminDashboard();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (window.adminDashboard) {
        if (document.hidden) {
            window.adminDashboard.pauseAutoRefresh();
        } else {
            window.adminDashboard.resumeAutoRefresh();
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.adminDashboard) {
        window.adminDashboard.pauseAutoRefresh();
    }
});
