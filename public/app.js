'use strict';

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const app = $('#app');
  const dialog = $('#modal');
  const SUPPORT = 'https://yapin.gg/invite/Maki';
  const DEFAULT_TEMPLATE = '🔴 New upload from **[channel]**!\n\n**[title]**\n[url]';
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    crown: '<path d="m3 6 5 5 4-7 4 7 5-5-2 13H5L3 6Z"/><path d="M6 22h12"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    external: '<path d="M13 4h7v7M20 4 10 14"/><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    play: '<path d="m9 5 11 7-11 7V5Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14l-1 7Z"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6a8 8 0 0 1 13 2L20 12M4 12l.9 4a8 8 0 0 0 13 2"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 8.5a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17h.01"/>',
    hash: '<path d="m9 3-2 18M17 3l-2 18M4 8h17M3 16h17"/>',
    logout: '<path d="M9 4H4v16h5M12 12h9m-4-4 4 4-4 4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
    alert: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
    sparkle: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
    youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3V9Z"/>',
    link: '<path d="m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0) scale(.92)"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M18 15c3 0 4 2 4 5"/>',
    server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M12 6.5h5M12 17.5h5"/>',
  };
  const icon = (name, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" class="${extra}">${paths[name] || paths.bell}</svg>`;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
  const initials = value => String(value || 'M').trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0] || '').join('').toUpperCase();
  const number = value => new Intl.NumberFormat().format(Number(value) || 0);
  const safeURL = value => {
    try {
      const url = new URL(value, location.origin);
      return url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === location.origin) ? url.href : '';
    } catch { return ''; }
  };
  const avatar = (name, url, className = 'server-avatar') => {
    const src = url ? safeURL(url) : '';
    return `<span class="${className}">${src ? `<img src="${escape(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : escape(initials(name))}</span>`;
  };
  const time = value => {
    if (!value) return 'Not yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not yet';
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return date.toLocaleDateString(undefined, {month:'short', day:'numeric'});
  };
  const dateTitle = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString() : 'No activity recorded yet';
  const planName = plan => !plan ? 'Free' : plan.limit === null || plan.tier === 'unlimited' ? 'Unlimited' : plan.premium ? 'Premium' : 'Free';
  const planLabel = plan => planName(plan) === 'Unlimited' ? 'Premium Unlimited' : planName(plan);
  const full = plan => plan && plan.limit !== null && Number(plan.used) >= Number(plan.limit);
  const state = {session:null, servers:[], selected:'', detail:null, view:'overview', filter:'all', search:'', serverSearch:'', loading:false, detailError:'', serverSequence:0, busy:new Set(), modal:null, previousFocus:null};

  class HTTPError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  async function api(path, options = {}) {
    const headers = {'Accept':'application/json', ...options.headers};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.method && options.method !== 'GET' && state.session?.csrf_token) headers['X-CSRF-Token'] = state.session.csrf_token;
    let response;
    try {
      response = await fetch(path, {credentials:'same-origin', ...options, headers, body:options.body === undefined ? undefined : JSON.stringify(options.body)});
    } catch { throw new HTTPError('Maki could not be reached. Check your connection and try again.', 0); }
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      if (response.status === 401 && state.session?.authenticated) {
        state.session = null;
        closeModal();
        renderLogin('Your session expired. Sign in again to continue.');
      }
      throw new HTTPError(typeof data.error === 'string' ? data.error : `The request could not be completed (${response.status}).`, response.status);
    }
    return data;
  }
  function toast(message, error = false) {
    const item = document.createElement('div');
    item.className = `toast${error ? ' error' : ''}`;
    item.innerHTML = `${icon(error ? 'alert' : 'checkCircle')}<span>${escape(message)}</span><button class="icon-btn" aria-label="Dismiss notification">${icon('close')}</button>`;
    item.querySelector('button').addEventListener('click', () => item.remove());
    $('#toasts').append(item);
    setTimeout(() => item.remove(), error ? 11000 : 6000);
  }
  function brand() { return '<span class="brand-mark" aria-hidden="true">m</span><span class="brand-word">maki<small>YOUTUBE × YAPPER</small></span>'; }
  function renderLogin(error = '') {
    app.removeAttribute('aria-busy');
    const enabled = !!state.session?.oauth_enabled;
    app.innerHTML = `<main class="login" id="main-content"><section class="login-left"><a class="brand" href="/" aria-label="Maki home">${brand()}</a><div class="login-copy"><div class="login-pill"><span class="status-dot"></span>YOUR CREATORS. YOUR COMMUNITY.</div><h1>Keep everyone<br><em>in the loop.</em></h1><p>Your favorite creators, delivered to your Yapper server. Set up upload alerts and make every notification feel like you.</p>${error ? `<div class="login-error" role="alert">${escape(error)}</div>` : ''}<div class="login-buttons">${enabled ? `<a class="btn btn-primary" href="/auth/login" target="_top">Continue with Yapper ${icon('arrow')}</a><p class="login-sub">Secure sign-in. Your bot token stays on the server.</p>` : '<p class="muted">Connect through Maki to open your dashboard.</p>'}</div><div class="pair-instructions"><h3>${enabled ? 'Or open a private dashboard link' : 'Sign in through Maki'}</h3><p>Use <code>/dashboard</code> in a Yapper server with Maki. Open the private link Maki sends to your DMs. It expires after five minutes.</p><form id="pair-form" class="pair-code"><label class="sr-only" for="pair-code">Private sign-in code</label><input id="pair-code" name="code" type="password" autocomplete="off" placeholder="Or paste your private sign-in code" required maxlength="256"><button class="btn" type="submit">Connect ${icon('arrow')}</button></form><div id="pair-error" class="field-help" role="alert"></div></div></div><footer class="login-footer"><span class="copyright">Maki · Made for your community</span><a href="${SUPPORT}" target="_blank" rel="noopener noreferrer">Support</a><a href="${SUPPORT}" target="_blank" rel="noopener noreferrer">Get Premium</a></footer></section><aside class="login-right" aria-label="How Maki connects your community"><div class="flow-card"><div class="flow-heading"><span class="flow-youtube">${icon('youtube')}</span><strong>A new upload</strong><span class="badge"><i></i> Auto alerts</span></div><div class="flow-title">A little closer to<br>your favorite creators.</div><p class="flow-body">A custom message, a video card, and a Watch button. Delivered where your community hangs out.</p><div class="flow-preview"><span class="decor-line"></span><span class="play-ring">${icon('play')}</span><span class="decor-line"></span></div><div class="flow-foot"><span class="status-dot"></span>YouTube → Maki → your Yapper server</div></div><div class="flow-delivered">${icon('checkCircle')}<div><strong>Your server. Your notification.</strong><p>Choose a creator, a channel, and a message.</p></div></div><div class="login-caption"><span>${icon('shield')} Permission-aware</span><span>${icon('bell')} Videos & Shorts</span></div></aside></main>`;
  }
  function renderShell() {
    const user = state.session.user || {};
    const name = user.display_name || user.username || 'Your account';
    app.removeAttribute('aria-busy');
    app.innerHTML = `<div class="shell"><button class="mobile-overlay" data-action="toggle-menu" aria-label="Close menu"></button><aside class="sidebar" aria-label="Dashboard navigation"><a class="brand" href="/" aria-label="Maki dashboard">${brand()}</a><div class="section-label">Workspace</div><nav class="nav"><button class="nav-btn active" data-view="overview">${icon('grid')} Overview<span class="nav-dot"></span></button><button class="nav-btn" data-view="subscriptions">${icon('bell')} Subscriptions</button><button class="nav-btn" data-view="plans">${icon('crown')} Premium</button></nav><div class="servers-heading"><div class="section-label">Your servers</div><span class="server-count" id="server-count">0</span></div><div class="server-search">${icon('search')}<label class="sr-only" for="server-search">Find a server</label><input id="server-search" type="search" placeholder="Find a server…" autocomplete="off"></div><div class="server-list" id="server-list"></div><div class="sidebar-bottom"><div class="upgrade-small">${icon('sparkle', 'sparkle')}<strong>A bigger creator lineup.</strong><p>More alerts. More possibilities.<br>Meet Maki Premium.</p><a href="${SUPPORT}" target="_blank" rel="noopener noreferrer">Explore Premium ${icon('arrow')}</a></div><div class="account">${avatar(name, user.avatar_url, 'account-avatar')}<div class="account-text"><strong>${escape(name)}</strong><span>Yapper account connected</span></div><button class="icon-btn" data-action="logout" title="Sign out" aria-label="Sign out">${icon('logout')}</button></div></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumbs"><button class="icon-btn mobile-toggle" data-action="toggle-menu" aria-label="Open menu">${icon('menu')}</button><span class="home-crumb">Dashboard</span>${icon('chevron')}<span class="crumb-current" id="current-breadcrumb">Your servers</span></div><div class="top-actions"><a class="support-top" href="${SUPPORT}" target="_blank" rel="noopener noreferrer">${icon('help')} Need a hand?</a><span class="online-label"><span class="status-dot"></span>Maki connected</span></div></header><main class="main" id="main-content" tabindex="-1"></main></div></div>`;
    renderServerList();
    renderContent();
  }
  function renderServerList() {
    const list = $('#server-list');
    if (!list) return;
    $('#server-count').textContent = state.servers.length;
    const rows = state.servers.filter(server => server.name.toLocaleLowerCase().includes(state.serverSearch.toLocaleLowerCase()));
    list.innerHTML = rows.length ? rows.map(server => `<button class="server-btn${server.id === state.selected ? ' active' : ''}" data-server="${escape(server.id)}" aria-pressed="${server.id === state.selected}">${avatar(server.name, server.icon_url)}<span class="server-name">${escape(server.name)}</span>${server.id === state.selected ? icon('check', 'server-check') : ''}</button>`).join('') : `<p class="sidebar-empty">${state.serverSearch ? 'No matching servers.' : 'No manageable servers yet.'}</p>`;
  }
  function setView(view) {
    state.view = ['overview','subscriptions','plans'].includes(view) ? view : 'overview';
    document.querySelectorAll('[data-view]').forEach(button => {
      const selected = button.dataset.view === state.view;
      button.classList.toggle('active', selected);
      const old = button.querySelector('.nav-dot');
      if (old) old.remove();
      if (selected) button.insertAdjacentHTML('beforeend','<span class="nav-dot"></span>');
    });
    $('.shell')?.classList.remove('menu-open');
    renderContent();
  }
  function renderContent() {
    const main = $('#main-content');
    if (!main || !state.session?.authenticated) return;
    const current = state.servers.find(server => server.id === state.selected);
    $('#current-breadcrumb').textContent = current?.name || 'Your servers';
    if (state.loading) {
      main.innerHTML = '<div class="panel loading-panel" role="status"><span class="loader" aria-hidden="true"></span>Loading your workspace…</div>';
      return;
    }
    if (state.detailError) {
      main.innerHTML = `<section class="panel error-panel" role="alert"><h2>We couldn’t open this workspace.</h2><p>${escape(state.detailError)}</p><button class="btn" data-action="retry">${icon('refresh')} Try again</button></section>`;
      return;
    }
    if (!state.detail) {
      main.innerHTML = `<div class="page-heading"><div><div class="eyebrow">YOUR MAKI WORKSPACE</div><h1>Let’s connect your community.</h1><p>Your manageable servers will appear here.</p></div><button class="btn" data-action="refresh-all">${icon('refresh')} Refresh servers</button></div><section class="panel empty"><div class="empty-icon">${icon('server')}</div><h2>A home for your upload alerts.</h2><p>Add Maki through Yapper’s server settings, then return here. You need server ownership, Administrator, or Manage Server to manage its alerts.</p><a class="btn btn-primary" href="${SUPPORT}" target="_blank" rel="noopener noreferrer">Get help connecting ${icon('external')}</a><p class="field-help">${state.session.bot?.id ? `Maki’s bot ID: <code>${escape(state.session.bot.id)}</code>` : 'Only servers Maki has joined are shown.'}</p></section>`;
      return;
    }
    const detail = state.detail;
    const title = state.view === 'overview' ? 'Your community, in the loop.' : state.view === 'subscriptions' ? 'Your creator lineup.' : 'Make room for more.';
    const description = state.view === 'overview' ? 'A little less checking YouTube. A lot more keeping up.' : state.view === 'subscriptions' ? 'Manage the creators your community wants to hear from.' : 'Choose the right plan for your server’s next chapter.';
    main.innerHTML = `<div class="page-heading"><div><div class="eyebrow">${escape(detail.server?.name || current?.name || 'YOUR SERVER')}</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions"><button class="btn btn-ghost" data-action="refresh" title="Refresh this server">${icon('refresh')} Refresh</button>${state.view !== 'plans' ? `<button class="btn btn-primary" data-action="add" ${full(detail.plan) ? 'disabled title="This server’s subscription limit has been reached"' : ''}>${icon('plus')} Add creator</button>` : ''}</div></div>${state.view === 'plans' ? renderPlans(detail) : `${state.view === 'overview' ? renderStats(detail) + renderStrip(detail) : ''}${full(detail.plan) ? `<div class="notice">${icon('alert')}<span>This server has used all ${escape(detail.plan.limit)} ${escape(planLabel(detail.plan))} subscription slots. Paused alerts also count. Remove an alert or <a class="text-link" href="${SUPPORT}" target="_blank" rel="noopener noreferrer">explore an upgrade</a> to add another creator.</span></div>` : ''}${renderSubscriptionsSection(detail)}`}<footer class="footer-note"><span>${icon('shield')} Changes apply directly to Maki. Server permissions are checked for every action.</span><span>${icon('refresh')} Refreshes while this page is open</span></footer>`;
    if (state.view !== 'plans') renderSubscriptions();
  }
  function renderStats(detail) {
    const stats = detail.stats || {};
    const plan = detail.plan || {used:0,limit:3};
    const subscriptions = detail.subscriptions || [];
    const paused = subscriptions.filter(sub => !sub.enabled).length;
    const cap = plan.limit === null ? 'No subscription cap' : `${number(plan.used)} of ${number(plan.limit)} subscriptions used`;
    return `<section class="stats-grid" aria-label="Server activity"><article class="panel stat"><div class="stat-top">Active subscriptions<span class="stat-icon">${icon('bell')}</span></div><div class="stat-value">${number(stats.active)}</div><div class="stat-bottom good"><span class="tiny-dot"></span>${paused ? `${number(paused)} paused` : 'Ready for the next upload'}</div></article><article class="panel stat"><div class="stat-top">Uploads delivered<span class="stat-icon">${icon('youtube')}</span></div><div class="stat-value">${number(stats.delivered)}</div><div class="stat-bottom">Across this server’s saved alerts</div></article><article class="panel stat"><div class="stat-top">Pending notifications<span class="stat-icon">${icon('clock')}</span></div><div class="stat-value">${number(stats.pending)}</div><div class="stat-bottom">${stats.pending ? 'Waiting for delivery' : 'No uploads waiting in the queue'}</div></article><article class="panel stat stat-plan"><div class="stat-top">Server plan<span class="stat-icon">${icon('crown')}</span></div><div class="stat-value">${escape(planName(plan))}</div><div class="stat-bottom">${escape(cap)}</div><progress class="usage-meter" value="${plan.limit === null ? 0 : Math.min(Number(plan.used), Number(plan.limit))}" max="${plan.limit || 1}" aria-label="Subscription slots used"></progress></article></section>`;
  }
  function renderStrip(detail) {
    const hasIssues = (detail.subscriptions || []).some(sub => sub.last_error);
    return `<section class="panel welcome-strip"><div class="strip-icon">${icon(hasIssues ? 'alert' : 'sparkle')}</div><div class="strip-text"><h3>${hasIssues ? 'One of your alerts needs a little attention.' : 'Your next upload has a place to land.'}</h3><p>${hasIssues ? 'Check the issue on its subscription card, then try a test.' : 'Maki watches public YouTube pages for new videos, Shorts, and streams.'}</p></div><span class="text-link" title="${escape(dateTitle(detail.stats?.last_check))}">${icon('clock')} Checked ${escape(time(detail.stats?.last_check))}</span></section>`;
  }
  function renderSubscriptionsSection() {
    return `<section aria-label="Subscriptions"><div class="section-heading"><div class="section-title"><h2>${state.view === 'overview' ? 'Your subscriptions' : 'All subscriptions'}</h2><span class="count-pill" id="subscription-count">0</span></div><div class="filter-row"><div class="searchbox">${icon('search')}<label class="sr-only" for="subscription-search">Search creators or channels</label><input id="subscription-search" type="search" placeholder="Search creators…" value="${escape(state.search)}" autocomplete="off"></div><div class="segmented" role="group" aria-label="Filter subscription status"><button data-filter="all" class="${state.filter === 'all' ? 'active' : ''}" aria-pressed="${state.filter === 'all'}">All</button><button data-filter="active" class="${state.filter === 'active' ? 'active' : ''}" aria-pressed="${state.filter === 'active'}">Active</button><button data-filter="paused" class="${state.filter === 'paused' ? 'active' : ''}" aria-pressed="${state.filter === 'paused'}">Paused</button></div></div></div><div class="subscriptions-grid" id="subscriptions-grid"></div></section>`;
  }
  function renderSubscriptions() {
    const grid = $('#subscriptions-grid');
    if (!grid) return;
    const subscriptions = state.detail?.subscriptions || [];
    $('#subscription-count').textContent = subscriptions.length;
    const rows = subscriptions.filter(sub => (state.filter === 'all' || (state.filter === 'active' ? sub.enabled : !sub.enabled)) && `${sub.youtube_name} ${sub.destination_name}`.toLocaleLowerCase().includes(state.search.toLocaleLowerCase())).sort((a,b) => a.youtube_name.localeCompare(b.youtube_name));
    if (!subscriptions.length) {
      grid.innerHTML = `<div class="panel empty"><div class="empty-icon">${icon('bell')}</div><h2>Your first creator is one click away.</h2><p>Add a YouTube channel, choose where uploads should appear, and write a message your community will recognize.</p><button class="btn btn-primary" data-action="add">${icon('plus')} Add your first creator</button></div>`;
      return;
    }
    if (!rows.length) {
      grid.innerHTML = '<div class="panel no-results">No subscriptions match this search or filter.</div>';
      return;
    }
    grid.innerHTML = rows.map(sub => {
      const busy = state.busy.has(sub.id) ? 'disabled' : '';
      return `<article class="panel subscription${sub.enabled ? '' : ' paused'}"><div class="subscription-top"><div class="creator-avatar">${escape(initials(sub.youtube_name))}</div><div class="creator-info"><h3 title="${escape(sub.youtube_name)}">${escape(sub.youtube_name)}</h3><a href="https://www.youtube.com/channel/${encodeURIComponent(sub.youtube_id)}" target="_blank" rel="noopener noreferrer">YouTube channel ${icon('external')}</a></div><span class="badge ${sub.last_error ? 'warn' : sub.enabled ? '' : 'neutral'}"><i></i>${sub.last_error ? 'Check alert' : sub.enabled ? 'Active' : 'Paused'}</span></div><div class="destination">${icon('hash')} Posting in <strong>${escape(sub.destination_name)}</strong></div><div class="template-snippet">${escape(sub.template)}</div><div class="card-meta"><span><strong>${number(sub.delivered)}</strong> uploads delivered</span><span title="${escape(dateTitle(sub.last_notified_at))}">Last sent ${escape(time(sub.last_notified_at))}</span></div>${sub.last_error ? `<div class="issue">${icon('alert')}<span>${escape(sub.last_error)}</span></div>` : ''}<div class="card-actions"><button class="btn btn-ghost" data-action="${sub.enabled ? 'pause' : 'resume'}" data-sub="${escape(sub.id)}" ${busy}>${icon(sub.enabled ? 'pause' : 'play')}${sub.enabled ? 'Pause' : 'Resume'}</button><button class="btn btn-ghost" data-action="test" data-sub="${escape(sub.id)}" ${busy}>${icon('play')} Test</button><button class="btn btn-ghost" data-action="edit" data-sub="${escape(sub.id)}" ${busy}>${icon('edit')} Edit</button><button class="icon-btn" data-action="remove" data-sub="${escape(sub.id)}" title="Remove ${escape(sub.youtube_name)}" aria-label="Remove ${escape(sub.youtube_name)}" ${busy}>${icon('trash')}</button></div></article>`;
    }).join('');
  }
  function renderPlans(detail) {
    const current = detail.plan || {};
    const features = ['Custom upload messages','Videos, Shorts & streams','Role mentions and test alerts'];
    const cards = [{tier:'free',name:'Free',cap:'3',description:'A small lineup with a lot to say.'},{tier:'standard',name:'Premium',cap:'15',description:'Bring more of your favorites together.'},{tier:'unlimited',name:'Premium Unlimited',cap:'∞',description:'Your community’s complete creator lineup.'}];
    return `<section class="panel server-summary">${avatar(detail.server?.name,detail.server?.icon_url)}<div><h2>${escape(detail.server?.name || 'Your server')}</h2><p>${number(current.used)} saved subscriptions · ${current.limit === null ? 'Unlimited available slots' : `${number(Math.max(0,Number(current.limit)-Number(current.used)))} available slots`}</p></div><span class="badge">${icon('crown')} ${escape(planLabel(current))}</span></section><section class="plan-grid" aria-label="Maki plans">${cards.map(plan => `<article class="panel plan-card${plan.tier === 'standard' ? ' featured' : ''}"><span class="badge ${current.tier === plan.tier || (!current.premium && plan.tier === 'free') ? '' : 'neutral'}">${current.tier === plan.tier || (!current.premium && plan.tier === 'free') ? 'Current plan' : plan.tier === 'standard' ? 'A bigger lineup' : plan.tier === 'unlimited' ? 'Room for everyone' : 'Start here'}</span><h3>${plan.name}</h3><div class="plan-cap">${plan.cap}<small> subscriptions / server</small></div><p>${plan.description}</p><ul class="plan-features">${features.map(feature => `<li>${icon('check')}${feature}</li>`).join('')}</ul><a class="btn ${plan.tier === 'standard' ? 'btn-primary' : ''}" href="${SUPPORT}" target="_blank" rel="noopener noreferrer">${plan.tier === 'free' ? 'Visit support' : 'Ask about Premium'} ${icon('external')}</a></article>`).join('')}</section>${detail.is_bot_owner ? `<section class="panel owner-controls"><div><div class="eyebrow">BOT OWNER CONTROLS</div><h3>Manage this server’s plan</h3><p>Activate a tier or return this server to Free. Existing alerts are retained.</p></div><form id="premium-form" class="owner-form"><label class="sr-only" for="premium-tier">Server plan</label><select id="premium-tier"><option value="free" ${!current.premium ? 'selected' : ''}>Free · 3 subscriptions</option><option value="standard" ${current.tier === 'standard' ? 'selected' : ''}>Premium · 15 subscriptions</option><option value="unlimited" ${current.tier === 'unlimited' ? 'selected' : ''}>Premium Unlimited</option></select><button class="btn" type="submit">Update plan ${icon('arrow')}</button></form></section>` : ''}`;
  }
  async function loadServers() {
    const data = await api('/api/servers');
    state.servers = Array.isArray(data.servers) ? data.servers.map(server => ({...server,name:String(server.name || 'Unnamed server')})) : [];
    state.serverSearch = '';
    const search = $('#server-search');
    if (search) search.value = '';
    renderServerList();
    let remembered = '';
    try { remembered = localStorage.getItem('maki.lastServer') || ''; } catch { /* Optional preference. */ }
    const selected = state.servers.find(server => server.id === state.selected) || state.servers.find(server => server.id === remembered) || state.servers[0];
    if (selected) await selectServer(selected.id);
    else { state.selected = ''; state.detail = null; state.loading = false; state.detailError = ''; renderContent(); }
  }
  async function selectServer(id, silent = false) {
    if (!state.session?.authenticated) return;
    const sequence = ++state.serverSequence;
    const previous = state.selected;
    state.selected = id;
    state.detailError = '';
    if (!silent || previous !== id) { state.loading = true; state.detail = null; }
    renderServerList();
    if (!silent) renderContent();
    try {
      const data = await api(`/api/servers/${encodeURIComponent(id)}`);
      if (sequence !== state.serverSequence || !state.session?.authenticated) return;
      state.detail = data;
      state.loading = false;
      const server = state.servers.find(row => row.id === id);
      if (server && data.plan) server.plan = data.plan;
      try { localStorage.setItem('maki.lastServer', id); } catch { /* Optional preference. */ }
      renderContent();
    } catch (error) {
      if (sequence !== state.serverSequence || !state.session?.authenticated) return;
      state.loading = false;
      if (silent && state.detail) toast(error.message,true);
      else { state.detailError = error.message; renderContent(); }
    }
    $('.shell')?.classList.remove('menu-open');
  }
  const endpoint = (server = state.selected) => `/api/servers/${encodeURIComponent(server)}`;
  const subEndpoint = (id, server = state.selected) => `${endpoint(server)}/subscriptions/${encodeURIComponent(id)}`;
  function findSub(id) { return state.detail?.subscriptions?.find(sub => sub.id === id); }
  async function changeSubscription(action,id) {
    const sub = findSub(id);
    if (!sub || state.busy.has(id)) return;
    const server = state.selected;
    state.busy.add(id);
    renderSubscriptions();
    try {
      await api(`${subEndpoint(id,server)}/${action}`, {method:'POST',body:{}});
      toast(action === 'pause' ? `${sub.youtube_name} is paused.` : `${sub.youtube_name} is resumed. Uploads from its paused period will be skipped.`);
      if (server === state.selected) await selectServer(server,true);
    } catch (error) { toast(error.message,true); }
    finally { state.busy.delete(id); renderSubscriptions(); }
  }
  function openModal(type, sub = null) {
    if (!state.detail) return;
    if (type === 'add' && full(state.detail.plan)) { toast('This server has reached its subscription limit. Remove an alert or upgrade its plan.',true); return; }
    state.previousFocus = document.activeElement;
    state.modal = {type,sub,server:state.selected,creator:type === 'edit' ? {id:sub.youtube_id,name:sub.youtube_name} : null,identifier:'',destination:sub?.destination_id || state.detail.channels?.[0]?.id || '',template:sub?.template || DEFAULT_TEMPLATE,busy:false};
    dialog.classList.toggle('modal-small', ['test','remove','premium'].includes(type));
    renderModal();
    dialog.showModal();
  }
  function closeModal() {
    if (dialog.open) dialog.close();
    state.modal = null;
    if (state.previousFocus?.isConnected) state.previousFocus.focus();
  }
  function modalHead(title,description) {
    return `<div class="modal-head"><div><h2 id="modal-title">${title}</h2><p>${description}</p></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div>`;
  }
  function editorHTML(modal) {
    const channels = state.detail.channels || [];
    const roles = state.detail.roles || [];
    return `<div class="editor-cols"><div><div class="field"><label for="destination">Destination channel</label><select id="destination" name="destination_id" required ${!channels.length ? 'disabled' : ''}>${!channels.length ? '<option value="">No accessible text channels</option>' : channels.map(channel => `<option value="${escape(channel.id)}" ${channel.id === modal.destination ? 'selected' : ''}># ${escape(channel.name || 'text-channel')}</option>`).join('')}</select><p class="field-help">Maki needs access to post in this channel.</p></div><div class="field"><label for="message-template">Notification message</label><textarea id="message-template" name="template" maxlength="2000" required spellcheck="false">${escape(modal.template)}</textarea><div class="field-help"><code>[channel]</code> creator &nbsp; <code>[title]</code> video title &nbsp; <code>[url]</code> Watch button</div><div class="role-row"><label class="sr-only" for="role-select">Role to mention</label><select id="role-select" ${!roles.length ? 'disabled' : ''}><option value="">Add a role mention…</option>${roles.map(role => `<option value="${escape(role.id)}">@${escape(role.name || 'Role')}</option>`).join('')}</select><button class="btn btn-small" type="button" data-action="insert-role" ${!roles.length ? 'disabled' : ''}>${icon('plus')} Insert</button></div><p class="field-help">Choose a role assigned to your members. Its mention permissions still apply.</p></div></div><div class="preview-column"><div class="preview-box"><div class="preview-label">Message preview<span>Nothing is sent</span></div><div class="preview-message" id="message-preview"></div><div class="preview-card"><small id="preview-creator"></small><strong>Your creator’s next video</strong><p>A single video card, with the upload’s thumbnail and a link to watch.</p><span class="preview-watch">${icon('play')} Watch video &nbsp; ${icon('external')}</span></div></div><p class="field-help">New alerts start from now. Existing uploads won’t be announced.</p></div></div>`;
  }
  function renderModal() {
    const modal = state.modal;
    if (!modal) return;
    let html;
    if (modal.type === 'add' || modal.type === 'edit') {
      const isAdd = modal.type === 'add';
      const creator = modal.creator;
      html = `<form id="subscription-form">${modalHead(isAdd ? 'Add a creator' : 'Make this alert yours',isAdd ? 'Connect a YouTube channel to your community.' : 'Update the destination and notification message.')}<div class="modal-body"><div class="form-error" id="form-error" role="alert"></div>${isAdd && !creator ? `<div class="field"><label for="creator-identifier">YouTube creator</label><div class="field-row"><input id="creator-identifier" name="identifier" value="${escape(modal.identifier)}" placeholder="@handle, channel URL, or channel ID" autocomplete="off" maxlength="500" required><button class="btn btn-primary" type="submit">Find creator ${icon('arrow')}</button></div><p class="field-help">Paste a public YouTube channel link or handle. Videos, Shorts, and streams are supported.</p></div>` : `${creator ? `<div class="creator-selected"><div class="creator-avatar">${escape(initials(creator.name))}</div><div><strong>${escape(creator.name)}</strong><p>YouTube creator · ${escape(creator.id)}</p></div>${isAdd ? `<button class="icon-btn" type="button" data-action="change-creator" aria-label="Choose another creator">${icon('close')}</button>` : ''}</div>` : ''}${editorHTML(modal)}`}</div><div class="modal-footer"><span class="form-note">${isAdd ? 'Free: 3 · Premium: 15 · Unlimited: no cap' : 'Your existing upload tracking is preserved.'}</span><button class="btn btn-ghost" type="button" data-action="close-modal">Cancel</button>${creator ? `<button class="btn btn-primary" type="submit">${icon(isAdd ? 'plus' : 'check')}${isAdd ? 'Enable subscription' : 'Save changes'}</button>` : ''}</div></form>`;
    } else if (modal.type === 'test') {
      html = `<form id="test-form">${modalHead('Send a test notification','See your saved alert in its destination channel.')}<div class="modal-body"><div class="form-error" id="form-error" role="alert"></div><div class="confirm-summary"><div class="creator-avatar">${escape(initials(modal.sub.youtube_name))}</div><div><h3>${escape(modal.sub.youtube_name)}</h3><p># ${escape(modal.sub.destination_name)}</p></div></div><label class="checkbox-row"><input id="ping-roles" type="checkbox" checked><span><strong>Enable saved role mentions</strong><p>This test may notify members in the selected roles. Uncheck this for a quiet preview. Tests never advance upload tracking.</p></span></label><p class="field-help">One notification will be posted. Maki allows one test per alert every 15 seconds.</p></div><div class="modal-footer"><button class="btn btn-ghost" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${icon('play')} Send test</button></div></form>`;
    } else if (modal.type === 'remove') {
      html = `<form id="remove-form">${modalHead('Remove this subscription?','This creator will stop posting to your server.')}<div class="modal-body"><div class="form-error" id="form-error" role="alert"></div><p class="confirm-copy">Remove <strong>${escape(modal.sub.youtube_name)}</strong> from <strong>#${escape(modal.sub.destination_name)}</strong>? You can add it again later. Previous notification messages stay in your server.</p></div><div class="modal-footer"><button class="btn btn-ghost" type="button" data-action="close-modal">Keep subscription</button><button class="btn btn-danger" type="submit">${icon('trash')} Remove subscription</button></div></form>`;
    } else if (modal.type === 'premium') {
      html = `<form id="confirm-premium-form">${modalHead('Update this server’s plan','Available only to Maki’s verified bot owner.')}<div class="modal-body"><div class="form-error" id="form-error" role="alert"></div><p class="confirm-copy">Set <strong>${escape(state.detail.server.name)}</strong> to <strong>${modal.tier === 'free' ? 'Free (3 subscriptions)' : modal.tier === 'standard' ? 'Premium (15 subscriptions)' : 'Premium Unlimited'}</strong>? Existing subscriptions are retained after a downgrade; new ones are limited by the new plan.</p></div><div class="modal-footer"><button class="btn btn-ghost" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${icon('check')} Update plan</button></div></form>`;
    }
    $('#modal-content').innerHTML = html || '';
    updatePreview();
  }
  function updatePreview() {
    const textarea = $('#message-template');
    if (!textarea || !state.modal) return;
    state.modal.template = textarea.value;
    const creator = state.modal.creator?.name || 'Your creator';
    let rendered = textarea.value.replace(/\[(channel|title|url)\]/g, (_, name) => ({channel:creator,title:'Your creator’s next video',url:'Watch video below ↓'}[name]));
    const roles = state.detail.roles || [];
    rendered = rendered.replace(/<@&([0-9a-f-]+)>/gi, (token,id) => {
      const role = roles.find(row => row.id === id.toLowerCase());
      return role ? `@${role.name}` : token;
    });
    $('#message-preview').textContent = rendered;
    $('#preview-creator').textContent = creator;
  }
  function formError(error) {
    const target = $('#form-error');
    if (target) { target.textContent = error.message || String(error); target.scrollIntoView({block:'nearest'}); }
    else toast(error.message || String(error),true);
  }
  async function modalRequest(operation) {
    const modal = state.modal;
    if (!modal || modal.busy) return;
    if (modal.server !== state.selected) { closeModal(); toast('The selected server changed. Open the alert again.',true); return; }
    modal.busy = true;
    const buttons = dialog.querySelectorAll('button, input, select, textarea');
    const wasDisabled = [...buttons].map(element => element.disabled);
    buttons.forEach(element => { element.disabled = true; });
    const error = $('#form-error');
    if (error) error.textContent = '';
    try { await operation(modal); }
    catch (error) { if (state.modal === modal) formError(error); else toast(error.message,true); }
    finally {
      modal.busy = false;
      if (state.modal === modal) buttons.forEach((element,index) => { if (element.isConnected) element.disabled = wasDisabled[index]; });
    }
  }
  async function submitSubscription() {
    const modal = state.modal;
    if (!modal) return;
    if (!modal.creator) {
      const identifier = $('#creator-identifier').value.trim();
      if (!identifier) return;
      modal.identifier = identifier;
      return modalRequest(async current => {
        const result = await api(`${endpoint(current.server)}/resolve`,{method:'POST',body:{identifier}});
        if (!result.creator?.id) throw new Error('YouTube did not return a channel. Try its full channel URL.');
        current.creator = result.creator;
        current.identifier = result.creator.id;
        renderModal();
        $('#destination')?.focus();
      });
    }
    const template = $('#message-template').value.trim();
    const destination = $('#destination').value;
    if (!template || !destination) return formError(new Error('Choose a destination and enter a notification message.'));
    modal.template = template;
    modal.destination = destination;
    return modalRequest(async current => {
      const isAdd = current.type === 'add';
      await api(isAdd ? `${endpoint(current.server)}/subscriptions` : subEndpoint(current.sub.id,current.server),{method:isAdd ? 'POST' : 'PATCH',body:{...(isAdd ? {identifier:current.identifier} : {}),destination_id:destination,template}});
      closeModal();
      toast(isAdd ? `${current.creator.name} is connected. New uploads will be announced from now.` : 'Your subscription has been updated.');
      if (current.server === state.selected) await selectServer(current.server,true);
    });
  }
  async function submitTest() {
    const pingRoles = $('#ping-roles').checked;
    return modalRequest(async current => {
      await api(`${subEndpoint(current.sub.id,current.server)}/test`,{method:'POST',body:{ping_roles:pingRoles}});
      closeModal();
      toast(`${pingRoles ? 'Role-enabled test' : 'Quiet test'} sent to #${current.sub.destination_name}.`);
    });
  }
  async function submitRemove() {
    return modalRequest(async current => {
      await api(subEndpoint(current.sub.id,current.server),{method:'DELETE',body:{}});
      closeModal();
      toast(`${current.sub.youtube_name} has been removed.`);
      if (current.server === state.selected) await selectServer(current.server,true);
    });
  }
  async function submitPremium() {
    return modalRequest(async current => {
      await api(`${endpoint(current.server)}/premium`,{method:'PUT',body:{tier:current.tier}});
      closeModal();
      toast('The server plan has been updated.');
      if (current.server === state.selected) await selectServer(current.server,true);
    });
  }
  async function pair(code, button = null) {
    if (button) button.disabled = true;
    try {
      await api('/auth/pair',{method:'POST',body:{code}});
      await bootstrap();
    } catch (error) {
      if (state.session?.authenticated) toast(error.message,true);
      else renderLogin(error.message);
    } finally { if (button?.isConnected) button.disabled = false; }
  }
  async function logout(button) {
    if (button) button.disabled = true;
    try {
      await api('/auth/logout',{method:'POST',body:{}});
      state.session = null; state.servers = []; state.detail = null; state.selected = ''; state.serverSequence++;
      closeModal();
      await bootstrap();
    } catch (error) { toast(error.message,true); if (button?.isConnected) button.disabled = false; }
  }
  async function bootstrap() {
    try {
      state.session = await api('/api/session');
      if (!state.session.authenticated) {
        const query = new URLSearchParams(location.search);
        const cancelled = query.get('login') === 'cancelled';
        const failed = query.has('error') || query.has('login_error');
        if (failed || cancelled) history.replaceState(null,'',location.pathname);
        renderLogin(cancelled ? 'Yapper sign-in was cancelled. Try again whenever you’re ready, or use a private /dashboard link.' : failed ? 'Sign-in could not be completed. Try again or use a private /dashboard link.' : '');
        return;
      }
      state.loading = true;
      renderShell();
      await loadServers();
    } catch (error) {
      if (state.session?.authenticated && $('#main-content')) { state.loading = false; state.detailError = error.message; renderContent(); }
      else { renderLogin(error.message); const codeForm = $('#pair-form'); if (codeForm) codeForm.insertAdjacentHTML('afterend','<button class="btn btn-ghost login-retry" data-action="bootstrap">Try connecting again</button>'); }
    }
  }
  async function onClick(event) {
    const button = event.target.closest('button,[data-view]');
    if (!button || button.disabled) return;
    if (button.dataset.server) { closeModal(); return selectServer(button.dataset.server); }
    if (button.dataset.view) return setView(button.dataset.view);
    if (button.dataset.filter) {
      state.filter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(item => { item.classList.toggle('active',item.dataset.filter === state.filter); item.setAttribute('aria-pressed',String(item.dataset.filter === state.filter)); });
      return renderSubscriptions();
    }
    const action = button.dataset.action;
    if (!action) return;
    if (action === 'toggle-menu') return $('.shell')?.classList.toggle('menu-open');
    if (action === 'close-modal') return closeModal();
    if (action === 'bootstrap') return bootstrap();
    if (action === 'logout') return logout(button);
    if (action === 'retry') return state.selected ? selectServer(state.selected) : loadServers();
    if (action === 'refresh-all') {
      button.disabled = true;
      try { await loadServers(); } catch (error) { toast(error.message,true); if (button.isConnected) button.disabled = false; }
      return;
    }
    if (action === 'refresh') {
      button.disabled = true; button.classList.add('spin');
      await selectServer(state.selected,true);
      if (button.isConnected) { button.disabled = false; button.classList.remove('spin'); }
      return;
    }
    if (action === 'add') return openModal('add');
    if (action === 'change-creator' && state.modal) { state.modal.creator = null; state.modal.identifier = ''; return renderModal(); }
    if (action === 'insert-role') {
      const id = $('#role-select').value;
      if (!id) return;
      const textarea = $('#message-template');
      const token = `<@&${id}>`;
      textarea.setRangeText(token,textarea.selectionStart,textarea.selectionEnd,'end');
      textarea.focus();
      updatePreview();
      $('#role-select').value = '';
      return;
    }
    const sub = findSub(button.dataset.sub);
    if (!sub) return;
    if (action === 'pause' || action === 'resume') return changeSubscription(action,sub.id);
    if (['edit','test','remove'].includes(action)) return openModal(action,sub);
  }
  document.addEventListener('click',event => { onClick(event).catch(error => toast(error.message,true)); });
  document.addEventListener('input',event => {
    if (event.target.id === 'server-search') { state.serverSearch = event.target.value; renderServerList(); }
    if (event.target.id === 'subscription-search') { state.search = event.target.value; renderSubscriptions(); }
    if (event.target.id === 'message-template') updatePreview();
  });
  document.addEventListener('submit',event => {
    const form = event.target;
    const handlers = {'subscription-form':submitSubscription,'test-form':submitTest,'remove-form':submitRemove,'confirm-premium-form':submitPremium};
    if (handlers[form.id]) { event.preventDefault(); handlers[form.id]().catch(error => formError(error)); }
    if (form.id === 'pair-form') { event.preventDefault(); const code = $('#pair-code').value.trim(); if (code) pair(code,form.querySelector('button')); }
    if (form.id === 'premium-form') {
      event.preventDefault();
      const tier = $('#premium-tier').value;
      openModal('premium');
      if (state.modal) { state.modal.tier = tier; renderModal(); }
    }
  });
  dialog.addEventListener('cancel',event => { if (state.modal?.busy) event.preventDefault(); else closeModal(); });
  dialog.addEventListener('click',event => { if (event.target === dialog && !state.modal?.busy) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal(); } });
  document.addEventListener('keydown',event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !dialog.open) { event.preventDefault(); $('#subscription-search')?.focus(); } });
  setInterval(() => { if (state.session?.authenticated && state.selected && !state.loading && !dialog.open && !document.hidden && !state.busy.size && !document.activeElement?.matches('input,textarea,select')) selectServer(state.selected,true); },30000);
  const fragment = new URLSearchParams(location.hash.slice(1));
  const privateCode = fragment.get('code');
  if (privateCode) {
    history.replaceState(null,'',location.pathname + location.search);
    pair(privateCode);
  } else bootstrap();
})();
