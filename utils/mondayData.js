// mondayData.js
// monday.com storage integration for label templates and connection settings
import mondaySdk from 'monday-sdk-js';

const monday = mondaySdk();

const TEMPLATE_KEY = 'label_template';
const CONN_SETTINGS_KEY = 'connection_settings';

export async function saveTemplate(boardId, template) {
  try {
    await monday.storage.instance.setItem(TEMPLATE_KEY, JSON.stringify(template));
    console.log('Template saved successfully');
  } catch (err) {
    console.error('Failed to save template:', err);
    throw err;
  }
}

export async function loadTemplate(boardId) {
  try {
    const data = await monday.storage.instance.getItem(TEMPLATE_KEY);
    if (!data || !data.value) return null;
    return JSON.parse(data.value);
  } catch (err) {
    console.error('Failed to load template:', err);
    return null;
  }
}

export async function saveConnectionSettings(boardId, settings) {
  try {
    await monday.storage.instance.setItem(CONN_SETTINGS_KEY, JSON.stringify(settings));
    console.log('Connection settings saved successfully');
  } catch (err) {
    console.error('Failed to save connection settings:', err);
    throw err;
  }
}

export async function loadConnectionSettings(boardId) {
  try {
    const data = await monday.storage.instance.getItem(CONN_SETTINGS_KEY);
    if (!data || !data.value) return null;
    return JSON.parse(data.value);
  } catch (err) {
    console.error('Failed to load connection settings:', err);
    return null;
  }
}
  