(function () {
  'use strict';

  var ROLE_ORDER = ['members', 'war', 'events', 'ops', 'people', 'leader'];
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var roles = {};
  var filter = 'all';
  var week, guides;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function safeUrl(u) { return typeof u === 'string' && u.indexOf('https://') === 0 ? u : null; }
  function link(text, url, cls) {
    var u = safeUrl(url);
    if (!u) return el('span', cls, text);
    var a = el('a', cls, text);
    a.href = u; a.target = '_blank'; a.rel = 'noopener';
    return a;
  }
  function todayUTC() { return new Date().toISOString().slice(0, 10); }
  function fmt(d) {
    var x = new Date(d + 'T00:00:00Z');
    return WD[x.getUTCDay()] + ' ' + x.getUTCDate() + ' ' + MO[x.getUTCMonth()];
  }
  function roleName(r) { return roles[r] ? roles[r].title : r; }
  function chip(r, text) {
    var c = el('span', 'chip', text || roleName(r));
    c.setAttribute('data-role', r);
    return c;
  }
  function pref(k, v) {
    try {
      if (v === undefined) return localStorage.getItem('k2389-' + k);
      localStorage.setItem('k2389-' + k, v);
    } catch (e) { return null; }
  }

  function renderHead() {
    if (week.alliance) { $('alliance').textContent = week.alliance; document.title = week.alliance + ' – K2389'; }
    $('stamp').textContent = 'Plan for ' + fmt(week.window.start) + ' – ' + fmt(week.window.end) +
      '. Updated ' + fmt(week.updated) + '. Next update ' + fmt(week.next_update) + '.';
    if (todayUTC() > week.window.end) {
      var s = $('stale');
      s.hidden = false;
      s.textContent = 'This plan ended on ' + fmt(week.window.end) + '. Ask an officer for the new week before acting on it.';
    }
  }

  /* ---------- Coming up: next-event panel + timeline ---------- */
  var DAY = 864e5;
  function ms(s) { return Date.parse(s); }
  function isAllDay(it) { return /T00:00/.test(it.start) && /T00:00/.test(it.end); }
  function hm(t) { var d = new Date(t); return ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2); }
  function dLabel(t) { return fmt(new Date(t).toISOString().slice(0, 10)); }
  function span(it) {
    var s = ms(it.start), e = ms(it.end);
    if (isAllDay(it)) {
      return (e - s) <= DAY ? dLabel(s) : dLabel(s) + ' – ' + dLabel(e - DAY);
    }
    if (dLabel(s) === dLabel(e - 1)) return dLabel(s) + ', ' + hm(s) + '–' + hm(e) + ' UTC';
    return dLabel(s) + ' ' + hm(s) + ' – ' + dLabel(e) + ' ' + hm(e) + ' UTC';
  }
  function dur(x) {
    var m = Math.max(0, Math.round(x / 6e4)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + mm + 'm';
    return mm + 'm';
  }
  function status(it, now) {
    var s = ms(it.start), e = ms(it.end);
    if (now >= s && now < e) return { live: true, text: 'Live now · ends in ' + dur(e - now) };
    if (isAllDay(it)) {
      var days = Math.round((s - Date.parse(new Date(now).toISOString().slice(0, 10) + 'T00:00Z')) / DAY);
      return { live: false, text: days === 1 ? 'Tomorrow' : 'In ' + days + ' days' };
    }
    return { live: false, text: 'Starts in ' + dur(s - now) };
  }
  function evHref(it) { return it.event ? '#ev-' + it.event : '#calendar'; }
  function goEvent(a, it) {
    a.href = evHref(it);
    a.addEventListener('click', function () { var d = it.event && document.getElementById('ev-' + it.event); if (d) d.open = true; });
  }
  function upcoming(now) {
    var tl = week.timeline || [];
    return tl.filter(function (it) { return ms(it.end) > now; })
      .sort(function (a, b) {
        return ms(a.start) - ms(b.start) ||
          (a.level === b.level ? 0 : (a.level === 'main' ? -1 : 1)) ||
          tl.indexOf(a) - tl.indexOf(b);
      });
  }

  function renderNext() {
    var box = $('next'); clear(box);
    var now = Date.now(), list = upcoming(now);
    var main = list.filter(function (it) { return it.level === 'main'; });
    var live = main.filter(function (it) { return ms(it.start) <= now; });
    var hero = live[0] || main[0];
    if (hero) {
      var h = el('a', 'hero'); goEvent(h, hero);
      var st = status(hero, now);
      h.appendChild(el('span', 'k', st.live ? 'Main event – live' : 'Next main event'));
      h.appendChild(el('span', 'n', hero.name));
      h.appendChild(el('span', 'cd', st.text));
      h.appendChild(el('span', 'w', span(hero)));
      if (hero.note) h.appendChild(el('span', 'note2', hero.note));
      box.appendChild(h);
    }
    var s = el('div', 'soon');
    s.appendChild(el('h3', null, 'Next up'));
    list.filter(function (it) { return it !== hero; }).slice(0, 5).forEach(function (it) {
      var a = el('a'); goEvent(a, it);
      a.appendChild(el('i', 'dot' + (it.level === 'main' ? ' main' : '')));
      a.appendChild(el('span', 'nm' + (it.level === 'main' ? ' main' : ''), it.name));
      var st2 = status(it, now);
      a.appendChild(el('span', 'when' + (st2.live ? ' live' : ''), st2.live ? 'Live' : st2.text.replace('Starts in ', 'in ')));
      s.appendChild(a);
    });
    box.appendChild(s);
  }

  function pack(items) {
    var rows = [];
    items.forEach(function (it) {
      var s = ms(it.start), placed = false;
      for (var r = 0; r < rows.length; r++) {
        if (rows[r] <= s) { it._row = r; rows[r] = ms(it.end); placed = true; break; }
      }
      if (!placed) { it._row = rows.length; rows.push(ms(it.end)); }
    });
    return rows.length;
  }

  function renderTimeline() {
    var host = $('tl'); clear(host);
    var items = (week.timeline || []).slice();
    var t0 = Date.parse(week.window.start + 'T00:00Z');
    var t1 = Date.parse(week.window.end + 'T00:00Z') + DAY;
    items.forEach(function (it) { if (ms(it.start) >= t1 && ms(it.start) < t1 + 2 * DAY) t1 = Math.max(t1, Date.parse(it.start.slice(0, 10) + 'T00:00Z') + DAY); });
    var nDays = Math.round((t1 - t0) / DAY);
    host.style.setProperty('--tlw', (nDays * 88) + 'px');
    function pct(t) { return ((Math.min(Math.max(t, t0), t1) - t0) / (t1 - t0) * 100) + '%'; }
    var now = Date.now(), today = todayUTC();

    var head = el('div', 'tl-days');
    for (var i = 0; i < nDays; i++) {
      var iso = new Date(t0 + i * DAY).toISOString().slice(0, 10), x = new Date(t0 + i * DAY);
      var dd = el('div', 'tl-day' + (x.getUTCDay() % 6 === 0 ? ' wkend' : '') + (iso === today ? ' today' : ''));
      dd.appendChild(document.createTextNode(WD[x.getUTCDay()]));
      dd.appendChild(el('b', null, String(x.getUTCDate())));
      head.appendChild(dd);
    }
    host.appendChild(head);

    [['main', 'Main events', 52, 6], ['routine', 'Regular events', 30, 4]].forEach(function (L) {
      var lv = items.filter(function (it) { return it.level === L[0] && ms(it.end) > t0 && ms(it.start) < t1; })
        .sort(function (a, b) { return ms(a.start) - ms(b.start); });
      var shown = lv.map(function (it) {
        var s0 = ms(it.start), e0 = ms(it.end);
        if (it.level === 'main' && e0 - s0 < DAY) { s0 = Date.parse(it.start.slice(0, 10) + 'T00:00Z'); e0 = s0 + DAY; }
        return { start: new Date(s0).toISOString(), end: new Date(e0).toISOString(), ref: it };
      });
      var rows = Math.max(1, pack(shown));
      shown.forEach(function (x) { x.ref._row = x._row; });
      var lane = el('div', 'tl-lane');
      var top = 26;
      lane.style.height = (top + rows * L[2] + L[3]) + 'px';
      var grid = el('div', 'tl-grid');
      for (var g = 0; g < nDays; g++) grid.appendChild(el('i'));
      lane.appendChild(grid);
      lane.appendChild(el('span', 'tl-lab', L[1]));
      lv.forEach(function (it) {
        var a = el('a', 'tl-bar lv-' + it.level + (/prep/i.test(it.name) ? ' prep' : '') + (ms(it.end) <= now ? ' past' : '') + (isAllDay(it) && (ms(it.end) - ms(it.start)) <= DAY ? ' short' : ''));
        goEvent(a, it);
        var bs = ms(it.start), be = ms(it.end);
        if (it.level === 'main' && be - bs < DAY) {
          bs = Date.parse(it.start.slice(0, 10) + 'T00:00Z'); be = bs + DAY;
        }
        var l = pct(bs), r = pct(be);
        a.style.left = 'calc(' + l + ' + 2px)';
        a.style.width = 'calc(' + r + ' - ' + l + ' - 4px)';
        a.style.top = (top + it._row * L[2]) + 'px';
        a.title = it.name + ' – ' + span(it) + (it.note ? '. ' + it.note : '');
        if (it.level === 'main') {
          a.appendChild(el('b', null, it.name));
          a.appendChild(el('small', null, (isAllDay(it) || dLabel(ms(it.start)) !== dLabel(ms(it.end) - 1)) ? span(it) : hm(ms(it.start)) + '–' + hm(ms(it.end))));
        } else a.appendChild(el('span', null, it.name));
        lane.appendChild(a);
      });
      host.appendChild(lane);
    });

    if (now > t0 && now < t1) {
      var line = el('div', 'tl-now'); line.style.left = pct(now);
      host.appendChild(line);
      var sc = $('tl-scroll');
      requestAnimationFrame(function () {
        sc.scrollLeft = Math.max(0, (now - t0) / (t1 - t0) * host.scrollWidth - 48);
      });
    }

    var rec = $('recurring'); clear(rec);
    (week.recurring || []).forEach(function (r, i) {
      if (i) rec.appendChild(document.createTextNode(' '));
      var b = el('a', null, r.name); goEvent(b, r);
      rec.appendChild(b);
      rec.appendChild(document.createTextNode(': ' + r.note));
    });
  }

  function renderGoals() {
    $('headline').textContent = week.headline;
    var g = $('goal-list'); clear(g);
    week.goals.forEach(function (x) {
      var c = el('div', 'goal');
      c.setAttribute('data-role', x.owner);
      c.appendChild(chip(x.owner));
      c.appendChild(el('b', null, x.title));
      if (x.when) c.appendChild(el('span', 'when', x.when));
      c.appendChild(el('p', null, x.detail));
      g.appendChild(c);
    });
    var r = $('rule-list'); clear(r);
    week.rules.forEach(function (t) { r.appendChild(el('li', null, t)); });
  }

  function renderPick() {
    var p = $('role-pick'); clear(p);
    ['all'].concat(ROLE_ORDER).forEach(function (r) {
      var b = el('button', null, r === 'all' ? 'Everything' : roleName(r));
      b.type = 'button';
      b.setAttribute('data-role', r);
      b.setAttribute('aria-pressed', filter === r ? 'true' : 'false');
      b.addEventListener('click', function () { filter = r; pref('filter', r); renderPick(); renderDays(); });
      p.appendChild(b);
    });
  }

  function renderDays() {
    var box = $('day-list'); clear(box);
    var t = todayUTC();
    var evIds = {};
    guides.events.forEach(function (e) { evIds[e.id] = true; });
    week.days.forEach(function (d) {
      var card = el('article', 'day' + (d.date < t ? ' past' : '') + (d.date === t ? ' today' : ''));
      if (d.kind) card.setAttribute('data-kind', d.kind);
      card.id = 'day-' + d.date;
      var h = el('div', 'day-head');
      h.appendChild(el('span', 'day-date', fmt(d.date)));
      if (d.label) h.appendChild(el('span', 'day-mk', d.label));
      if (d.date === t) h.appendChild(el('span', 'now', 'Today'));
      card.appendChild(h);
      var tags = el('div', 'day-tags');
      d.on.forEach(function (o) {
        var name = typeof o === 'string' ? o : o.text;
        var ref = typeof o === 'string' ? null : o.event;
        if (ref && evIds[ref]) {
          var a = el('a', 'tag', name); a.href = '#ev-' + ref;
          a.addEventListener('click', function () { var dd = document.getElementById('ev-' + ref); if (dd) dd.open = true; });
          tags.appendChild(a);
        } else tags.appendChild(el('span', 'tag', name));
      });
      card.appendChild(tags);
      var list = d.tasks.filter(function (x) { return filter === 'all' || x.role === filter; });
      list.sort(function (a, b) { return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role); });
      if (!list.length) card.appendChild(el('p', 'empty', 'Nothing for ' + roleName(filter) + ' this day.'));
      list.forEach(function (x) {
        var row = el('div', 'task');
        row.setAttribute('data-role', x.role);
        row.appendChild(chip(x.role, roles[x.role] ? roles[x.role].short : x.role));
        row.appendChild(el('span', null, x.text));
        card.appendChild(row);
      });
      box.appendChild(card);
    });
  }

  function videoRow(v) {
    var u = safeUrl(v.url);
    if (!u) return null;
    var a = el('a', 'vid'); a.href = u; a.target = '_blank'; a.rel = 'noopener';
    var m = /[?&]v=([\w-]{11})/.exec(u) || /youtu\.be\/([\w-]{11})/.exec(u);
    if (m) {
      var img = document.createElement('img');
      img.src = 'https://i.ytimg.com/vi/' + m[1] + '/mqdefault.jpg';
      img.alt = ''; img.loading = 'lazy';
      a.appendChild(img);
    }
    var s = el('span', null, v.title);
    s.appendChild(el('small', null, v.channel + (v.year ? ' · ' + v.year : '')));
    a.appendChild(s);
    return a;
  }

  function renderEvents() {
    var box = $('event-list'); clear(box);
    guides.events.forEach(function (e) {
      var d = el('details', 'ev'); d.id = 'ev-' + e.id;
      var s = el('summary');
      var top = el('div', 'ev-top'); top.appendChild(el('span', 'ev-name', e.name));
      s.appendChild(top);
      s.appendChild(el('span', 'ev-when', e.when));
      d.appendChild(s);
      var b = el('div', 'ev-body');
      function list(title, items) {
        if (!items || !items.length) return;
        b.appendChild(el('h4', null, title));
        var ul = el('ul');
        items.forEach(function (t) { ul.appendChild(el('li', null, t)); });
        b.appendChild(ul);
      }
      list('What to know', e.know);
      list('What to do', e.todo);
      if (e.videos && e.videos.length) {
        b.appendChild(el('h4', null, 'Watch'));
        var v = el('div', 'vids');
        e.videos.forEach(function (x) { var r = videoRow(x); if (r) v.appendChild(r); });
        b.appendChild(v);
      }
      if (e.links && e.links.length) {
        b.appendChild(el('h4', null, 'Read more'));
        var p = el('p'); p.style.margin = '0';
        e.links.forEach(function (l, i) { if (i) p.appendChild(document.createTextNode(' · ')); p.appendChild(link(l.text, l.url)); });
        b.appendChild(p);
      }
      d.appendChild(b);
      box.appendChild(d);
    });
    openFromHash();
  }

  function openFromHash() {
    if (location.hash.indexOf('#ev-') !== 0) return;
    var t = document.getElementById(location.hash.slice(1));
    if (t) { t.open = true; t.scrollIntoView(); }
  }
  window.addEventListener('hashchange', openFromHash);

  function renderTools() {
    var box = $('tool-list'); clear(box);
    guides.tool_groups.forEach(function (g) {
      var c = el('div', 'tool-group');
      c.appendChild(el('h3', null, g.name));
      g.tools.forEach(function (t) {
        var u = safeUrl(t.url); if (!u) return;
        var a = el('a', 'tool'); a.href = u; a.target = '_blank'; a.rel = 'noopener';
        a.appendChild(el('b', null, t.name));
        a.appendChild(el('small', null, t.what));
        c.appendChild(a);
      });
      box.appendChild(c);
    });
  }

  function renderOfficers() {
    var box = $('role-list'); clear(box);
    ROLE_ORDER.forEach(function (r) {
      var R = roles[r]; if (!R || r === 'members') return;
      var c = el('div', 'role'); c.setAttribute('data-role', r);
      c.appendChild(el('h3', null, R.title));
      c.appendChild(el('p', 'who', R.name ? R.name : 'Name to be added'));
      c.appendChild(el('div', null, R.owns));
      if (R.backup) c.appendChild(el('p', 'bk', 'Backup: ' + roleName(R.backup)));
      box.appendChild(c);
    });
    var nb = $('notice-list'); clear(nb);
    (week.notices || []).forEach(function (n) {
      var c = el('div', 'notice'); c.setAttribute('data-role', n.owner);
      var h = el('h4', null, n.title + ' · ');
      h.appendChild(chip(n.owner));
      c.appendChild(h);
      var p = el('p', null, n.text);
      c.appendChild(p);
      var m = el('div', 'n-meta');
      m.appendChild(el('span', null, n.text.length + ' characters' + (n.post ? ' · post ' + n.post : '')));
      var btn = el('button', 'copy', 'Copy'); btn.type = 'button';
      btn.addEventListener('click', function () {
        function ok() { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1500); }
        function fb() {
          try { var r = document.createRange(); r.selectNodeContents(p); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
          btn.textContent = 'Selected – copy it'; setTimeout(function () { btn.textContent = 'Copy'; }, 2500);
        }
        try { navigator.clipboard.writeText(n.text).then(ok, fb); } catch (e) { fb(); }
      });
      m.appendChild(btn);
      c.appendChild(m);
      nb.appendChild(c);
    });
  }

  function renderFoot() {
    var c = $('confirm-list'); clear(c);
    guides.confirm.forEach(function (t) { c.appendChild(el('li', null, t)); });
    var s = $('sources'); clear(s);
    s.appendChild(document.createTextNode('Dates are forecasts from '));
    s.appendChild(link('the Kingdom 2389 tracker', 'https://www.kingshotguide.org/kingdom-rankings/2389'));
    s.appendChild(document.createTextNode('. Rules follow the '));
    s.appendChild(link('official help center', 'https://centurygames.helpshift.com/hc/en/140-kingshot/'));
    s.appendChild(document.createTextNode(' and the fan guides linked in each event. Fan-made page, not affiliated with the game.'));
  }

  function tick() {
    var n = new Date();
    $('clock').textContent = 'Game time ' + ('0' + n.getUTCHours()).slice(-2) + ':' + ('0' + n.getUTCMinutes()).slice(-2) + ' UTC';
  }

  function load(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' ' + r.status);
      return r.json();
    });
  }

  tick(); setInterval(tick, 20000);
  Promise.all([load('data/week.json'), load('data/guides.json')]).then(function (res) {
    week = res[0]; guides = res[1]; roles = guides.roles;
    var saved = pref('filter');
    if (saved && (saved === 'all' || roles[saved])) filter = saved;
    renderHead(); renderNext(); renderTimeline(); renderGoals();
    setInterval(function () { renderNext(); }, 60000); renderPick(); renderDays(); renderEvents(); renderTools(); renderOfficers(); renderFoot();
  }).catch(function (e) {
    $('stamp').textContent = 'The plan did not load. Refresh the page; if it keeps failing, tell an officer. (' + e.message + ')';
  });
})();
