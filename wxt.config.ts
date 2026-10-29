import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Screen Fit', description: '__MSG_extensionDescription__',default_locale:'en',
    permissions: ['activeTab', 'scripting', 'storage', 'webNavigation'],
    optional_host_permissions: ['https://*/*','http://*/*'],
    action: { default_title: '__MSG_actionTitle__' },
    commands: { 'toggle-fit': { suggested_key: { default: 'Alt+Shift+F' }, description: '__MSG_toggleCommand__' }, 'select-video': { suggested_key: { default: 'Alt+Shift+V' }, description: '__MSG_selectCommand__' } },
    icons: {16:'icon/16.png',32:'icon/32.png',48:'icon/48.png',128:'icon/128.png'},
  },
});
