/* ==========================================================================
   Alfastjores — js.js
   Contenido (en este orden):
     1. APP: catálogo, armado del alfajor, carrito y pedido por WhatsApp.
        Datos editables al principio: WHATSAPP, TAPAS, RELLENOS, COBERTURAS y precios.
     2. TECHTEXT: logo interactivo del encabezado (canvas, sin dependencias).
   Se carga con <script src="js.js" defer>; la política de seguridad (CSP) del index.html
   no permite scripts dentro del HTML, así que todo el JavaScript vive acá.
   ========================================================================== */

/* ============================== 1. APP ============================== */
(() => {
  'use strict';

  /* ==========================================================================
     Datos: ingredientes, descripciones y precios.
     Son los mismos de la versión original (no se agregó ni se sacó ninguno).
     `icon` ya no se muestra en pantalla, pero se conserva porque el aviso
     "alfastjores_pedido" (ver enviar()) lo sigue usando igual que antes.
     ========================================================================== */
  const TAPAS = [
    { name: 'Maicena clásica', lower: 'maicena clásica', desc: 'Suave y esponjosa',    icon: '🟡', price: 200, base: '#EBD5A6', edge: '#C4A25F', tex: 'crumb' },
    { name: 'Chocolate negro', lower: 'chocolate negro', desc: 'Intensa y crocante',   icon: '🟫', price: 250, base: '#4B2A1B', edge: '#24120A', tex: 'choc'  },
    { name: 'Vainilla',        lower: 'vainilla',        desc: 'Clásica y aromática',  icon: '🌿', price: 220, base: '#F4DE96', edge: '#CDB15A', tex: 'crumb' },
    { name: 'Coco rallado',    lower: 'coco rallado',    desc: 'Tropical y crujiente', icon: '🥥', price: 240, base: '#F4ECDA', edge: '#CBBC99', tex: 'coco'  },
  ];

  const RELLENOS = [
    { name: 'Dulce de leche',        lower: 'dulce de leche',        desc: 'El clásico de siempre', icon: '🍯', price: 150, base: '#C98332', tex: 'none'  },
    { name: 'Mermelada de frutilla', lower: 'mermelada de frutilla', desc: 'Dulce y afrutado',      icon: '🍓', price: 180, base: '#C23A56', tex: 'seeds' },
    { name: 'Nutella',               lower: 'Nutella',               desc: 'Avellanas y cacao',     icon: '🌰', price: 220, base: '#6B3B22', tex: 'none'  },
  ];

  const COBERTURAS = [
    { name: 'Sin cobertura',    lower: null,               desc: 'Las tapas al natural', icon: '⬜', price: 0,   fill: null },
    { name: 'Chocolate blanco', lower: 'chocolate blanco', desc: 'Suave y dulce',        icon: '🤍', price: 100, fill: '#F5E9CB', edge: '#D6BE86', gloss: 0.9  },
    { name: 'Chocolate negro',  lower: 'chocolate negro',  desc: 'Intenso y amargo',     icon: '⬛', price: 120, fill: '#2E1B10', edge: '#180B05', gloss: 0.42 },
  ];

  const GROUPS = [
    { key: 'top', title: 'Tapa superior',      list: TAPAS,      kind: 'tapa' },
    { key: 'rel', title: 'Relleno',            list: RELLENOS,   kind: 'relleno' },
    { key: 'bot', title: 'Tapa inferior',      list: TAPAS,      kind: 'tapa' },
    { key: 'cob', title: 'Cobertura exterior', list: COBERTURAS, kind: 'cobertura' },
  ];

  const WHATSAPP   = '5493624886110';
  const MAX_ADD    = 20;   // tope del selector de cantidad (igual que antes)
  const MAX_LINE   = 99;   // tope de una misma variedad dentro del carrito
  const KEY_CARRITO = 'alfastjores_carrito';
  const KEY_PEDIDO  = 'alfastjores_pedido';   // no cambiar: lo pueden leer otras herramientas

  /* ==========================================================================
     Utilidades
     ========================================================================== */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = n => '$' + n.toLocaleString('es-AR');
  const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgb2hex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); };

  const unit       = c => TAPAS[c.top].price + RELLENOS[c.rel].price + TAPAS[c.bot].price + COBERTURAS[c.cob].price;
  const cartUnits  = () => cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal  = () => cart.reduce((s, i) => s + unit(i) * i.qty, 0);
  const plural     = (n, uno, varios) => (n === 1 ? uno : varios);
  const capital    = s => s.charAt(0).toUpperCase() + s.slice(1);

  function describe(c) {
    const t = TAPAS[c.top], b = TAPAS[c.bot], r = RELLENOS[c.rel], k = COBERTURAS[c.cob];
    let s = (c.top === c.bot ? t.lower : t.lower + ' y ' + b.lower) + ' con ' + r.lower;
    if (k.lower) s += ', bañado en ' + k.lower;
    return capital(s);
  }

  /* ==========================================================================
     Estado
     ========================================================================== */
  const state = { top: 0, rel: 0, bot: 0, cob: 0, qty: 1 };
  let cart = loadCart();
  let sentUrl = null;

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY_CARRITO) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .filter(i => i && TAPAS[i.top] && RELLENOS[i.rel] && TAPAS[i.bot] && COBERTURAS[i.cob] && Number.isInteger(i.qty) && i.qty >= 1)
        .map(i => ({ top: i.top, rel: i.rel, bot: i.bot, cob: i.cob, qty: Math.min(MAX_LINE, i.qty) }));
    } catch (e) { return []; }
  }
  function saveCart() {
    try { localStorage.setItem(KEY_CARRITO, JSON.stringify(cart)); } catch (e) { /* sin almacenamiento: no pasa nada */ }
  }

  /* ==========================================================================
     Íconos y muestras de color
     ========================================================================== */
  const TICK = '<svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 12.6l4.2 4.2L18.5 8"/></svg>';
  const ICON_MINUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"/></svg>';
  const ICON_PLUS  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 12.6l4.2 4.2L18.5 8"/></svg>';

  // Pictograma que muestra qué capa del alfajor se está eligiendo.
  function groupIcon(key) {
    const c = k => (k === key ? 'on' : 'off');
    if (key === 'cob') {
      return '<svg class="gico" viewBox="0 0 32 27" aria-hidden="true">' +
        '<rect class="ring" x="1.5" y="1.5" width="29" height="24" rx="10"/>' +
        '<rect class="off" x="8" y="6.5" width="16" height="4.6" rx="2.3"/>' +
        '<rect class="off" x="6.6" y="11.9" width="18.8" height="3.2" rx="1.6"/>' +
        '<rect class="off" x="8" y="15.9" width="16" height="4.6" rx="2.3"/></svg>';
    }
    return '<svg class="gico" viewBox="0 0 32 27" aria-hidden="true">' +
      '<rect class="' + c('top') + '" x="5" y="2.5" width="22" height="7.6" rx="3.8"/>' +
      '<rect class="' + c('rel') + '" x="2.5" y="11.6" width="27" height="4" rx="2"/>' +
      '<rect class="' + c('bot') + '" x="5" y="17.1" width="22" height="7.6" rx="3.8"/></svg>';
  }

  // Fondo de la muestra circular de cada opción.
  function swatchStyle(item, kind) {
    const base = kind === 'cobertura' ? item.fill : item.base;
    if (!base) return '';
    const hi = mix(base, '#ffffff', 0.4);
    const lo = mix(base, '#000000', 0.22);
    const layers = [];
    if (item.tex === 'coco')        layers.push('radial-gradient(circle,rgba(185,165,125,.7) 0 1px,transparent 1.5px) 0 0/6px 6px');
    else if (item.tex === 'crumb')  layers.push('radial-gradient(circle,rgba(110,78,30,.4) 0 .9px,transparent 1.3px) 3px 2px/9px 9px');
    else if (item.tex === 'choc')   layers.push('radial-gradient(circle,rgba(215,165,125,.38) 0 .9px,transparent 1.3px) 3px 2px/9px 9px');
    else if (item.tex === 'seeds')  layers.push('radial-gradient(circle,rgba(255,232,150,.8) 0 .9px,transparent 1.3px) 2px 2px/8px 8px');
    layers.push('radial-gradient(circle at 32% 26%,' + hi + ' 0,' + base + ' 52%,' + lo + ' 100%)');
    return 'background:' + layers.join(',');
  }

  /* ==========================================================================
     Opciones (se generan desde los datos de arriba)
     ========================================================================== */
  function buildOptions() {
    $('#options').innerHTML = GROUPS.map(g => {
      const rows = g.list.map((item, i) => {
        const sw = swatchStyle(item, g.kind);
        const price = item.price === 0 ? 'Sin costo' : fmt(item.price);
        return '<label class="opt">' +
          '<input type="radio" name="' + g.key + '" value="' + i + '">' +
          '<span class="sw' + (sw ? '' : ' none') + '"' + (sw ? ' style="' + sw + '"' : '') + '>' + TICK + '</span>' +
          '<span class="ot">' +
            '<span class="ol"><span class="o-name">' + item.name + '</span><i class="lead" aria-hidden="true"></i><span class="o-price">' + price + '</span></span>' +
            '<span class="o-desc">' + item.desc + '</span>' +
          '</span></label>';
      }).join('');
      return '<section class="group" data-g="' + g.key + '" aria-labelledby="g-' + g.key + '">' +
        '<h3 class="g-title" id="g-' + g.key + '">' + groupIcon(g.key) + '<span>' + g.title + '</span></h3>' +
        '<div class="list" role="radiogroup" aria-labelledby="g-' + g.key + '">' + rows + '</div></section>';
    }).join('');
  }

  function syncRadios() {
    GROUPS.forEach(g => {
      $$('input[name="' + g.key + '"]').forEach((inp, i) => {
        const on = i === state[g.key];
        inp.checked = on;
        inp.closest('.opt').classList.toggle('is-on', on);
      });
    });
  }

  /* ==========================================================================
     Vista previa (dibujo SVG)
     ========================================================================== */
  const els = {
    svg: $('#alf'),
    fTop: $('#f-top'), tTop: $('#t-top'),
    fBot: $('#f-bot'), tBot: $('#t-bot'),
    fRel: $('#f-rel'), tRel: $('#t-rel'),
    shellIn: $('#shell-in'), shellEdge: $('#shell-edge'), shellFill: $('#shell-fill'), glossShell: $('#gloss-shell'),
  };

  function paintCookie(fill, tex, item) {
    fill.style.fill = item.base;
    fill.style.stroke = item.edge;
    tex.setAttribute('fill', 'url(#tx-' + item.tex + ')');
  }

  function paintShell(k) {
    const { shellIn, shellEdge, shellFill, glossShell } = els;
    if (!k.fill) {
      shellIn.style.opacity = '0';
      shellEdge.style.strokeWidth = '0px';
      shellFill.style.strokeWidth = '0px';
      return;
    }
    const wasHidden = shellIn.style.opacity !== '1';
    const paint = () => {
      shellEdge.style.stroke = k.edge; shellEdge.style.fill = k.edge;
      shellFill.style.stroke = k.fill; shellFill.style.fill = k.fill;
    };
    if (wasHidden) {
      // El baño aparece ya con su color (sin pasar por negro).
      [shellEdge, shellFill].forEach(n => { n.style.transition = 'none'; });
      paint();
      void shellEdge.getBoundingClientRect();
      [shellEdge, shellFill].forEach(n => { n.style.transition = ''; });
    } else {
      paint();
    }
    glossShell.style.strokeOpacity = String(k.gloss);
    shellEdge.style.strokeWidth = '23px';
    shellFill.style.strokeWidth = '20px';
    shellIn.style.opacity = '1';
  }

  function paintPreview() {
    const t = TAPAS[state.top], b = TAPAS[state.bot], r = RELLENOS[state.rel], k = COBERTURAS[state.cob];
    paintCookie(els.fTop, els.tTop, t);
    paintCookie(els.fBot, els.tBot, b);
    els.fRel.style.fill = r.base;
    els.fRel.style.stroke = mix(r.base, '#000000', 0.35);
    els.tRel.setAttribute('fill', r.tex === 'seeds' ? 'url(#tx-seeds)' : 'none');
    paintShell(k);
  }

  // Pequeño rebote en la capa que cambió, para que se note qué se modificó.
  function bounce(key) {
    if (prefersReduced()) return;
    const map = {
      top: ['#ly-top',   [{ transform: 'translateY(-11px)' }, { transform: 'translateY(0)' }]],
      rel: ['#ly-rel',   [{ transform: 'scale(1.06,.78)' },   { transform: 'scale(1,1)' }]],
      bot: ['#ly-bot',   [{ transform: 'translateY(7px)' },   { transform: 'translateY(0)' }]],
      cob: ['#shell-in', [{ transform: 'scale(1.05)' },       { transform: 'scale(1)' }]],
    };
    const m = map[key];
    if (!m) return;
    $(m[0]).animate(m[1], { duration: 520, easing: 'cubic-bezier(.3,1.7,.5,1)' });
  }

  /* ==========================================================================
     Textos, resumen y precios
     ========================================================================== */
  function paintTexts() {
    const t = TAPAS[state.top], b = TAPAS[state.bot], r = RELLENOS[state.rel], k = COBERTURAS[state.cob];
    const name = describe(state);
    $('#alf-name').textContent = name;
    els.svg.setAttribute('aria-label', 'Vista previa de tu alfajor: ' + name);

    const dash = p => (p === 0 ? '—' : fmt(p));
    $('#rc-top').textContent = t.name; $('#rc-top-p').textContent = dash(t.price);
    $('#rc-rel').textContent = r.name; $('#rc-rel-p').textContent = dash(r.price);
    $('#rc-bot').textContent = b.name; $('#rc-bot-p').textContent = dash(b.price);
    $('#rc-cob').textContent = k.name; $('#rc-cob-p').textContent = dash(k.price);
  }

  function paintNumbers() {
    const u = unit(state);
    $('#rc-unit').textContent = fmt(u);
    $('#total').textContent = fmt(u * state.qty);
    $('#add-price').textContent = fmt(u * state.qty);
    $('#qty-val').textContent = state.qty;
    $('#qty-minus').disabled = state.qty <= 1;
    $('#qty-plus').disabled = state.qty >= MAX_ADD;
  }

  function render(changedKey) {
    syncRadios();
    paintPreview();
    paintTexts();
    paintNumbers();
    if (changedKey) bounce(changedKey);
    checkStageOverflow();
  }

  // En ventanas de escritorio bajas, el panel de vista previa puede necesitar scroll propio
  // para llegar al botón de compra. Esto muestra un aviso (sombra) solo mientras haga falta.
  const stageEl = $('.stage');
  function checkStageOverflow() {
    const more = stageEl.scrollHeight - stageEl.clientHeight - stageEl.scrollTop > 4;
    stageEl.classList.toggle('has-more', more);
  }
  stageEl.addEventListener('scroll', checkStageOverflow, { passive: true });
  window.addEventListener('resize', checkStageOverflow);
  if ('ResizeObserver' in window) new ResizeObserver(checkStageOverflow).observe(stageEl);

  /* ==========================================================================
     Aviso (toast)
     ========================================================================== */
  let toastTimer;
  function showToast(msg, withAction) {
    $('#toast-msg').textContent = msg;
    $('#toast-act').hidden = !withAction;
    $('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4600);
  }
  function hideToast() { $('#toast').classList.remove('show'); }

  /* ==========================================================================
     Carrito: agregar, animar, mostrar
     ========================================================================== */
  function miniHTML(c) {
    const t = TAPAS[c.top], b = TAPAS[c.bot], r = RELLENOS[c.rel], k = COBERTURAS[c.cob];
    const shell = k.fill ? '--m-shell:' + k.fill + ';--m-ring:0 0 0 1px ' + k.edge + ';' : '';
    return '<span class="mini' + (k.fill ? ' has-shell' : '') + '" style="--m-top:' + t.base + ';--m-fil:' + r.base + ';--m-bot:' + b.base + ';' + shell + '" aria-hidden="true">' +
      '<i class="m-top"></i><i class="m-fil"></i><i class="m-bot"></i></span>';
  }

  function bumpCartButton() {
    const btn = $('#cart-open');
    btn.classList.remove('bump');
    void btn.offsetWidth;
    btn.classList.add('bump');
  }

  // El alfajor "vuela" hasta el botón Mi pedido.
  function flyToCart(cfg) {
    if (prefersReduced()) { bumpCartButton(); return; }
    const from = els.svg.getBoundingClientRect();
    const to = $('#cart-open').getBoundingClientRect();
    if (!from.width || !to.width) { bumpCartButton(); return; }

    const f = document.createElement('div');
    f.className = 'fly';
    f.innerHTML = miniHTML(cfg);
    document.body.appendChild(f);

    const size = 58;
    const sx = from.left + from.width / 2 - size / 2;
    const sy = from.top + from.height / 2 - size / 2;
    const dx = to.left + to.width / 2 - size / 2 - sx;
    const dy = to.top + to.height / 2 - size / 2 - sy;
    const lift = Math.min(150, Math.max(70, Math.abs(dy) * 0.3));
    f.style.left = sx + 'px';
    f.style.top = sy + 'px';

    const frames = [];
    for (let i = 0; i <= 12; i++) {
      const p = i / 12;
      frames.push({
        transform: 'translate(' + (dx * p) + 'px,' + (dy * p - Math.sin(Math.PI * p) * lift) + 'px) scale(' + (1.1 - 0.82 * p) + ')',
        opacity: p > 0.88 ? 1 - (p - 0.88) / 0.12 * 0.5 : 1,
      });
    }
    const anim = f.animate(frames, { duration: 680, easing: 'cubic-bezier(.5,0,.7,.6)', fill: 'forwards' });
    anim.onfinish = () => { f.remove(); bumpCartButton(); };
    anim.oncancel = () => f.remove();
  }

  function addToCart() {
    const cfg = { top: state.top, rel: state.rel, bot: state.bot, cob: state.cob };
    const qty = state.qty;
    const found = cart.find(i => i.top === cfg.top && i.rel === cfg.rel && i.bot === cfg.bot && i.cob === cfg.cob);
    if (found) found.qty = Math.min(MAX_LINE, found.qty + qty);
    else cart.push({ ...cfg, qty });

    saveCart();
    updateCartUI();
    flyToCart(cfg);
    showToast(qty === 1 ? 'Alfajor agregado al carrito' : qty + ' alfajores agregados al carrito', true);

    state.qty = 1;
    paintNumbers();
  }

  function updateCartUI() {
    const n = cartUnits();
    const count = $('#cart-count');
    count.hidden = n === 0;
    count.textContent = n;
    const btn = $('#cart-open');
    btn.classList.toggle('has-items', n > 0);
    btn.setAttribute('aria-label', n ? 'Mi pedido, ' + n + ' ' + plural(n, 'alfajor', 'alfajores') : 'Mi pedido');
    if (dlg.open) renderCart();
  }

  function itemHTML(c, i) {
    const t = TAPAS[c.top], b = TAPAS[c.bot], r = RELLENOS[c.rel], k = COBERTURAS[c.cob];
    return '<li class="ci" data-i="' + i + '">' + miniHTML(c) +
      '<div class="ci-main">' +
        '<dl class="ci-dl">' +
          '<div><dt>Tapa superior</dt><dd>' + t.name + '</dd></div>' +
          '<div><dt>Relleno</dt><dd>' + r.name + '</dd></div>' +
          '<div><dt>Tapa inferior</dt><dd>' + b.name + '</dd></div>' +
          '<div><dt>Cobertura</dt><dd>' + k.name + '</dd></div>' +
        '</dl>' +
        '<div class="ci-row">' +
          '<div class="stepper sm" role="group" aria-label="Cantidad de este alfajor">' +
            '<button type="button" data-act="dec" aria-label="Menos unidades"' + (c.qty <= 1 ? ' disabled' : '') + '>' + ICON_MINUS + '</button>' +
            '<output>' + c.qty + '</output>' +
            '<button type="button" data-act="inc" aria-label="Más unidades"' + (c.qty >= MAX_LINE ? ' disabled' : '') + '>' + ICON_PLUS + '</button>' +
          '</div>' +
          '<button type="button" class="link" data-act="del" aria-label="Quitar este alfajor del pedido">Quitar</button>' +
          '<span class="ci-sub">' + fmt(unit(c) * c.qty) + '</span>' +
        '</div>' +
      '</div></li>';
  }

  const EMPTY_HTML =
    '<div class="empty">' +
      '<h3>Todavía no agregaste nada</h3>' +
      '<p>Armá tu alfajor y sumalo al carrito para empezar tu pedido.</p>' +
      '<button type="button" class="btn btn-amber" data-act="armar">Armar mi alfajor</button>' +
    '</div>';

  function sentHTML(url) {
    if (!/^https:\/\/wa\.me\/\d{8,15}\?text=[A-Za-z0-9%._~!*'()-]*$/.test(url)) return EMPTY_HTML;
    return '<div class="sent">' +
      '<div class="sent-ico">' + ICON_CHECK + '</div>' +
      '<h3>Tu pedido está listo en WhatsApp</h3>' +
      '<p>Enviá el mensaje para confirmarlo. Si no se abrió, tocá el botón.</p>' +
      '<a class="btn btn-wa" href="' + url + '" target="_blank" rel="noopener noreferrer">' + $('#send svg').outerHTML + '<span>Abrir WhatsApp</span></a>' +
      '<button type="button" class="btn btn-ghost" data-act="armar">Seguir armando</button>' +
    '</div>';
  }

  function renderCart() {
    const body = $('#cart-body'), foot = $('#cart-foot');
    if (sentUrl) {
      body.innerHTML = sentHTML(sentUrl);
      foot.hidden = true;
      return;
    }
    if (!cart.length) {
      body.innerHTML = EMPTY_HTML;
      foot.hidden = true;
      return;
    }
    body.innerHTML = '<ul class="ci-list">' + cart.map(itemHTML).join('') + '</ul>';
    foot.hidden = false;
    $('#cf-total').textContent = fmt(cartTotal());
  }

  /* ==========================================================================
     Panel del carrito (<dialog>)
     ========================================================================== */
  const dlg = $('#cart');
  let closing = false, closeTimer;

  function openCart() {
    hideToast();
    if (closing) {                     // se reabrió mientras se cerraba
      clearTimeout(closeTimer);
      closing = false;
      dlg.classList.add('is-in');
      return;
    }
    if (dlg.open) return;
    renderCart();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    document.documentElement.classList.add('lock');
    requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add('is-in')));
  }

  function finishClose() {
    closing = false;
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
    document.documentElement.classList.remove('lock');
    sentUrl = null;
  }

  function closeCart() {
    if (!dlg.open || closing) return;
    closing = true;
    dlg.classList.remove('is-in');
    if (prefersReduced()) finishClose();
    else closeTimer = setTimeout(finishClose, 400);
  }

  dlg.addEventListener('cancel', e => { e.preventDefault(); closeCart(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) closeCart(); });
  $('#cart-close').addEventListener('click', closeCart);
  $('#cart-open').addEventListener('click', openCart);
  $('#toast-act').addEventListener('click', openCart);

  $('#cart-body').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'armar') { closeCart(); return; }

    const li = btn.closest('.ci');
    if (!li) return;
    const i = +li.dataset.i;
    const item = cart[i];
    if (!item) return;

    if (act === 'inc') item.qty = Math.min(MAX_LINE, item.qty + 1);
    if (act === 'dec') item.qty = Math.max(1, item.qty - 1);
    if (act === 'del') cart.splice(i, 1);

    saveCart();
    updateCartUI();      // vuelve a dibujar el panel (está abierto)

    // Mantener el foco donde estaba, para quien navega con teclado.
    const body = $('#cart-body');
    let next = null;
    if (act === 'del') next = body.querySelector('.ci[data-i="' + Math.min(i, cart.length - 1) + '"] [data-act="del"]') || body.querySelector('[data-act="armar"]');
    else next = body.querySelector('.ci[data-i="' + i + '"] [data-act="' + act + '"]:not(:disabled)') ||
                body.querySelector('.ci[data-i="' + i + '"] [data-act="' + (act === 'inc' ? 'dec' : 'inc') + '"]:not(:disabled)');
    if (next) next.focus();
  });

  /* ==========================================================================
     Pedido por WhatsApp
     ========================================================================== */
  const legacyLabel = c => {
    const t = TAPAS[c.top], r = RELLENOS[c.rel], b = TAPAS[c.bot], k = COBERTURAS[c.cob];
    return t.icon + ' ' + t.name + ' / ' + r.icon + ' ' + r.name + ' / ' + b.icon + ' ' + b.name +
      (k.name !== 'Sin cobertura' ? ' / ' + k.icon + ' ' + k.name : '');
  };

  function buildMessage(nombre) {
    const lineas = cart.map((c, i) => {
      const t = TAPAS[c.top], r = RELLENOS[c.rel], b = TAPAS[c.bot], k = COBERTURAS[c.cob];
      return '*' + (i + 1) + '.* Alfajor x' + c.qty + ' → ' + fmt(unit(c) * c.qty) + '\n' +
        '   • Tapa superior: ' + t.name + '\n' +
        '   • Relleno: ' + r.name + '\n' +
        '   • Tapa inferior: ' + b.name + '\n' +
        '   • Cobertura: ' + k.name;
    }).join('\n\n');

    let msg = '🥮 *Nuevo pedido — Alfastjores*\n';
    if (nombre) msg += '👤 Cliente: ' + nombre + '\n';
    msg += '\n' + lineas + '\n\n💰 *Total: ' + fmt(cartTotal()) + '*\n\n_Pedido realizado desde la web_';
    return msg;
  }

  // Mismo aviso que hacía la versión original (por si otra herramienta lo escucha).
  function avisarPedido(nombre) {
    try {
      const pedido = {
        cliente: nombre || 'Cliente web',
        items: cart.map(c => ({ desc: legacyLabel(c), qty: c.qty, price: unit(c) * c.qty })),
      };
      localStorage.setItem(KEY_PEDIDO, JSON.stringify(pedido));
      // Se limpia para que el próximo pedido también dispare el evento.
      setTimeout(() => { try { localStorage.removeItem(KEY_PEDIDO); } catch (e) {} }, 500);
    } catch (e) { /* sin almacenamiento */ }
  }

  function openLink(url) {
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Nombre del cliente: sin saltos de línea, caracteres de control ni marcas de dirección de texto; máx. 40.
  function limpiarNombre(v) {
    return String(v).replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  }

  function enviarWhatsApp() {
    if (!cart.length) return;
    const nombre = limpiarNombre($('#cf-name').value);
    const url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(buildMessage(nombre));

    avisarPedido(nombre);
    openLink(url);

    cart = [];
    saveCart();
    $('#cf-name').value = '';
    sentUrl = url;
    updateCartUI();                       // actualiza contador y vuelve a dibujar el panel
    const primary = $('#cart-body .btn-wa');
    if (primary) primary.focus();
  }

  $('#send').addEventListener('click', enviarWhatsApp);
  $('#cf-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); enviarWhatsApp(); } });

  /* ==========================================================================
     Eventos del armado
     ========================================================================== */
  $('#options').addEventListener('change', e => {
    const inp = e.target.closest('input[type="radio"]');
    if (!inp) return;
    state[inp.name] = +inp.value;
    render(inp.name);
  });

  $('#qty-minus').addEventListener('click', () => { state.qty = Math.max(1, state.qty - 1); paintNumbers(); });
  $('#qty-plus').addEventListener('click',  () => { state.qty = Math.min(MAX_ADD, state.qty + 1); paintNumbers(); });
  $('#add').addEventListener('click', addToCart);

  // Tocar una capa del dibujo lleva a su grupo de opciones.
  els.svg.addEventListener('click', e => {
    const layer = e.target.closest('[data-layer]');
    if (!layer) return;
    const group = $('.group[data-g="' + layer.dataset.layer + '"]');
    if (!group) return;
    group.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
    group.classList.remove('flash');
    void group.offsetWidth;
    group.classList.add('flash');
    setTimeout(() => group.classList.remove('flash'), 1400);
  });

  // Al pasar por un grupo (o enfocarlo con teclado) se resalta su capa en el dibujo.
  const canHover = window.matchMedia('(hover: hover)').matches;
  $$('.group').forEach(g => {
    const key = g.dataset.g;
    if (canHover) {
      g.addEventListener('mouseenter', () => { els.svg.dataset.hl = key; });
      g.addEventListener('mouseleave', () => { delete els.svg.dataset.hl; });
    }
    g.addEventListener('focusin', e => { if (e.target.matches(':focus-visible')) els.svg.dataset.hl = key; });
    g.addEventListener('focusout', () => { delete els.svg.dataset.hl; });
  });

  // En celular, la barra de compra se retira al terminar la zona de armado.
  const buy = $('#buy'), sentinel = $('#buy-end');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      const pasado = en.isIntersecting || en.boundingClientRect.top < 0;
      buy.classList.toggle('away', pasado);
    }, { rootMargin: '0px 0px -70px 0px' }).observe(sentinel);
  }

  /* ==========================================================================
     Preguntas frecuentes
     ========================================================================== */
  $('.faq').addEventListener('click', e => {
    const q = e.target.closest('.faq-q');
    if (!q) return;
    const item = q.closest('.faq-item');
    const open = item.classList.toggle('open');
    q.setAttribute('aria-expanded', String(open));
  });

  /* ==========================================================================
     Inicio
     ========================================================================== */
  buildOptions();
  render();
  updateCartUI();
})();

/* ============================== 2. TECHTEXT ============================== */
/* ==========================================================================
   TechText — wordmark interactivo en canvas (JS puro, sin dependencias).
   Port de <TechText /> de React Bits: la letra bajo el puntero pasa a contorno punteado,
   con marco de selección, etiquetas, partículas, barrido automático y letras arrastrables.
   Uso en esta página: solo el logo del encabezado (data-tech-text).
   Opciones (data-*): text, font-family, font-weight, font-size, letter-spacing, color, accent-color,
   dash-length, dash-gap, stroke-width, line-style, reveal (letter|off), specks, selection, labels,
   draggable, sweep, speed, align (center|left), pad, height-fit.   No incluye el modo reveal="area".
   ========================================================================== */
(() => {
  'use strict';
  const LABEL_FONT = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const SPRING = 320, DAMPING = 22;
  const DEF = { text: 'Alfastjores', fontFamily: '', fontWeight: 600, fontSize: 150, letterSpacing: -0.05,
    color: '#ffffff', accentColor: '#ffffff', dashLength: 4, dashGap: 2, strokeWidth: 1.5, lineStyle: 'dashed',
    reveal: 'letter', specks: 15, selection: true, labels: true, draggable: true, sweep: true, speed: 1, align: 'center', pad: 0, heightFit: 0.66 };

  const approach = (c, t, dt, sec) => c + (t - c) * (1 - Math.exp(-dt / sec));
  const rgba = (hex, a) => {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.replace(/./g, c => c + c);
    const n = parseInt(h.slice(0, 6), 16), v = Number.isNaN(n) ? 16777215 : n;
    return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')';
  };
  const noise = (...vals) => {
    let h = 2166136261;
    for (const v of vals) { h = Math.imul(h ^ (v | 0), 16777619); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; }
    return (h >>> 0) / 4294967296;
  };
  const signed = v => (v > 0 ? '+' + v : v < 0 ? '−' + (-v) : '0');

  function options(el) {
    const s = Object.assign({}, DEF), d = el.dataset;
    for (const k in DEF) {
      if (d[k] === undefined) continue;
      const n = parseFloat(d[k]);
      s[k] = typeof DEF[k] === 'number' ? (isNaN(n) ? DEF[k] : n) : typeof DEF[k] === 'boolean' ? d[k] !== 'false' : d[k];
    }
    if (d.fontSize === 'inherit') s.fontSize = 0;   // 0 = usar el tamaño de letra del CSS
    return s;
  }

  function mount(container) {
    const s = options(container);
    const canvas = document.createElement('canvas');
    canvas.className = 'tech-text-canvas';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const probe = document.createElement('canvas').getContext('2d');
    if (!ctx || !probe) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 1, height = 1, dpr = 1, raf = 0, last = performance.now(), visible = true;
    let layoutKey = '', requestedFont = '', word = null, glyphs = [];
    let clock = 0, pulse = 0, placed = false, dragging = -1, down = null;
    const goTop = () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    const fontPx = () => s.fontSize || parseFloat(getComputedStyle(container).fontSize) || 24;
    const pointer = { x: 0, y: 0, inside: false }, grab = { x: 0, y: 0 }, lens = { x: 0, y: 0 };
    const frame = { x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0, index: -1 };

    const family = () => s.fontFamily || getComputedStyle(container).fontFamily || 'sans-serif';
    const fontFor = size => s.fontWeight + ' ' + size + 'px ' + family();
    const setFont = (t, size) => {
      t.font = fontFor(size);
      if ('letterSpacing' in t) t.letterSpacing = (s.letterSpacing * size) + 'px';
      t.textAlign = 'left'; t.textBaseline = 'alphabetic';
    };
    const refresh = () => { layoutKey = ''; wake(); };

    // Cada letra se dibuja una sola vez (relleno y contorno) y después solo se copia: es lo que mantiene el movimiento fluido.
    const sprite = (view, g, stroke) => {
      const pad = Math.ceil(s.strokeWidth * 2 + 4), left = g.box.x1 - pad, top = g.box.y1 - pad;
      const image = document.createElement('canvas');
      image.width = Math.max(1, Math.ceil((g.box.x2 - g.box.x1 + pad * 2) * dpr));
      image.height = Math.max(1, Math.ceil((g.box.y2 - g.box.y1 + pad * 2) * dpr));
      const c = image.getContext('2d');
      if (!c) return { image, left, top };
      c.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
      setFont(c, view.size);
      if (stroke) {
        c.lineJoin = 'round'; c.lineWidth = s.strokeWidth * 2; c.strokeStyle = s.color;
        if (s.lineStyle !== 'solid') c.setLineDash([Math.max(1, s.dashLength), Math.max(1, s.dashGap)]);
        c.strokeText(g.char, g.x, view.baseline);
        c.setLineDash([]);
        c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
        c.fillText(g.char, g.x, view.baseline);
      } else { c.fillStyle = s.color; c.fillText(g.char, g.x, view.baseline); }
      return { image, left, top };
    };

    const ensureLayout = () => {
      const key = [s.text, family(), fontPx(), width, height, dpr].join('|');
      if (key === layoutKey && word) return word;
      layoutKey = key;
      const wanted = fontFor(64);
      if (document.fonts && wanted !== requestedFont) { requestedFont = wanted; document.fonts.load(wanted, s.text).then(refresh, refresh); }
      const fs = fontPx();
      setFont(probe, fs);
      let m = probe.measureText(s.text);
      const fit = Math.min(1, (s.align === 'left' ? width - 2 * s.pad : width * 0.9) / Math.max(m.actualBoundingBoxLeft + m.actualBoundingBoxRight, 1),
                              (height * s.heightFit) / Math.max(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, 1));
      const size = fs * fit;
      setFont(probe, size);
      m = probe.measureText(s.text);
      const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const x = s.align === 'left' ? s.pad + m.actualBoundingBoxLeft : (width - inkW) / 2 + m.actualBoundingBoxLeft;
      // Alineado a la izquierda todas las líneas comparten la misma línea base, como en un texto normal.
      const ref = probe.measureText('Hgpqjé'), refH = ref.actualBoundingBoxAscent + ref.actualBoundingBoxDescent;
      const baseline = s.align === 'left' ? (height - refH) / 2 + ref.actualBoundingBoxAscent : (height - inkH) / 2 + m.actualBoundingBoxAscent;
      const view = { size, baseline, left: x - m.actualBoundingBoxLeft, right: x + m.actualBoundingBoxRight,
                     top: baseline - m.actualBoundingBoxAscent, bottom: baseline + m.actualBoundingBoxDescent };
      word = view;
      const previous = glyphs; glyphs = []; let prefix = '';
      Array.from(s.text).forEach((char, i) => {
        prefix += char;
        const own = probe.measureText(char), gx = x + probe.measureText(prefix).width - own.width;
        if (!char.trim()) return;
        const base = { char, x: gx, box: { x1: gx - own.actualBoundingBoxLeft, y1: baseline - own.actualBoundingBoxAscent,
                                            x2: gx + own.actualBoundingBoxRight, y2: baseline + own.actualBoundingBoxDescent } };
        const kept = previous[glyphs.length];
        glyphs.push(Object.assign({}, base, { offset: kept && kept.char === char ? kept.offset : { x: 0, y: 0 },
          velocity: { x: 0, y: 0 }, outline: 0, index: i, fill: sprite(view, base, false), dashes: sprite(view, base, true) }));
      });
      dragging = -1; frame.index = -1;
      return view;
    };

    const glyphAt = (x, y) => {
      if (!word || y < word.top - 24 || y > word.bottom + 24) return -1;
      let best = -1, bd = Infinity;
      glyphs.forEach((g, i) => {
        const x1 = g.box.x1 + g.offset.x, x2 = g.box.x2 + g.offset.x, d = x < x1 ? x1 - x : x > x2 ? x - x2 : 0;
        if (d < bd) { bd = d; best = i; }
      });
      return bd < 28 ? best : -1;
    };

    const blit = (art, dx, dy) => ctx.drawImage(art.image, Math.round((art.left + dx) * dpr), Math.round((art.top + dy) * dpr));
    const crisp = v => (Math.round(v * dpr) + 0.5) / dpr;

    const perimeterPoint = (dist, w, h) => {
      let d = ((dist % (2 * (w + h))) + 2 * (w + h)) % (2 * (w + h));
      if (d < w) return [frame.x1 + d, frame.y1, 0, -1];
      d -= w; if (d < h) return [frame.x2, frame.y1 + d, 1, 0];
      d -= h; if (d < w) return [frame.x2 - d, frame.y2, 0, 1];
      d -= w; return [frame.x1, frame.y2 - d, -1, 0];
    };

    const drawSpecks = a => {
      const w = frame.x2 - frame.x1, h = frame.y2 - frame.y1;
      if (w < 2 || h < 2) return;
      const perimeter = 2 * (w + h), seed = frame.index + 1, grid = 3;
      for (let k = 0; k < s.specks; k++) {
        const period = 0.5 + noise(seed, k, 11) * 1.2, t = pulse / period + noise(seed, k, 17), cycle = Math.floor(t), life = t - cycle;
        if (life > 0.7) continue;
        const [px, py, nx, ny] = perimeterPoint(noise(seed, k, cycle) * perimeter, w, h);
        const pick = noise(seed, k, cycle, 2), size = pick < 0.46 ? 2 : pick < 0.7 ? 3 : pick < 0.84 ? 5 : pick < 0.94 ? 8 : 11, large = size >= 8;
        const out = (large ? 9 : 4) + Math.floor(noise(seed, k, cycle, 1) * 5) * grid;
        const x = frame.x1 + Math.round((px + nx * out - frame.x1) / grid) * grid, y = frame.y1 + Math.round((py + ny * out - frame.y1) / grid) * grid;
        const tone = noise(seed, k, cycle, 3), blink = life < 0.06 || (life > 0.32 && life < 0.36) ? 0.35 : 1;
        const alpha = a * (large ? 0.3 + 0.4 * tone : 0.3 + 0.6 * tone) * blink, left = Math.round(x - size / 2), top = Math.round(y - size / 2);
        if (tone < 0.26 || (large && tone < 0.78)) {
          ctx.strokeStyle = rgba(s.accentColor, alpha); ctx.strokeRect(left + 0.5, top + 0.5, size, size);
          if (large && tone > 0.5) { ctx.fillStyle = rgba(s.accentColor, alpha); ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); }
        } else { ctx.fillStyle = rgba(s.accentColor, alpha); ctx.fillRect(left, top, size, size); }
      }
      for (let j = 0; j < 2; j++) {
        const head = (pulse * 0.42 * s.speed + j * 0.5) * perimeter;
        for (let i = 0; i < 4; i++) {
          const [x, y] = perimeterPoint(head - i * 6, w, h), size = i === 0 ? 3 : 2;
          ctx.fillStyle = rgba(s.accentColor, a * [0.95, 0.55, 0.32, 0.16][i]);
          ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
        }
      }
    };

    const drawFrame = () => {
      const g = glyphs[frame.index];
      if (!g || frame.alpha < 0.01) return;
      const a = frame.alpha, x1 = crisp(frame.x1), y1 = crisp(frame.y1), x2 = crisp(frame.x2), y2 = crisp(frame.y2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const moved = Math.hypot(g.offset.x, g.offset.y);
      if (moved > 1) {
        const hx = (g.box.x1 + g.box.x2) / 2, hy = (g.box.y1 + g.box.y2) / 2;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + g.offset.x, hy + g.offset.y);
        ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.strokeStyle = rgba(s.accentColor, 0.45 * a); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.rect(Math.round(hx) - 2, Math.round(hy) - 2, 4, 4); ctx.fillStyle = rgba(s.accentColor, 0.7 * a); ctx.fill();
      }
      ctx.beginPath(); ctx.rect(x1, y1, x2 - x1, y2 - y1); ctx.lineWidth = 1; ctx.strokeStyle = rgba(s.accentColor, 0.5 * a); ctx.stroke();
      ctx.beginPath();
      for (const [cx, cy] of [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]) ctx.rect(Math.round(cx) - 2, Math.round(cy) - 2, 5, 5);
      ctx.fillStyle = rgba(s.accentColor, 0.95 * a); ctx.fill();
      if (s.specks > 0) { ctx.lineWidth = 1; drawSpecks(a); }
      if (!s.labels) return;
      ctx.font = LABEL_FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillStyle = rgba(s.accentColor, 0.62 * a);
      const label = moved > 1 ? signed(Math.round(g.offset.x)) + ', ' + signed(Math.round(-g.offset.y))
                              : g.char + '  ' + Math.round(g.box.x2 - g.box.x1) + ' × ' + Math.round(g.box.y2 - g.box.y1);
      ctx.fillText(label, Math.round(frame.x1), Math.round(frame.y1) - 7);
    };

    const tick = now => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));   // tope: si el navegador se demora, no hay saltos
      last = now;
      const view = ensureLayout();
      const sweeping = s.sweep && !reduced && !pointer.inside && dragging < 0;
      if (sweeping) clock += dt * s.speed;
      pulse += dt;
      let tx = pointer.x, ty = pointer.y;
      if (sweeping) {
        tx = view.left + (view.right - view.left) * (0.5 - 0.5 * Math.cos(clock * 0.45));
        ty = view.top + (view.bottom - view.top) * (0.45 + 0.1 * Math.sin(clock * 0.8));
      }
      const active = pointer.inside || sweeping || dragging >= 0;
      if (active && !placed) { lens.x = tx; lens.y = ty; }
      if (active) { const lag = pointer.inside ? 0.05 : 0.22; lens.x = approach(lens.x, tx, dt, lag); lens.y = approach(lens.y, ty, dt, lag); }
      placed = active;

      let moving = false;
      glyphs.forEach((g, i) => {
        if (i === dragging) {
          g.offset.x = approach(g.offset.x, pointer.x - grab.x, dt, 0.03); g.offset.y = approach(g.offset.y, pointer.y - grab.y, dt, 0.03);
          g.velocity.x = 0; g.velocity.y = 0; moving = true; return;
        }
        const { offset, velocity } = g;
        if (Math.abs(offset.x) < 0.05 && Math.abs(offset.y) < 0.05 && Math.hypot(velocity.x, velocity.y) < 0.5) {
          offset.x = offset.y = velocity.x = velocity.y = 0; return;
        }
        velocity.x += (-SPRING * offset.x - DAMPING * velocity.x) * dt; velocity.y += (-SPRING * offset.y - DAMPING * velocity.y) * dt;
        offset.x += velocity.x * dt; offset.y += velocity.y * dt; moving = true;
      });

      const focus = dragging >= 0 ? dragging : active ? glyphAt(lens.x, lens.y) : -1;
      if (focus >= 0 && s.selection) {
        const g = glyphs[focus];
        const bx1 = g.box.x1 + g.offset.x - 6, by1 = g.box.y1 + g.offset.y - 6, bx2 = g.box.x2 + g.offset.x + 6, by2 = g.box.y2 + g.offset.y + 6;
        if (frame.index < 0 || frame.alpha < 0.02) { frame.x1 = bx1; frame.y1 = by1; frame.x2 = bx2; frame.y2 = by2; }
        const glide = focus === dragging ? 0.02 : 0.08;
        frame.x1 = approach(frame.x1, bx1, dt, glide); frame.y1 = approach(frame.y1, by1, dt, glide);
        frame.x2 = approach(frame.x2, bx2, dt, glide); frame.y2 = approach(frame.y2, by2, dt, glide);
        frame.index = focus;
      }
      frame.alpha = approach(frame.alpha, focus >= 0 && s.selection ? 1 : 0, dt, 0.1);
      glyphs.forEach((g, i) => {
        const target = s.reveal === 'letter' && i === focus && i !== dragging ? 1 : 0;
        g.outline = approach(g.outline, target, dt, 0.09);
        if (Math.abs(g.outline - target) > 0.002) moving = true; else g.outline = target;
      });
      if (s.draggable) container.style.cursor = dragging >= 0 ? 'grabbing' : focus >= 0 && pointer.inside ? 'grab' : '';

      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const g of glyphs) {
        const moved = Math.hypot(g.offset.x, g.offset.y);
        if (moved > 1) { ctx.globalAlpha = Math.min(1, moved / 24) * 0.55; blit(g.dashes, 0, 0); ctx.globalAlpha = 1; }
      }
      for (const g of glyphs) {
        if (g.outline < 0.999) { ctx.globalAlpha = 1 - g.outline; blit(g.fill, g.offset.x, g.offset.y); }
        if (g.outline > 0.001) { ctx.globalAlpha = g.outline; blit(g.dashes, g.offset.x, g.offset.y); }
        ctx.globalAlpha = 1;
      }
      drawFrame();
      // Con el puntero afuera y sin barrido el bucle se detiene solo: cero consumo.
      if ((active || moving || (frame.alpha > 0.01 && frame.alpha < 0.99)) && visible) raf = requestAnimationFrame(tick);
    };

    function wake() { if (raf || !visible || document.hidden) return; last = performance.now(); raf = requestAnimationFrame(tick); }

    const resize = () => {
      width = Math.max(1, container.clientWidth); height = Math.max(1, container.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      layoutKey = ''; wake();
    };
    const locate = e => { const r = container.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; };
    const onMove = e => { locate(e); pointer.inside = true; wake(); };
    const onLeave = () => { if (dragging >= 0) return; pointer.inside = false; wake(); };
    const onDown = e => {
      locate(e); pointer.inside = true;
      down = e.pointerType !== 'mouse' || e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
      if (s.draggable && (e.pointerType !== 'mouse' || e.button === 0)) {
        const i = glyphAt(pointer.x, pointer.y);
        if (i >= 0) { dragging = i; grab.x = pointer.x - glyphs[i].offset.x; grab.y = pointer.y - glyphs[i].offset.y;
                      if (container.setPointerCapture) container.setPointerCapture(e.pointerId); }
      }
      wake();
    };
    const onUp = e => {
      if (e.type === 'pointerup' && down && container.hasAttribute('data-scroll-top') && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) goTop();
      down = null;
      if (dragging >= 0) {
        dragging = -1;
        if (container.releasePointerCapture) container.releasePointerCapture(e.pointerId);
        const r = container.getBoundingClientRect();
        pointer.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      }
      wake();
    };
    const opt = { passive: true };
    container.addEventListener('pointermove', onMove, opt);  container.addEventListener('pointerenter', onMove, opt);
    container.addEventListener('pointerdown', onDown, opt);  container.addEventListener('pointerup', onUp, opt);
    container.addEventListener('pointercancel', onUp, opt);  container.addEventListener('pointerleave', onLeave, opt);
    container.addEventListener('keydown', e => { if (e.key === 'Enter' && container.hasAttribute('data-scroll-top')) goTop(); });
    new ResizeObserver(resize).observe(container);
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; wake(); }).observe(container);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake(); });
    if (document.fonts) document.fonts.ready.then(refresh, refresh);
    resize();
  }

  document.querySelectorAll('[data-tech-text]').forEach(mount);
  window.TechText = { mount };
})();
