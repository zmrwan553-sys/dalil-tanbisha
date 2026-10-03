const DIRECTORY_HEADERS = ['id', 'name', 'phone', 'category', 'description'];
const DIRECTORY_CATEGORIES = new Set([
  'shops', 'restaurants', 'tricycles', 'pickup', 'electrician', 'carpenters',
  'doors-windows', 'painters', 'appliances', 'tuktuk', 'pharmacies', 'doctors',
  'plumbing', 'private-cars', 'suzuki-cars', 'plaster', 'furniture',
  'laboratories', 'doctors-clinics', 'gypsum-decor', 'sewage-trucks',
]);

function doGet(event) {
  if (event && event.parameter && event.parameter.action === 'list') {
    let response;
    try {
      response = { data: readListings_() };
    } catch {
      response = { data: [], error: 'تعذر تحميل بيانات الدليل' };
    }

    const json = JSON.stringify(response);
    const callback = String(event.parameter.callback || '').trim();
    if (callback) {
      if (!/^[A-Za-z_$][\w$]*$/.test(callback)) {
        return ContentService.createTextOutput('Invalid callback')
          .setMimeType(ContentService.MimeType.TEXT);
      }
      return ContentService.createTextOutput(`${callback}(${json})`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createHtmlOutputFromFile('admin')
    .setTitle('إدارة دليل طنبشا')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function loginAdmin(password) {
  const configuredPassword = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!configuredPassword || configuredPassword.length < 16) {
    throw new Error('يجب ضبط كلمة مرور إدارة قوية من إعدادات Script Properties.');
  }
  if (String(password || '') !== configuredPassword) {
    throw new Error('بيانات الدخول غير صحيحة.');
  }

  const token = `${Utilities.getUuid()}${Utilities.getUuid()}`;
  CacheService.getScriptCache().put(`admin:${token}`, '1', 1800);
  return token;
}

function getAdminListings(token) {
  requireAdmin_(token);
  return readListings_();
}

function logoutAdmin(token) {
  requireAdmin_(token);
  CacheService.getScriptCache().remove(`admin:${token}`);
}

function createListing(token, input) {
  requireAdmin_(token);
  const listing = validateListing_(input);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const context = prepareSheet_();
    const row = new Array(context.sheet.getLastColumn()).fill('');
    row[context.columns.id - 1] = Utilities.getUuid();
    row[context.columns.name - 1] = listing.name;
    row[context.columns.phone - 1] = listing.phone;
    row[context.columns.category - 1] = listing.category;
    row[context.columns.description - 1] = listing.description;
    context.sheet.appendRow(row);
    return readListings_();
  } finally {
    lock.releaseLock();
  }
}

function updateListing(token, id, input) {
  requireAdmin_(token);
  const listing = validateListing_(input);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const context = prepareSheet_();
    const rowNumber = findListingRow_(context, id);
    if (!rowNumber) throw new Error('السجل المطلوب غير موجود.');
    context.sheet.getRange(rowNumber, context.columns.name).setValue(listing.name);
    context.sheet.getRange(rowNumber, context.columns.phone).setValue(listing.phone);
    context.sheet.getRange(rowNumber, context.columns.category).setValue(listing.category);
    context.sheet.getRange(rowNumber, context.columns.description).setValue(listing.description);
    return readListings_();
  } finally {
    lock.releaseLock();
  }
}

function deleteListing(token, id) {
  requireAdmin_(token);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const context = prepareSheet_();
    const rowNumber = findListingRow_(context, id);
    if (!rowNumber) throw new Error('السجل المطلوب غير موجود.');
    context.sheet.deleteRow(rowNumber);
    return readListings_();
  } finally {
    lock.releaseLock();
  }
}

function requireAdmin_(token) {
  if (!token || !CacheService.getScriptCache().get(`admin:${token}`)) {
    throw new Error('انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.');
  }
}

function validateListing_(input) {
  const listing = {
    name: String(input && input.name || '').trim(),
    phone: String(input && input.phone || '').trim(),
    category: String(input && input.category || '').trim(),
    description: String(input && input.description || '').trim(),
  };
  if (!listing.name || listing.name.length > 70) throw new Error('اكتب اسمًا صحيحًا لا يتجاوز 70 حرفًا.');
  if (!/^01[0125][0-9]{8}$/.test(listing.phone)) throw new Error('رقم الهاتف يجب أن يكون رقمًا مصريًا صحيحًا.');
  if (!DIRECTORY_CATEGORIES.has(listing.category)) throw new Error('اختار تصنيفًا صحيحًا.');
  if (listing.description.length > 140) throw new Error('الوصف يجب ألا يتجاوز 140 حرفًا.');
  return listing;
}

function readListings_() {
  const context = prepareSheet_();
  const lastRow = context.sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = context.sheet.getRange(2, 1, lastRow - 1, context.sheet.getLastColumn()).getDisplayValues();
  return values.map((row) => ({
    id: row[context.columns.id - 1],
    name: row[context.columns.name - 1],
    phone: row[context.columns.phone - 1],
    category: row[context.columns.category - 1],
    description: row[context.columns.description - 1],
  })).filter((listing) => listing.id && listing.name && listing.phone && listing.category);
}

function prepareSheet_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('يجب ضبط SPREADSHEET_ID من إعدادات Script Properties.');

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheetName = properties.getProperty('SHEET_NAME') || 'Listings';
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, DIRECTORY_HEADERS.length).setValues([DIRECTORY_HEADERS]);
  }

  const width = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map((value) => value.trim().toLowerCase());
  const aliases = {
    id: ['id', '_id', 'record_id', 'معرف'],
    name: ['name', 'person', 'store', 'الاسم', 'اسم الشخص / المحل'],
    phone: ['phone', 'number', 'telephone', 'رقم التليفون', 'الهاتف'],
    category: ['category', 'categoryid', 'section', 'التصنيف', 'القسم'],
    description: ['description', 'details', 'الوصف', 'التفاصيل'],
  };
  const columns = {};
  Object.keys(aliases).forEach((field) => {
    columns[field] = headers.findIndex((header) => aliases[field].includes(header)) + 1;
  });

  ['name', 'phone', 'category'].forEach((field) => {
    if (!columns[field]) throw new Error(`تعذر تحديد عمود ${field} في أول صف من الشيت.`);
  });
  if (!columns.description) {
    columns.description = sheet.getLastColumn() + 1;
    sheet.getRange(1, columns.description).setValue('description');
  }
  if (!columns.id) {
    columns.id = sheet.getLastColumn() + 1;
    sheet.getRange(1, columns.id).setValue('id');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const idRange = sheet.getRange(2, columns.id, lastRow - 1, 1);
    const ids = idRange.getValues();
    let changed = false;
    ids.forEach((row) => {
      if (!row[0]) {
        row[0] = Utilities.getUuid();
        changed = true;
      }
    });
    if (changed) idRange.setValues(ids);
  }

  return { sheet, columns };
}

function findListingRow_(context, id) {
  if (!id || context.sheet.getLastRow() < 2) return 0;
  const ids = context.sheet.getRange(2, context.columns.id, context.sheet.getLastRow() - 1, 1).getDisplayValues();
  const index = ids.findIndex((row) => row[0] === String(id));
  return index < 0 ? 0 : index + 2;
}