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
    renderHead(); renderGoals(); renderPick(); renderDays(); renderEvents(); renderTools(); renderOfficers(); renderFoot();
  }).catch(function (e) {
    $('stamp').textContent = 'The plan did not load. Refresh the page; if it keeps failing, tell an officer. (' + e.message + ')';
  });
})();
