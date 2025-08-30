// Custom notification system to replace browser alerts
class NotificationManager {
  constructor() {
    this.container = document.getElementById('notification-container');
    if (!this.container) {
      this.createContainer();
    }
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', title = null, duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = this.getIcon(type);
    const notificationTitle = title || this.getDefaultTitle(type);
    
    notification.innerHTML = `
      <div class="notification-icon">${icon}</div>
      <div class="notification-content">
        <div class="notification-title">${notificationTitle}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    this.container.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.hide(notification);
      }, duration);
    }

    return notification;
  }

  hide(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 300);
  }

  getIcon(type) {
    switch (type) {
      case 'success':
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`;
      case 'error':
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636"></path>
        </svg>`;
      case 'warning':
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"></path>
        </svg>`;
      case 'info':
      default:
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`;
    }
  }

  getDefaultTitle(type) {
    switch (type) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'info':
      default:
        return 'Information';
    }
  }

  // Convenience methods
  success(message, title = null, duration = 5000) {
    return this.show(message, 'success', title, duration);
  }

  error(message, title = null, duration = 8000) {
    return this.show(message, 'error', title, duration);
  }

  warning(message, title = null, duration = 6000) {
    return this.show(message, 'warning', title, duration);
  }

  info(message, title = null, duration = 5000) {
    return this.show(message, 'info', title, duration);
  }
}

// Global notification instance
const notifications = new NotificationManager();

// Global functions for easy access
function showNotification(message, type = 'info', title = null, duration = 5000) {
  return notifications.show(message, type, title, duration);
}

function showSuccess(message, title = null, duration = 5000) {
  return notifications.success(message, title, duration);
}

function showError(message, title = null, duration = 8000) {
  return notifications.error(message, title, duration);
}

function showWarning(message, title = null, duration = 6000) {
  return notifications.warning(message, title, duration);
}

function showInfo(message, title = null, duration = 5000) {
  return notifications.info(message, title, duration);
}