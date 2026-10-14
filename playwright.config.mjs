import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./test/browser',
  use:{baseURL:'http://127.0.0.1:4173/product/', browserName:'chromium'},
  projects:[{name:'desktop',use:{viewport:{width:1280,height:800}}},{name:'mobile',use:{viewport:{width:390,height:844}}}],
  webServer:{command:'node test/server.mjs',url:'http://127.0.0.1:4173/product/index.html',reuseExistingServer:false},
  reporter:process.env.CI ? [['list'],['html',{open:'never'}]] : 'list'
});
