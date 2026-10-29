import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests',testMatch:'**/*.e2e.ts',workers:1,timeout:30000,reporter:'list',webServer:{command:'node scripts/fixture-server.mjs',url:'http://127.0.0.1:4178',reuseExistingServer:true}});
