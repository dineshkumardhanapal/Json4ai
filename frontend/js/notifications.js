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
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
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