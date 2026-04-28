// --- Utility functions ---
function sortHeaders(a, b) {
  const na = a.name.toLowerCase(), nb = b.name.toLowerCase();
  return na < nb ? -1 : na > nb ? 1 : 0;
}

function getClassStyle(statusLine) {
  if (/2\d\d/.test(statusLine)) return 'success';
  if (/3\d\d/.test(statusLine)) return 'info';
  if (/4\d\d/.test(statusLine)) return 'error';
  if (/5\d\d/.test(statusLine)) return 'warning';
  return '';
}

function parseURL(url) {
  const m = url.match(/^([^:]+):\/\/([^/:]*)(:\d+)?(\/[^#]*)?/i);
  if (!m) return { scheme: '', host: '', port: undefined, path: '/' };
  return {
    scheme: m[1].toLowerCase(),
    host: m[2],
    port: m[3] ? m[3].slice(1) : undefined,
    path: m[4] || '/'
  };
}

// --- State ---
const headerInfo = { request: [], response: [] };
let settings = {};
let selectedInfo = 0;
let captureTraffic = true;
let filterTabId = null;
let defaultText = '';

// --- Settings ---
function saveSettings() {
  const allOff = ['cap_MainFrame','cap_SubFrame','cap_Stylesheet','cap_Script',
    'cap_Image','cap_Object','cap_Xmlhttprequest','cap_other']
    .every(k => !settings[k]);
  if (allOff) {
    settings.cap_MainFrame = settings.cap_SubFrame = settings.cap_Stylesheet =
    settings.cap_Script = settings.cap_Image = settings.cap_Object =
    settings.cap_Xmlhttprequest = settings.cap_other = true;
  }
  localStorage.lhhSettings = JSON.stringify(settings);
}

function capture(type, tabId) {
  if (filterTabId !== null && tabId !== filterTabId) return false;
  const map = {
    main_frame: 'cap_MainFrame', sub_frame: 'cap_SubFrame',
    stylesheet: 'cap_Stylesheet', script: 'cap_Script',
    image: 'cap_Image', object: 'cap_Object',
    xmlhttprequest: 'cap_Xmlhttprequest', other: 'cap_other'
  };
  return !!settings[map[type]];
}

function populateTabFilter() {
  chrome.tabs.query({}, tabs => {
    const sel = document.getElementById('tabFilter');
    const current = sel.value;
    sel.innerHTML = '<option value="">All Tabs</option>';
    tabs.forEach(tab => {
      const opt = document.createElement('option');
      opt.value = tab.id;
      opt.textContent = tab.title || tab.url || `Tab ${tab.id}`;
      sel.appendChild(opt);
    });
    sel.value = current;
  });
}

// --- UI helpers ---
function resizeWindow() {
  $('.results').css('height', '0px');
  $('.preview').css('width', '0px');
  $('#mainTable').height($(window).height() - $('.nav-pills').height());
  $('.results').css('height', $('#mainTable td').css('height'));
  $('.preview').css('width', $('#previewArea').css('width'));
  $('.codeBlock').height($('#previewArea').height());
  $('.codeBlock').width($('#previewArea').width());
}

function toggleCaptureButton() {
  const $btn = $('#capture');
  $btn.parent().toggleClass('active', captureTraffic);
  $btn.children('i')
    .toggleClass('icon-ok-circle', captureTraffic)
    .toggleClass('icon-ban-circle', !captureTraffic);
  showInfo(selectedInfo);
}

function toggleRawViewButton() {
  const $btn = $('#rawView');
  $btn.parent().toggleClass('active', !!settings.view_Raw);
  $btn.children('i')
    .toggleClass('icon-ok-circle', !!settings.view_Raw)
    .toggleClass('icon-ban-circle', !settings.view_Raw);
  showInfo(selectedInfo);
}

function resetAll() {
  selectedInfo = 0;
  headerInfo.request = [];
  headerInfo.response = [];
  $('#responseList > tbody').empty();
  $('#previewArea').empty().html(defaultText);
}

// --- Display ---
function showHeader(n) {
  const i = n - 1;
  const res = headerInfo.response[i];
  const req = headerInfo.request[i];
  const statusCode = res.statusLine.split(' ')[1];

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="rId">${n}</td>
    <td class="rMe">${req.method}</td>
    <td class="rSt"><span class="badge badge-${getClassStyle(res.statusLine)}">${statusCode}</span></td>
    <td><input type="text" class="inputUrl" value="${res.url.replace(/"/g, '&quot;')}" /></td>`;

  const tbody = document.querySelector('#responseList > tbody');
  if (settings.list_Ascending) {
    if (headerInfo.response.length >= 500) tbody.firstElementChild && tbody.removeChild(tbody.firstElementChild);
    tbody.appendChild(tr);
  } else {
    if (headerInfo.response.length >= 500) tbody.lastElementChild && tbody.removeChild(tbody.lastElementChild);
    tbody.insertBefore(tr, tbody.firstChild);
  }
}

function buildHeaderRows(headers, label) {
  const frag = document.createDocumentFragment();
  const labelRow = document.createElement('tr');
  labelRow.className = 'warning';
  labelRow.innerHTML = `<td colspan="2"><b>${label}</b></td>`;
  frag.appendChild(labelRow);
  headers.forEach(h => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.setAttribute('nowrap', 'nowrap');
    th.textContent = h.name;
    const td = document.createElement('td');
    td.textContent = h.value;
    tr.appendChild(th);
    tr.appendChild(td);
    frag.appendChild(tr);
  });
  return frag;
}

function showNiceInfo(n) {
  const i = n - 1;
  const req = headerInfo.request[i];
  const res = headerInfo.response[i];
  req.requestHeaders.sort(sortHeaders);
  res.responseHeaders.sort(sortHeaders);

  const wrapper = document.createElement('div');
  wrapper.className = 'results preview';
  wrapper.style.overflow = 'auto';

  const table = document.createElement('table');
  table.className = 'table table-bordered table-condensed table-hover';

  const titleRow = document.createElement('tr');
  titleRow.className = getClassStyle(res.statusLine);
  const titleTd = document.createElement('td');
  titleTd.setAttribute('colspan', '2');
  titleTd.innerHTML = `<b>${req.method}</b> ${res.url}<br/> <b>Status:</b> ${res.statusLine}`;
  titleRow.appendChild(titleTd);
  table.appendChild(titleRow);

  table.appendChild(buildHeaderRows(req.requestHeaders, 'Request Headers'));
  table.appendChild(buildHeaderRows(res.responseHeaders, 'Response Headers'));

  wrapper.appendChild(table);
  const area = document.getElementById('previewArea');
  area.innerHTML = '';
  area.appendChild(wrapper);
  resizeWindow();
}

function showRawInfo(n) {
  const i = n - 1;
  const req = headerInfo.request[i];
  const res = headerInfo.response[i];
  req.requestHeaders.sort(sortHeaders);
  res.responseHeaders.sort(sortHeaders);

  const parsed = parseURL(res.url);
  let host = parsed.host;
  if (parsed.port) host += ':' + parsed.port;
  else if (parsed.scheme === 'https') host += ':443';

  const statusParts = res.statusLine.split(' ');
  let text = `${req.method} ${parsed.path} ${statusParts[0]}\nHost: ${host}\n`;
  req.requestHeaders.forEach(h => { text += `${h.name}: ${h.value}\n`; });
  text += `\n${res.statusLine}\n`;
  res.responseHeaders.forEach(h => { text += `${h.name}: ${h.value}\n`; });

  const textarea = document.createElement('textarea');
  textarea.setAttribute('wrap', 'off');
  textarea.className = 'codeBlock input-block-level';
  textarea.setAttribute('readonly', 'readonly');
  textarea.value = text;

  const area = document.getElementById('previewArea');
  area.innerHTML = '';
  area.appendChild(textarea);
  resizeWindow();
}

function showInfo(n) {
  if (!n) return;
  settings.view_Raw ? showRawInfo(n) : showNiceInfo(n);
}

function showAll() {
  let text = '';
  for (let i = 0; i < headerInfo.response.length; i++) {
    const req = headerInfo.request[i];
    const res = headerInfo.response[i];
    req.requestHeaders.sort(sortHeaders);
    res.responseHeaders.sort(sortHeaders);

    const parsed = parseURL(res.url);
    let host = parsed.host;
    if (parsed.port) host += ':' + parsed.port;
    else if (parsed.scheme === 'https') host += ':443';

    const statusParts = res.statusLine.split(' ');
    text += `${req.method} ${parsed.path} ${statusParts[0]}\nHost: ${host}\n`;
    req.requestHeaders.forEach(h => { text += `${h.name}: ${h.value}\n`; });
    text += `\n${res.statusLine}\n`;
    res.responseHeaders.forEach(h => { text += `${h.name}: ${h.value}\n`; });
    text += '\n';
  }
  document.getElementById('exportAsText').value = text;
}

// --- Init ---
$(function () {
  defaultText = document.getElementById('previewArea').innerHTML;

  // Register webRequest listeners (no blocking in MV3)
  chrome.webRequest.onHeadersReceived.addListener(
    n => {
      if (capture(n.type, n.tabId) && captureTraffic) {
        headerInfo.response.push(n);
        showHeader(headerInfo.response.length);
      }
    },
    { urls: ['<all_urls>'], types: ['main_frame','sub_frame','stylesheet','script','image','object','xmlhttprequest','other'] },
    ['responseHeaders']
  );

  chrome.webRequest.onSendHeaders.addListener(
    n => {
      if (capture(n.type, n.tabId) && captureTraffic) headerInfo.request.push(n);
    },
    { urls: ['<all_urls>'], types: ['main_frame','sub_frame','stylesheet','script','image','object','xmlhttprequest','other'] },
    ['requestHeaders']
  );

  // Tab filter
  populateTabFilter();
  $('#tabFilter').on('mousedown', populateTabFilter).on('change', function () {
    const val = this.value;
    filterTabId = val ? parseInt(val, 10) : null;
    resetAll();
  });

  // List click
  $('#responseList').on('click', function (ev) {
    const target = ev.target;
    const tag = target.nodeName.toLowerCase();
    if (tag === 'td' || tag === 'input' || tag === 'span') {
      const id = parseInt($(target).closest('tr').children('td').first().text(), 10);
      $(target).closest('tr').find('input').select();
      selectedInfo = id;
      showInfo(id);
    }
  });

  $('#clearAll').on('click', resetAll);
  $('#showAll').on('click', showAll);

  $('#rawView').on('click', function () {
    settings.view_Raw = !settings.view_Raw;
    saveSettings();
    toggleRawViewButton();
  });

  $('#capture').on('click', function () {
    captureTraffic = !captureTraffic;
    showInfo(selectedInfo);
    toggleCaptureButton();
  });

  $('#settings').on('click', function () {
    $('#setMainFrame').prop('checked', settings.cap_MainFrame);
    $('#setSubFrame').prop('checked', settings.cap_SubFrame);
    $('#setStylesheet').prop('checked', settings.cap_Stylesheet);
    $('#setScript').prop('checked', settings.cap_Script);
    $('#setImage').prop('checked', settings.cap_Image);
    $('#setObject').prop('checked', settings.cap_Object);
    $('#setXHR').prop('checked', settings.cap_Xmlhttprequest);
    $('#setOther').prop('checked', settings.cap_other);
    $('#viewTypeRaw').prop('checked', !!settings.view_Raw);
    $('#viewTypeNice').prop('checked', !settings.view_Raw);
    $('#listAscending').prop('checked', !!settings.list_Ascending);
    $('#listDescending').prop('checked', !settings.list_Ascending);
  });

  $('#saveSettings').on('click', function () {
    settings.cap_MainFrame = $('#setMainFrame').prop('checked');
    settings.cap_SubFrame = $('#setSubFrame').prop('checked');
    settings.cap_Stylesheet = $('#setStylesheet').prop('checked');
    settings.cap_Script = $('#setScript').prop('checked');
    settings.cap_Image = $('#setImage').prop('checked');
    settings.cap_Object = $('#setObject').prop('checked');
    settings.cap_Xmlhttprequest = $('#setXHR').prop('checked');
    settings.cap_other = $('#setOther').prop('checked');
    settings.view_Raw = $('#viewTypeRaw').prop('checked');
    const asc = $('#listAscending').prop('checked');
    if (settings.list_Ascending !== asc) { settings.list_Ascending = asc; resetAll(); }
    toggleRawViewButton();
    saveSettings();
    $('#myModal').modal('hide');
  });

  // Load settings
  const saved = localStorage.lhhSettings;
  if (saved) {
    settings = JSON.parse(saved);
  } else {
    settings = {
      cap_MainFrame: true, cap_SubFrame: true, cap_Stylesheet: true,
      cap_Script: true, cap_Image: true, cap_Object: true,
      cap_Xmlhttprequest: true, cap_other: true,
      view_Raw: true, list_Ascending: false
    };
    saveSettings();
  }

  // Notify background of this tab's ID
  chrome.tabs.getCurrent(tab => {
    chrome.runtime.sendMessage({ type: 'setViewTabId', tabId: tab.id });
  });

  resizeWindow();
  toggleRawViewButton();
});

$(window).on('resize', resizeWindow);
