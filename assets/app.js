(function () {
  'use strict';

  var ROLE_ORDER = ['members', 'war', 'events', 'ops', 'people', 'leader'];
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var roles = {};
  var me = 'members';      // who is reading: a member, or one of the officer roles
  var showPast = false;
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
  function title(r) { return r === 'members' ? 'Member' : roleName(r); }
  function nameOf(r) { return roles[r] && roles[r].name ? roles[r].name : ''; }
  function dayOf(iso) { return week.days.filter(function (d) { return d.date === iso; })[0]; }
  function forMe(t) { return me === 'leader' || t.role === 'members' || t.role === me; }
  function evLink(cls, text, ref) {
    var a = el('a', cls, text); a.href = '#ev-' + ref;
    a.addEventListener('click', function () { var d = document.getElementById('ev-' + ref); if (d) d.open = true; });
    return a;
  }
  function onName(o) { return typeof o === 'string' ? o : o.text; }
  function onItem(d, name) { return d.on.filter(function (o) { return onName(o) === name; })[0]; }
  function onTag(o) {
    var name = typeof o === 'string' ? o : o.text;
    var ref = typeof o === 'string' ? null : o.event;
    return ref ? evLink('tag', name, ref) : el('span', 'tag', name);
  }

  /* Ticked to-dos live in this browser only, one list per day. */
  function doneList(day) { try { return JSON.parse(pref('done-' + day) || '[]'); } catch (e) { return []; } }
  function todo(day, key, text, cls, label) {
    var lab = el('label', 'todo' + (cls ? ' ' + cls : ''));
    var box = document.createElement('input'); box.type = 'checkbox';
    box.checked = doneList(day).indexOf(key) >= 0;
    lab.classList.toggle('done', box.checked);
    box.addEventListener('change', function () {
      var l = doneList(day).filter(function (k) { return k !== key; });
      if (box.checked) l.push(key);
      pref('done-' + day, JSON.stringify(l));
      lab.classList.toggle('done', box.checked);
    });
    lab.appendChild(box);
    var sp = el('span');
    if (label) sp.appendChild(el('small', 'ev-l', label));
    sp.appendChild(document.createTextNode(text));
    lab.appendChild(sp);
    return lab;
  }

  function copyBtn(text, p) {
    var btn = el('button', 'copy', 'Copy'); btn.type = 'button';
    btn.addEventListener('click', function () {
      function ok() { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1500); }
      function fb() {
        try { var r = document.createRange(); r.selectNodeContents(p); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
        btn.textContent = 'Selected – copy it'; setTimeout(function () { btn.textContent = 'Copy'; }, 2500);
      }
      try { navigator.clipboard.writeText(text).then(ok, fb); } catch (e) { fb(); }
    });
    return btn;
  }
  function noticeCard(n) {
    var c = el('div', 'notice'); c.setAttribute('data-role', n.owner);
    var h = el('h4', null, n.title + ' · ');
    h.appendChild(chip(n.owner));
    c.appendChild(h);
    var p = el('p', null, n.text);
    c.appendChild(p);
    var m = el('div', 'n-meta');
    m.appendChild(el('span', null, n.text.length + ' characters' + (n.post ? ' · post ' + n.post : '')));
    m.appendChild(copyBtn(n.text, p));
    c.appendChild(m);
    return c;
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

  /* ---------- Who am I: one picker drives every block below ---------- */
  function renderMe() {
    var p = $('me-pick'); clear(p);
    ROLE_ORDER.forEach(function (r) {
      var b = el('button', null, title(r));
      if (nameOf(r)) b.appendChild(el('small', null, nameOf(r)));
      b.type = 'button';
      b.setAttribute('data-role', r);
      b.setAttribute('aria-pressed', me === r ? 'true' : 'false');
      b.addEventListener('click', function () { me = r; pref('me', r); renderPersonal(); });
      p.appendChild(b);
    });
    var hint = $('me-hint');
    hint.textContent = me === 'members'
      ? 'Officer? Pick your role and the whole page shows your jobs too.'
      : me === 'leader'
        ? 'You see every officer\'s jobs, so you can check nothing is dropped.'
        : 'You see your officer jobs plus everything a member does.';
  }

  function group(heading, role) {
    var g = el('div', 'grp'); g.setAttribute('data-role', role);
    g.appendChild(el('h3', null, heading));
    return g;
  }

  function renderToday() {
    var box = $('today-box'); clear(box);
    var t = todayUTC(), d = dayOf(t), tasks = d ? d.tasks : [];
    $('today-date').textContent = fmt(t) + (d && d.label ? ' · ' + d.label : '');
    if (d && d.on.length) {
      var tags = el('div', 'day-tags today-on');
      tags.appendChild(el('span', 'on-k', 'In game today'));
      d.on.forEach(function (o) { tags.appendChild(onTag(o)); });
      box.appendChild(tags);
    }

    if (me !== 'members') {
      var job = group('Your job as ' + roleName(me), me);
      var mine = tasks.filter(function (x) { return x.role === me; });
      var nts = (week.notices || []).filter(function (n) { return n.date === t && n.owner === me; });
      mine.forEach(function (x) { job.appendChild(todo(t, me + ':' + x.text, x.text, null, x.on)); });
      nts.forEach(function (n) {
        job.appendChild(el('p', 'sub', 'Post this notice today'));
        job.appendChild(noticeCard(n));
      });
      if (!mine.length && !nts.length) job.appendChild(el('p', 'empty', me === 'leader' ? 'Nothing only for you today.' : 'No officer jobs today. Your next ones are in the 14 days below.'));
      box.appendChild(job);
    }

    if (me === 'leader') {
      var off = group('Your officers today', 'leader');
      var ot = tasks.filter(function (x) { return x.role !== 'members' && x.role !== 'leader'; });
      ot.sort(function (a, b) { return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role); });
      ot.forEach(function (x) {
        var row = el('div', 'task'); row.setAttribute('data-role', x.role);
        row.appendChild(chip(x.role, nameOf(x.role) || roles[x.role].short));
        row.appendChild(el('span', null, x.text));
        off.appendChild(row);
      });
      (week.notices || []).filter(function (n) { return n.date === t; }).forEach(function (n) {
        var row = el('div', 'task'); row.setAttribute('data-role', n.owner);
        row.appendChild(chip(n.owner, nameOf(n.owner) || roles[n.owner].short));
        row.appendChild(el('span', null, 'Posts the notice "' + n.title + '".'));
        off.appendChild(row);
      });
      if (off.children.length === 1) off.appendChild(el('p', 'empty', 'No officer jobs today.'));
      box.appendChild(off);
    }

    var mem = group(me === 'members' ? 'Your to-do' : 'As a member', 'members');
    var mt = tasks.filter(function (x) { return x.role === 'members'; });
    if (mt.length) {
      mem.appendChild(el('p', 'sub', 'Today'));
      mt.forEach(function (x) { mem.appendChild(todo(t, 'm:' + x.text, x.text, 'big', x.on)); });
    }
    if ((guides.daily || []).length) {
      mem.appendChild(el('p', 'sub', 'Every day'));
      guides.daily.forEach(function (x) { mem.appendChild(todo(t, 'd:' + x, x)); });
    }
    box.appendChild(mem);

    var nx = week.days.filter(function (x) { return x.date > t; })[0];
    if (nx) {
      var n = nx.tasks.filter(forMe).length;
      var a = el('a', 'tomorrow'); a.href = '#day-' + nx.date;
      var tm = new Date(Date.parse(t + 'T00:00Z') + DAY).toISOString().slice(0, 10) === nx.date;
      a.appendChild(el('b', null, (tm ? 'Tomorrow, ' : 'Next, ') + fmt(nx.date)));
      var names = nx.on.slice(0, 3).map(function (o) { return typeof o === 'string' ? o : o.text; });
      a.appendChild(el('span', null, names.join(', ') + (nx.on.length > 3 ? ' and more' : '') +
        '. ' + n + (n === 1 ? ' task' : ' tasks') + ' for you.'));
      box.appendChild(a);
    }
  }

  function renderGoals() {
    $('headline').textContent = week.headline;
    var g = $('goal-list'); clear(g);
    function mineG(x) { return x.owner === me || (me !== 'leader' && x.owner === 'members'); }
    week.goals.slice().sort(function (a, b) { return (mineG(b) ? 1 : 0) - (mineG(a) ? 1 : 0); }).forEach(function (x) {
      var c = el('div', 'goal' + (mineG(x) ? ' mine' : ''));
      c.setAttribute('data-role', x.owner);
      var top = el('div', 'goal-top');
      top.appendChild(chip(x.owner));
      if (mineG(x)) top.appendChild(el('span', 'yours', x.owner === 'members' ? 'You help' : 'Yours'));
      c.appendChild(top);
      c.appendChild(el('b', null, x.title));
      if (x.when) c.appendChild(el('span', 'when', x.when));
      c.appendChild(el('p', null, x.detail));
      g.appendChild(c);
    });
    var r = $('rule-list'); clear(r);
    week.rules.forEach(function (t) { r.appendChild(el('li', null, t)); });
  }

  function renderDays() {
    var box = $('day-list'); clear(box);
    var t = todayUTC();
    $('days-note').textContent = me === 'leader'
      ? 'Every task for every officer. Times are UTC, the game clock; Central Europe is one hour ahead.'
      : 'Showing what a ' + title(me) + (me === 'members' ? '' : ' and every member') + ' does. Times are UTC, the game clock; Central Europe is one hour ahead.';
    var past = week.days.filter(function (d) { return d.date < t; });
    if (past.length) {
      var more = el('button', 'more', showPast ? 'Hide earlier days' : 'Show ' + past.length + ' earlier ' + (past.length === 1 ? 'day' : 'days'));
      more.type = 'button';
      more.addEventListener('click', function () { showPast = !showPast; renderDays(); });
      box.appendChild(more);
    }
    week.days.forEach(function (d) {
      if (d.date < t && !showPast) return;
      var card = el('article', 'day' + (d.date < t ? ' past' : '') + (d.date === t ? ' today' : ''));
      if (d.kind) card.setAttribute('data-kind', d.kind);
      card.id = 'day-' + d.date;
      var h = el('div', 'day-head');
      h.appendChild(el('span', 'day-date', fmt(d.date)));
      if (d.label) h.appendChild(el('span', 'day-mk', d.label));
      if (d.date === t) h.appendChild(el('span', 'now', 'Today'));
      card.appendChild(h);
      var list = d.tasks.filter(forMe);
      list.sort(function (a, b) {
        function rank(r) { return r === me ? -1 : ROLE_ORDER.indexOf(r); }
        return rank(a.role) - rank(b.role);
      });
      function row(x) {
        var r = el('div', 'task' + (x.role === me && me !== 'members' ? ' mine' : ''));
        r.setAttribute('data-role', x.role);
        r.appendChild(chip(x.role, x.role === 'members' ? 'All' : (x.role === me ? 'You' : roles[x.role].short)));
        r.appendChild(el('span', null, x.text));
        return r;
      }
      var idle = [];
      d.on.forEach(function (o) {
        var its = list.filter(function (x) { return x.on === onName(o); });
        if (!its.length) { idle.push(o); return; }
        var blk = el('div', 'evb');
        var h4 = el('h4', 'evb-h');
        h4.appendChild(typeof o === 'string' ? el('span', null, o) : evLink(null, o.text, o.event));
        blk.appendChild(h4);
        its.forEach(function (x) { blk.appendChild(row(x)); });
        card.appendChild(blk);
      });
      var gen = list.filter(function (x) { return !x.on || !onItem(d, x.on); });
      if (gen.length) {
        var gb = el('div', 'evb');
        gb.appendChild(el('h4', 'evb-h plain', 'Other jobs'));
        gen.forEach(function (x) { gb.appendChild(row(x)); });
        card.appendChild(gb);
      }
      if (!list.length) card.appendChild(el('p', 'empty', 'Nothing for you this day.'));
      if (idle.length) {
        var tags = el('div', 'day-tags also');
        tags.appendChild(el('span', 'on-k', list.length ? 'Also running' : 'Running'));
        idle.forEach(function (o) { tags.appendChild(onTag(o)); });
        card.appendChild(tags);
      }
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

  /* Guides follow the timeline: what is coming soonest comes first. */
  function nextOf(id, now) {
    var best = null;
    (week.timeline || []).forEach(function (it) {
      if (it.event === id && ms(it.end) > now && (!best || ms(it.start) < ms(best.start))) best = it;
    });
    return best;
  }

  function renderEvents() {
    var box = $('event-list');
    var open = {};
    Array.prototype.forEach.call(box.querySelectorAll('details[open]'), function (d) { open[d.id] = true; });
    clear(box);
    var now = Date.now();
    var rec = {};
    (week.recurring || []).forEach(function (r) { if (r.event) rec[r.event] = r; });
    var list = guides.events.map(function (e) { return { e: e, nx: nextOf(e.id, now), rec: rec[e.id] }; });
    function key(x) { return x.rec ? now : x.nx ? ms(x.nx.start) : Infinity; }
    list.sort(function (a, b) { return key(a) - key(b); });
    var later = false;
    box.appendChild(el('h3', 'ev-group', 'Coming up'));
    list.forEach(function (x) {
      var e = x.e;
      if (!x.nx && !x.rec && !later) { later = true; box.appendChild(el('h3', 'ev-group', 'Not in the next two weeks')); }
      var d = el('details', 'ev'); d.id = 'ev-' + e.id;
      if (open[d.id]) d.open = true;
      var s = el('summary');
      var top = el('div', 'ev-top'); top.appendChild(el('span', 'ev-name', e.name));
      s.appendChild(top);
      var meta = el('div', 'ev-meta');
      if (x.nx) {
        var st = status(x.nx, now);
        meta.appendChild(el('span', 'ev-next' + (st.live ? ' live' : ''), st.live ? 'Live now' : dLabel(ms(x.nx.start)) + ' · ' + st.text.replace('Starts in', 'in')));
      } else if (x.rec) meta.appendChild(el('span', 'ev-next', 'Repeats'));
      if (e.owner && e.owner === me) meta.appendChild(chip(me, 'You run this'));
      meta.appendChild(el('span', 'ev-when', e.when));
      s.appendChild(meta);
      d.appendChild(s);
      var b = el('div', 'ev-body');
      if (e.owner && roles[e.owner]) {
        b.appendChild(el('p', 'ev-owner', e.owner === me
          ? 'You run this event. Your jobs for it are in Your day and the 14 days.'
          : 'Run by the ' + roleName(e.owner) + (nameOf(e.owner) ? ', ' + nameOf(e.owner) : '') + '. Ask them first.'));
      }
      function list2(t, items) {
        if (!items || !items.length) return;
        b.appendChild(el('h4', null, t));
        var ul = el('ul');
        items.forEach(function (t2) { ul.appendChild(el('li', null, t2)); });
        b.appendChild(ul);
      }
      list2('What you do', e.todo);
      list2('What to know', e.know);
      if (e.videos && e.videos.length) {
        b.appendChild(el('h4', null, 'Watch'));
        var v = el('div', 'vids');
        e.videos.forEach(function (y) { var r = videoRow(y); if (r) v.appendChild(r); });
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
  }

  function openFromHash() {
    if (location.hash.indexOf('#ev-') !== 0) return;
    var t = document.getElementById(location.hash.slice(1));
    if (t) { t.open = true; t.scrollIntoView(); }
  }
  window.addEventListener('hashchange', openFromHash);

  function renderPersonal() { renderMe(); renderToday(); renderGoals(); renderDays(); renderEvents(); renderOfficers(); }

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
    var order = ROLE_ORDER.filter(function (r) { return r !== 'members'; });
    if (me !== 'members') order = [me].concat(order.filter(function (r) { return r !== me; }));
    order.forEach(function (r) {
      var R = roles[r]; if (!R) return;
      var c = el('div', 'role' + (r === me ? ' you' : '')); c.setAttribute('data-role', r);
      var h = el('h3', null, R.title);
      if (r === me) h.appendChild(el('span', 'yours', 'You'));
      c.appendChild(h);
      c.appendChild(el('p', 'who', R.name ? R.name : 'Name to be added'));
      c.appendChild(el('div', null, R.owns));
      if (R.backup) c.appendChild(el('p', 'bk', 'Backup: ' + roleName(R.backup)));
      box.appendChild(c);
    });
    var wrap = $('notices'), nb = $('notice-list'); clear(nb);
    var ns = (week.notices || []).filter(function (n) { return me === 'leader' || n.owner === me; });
    wrap.hidden = me === 'members' || !ns.length;
    $('notices-h').textContent = me === 'leader' ? 'Notices to post this fortnight' : 'Your notices to post';
    ns.forEach(function (n) { nb.appendChild(noticeCard(n)); });
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
    var saved = pref('me');
    if (saved && roles[saved]) me = saved;
    renderHead(); renderNext(); renderTimeline(); renderPersonal(); renderTools(); renderFoot();
    openFromHash();
    try { sessionStorage.removeItem('k2389-reloaded'); } catch (x) {}
    setInterval(function () { renderNext(); }, 60000);
  }).catch(function (e) {
    // Page and script from two different versions (a cached copy right after an update): reload once.
    var again = false;
    try { again = sessionStorage.getItem('k2389-reloaded') === '1'; sessionStorage.setItem('k2389-reloaded', '1'); } catch (x) { again = true; }
    if (!again) { location.reload(); return; }
    $('stamp').textContent = 'The plan did not load. Refresh the page; if it keeps failing, tell an officer. (' + e.message + ')';
  });
})();
