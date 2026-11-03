(() => {
  const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Loader counter -> hero reveal
  const loader = $('#loader'), num = $('#loadNum'), bar = $('.loader-bar');
  let n = 0;
  const tick = setInterval(() => {
    n = Math.min(100, n + Math.ceil(Math.random() * 12));
    num.textContent = n; bar.style.width = n + '%';
    if (n >= 100) {
      clearInterval(tick);
      setTimeout(() => { loader.classList.add('done'); document.body.classList.add('ready'); }, 250);
    }
  }, 60);

  // Cursor glow
  const cur = $('#cursor');
  addEventListener('pointermove', e => { cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; });

  // Scroll reveals + skill bars
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('visible'); io.unobserve(e.target);
  }), { threshold: .12 });
  $$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
  const barIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.style.width = e.target.dataset.width + '%'; barIO.unobserve(e.target); }
  }), { threshold: .5 });
  $$('.bar-fill').forEach(b => barIO.observe(b));

  // Nav: mobile menu, active link, hide on scroll down
  const burger = $('#hamburger'), links = $('#navLinks'), nav = $('#navbar');
  burger.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
  });
  $$('a', links).forEach(a => a.addEventListener('click', () => { links.classList.remove('open'); burger.setAttribute('aria-expanded', false); }));
  const secs = $$('section[id]');
  let lastY = 0;
  addEventListener('scroll', () => {
    const y = scrollY;
    nav.style.top = y > lastY && y > 200 ? '-90px' : '16px';
    lastY = y;
    let cur = 'home';
    secs.forEach(s => { if (y >= s.offsetTop - 220) cur = s.id; });
    $$('a', links).forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + cur && !a.classList.contains('btn-hire')));
  }, { passive: true });

  // Project filter
  $$('.filter-btn').forEach(b => b.addEventListener('click', () => {
    $$('.filter-btn').forEach(x => x.classList.remove('active')); b.classList.add('active');
    $$('.project-card').forEach(c => {
      const show = b.dataset.filter === 'all' || c.dataset.cat.split(' ').includes(b.dataset.filter);
      c.classList.toggle('hide', !show);
      if (show) { c.classList.remove('visible'); requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('visible'))); }
    });
  }));

  // Spotlight on cards
  $$('.project-card').forEach(c => c.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px');
  }));

  if (!reduce) {
    // Magnetic buttons
    $$('.magnetic').forEach(m => {
      m.addEventListener('pointermove', e => {
        const r = m.getBoundingClientRect();
        m.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px,${(e.clientY - r.top - r.height / 2) * .35}px)`;
      });
      m.addEventListener('pointerleave', () => { m.style.transform = ''; });
    });
    // 3D tilt on portrait
    const t = $('[data-tilt]');
    if (t) {
      t.addEventListener('pointermove', e => {
        const r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        t.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;
      });
      t.addEventListener('pointerleave', () => { t.style.transform = ''; });
    }
  }

})();

/* ===== v2 additions ===== */
(() => {
  const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  // Theme toggle (remembered when storage is available)
  const themeBtn = $('#themeBtn');
  const setTheme = t => {
    root.dataset.theme = t;
    themeBtn.innerHTML = `<i class="fas fa-${t === 'light' ? 'sun' : 'moon'}"></i>`;
    try { localStorage.setItem('js-theme', t); } catch (e) {}
  };
  let saved = 'dark'; try { saved = localStorage.getItem('js-theme') || 'dark'; } catch (e) {}
  setTheme(saved);
  const toggleTheme = () => setTheme(root.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.addEventListener('click', toggleTheme);

  // Toast + copy email
  const toast = $('#toast'); let tt;
  const say = m => { toast.textContent = m; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('show'), 2200); };
  const copyEmail = b => { const v = b.dataset ? b.dataset.copy : b; (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => say('Email copied to clipboard'), () => say(v)); };
  $$('.copy').forEach(b => b.addEventListener('click', () => copyEmail(b)));

  // Word-by-word title reveal
  const tio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); tio.unobserve(e.target); } }), { threshold: .3 });
  $$('.section-title').forEach(t => {
    t.classList.remove('reveal'); t.classList.add('split'); t.style.opacity = 1; t.style.transform = 'none';
    const words = t.textContent.trim().split(/\s+/); t.setAttribute('aria-label', words.join(' ')); t.textContent = '';
    words.forEach((w, i) => { const o = document.createElement('span'); o.className = 'w'; o.setAttribute('aria-hidden', 'true'); o.style.setProperty('--i', i); o.innerHTML = '<span>' + w + '</span>'; t.append(o, ' '); });
    tio.observe(t);
  });

  // Rotating role text (types and deletes)
  const roleEl = $('#role'), roles = ['web developer', 'hardware technician', 'PC builder', 'network troubleshooter'];
  let ri = 0, ci = roles[0].length, del = true;
  if (!reduce) (function type() {
    const w = roles[ri];
    ci += del ? -1 : 1; roleEl.textContent = w.slice(0, ci);
    let d = del ? 40 : 80;
    if (!del && ci === w.length) { del = true; d = 1600; }
    else if (del && ci === 0) { del = false; ri = (ri + 1) % roles.length; d = 300; }
    setTimeout(type, d);
  })();

  // Count-up stats
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const el = e.target, end = +el.dataset.count, suf = el.dataset.suffix || '', t0 = performance.now();
    (function f(t) { const p = Math.min(1, (t - t0) / 1600); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4))) + suf; if (p < 1) requestAnimationFrame(f); })(t0);
  }), { threshold: .6 });
  $$('[data-count]').forEach(el => cio.observe(el));

  // Cursor ring (follows with easing, grows over interactive items)
  const ring = $('#ring'); let rx = 0, ry = 0, tx = 0, ty = 0;
  addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; });
  (function loop() { rx += (tx - rx) * .16; ry += (ty - ry) * .16; ring.style.transform = `translate(${rx}px,${ry}px)`; requestAnimationFrame(loop); })();
  document.addEventListener('pointerover', e => ring.classList.toggle('big', !!e.target.closest('a,button,.project-card,.skill-card,.service-card')));

  // Scroll progress, back-to-top ring, hero parallax, marquee skew
  const bar = $('#progress'), top = $('#toTop'), arc = $('#toTopArc'), glow = $('.hero-glow'), track = $('.marquee-track');
  let lastY = scrollY, skew = 0;
  const onScroll = () => {
    const max = root.scrollHeight - innerHeight, p = max > 0 ? scrollY / max : 0;
    bar.style.transform = `scaleX(${p})`; arc.style.strokeDashoffset = 126 * (1 - p);
    top.classList.toggle('show', scrollY > 600);
    if (!reduce) glow.style.translate = `0 ${scrollY * .25}px`;
    const v = Math.max(-12, Math.min(12, (scrollY - lastY) * .4)); lastY = scrollY; skew += (v - skew) * .4;
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (!reduce) { const m = $('.marquee'); (function s() { skew *= .92; m.style.transform = `skewX(${-skew}deg)`; requestAnimationFrame(s); })(); }
  top.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

  // Command palette (Ctrl/Cmd + K)
  const pal = $('#palette'), inp = $('#palInput'), list = $('#palList');
  const go = id => () => $(id).scrollIntoView({ behavior: 'smooth' });
  const cmds = [['fa-house', 'Go to Home', go('#home')], ['fa-layer-group', 'Go to Skills', go('#skills')], ['fa-folder-open', 'Go to Projects', go('#projects')], ['fa-user', 'Go to About', go('#about')], ['fa-briefcase', 'Go to Services', go('#services')], ['fa-envelope', 'Go to Contact', go('#contact')],
    ['fa-circle-half-stroke', 'Toggle light / dark theme', toggleTheme], ['fa-copy', 'Copy email address', () => copyEmail('joshuasambere0313@gmail.com')], ['fa-code-branch', 'Open GitHub', () => open('https://github.com/daiki0918', '_blank', 'noopener')]];
  let shown = cmds, sel = 0;
  const draw = () => { list.innerHTML = shown.map((c, i) => `<li class="${i === sel ? 'sel' : ''}" data-i="${i}"><i class="fas ${c[0]}"></i>${c[1]}</li>`).join('') || '<li>No matches</li>'; };
  const openP = () => { pal.classList.add('open'); pal.setAttribute('aria-hidden', 'false'); inp.value = ''; shown = cmds; sel = 0; draw(); setTimeout(() => inp.focus(), 50); };
  const closeP = () => { pal.classList.remove('open'); pal.setAttribute('aria-hidden', 'true'); };
  const run = i => { const c = shown[i]; if (c) { closeP(); setTimeout(c[2], 150); } };
  $('#kBtn').addEventListener('click', openP);
  pal.addEventListener('click', e => { if (e.target === pal) closeP(); const li = e.target.closest('li[data-i]'); if (li) run(+li.dataset.i); });
  inp.addEventListener('input', () => { shown = cmds.filter(c => c[1].toLowerCase().includes(inp.value.toLowerCase())); sel = 0; draw(); });
  addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.classList.contains('open') ? closeP() : openP(); }
    if (!pal.classList.contains('open')) return;
    if (e.key === 'Escape') closeP();
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % shown.length; draw(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % shown.length; draw(); }
    if (e.key === 'Enter') run(sel);
  });

})();

/* ===== v3: skills explorer + services ===== */
(() => {
  const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  // Levels: 5 Strongest, 4 Confident, 3 Working knowledge, 2 Learning. Edit to match your real comfort level.
  const LV = ['', 'Learning', 'Learning', 'Working knowledge', 'Confident', 'Strongest'];
  const cats = [
    ['Frontend', 'fa-display', 'Interfaces that load fast and feel good on any screen.', [['fab fa-html5', 'HTML5', 'Semantic, accessible markup', 5], ['fab fa-css3-alt', 'CSS3', 'Flexbox, Grid, animations', 5], ['fab fa-js', 'JavaScript', 'ES6+, DOM, APIs', 4], ['fab fa-react', 'React', 'Component-based UI', 3]]],
    ['Backend', 'fa-server', 'Logins, forms and admin panels that run the business side.', [['fab fa-php', 'PHP', 'Forms, authentication, MySQL', 4], ['fab fa-laravel', 'Laravel', 'PHP web applications', 3], ['fab fa-java', 'Java', 'OOP and desktop apps', 3]]],
    ['Data', 'fa-database', 'Storing records safely and finding them quickly.', [['fas fa-database', 'MySQL', 'Database design and queries', 4], ['fas fa-leaf', 'MongoDB', 'NoSQL document store', 3], ['fas fa-bolt', 'Supabase', 'Postgres, auth, storage', 3]]],
    ['Maps and APIs', 'fa-map-location-dot', 'Location features and messaging that connect apps to the real world.', [['fas fa-map', 'Leaflet', 'Interactive maps', 3], ['fas fa-location-dot', 'MapTiler', 'Maps and tile services', 3], ['fas fa-comment-sms', 'TextBee', 'SMS notifications', 3]]],
    ['Hardware', 'fa-microchip', 'From the circuit board to the router, I fix what I can touch.', [['fas fa-microchip', 'PC building', 'Assembly, upgrades, BIOS', 4], ['fas fa-tools', 'Troubleshooting', 'Diagnostics and support', 4], ['fas fa-wifi', 'Networking', 'LAN/WiFi, routers, IP planning', 4]]]
  ];
  const tabs = $('#skTabs'), panel = $('#skPanel');
  const showCat = i => {
    $$('.sk-tab', tabs).forEach((t, k) => t.setAttribute('aria-selected', k === i));
    const c = cats[i];
    panel.classList.remove('go');
    panel.innerHTML = `<p class="sk-desc">${c[2]}</p>` + c[3].map((s, k) => `<div class="sk-row" style="--i:${k}"><i class="${s[0]}"></i><div><b>${s[1]}</b><span>${s[2]}</span></div><div class="sk-meter" role="img" aria-label="${LV[s[3]]}">${[0, 1, 2, 3, 4].map(j => `<u class="${j < s[3] ? 'on' : ''}" style="--d:${j}"></u>`).join('')}</div><em>${LV[s[3]]}</em></div>`).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('go')));
  };
  tabs.innerHTML = cats.map((c, i) => `<button class="sk-tab" role="tab" aria-selected="false" data-i="${i}"><i class="fas ${c[1]}"></i>${c[0]}<small>${c[3].length}</small></button>`).join('');
  tabs.addEventListener('click', e => { const b = e.target.closest('.sk-tab'); if (b) showCat(+b.dataset.i); });
  showCat(0);

  // Services: starting prices for a junior freelancer with about 1 year of experience (PHP = Philippine peso)
  const svcs = [
    ['web', 'fa-rocket', 'Landing page', 'A single polished page to introduce your business or event.', 3500, '3-5 days', ['Responsive on phone and desktop', 'Contact form and map link', 'Basic SEO and fast loading']],
    ['web', 'fa-globe', 'Business website', 'A full small-business site that customers can find and trust.', 8000, '1-2 weeks', ['Up to 5 pages, mobile-ready', 'Contact, gallery and location sections', 'Help setting up hosting and domain']],
    ['web', 'fa-server', 'Web system (PHP / Laravel)', 'Custom systems with logins, records and reports.', 15000, '3-6 weeks', ['Login and admin dashboard', 'Add, edit, delete and search records', 'MySQL database and printable reports']],
    ['web', 'fa-map-location-dot', 'Maps and SMS add-on', 'Add location pins or text alerts to your site or system.', 5000, '1 week', ['Leaflet or MapTiler interactive map', 'TextBee SMS notifications', 'Works with an existing project']],
    ['web', 'fa-window-maximize', 'Java desktop app', 'Windows programs for inventory, records or school tools.', 6000, '2-4 weeks', ['Clean Swing interface', 'Local or MySQL database', 'Installer-ready build']],
    ['web', 'fa-screwdriver-wrench', 'Website care plan', 'Monthly updates so your site stays fresh and working.', 1000, 'per month', ['Content and photo updates', 'Backups and small fixes', 'Quick replies when something breaks']],
    ['hw', 'fa-microchip', 'PC build and upgrade', 'Assembly, parts advice and tuning for gaming or office PCs.', 500, 'same day', ['Parts compatibility check', 'Cable management and BIOS setup', 'Stress test before handover (parts not included)']],
    ['hw', 'fa-stethoscope', 'Repair and diagnostics', 'Find out what is wrong before you spend on parts.', 300, '1-3 days', ['Hardware and software diagnosis', 'Clear explanation and repair quote', 'Diagnosis fee goes to the repair if you proceed']],
    ['hw', 'fa-compact-disc', 'OS reinstall and cleanup', 'Make a slow or infected computer feel new again.', 400, '2-4 hours', ['Windows install, drivers and updates', 'Virus removal and basic security', 'Backup of your files first']],
    ['hw', 'fa-wifi', 'Network setup', 'Reliable WiFi and wired networks for home or small office.', 800, '1 day', ['Router and access point setup', 'IP planning and basic firewall rules', 'Office setups from \u20b12,500']],
    ['hw', 'fa-headset', 'IT support by the hour', 'Hands-on help with whatever is blocking you.', 350, 'per hour', ['On-site in Binalbagan or remote', 'Software setup and troubleshooting', 'Travel fee applies outside town']]
  ];
  const groups = [['web', 'Web and software'], ['hw', 'Tech support and hardware']];
  const sTabs = $('#svcTabs'), grid = $('#svcGrid'), sel = $('#service');
  const peso = n => '\u20b1' + n.toLocaleString('en-PH');
  const showSvc = g => {
    $$('.svc-tab', sTabs).forEach(t => t.setAttribute('aria-selected', t.dataset.g === g));
    grid.innerHTML = svcs.filter(s => s[0] === g).map((s, i) => `<article class="svc" style="--i:${i}"><div class="svc-top"><div class="svc-icon"><i class="fas ${s[1]}"></i></div><span class="svc-time"><i class="fas fa-clock"></i>${s[5]}</span></div><h3>${s[2]}</h3><p>${s[3]}</p><div class="svc-price">Starting at<b>${peso(s[4])}</b></div><ul>${s[6].map(x => `<li><i class="fas fa-check"></i>${x}</li>`).join('')}</ul><button class="svc-btn" data-t="${s[2]}">Get a quote</button></article>`).join('');
  };
  sTabs.innerHTML = groups.map(g => `<button class="svc-tab" role="tab" data-g="${g[0]}" aria-selected="false">${g[1]}</button>`).join('');
  sTabs.addEventListener('click', e => { const b = e.target.closest('.svc-tab'); if (b) showSvc(b.dataset.g); });
  grid.addEventListener('click', e => {
    const b = e.target.closest('.svc-btn'); if (!b) return;
    sel.value = b.dataset.t; $('#contact').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => $('#message').focus({ preventScroll: true }), 700);
  });
  sel.innerHTML = '<option value="">Select a service...</option>' + svcs.map(s => `<option>${s[2]}</option>`).join('') + '<option>Other</option>';
  showSvc('web');
})();

/* ===== v4: contact form -> contact.php ===== */
(() => {
  const ENDPOINT = 'contact.php'; // change if your PHP file has another name or path
  const $ = (s, c = document) => c.querySelector(s);
  const form = $('#contactForm'), btn = $('.btn-send', form), err = $('#formError'), ok = $('#formSuccess');
  const label = btn.innerHTML;
  form.addEventListener('submit', async e => {
    e.preventDefault(); err.textContent = '';
    let valid = true;
    [...form.querySelectorAll('[required]')].forEach(f => {
      const bad = !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
      f.classList.toggle('err', bad); if (bad) valid = false;
    });
    if (!valid) { err.textContent = 'Please fill in every required field with valid details.'; return; }
    btn.disabled = true; btn.classList.add('loading'); btn.innerHTML = '<span class="spin"></span> Sending...';
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: $('#fname').value, last_name: $('#lname').value, email: $('#email').value, service: $('#service').value, message: $('#message').value, company: $('#company').value })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        $('p', ok).textContent = data.message; form.style.display = 'none'; ok.classList.add('show'); form.reset();
      } else err.textContent = data.message || 'Something went wrong. Please try again.';
    } catch (x) { err.textContent = 'Could not reach the server. Check your connection and try again.'; }
    btn.disabled = false; btn.classList.remove('loading'); btn.innerHTML = label;
  });
})();