const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('public/analytics.js', 'utf8');

function analyticsRequest(hostname) {
  const handlers = {};
  const requests = [];
  const target = {
    matches(selector) { return selector.includes('.figma-link'); },
  };
  const context = {
    location: { hostname, pathname: '/icons', search: '' },
    document: {
      addEventListener(name, handler) { handlers[name] = handler; },
      querySelector() { return null; },
    },
    fetch(url, options) { requests.push({ url, options }); return Promise.resolve(); },
    URLSearchParams,
    setTimeout,
    clearTimeout,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  handlers.click({ target: { closest() { return target; } } });
  assert.strictEqual(requests.length, 1, 'analytics click must send one event');
  return requests[0];
}

const sites = analyticsRequest('directum-icon-library.kunivaman.chatgpt.site');
assert.strictEqual(sites.url, '/api/events');

const pages = analyticsRequest('directum-design.desserg.ru');
assert.strictEqual(pages.url, 'https://directum-icon-library.kunivaman.chatgpt.site/api/events');
assert.strictEqual(pages.options.method, 'POST');
assert.strictEqual(pages.options.headers['content-type'], 'application/json');

const route = fs.readFileSync('app/api/events/route.ts', 'utf8');
assert(route.includes('export async function OPTIONS'), 'events API must handle CORS preflight');
assert(route.includes('https://directum-design.desserg.ru'), 'events API must allow the GitHub Pages domain');
assert(route.includes('!allowedOrigins.has(origin)'), 'events API must reject unknown origins');

console.log('Analytics routing for Sites and GitHub Pages: passed');
