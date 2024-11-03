// Constants and Types
const YOUTUBE_CHANNELS_URL = 'https://www.youtube.com/feed/channels';

/**
 * @typedef {Object} Message
 * @property {string} type
 * @property {string} msg
 * @property {boolean} [running]
 */
class ExtensionPopupController {
  constructor() {
    this.button = document.getElementById('start');
    this.statusText = document.createElement('div');
    this.setupUI();
    this.initializeListeners();
  }

  /**
   * Sets up the extension popup UI
   */
  setupUI() {
    this.button.className = 'action-button';
    this.button.innerText = 'Start Unsubscribing';

    this.statusText.className = 'status-text';
    this.button.parentElement.insertBefore(this.statusText, this.button.nextSibling);

    const style = document.createElement('style');
    style.textContent = `
      .action-button {
        background: #cc0000;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
        width: 100%;
        margin-bottom: 10px;
      }
      
      .action-button:hover {
        background: #aa0000;
      }
      
      .action-button[running="true"] {
        background: #666;
      }
      
      .status-text {
        color: #666;
        font-size: 12px;
        margin-top: 8px;
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Initialize all event listeners
   */
  initializeListeners() {
    this.button.addEventListener('click', () => this.handleButtonClick());
    this.setupMessageListener();
    this.setupTabUpdateListener();
  }

  /**
   * @returns {Promise<chrome.tabs.Tab>}
   */
  async getCurrentTab() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab;
  }

  /**
   * Executes a function in the content script
   * @param {number} tabId 
   * @param {string} functionName 
   */
  async executeContentScript(tabId, functionName) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (fname) => {
        window[fname]();
      },
      args: [functionName]
    });
  }

  /**
   * Updates the UI status
   * @param {string} message 
   * @param {boolean} [isRunning] 
   */
  updateStatus(message, isRunning = undefined) {
    this.statusText.textContent = message;
    if (isRunning !== undefined) {
      this.button.setAttribute('running', isRunning.toString());
      this.button.innerText = isRunning ? 'Close' : 'Start Unsubscribing';
    }
  }

  /**
   * Handles the start/stop button click
   */
  async handleButtonClick() {
    try {
      const tab = await this.getCurrentTab();
      const isRunning = this.button.getAttribute('running') === 'true';

      if (isRunning) {
        await this.executeContentScript(tab.id, 'Close');
      } else {
        if (tab.url !== YOUTUBE_CHANNELS_URL) {
          this.updateStatus('Redirecting to YouTube channels page...');
          await chrome.tabs.update(tab.id, { url: YOUTUBE_CHANNELS_URL });
        } else {
          await this.executeContentScript(tab.id, 'start');
        }
      }
    } catch (error) {
      this.updateStatus(`Error: ${error.message}`);
      console.error('Error in button click handler:', error);
    }
  }

  /**
   * Sets up the runtime message listener
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'msg') {
        this.updateStatus(message.msg, message.running);
      }
    });
  }

  /**
   * Sets up the tab update listener
   */
  setupTabUpdateListener() {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url === YOUTUBE_CHANNELS_URL) {
        this.updateStatus('Ready to unsubscribe', false);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ExtensionPopupController();
});