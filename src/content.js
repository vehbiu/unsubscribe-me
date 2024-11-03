const createUI = () => {
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 9999;
    min-width: 320px;
    font-family: 'YouTube Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: slideIn 0.3s ease-out;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.02); }
      100% { transform: scale(1); }
    }

    .progress-container {
      background: #f0f0f0;
      border-radius: 8px;
      height: 8px;
      overflow: hidden;
      position: relative;
      margin: 15px 0;
    }

    .progress-bar {
      background: linear-gradient(90deg, #ff0000, #ff4444);
      height: 100%;
      width: 0%;
      transition: width 0.3s ease-in-out;
      border-radius: 8px;
      position: relative;
      overflow: hidden;
    }

    .progress-bar::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.2),
        transparent
      );
      animation: shine 1.5s infinite;
    }

    @keyframes shine {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .action-button {
      background: #ff0000;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      width: 100%;
      margin-top: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .action-button:hover {
      background: #cc0000;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(204, 0, 0, 0.2);
    }

    .action-button:active {
      transform: translateY(0);
    }

    .action-button.secondary {
      background: #065fd4;
    }

    .action-button.secondary:hover {
      background: #0056bf;
      box-shadow: 0 2px 8px rgba(6, 95, 212, 0.2);
    }

    .action-button.stop {
      background: #606060;
    }

    .action-button.stop:hover {
      background: #505050;
      box-shadow: 0 2px 8px rgba(80, 80, 80, 0.2);
    }
  `;
  document.head.appendChild(style);

  const title = document.createElement('div');
  title.style.cssText = `
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #0f0f0f;
  `;
  title.textContent = 'Unsubscribe Me! 🚀';

  const status = document.createElement('div');
  status.style.cssText = `
    font-size: 14px;
    color: #606060;
    margin-bottom: 12px;
    font-weight: 500;
  `;

  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress-container';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  progressContainer.appendChild(progressBar);

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
  `;

  const stopButton = document.createElement('button');
  stopButton.className = 'action-button stop';
  stopButton.textContent = 'Stop';

  const resubscribeButton = document.createElement('button');
  resubscribeButton.className = 'action-button secondary';
  resubscribeButton.textContent = 'Re-subscribe';
  resubscribeButton.style.display = 'none';
  
  buttonContainer.appendChild(stopButton);
  buttonContainer.appendChild(resubscribeButton);

  container.appendChild(title);
  container.appendChild(status);
  container.appendChild(progressContainer);
  container.appendChild(buttonContainer);

  return { container, progressBar, status, stopButton, resubscribeButton };
};

class ChannelController {
  constructor() {
    this.isRunning = false;
    this.ui = createUI();
    this.popupObserver = this.createPopupObserver();
  }

  createPopupObserver() {
    return new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "aria-hidden") {
          const confirmButton = mutation.target?.querySelector("#confirm-button button");
          if (confirmButton) {
            confirmButton.click();
          }
        }
      }
    });
  }

  isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    const html = document.documentElement;
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || html.clientHeight) &&
      rect.right <= (window.innerWidth || html.clientWidth)
    );
  }

  async scrollToElement(element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  async stop() {
    this.isRunning = false;
    this.popupObserver.disconnect();
    
    this.ui.container.style.animation = 'slideIn 0.3s ease-out reverse';
    await new Promise(resolve => setTimeout(resolve, 300));
    this.ui.container.remove();
    
    await chrome.runtime.sendMessage({
      type: "msg",
      msg: "Process stopped",
      running: false
    });
  }

  async processChannels(isResubscribe = false) {
    const selector = isResubscribe ? 
      "#buttons > #subscribe-button > ytd-subscribe-button-renderer:not([subscribe-button-invisible])" :
      "#buttons > #subscribe-button > ytd-subscribe-button-renderer[subscribe-button-invisible]";
    
    const channels = Array.from(document.querySelectorAll(selector));

    if (!channels.length) {
      this.ui.status.textContent = `No ${isResubscribe ? 'unsubscribed' : 'subscribed'} channels found`;
      return false;
    }

    const actionWord = isResubscribe ? 'Resubscribing' : 'Unsubscribing';

    for (let i = 0; i < channels.length && this.isRunning; i++) {
      const channel = channels[i];
      
      this.ui.status.textContent = `${actionWord}: ${i + 1} of ${channels.length}`;
      this.ui.progressBar.style.width = `${(i + 1) / channels.length * 100}%`;

      if (!this.isElementInViewport(channel)) {
        await this.scrollToElement(channel);
      }

      const button = channel.querySelector("button");
      if (button) {
        button.click();
        this.ui.container.style.animation = 'pulse 0.3s ease-out';
        setTimeout(() => {
          this.ui.container.style.animation = '';
        }, 300);
      }

      await new Promise(resolve => setTimeout(resolve, 150));
    }

    return true;
  }

  async start(isResubscribe = false) {
    this.isRunning = true;
    document.body.appendChild(this.ui.container);
    
    this.ui.progressBar.style.width = '0%';
    this.ui.stopButton.addEventListener('click', () => this.stop());

    const popup = document.querySelector("ytd-popup-container");
    this.popupObserver.observe(popup, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-hidden"]
    });

    await chrome.runtime.sendMessage({
      type: "msg",
      msg: `Starting ${isResubscribe ? 'resubscribe' : 'unsubscribe'} process`,
      running: true
    });

    const success = await this.processChannels(isResubscribe);

    if (success && this.isRunning) {
      this.ui.status.textContent = `${isResubscribe ? 'Resubscribe' : 'Unsubscribe'} process completed!`;
      this.ui.stopButton.textContent = 'Close';
      
      if (!isResubscribe) {
        this.ui.resubscribeButton.style.display = 'block';
        this.ui.resubscribeButton.addEventListener('click', () => {
          this.ui.resubscribeButton.style.display = 'none';
          this.ui.progressBar.style.width = '0%';
          this.processChannels(true);
        });
      }

      const rateLink = document.createElement('a');
      /* TODO: Implement once approved on Chrome Web Store */
      rateLink.href = 'https://chrome.google.com/webstore/';
      rateLink.textContent = 'Rate this extension';
      rateLink.style.cssText = `
        display: block;
        margin-top: 16px;
        color: #065fd4;
        text-decoration: none;
        font-size: 14px;
        text-align: center;
      `;
      this.ui.container.appendChild(rateLink);
    }
  }
}

const controller = new ChannelController();
window.stop = () => controller.stop();
window.start = () => controller.start();