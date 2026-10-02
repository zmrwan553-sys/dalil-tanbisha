const categoryDefinitions = [
  { id: 'shops', label: 'محلات', icon: '🏪' },
  { id: 'restaurants', label: 'مطاعم', icon: '🍽️' },
  { id: 'tricycles', label: 'تروسيكلات', icon: '🛺' },
  { id: 'pickup', label: 'ربع نقل', icon: '🚚' },
  { id: 'electrician', label: 'كهربائي', icon: '🔌' },
  { id: 'carpenters', label: 'نجارين', icon: '🪚' },
  { id: 'doors-windows', label: 'ابواب وشبابيك', icon: '🚪' },
  { id: 'painters', label: 'نقاشين', icon: '🖌️' },
  { id: 'appliances', label: 'تصليح تلاجات وغسالات', icon: '🧺' },
  { id: 'tuktuk', label: 'تكاتك', icon: '🛺' },
  { id: 'pharmacies', label: 'صيدليات', icon: '✚' },
  { id: 'doctors', label: 'اطباء', icon: '🩺' },
  { id: 'plumbing', label: 'سباكة', icon: '🔧' },
  { id: 'private-cars', label: 'عربيات ملاكي', icon: '🚗' },
  { id: 'suzuki-cars', label: 'عربيات سوزوكي', icon: '🚐' },
  { id: 'plaster', label: 'بياض محارة', icon: '🧱' },
  { id: 'furniture', label: 'تجار موبيليا', icon: '🪑' },
  { id: 'laboratories', label: 'معامل', icon: '🧪' },
  { id: 'doctors-clinics', label: 'دكاترة', icon: '👨‍⚕️' },
  { id: 'gypsum-decor', label: 'جبس بورد وديكورات', icon: '🎨' },
  { id: 'sewage-trucks', label: 'عربيات صرف وكسح', icon: '🚛' },
];
const categoryById = Object.fromEntries(categoryDefinitions.map((category) => [category.id, category]));
const categoryAliases = new Map([
  ['سوبر ماركت', 'shops'],
  ['سوبرماركت', 'shops'],
  ['groceries', 'shops'],
  ['carpenter', 'carpenters'],
  ['plumbers', 'plumbing'],
  ['transport', 'private-cars'],
  ['blacksmiths', 'doors-windows'],
  ['trades', 'carpenters'],
  ['important', 'pharmacies'],
  ['بقالة وسوبر ماركت', 'shops'],
  ['نجار أبواب وشبابيك', 'carpenters'],
  ['سباكين', 'plumbing'],
  ['خدمات ومواصلات', 'private-cars'],
  ['صنايعية ومهنيين', 'carpenters'],
  ['أرقام مهمة', 'pharmacies'],
]);
const professionGroups = categoryDefinitions.map((category) => ({
  id: category.id,
  label: category.label,
  icon: category.icon,
  categories: [category.id],
}));
const initialListings = [];
const storageKey = 'tanbish_numbers';
const legacyStorageKey = 'tanbish-guide-listings';
const sheetUrlStorageKey = 'tanbish_sheet_url';
const searchInput = document.querySelector('#search-input');
const professionGrid = document.querySelector('#profession-grid');
const professionView = document.querySelector('#profession-view');
const resultsView = document.querySelector('#results-view');
const selectedProfessionTitle = document.querySelector('#selected-profession-title');
const providerResults = document.querySelector('#provider-results');
const resultsSummary = document.querySelector('#results-summary');
const resultsEmpty = document.querySelector('#results-empty');
const toast = document.querySelector('#toast');
let listings = [...initialListings];
let selectedProfession = null;
let toastTimer;
let numbersLoadPromise;
let listingsReady = false;
let pendingListings = [];

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2300);
}

function normalizeSearch(value) {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return String(value).normalize('NFKC').replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit))).toLocaleLowerCase('ar').trim();
}

function getSheetUrl() {
  const configuredUrl = SHEET_URL.trim();
  if (configuredUrl) return configuredUrl;

  try {
    const savedUrl = localStorage.getItem(sheetUrlStorageKey);
    return savedUrl ? savedUrl.trim() : '';
  } catch {
    return '';
  }
}

function normalizeNumbers(data) {
  const records = Array.isArray(data)
    ? data
    : Array.isArray(data?.numbers)
      ? data.numbers
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return records.map((record) => {
    if (!record || typeof record !== 'object') return null;
    const rawCategory = String(record.category || record.categoryId || record.section || '').trim();
    const category = categoryById[rawCategory]
      ? rawCategory
      : categoryAliases.get(rawCategory) || categoryDefinitions.find((item) => item.label === rawCategory)?.id;
    const name = String(record.name || record.person || record.store || '').trim();
    const rawPhone = record.phone || record.number || record.telephone || '';
    const phoneText = String(rawPhone).trim();
    const phone = typeof rawPhone === 'number' && /^\d{9,10}$/.test(phoneText)
      ? `0${phoneText}`
      : phoneText;
    return {
      name,
      phone,
      category,
      description: String(record.description || record.details || '').trim(),
    };
  }).filter((listing) => listing && listing.name && listing.phone && listing.category);
}

function getSavedListings() {
  try {
    return normalizeNumbers(JSON.parse(localStorage.getItem(storageKey) || '[]'));
  } catch {
    return [];
  }
}

function saveLocalNumbers(numbers) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(numbers));
    return true;
  } catch {
    return false;
  }
}

async function loadNumbers() {
  const sheetUrl = getSheetUrl();
  if (sheetUrl) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(sheetUrl, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`Sheet request failed: ${response.status}`);
      const remoteNumbers = normalizeNumbers(await response.json());
      if (remoteNumbers.length) {
        saveLocalNumbers(remoteNumbers);
        return remoteNumbers;
      }
    } catch (error) {
      console.warn('تعذر تحميل أرقام Google Sheets، سيتم استخدام النسخة المحلية.', error);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  const savedNumbers = getSavedListings();
  if (savedNumbers.length) return savedNumbers;

  try {
    const legacyNumbers = normalizeNumbers(JSON.parse(localStorage.getItem(legacyStorageKey) || '[]'));
    if (legacyNumbers.length) {
      saveLocalNumbers(legacyNumbers);
      return legacyNumbers;
    }
  } catch {
    return [...initialListings];
  }

  return [...initialListings];
}

function getMergedListings(loadedNumbers) {
  const mergedNumbers = [...loadedNumbers];
  pendingListings.forEach((pendingNumber) => {
    const alreadyLoaded = mergedNumbers.some((number) => (
      number.name === pendingNumber.name
      && number.phone === pendingNumber.phone
      && number.category === pendingNumber.category
    ));
    if (!alreadyLoaded) mergedNumbers.push(pendingNumber);
  });
  return mergedNumbers;
}

function getWhatsAppNumber(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `20${digits.slice(1)}`;
  return digits;
}

function createContactCard(listing) {
  const card = document.createElement('article');
  card.className = 'provider-card';

  const details = document.createElement('div');
  details.className = 'provider-details';
  const name = document.createElement('h4');
  name.textContent = listing.name;
  const phone = document.createElement('p');
  phone.className = 'provider-phone';
  phone.dir = 'ltr';
  phone.textContent = listing.phone;
  details.append(name, phone);
  if (listing.description) {
    const description = document.createElement('p');
    description.className = 'provider-description';
    description.textContent = listing.description;
    details.append(description);
  }

  const actions = document.createElement('div');
  actions.className = 'provider-actions';
  const callLink = document.createElement('a');
  callLink.className = 'provider-action provider-call';
  callLink.href = `tel:${listing.phone.replace(/[^\d+]/g, '')}`;
  callLink.setAttribute('aria-label', `اتصال بـ ${listing.name}`);
  callLink.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/></svg><span>اتصال</span>';
  const whatsappLink = document.createElement('a');
  whatsappLink.className = 'provider-action provider-whatsapp';
  whatsappLink.href = `https://wa.me/${getWhatsAppNumber(listing.phone)}`;
  whatsappLink.target = '_blank';
  whatsappLink.rel = 'noopener noreferrer';
  whatsappLink.setAttribute('aria-label', `تواصل واتساب مع ${listing.name}`);
  whatsappLink.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.8Z"/><path d="M9 8.5c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.2.2-.2.3-.1.5.6 1 1.4 1.8 2.4 2.3.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.2.3.4 0 .3-.2 1.2-.7 1.5-.5.4-1.1.5-1.8.3-1-.2-2.3-.8-3.8-2.1-1.2-1.1-2-2.5-2.2-3.5-.2-.9 0-1.6.6-2Z"/></svg><span>واتساب</span>';
  actions.append(callLink, whatsappLink);
  card.append(details, actions);
  return card;
}

function formatCount(count) {
  return count === 1 ? '1 رقم متاح' : `${count} أرقام متاحة`;
}

function buildCategories() {
  const fragment = document.createDocumentFragment();

  professionGroups.forEach((profession) => {
    const button = document.createElement('button');
    button.className = 'profession-card';
    button.type = 'button';
    button.dataset.profession = profession.id;
    button.innerHTML = `
      <span class="profession-icon" aria-hidden="true">${profession.icon}</span>
      <span class="profession-copy"><strong>${profession.label}</strong><small class="profession-count"></small></span>
      <span class="profession-chevron" aria-hidden="true">‹</span>`;
    button.addEventListener('click', () => {
      selectedProfession = profession.id;
      searchInput.value = '';
      updateDirectory();
    });
    fragment.append(button);
  });

  professionGrid.replaceChildren(fragment);
  document.querySelector('#profession-count').textContent = professionGroups.length;
}

function listingMatches(listing, category, query) {
  const profession = professionGroups.find((group) => group.categories.includes(listing.category));
  const text = normalizeSearch(`${listing.name} ${listing.phone} ${listing.description || ''} ${category.label} ${profession?.label || ''}`);
  const normalizedQuery = normalizeSearch(query);
  const queryDigits = normalizedQuery.replace(/\D/g, '');
  const phoneDigits = normalizeSearch(listing.phone).replace(/\D/g, '');
  return text.includes(normalizedQuery) || Boolean(queryDigits && phoneDigits.includes(queryDigits));
}

async function saveNumber(newNumber) {
  const normalizedNumber = normalizeNumbers([newNumber])[0];
  if (!normalizedNumber) return false;

  listings.push(normalizedNumber);
  if (!listingsReady) pendingListings.push(normalizedNumber);
  const localSaveSucceeded = saveLocalNumbers(listings);
  searchInput.value = '';
  selectedProfession = professionGroups.find((group) => group.categories.includes(normalizedNumber.category))?.id || null;
  updateDirectory();

  const sheetUrl = getSheetUrl();
  if (sheetUrl) {
    try {
      await fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          name: normalizedNumber.name,
          phone: normalizedNumber.phone,
          category: String(newNumber.category).trim(),
          description: normalizedNumber.description,
        }),
      });
    } catch (error) {
      console.warn('تعذر إرسال الرقم إلى Google Sheets.', error);
    }
  }

  return localSaveSucceeded;
}

function updateDirectory() {
  const query = searchInput.value.trim();
  const profession = professionGroups.find((group) => group.id === selectedProfession);
  const showResults = Boolean(query || profession);

  professionView.hidden = showResults;
  resultsView.hidden = !showResults;
  if (!showResults) {
    professionGroups.forEach((group) => {
      const count = listings.filter((listing) => group.categories.includes(listing.category)).length;
      const countLabel = professionGrid.querySelector(`[data-profession="${group.id}"] .profession-count`);
      countLabel.textContent = formatCount(count);
    });
    return;
  }

  const matchingListings = listings.filter((listing) => {
    const belongsToProfession = !profession || profession.categories.includes(listing.category);
    const category = categoryById[listing.category];
    return belongsToProfession && (!query || listingMatches(listing, category, query));
  });
  const fragment = document.createDocumentFragment();
  matchingListings.forEach((listing) => fragment.append(createContactCard(listing)));
  providerResults.replaceChildren(fragment);
  selectedProfessionTitle.textContent = query ? 'نتائج البحث' : profession.label;
  resultsSummary.textContent = formatCount(matchingListings.length);
  resultsEmpty.hidden = matchingListings.length > 0;
}

function getShareUrl() {
  return window.location.href.split('#')[0];
}

function createAddModal() {
  const modal = document.createElement('dialog');
  modal.className = 'add-modal';
  modal.id = 'add-listing-modal';
  modal.setAttribute('aria-labelledby', 'add-modal-title');
  const categoryOptions = categoryDefinitions
    .map((category) => `<option value="${category.id}">${category.label}</option>`)
    .join('');
  modal.innerHTML = `
    <div class="add-modal__header">
      <div><span class="add-modal__eyebrow">دليل طنبشا</span><h2 id="add-modal-title">أضف خدمة جديدة</h2><p>خلّي أهل البلد يوصلوا لك بسهولة.</p></div>
      <button class="add-modal__close" type="button" aria-label="إغلاق النموذج">×</button>
    </div>
    <form class="add-form">
      <div class="add-form__fields">
        <label class="add-form__field"><span>اسم الشخص / المحل <b>*</b></span><input name="name" type="text" maxlength="70" placeholder="مثال: أحمد السباك" autocomplete="name" required></label>
        <label class="add-form__field"><span>رقم التليفون <b>*</b></span><input name="phone" type="tel" inputmode="tel" maxlength="20" placeholder="01xxxxxxxxx" autocomplete="tel" required></label>
        <label class="add-form__field add-form__field--full"><span>التصنيف <b>*</b></span><select name="category" required><option value="" disabled selected>اختار التصنيف</option>${categoryOptions}</select></label>
        <label class="add-form__field add-form__field--full"><span>وصف قصير <small>اختياري</small></span><textarea name="description" rows="3" maxlength="140" placeholder="اكتب نبذة بسيطة عن الخدمة..."></textarea></label>
      </div>
      <div class="add-form__actions"><button class="add-form__submit" type="submit">إضافة وحفظ</button><button class="add-form__cancel" type="button">إلغاء</button></div>
    </form>
    <div class="sheet-url-setting">
      <label for="sheet-url-input">رابط SHEET_URL</label>
      <div class="sheet-url-controls">
        <input id="sheet-url-input" type="url" dir="ltr" placeholder="https://script.google.com/macros/s/.../exec">
        <button class="sheet-url-save" id="save-sheet-url" type="button">حفظ رابط الشيت</button>
      </div>
    </div>`;
  document.body.append(modal);

  const form = modal.querySelector('.add-form');
  const sheetUrlInput = modal.querySelector('#sheet-url-input');
  sheetUrlInput.value = getSheetUrl();
  sheetUrlInput.addEventListener('input', () => sheetUrlInput.setCustomValidity(''));
  const openModal = () => {
    modal.showModal();
    form.querySelector('[name="name"]').focus();
  };
  document.querySelector('#admin-access').addEventListener('click', () => {
    const password = window.prompt('أدخل الرقم السري');
    if (password === null) return;
    if (password === '2008') {
      openModal();
      return;
    }
    window.alert('الرقم السري خطأ');
  });
  modal.querySelector('.add-modal__close').addEventListener('click', () => modal.close());
  modal.querySelector('.add-form__cancel').addEventListener('click', () => modal.close());
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.close();
  });
  modal.addEventListener('close', () => form.reset());
  modal.querySelector('#save-sheet-url').addEventListener('click', async () => {
    const sheetUrl = sheetUrlInput.value.trim();
    if (sheetUrl && !/^https:\/\//i.test(sheetUrl)) {
      sheetUrlInput.setCustomValidity('استخدم رابط HTTPS المنشور من Google Apps Script.');
      sheetUrlInput.reportValidity();
      return;
    }
    sheetUrlInput.setCustomValidity('');
    try {
      localStorage.setItem(sheetUrlStorageKey, sheetUrl);
      showToast('تم حفظ رابط الشيت');
    } catch {
      showToast('تعذر حفظ الرابط في هذا المتصفح');
      return;
    }

    numbersLoadPromise = loadNumbers();
    const loadedNumbers = await numbersLoadPromise;
    listings = getMergedListings(loadedNumbers);
    listingsReady = true;
    pendingListings = [];
    saveLocalNumbers(listings);
    updateDirectory();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const listing = {
      name: String(formData.get('name')).trim(),
      phone: String(formData.get('phone')).trim(),
      category: String(formData.get('category')),
      description: String(formData.get('description')).trim(),
    };
    await saveNumber(listing);
    modal.close();
    showToast('تمت الاضافة ✅ سيظهر للجميع');
  });
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  const themeToggle = document.querySelector('#theme-toggle');
  const nextThemeLabel = theme === 'dark' ? 'تغيير إلى الوضع الفاتح' : 'تغيير إلى الوضع الداكن';
  themeToggle.setAttribute('aria-label', nextThemeLabel);
  themeToggle.title = nextThemeLabel;
  themeToggle.querySelector('.theme-sun').hidden = theme !== 'dark';
  themeToggle.querySelector('.theme-moon').hidden = theme === 'dark';
  try {
    localStorage.setItem('tanbish-theme', theme);
  } catch {
    return;
  }
}

function addStars(container, count, className) {
  const fragment = document.createDocumentFragment();
  for (let starIndex = 0; starIndex < count; starIndex += 1) {
    const star = document.createElement('span');
    star.className = className;
    star.style.setProperty('--star-left', `${Math.random() * 100}%`);
    star.style.setProperty('--star-top', `${Math.random() * 100}%`);
    star.style.setProperty('--star-size', `${1 + Math.random() * 2}px`);
    star.style.setProperty('--star-opacity', `${0.25 + Math.random() * 0.55}`);
    star.style.setProperty('--star-delay', `${Math.random() * 5}s`);
    star.style.setProperty('--star-duration', `${3 + Math.random() * 5}s`);
    fragment.append(star);
  }
  container.append(fragment);
}

searchInput.addEventListener('input', () => {
  if (searchInput.value.trim()) selectedProfession = null;
  updateDirectory();
});
document.querySelector('#back-to-professions').addEventListener('click', () => {
  selectedProfession = null;
  searchInput.value = '';
  updateDirectory();
});
document.querySelector('#theme-toggle').addEventListener('click', () => {
  setTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
});
document.querySelector('#share-button').addEventListener('click', async () => {
  const url = getShareUrl();
  const message = `دليل المهن والخدمات لقرية طنبشا\n${url}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'دليل طنبشا', text: message, url });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
});
document.querySelector('#copy-button').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(getShareUrl());
    showToast('تم نسخ لينك الدليل');
  } catch {
    showToast('تعذر النسخ، انسخ اللينك من شريط العنوان');
  }
});

buildCategories();
updateDirectory();
createAddModal();
try {
  const savedTheme = localStorage.getItem('tanbish-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') document.body.dataset.theme = savedTheme;
} catch {
  document.body.dataset.theme = 'dark';
}
setTheme(document.body.dataset.theme || 'dark');

numbersLoadPromise = loadNumbers();
numbersLoadPromise.then((loadedNumbers) => {
  listings = getMergedListings(loadedNumbers);
  listingsReady = true;
  pendingListings = [];
  saveLocalNumbers(listings);
  updateDirectory();
});

addStars(document.querySelector('.site-starfield'), 105, 'site-star');
const splashScreen = document.querySelector('#splash-screen');
addStars(splashScreen.querySelector('.splash-stars'), 85, 'splash-star');
window.setTimeout(() => splashScreen.classList.add('is-leaving'), 2000);
window.setTimeout(() => splashScreen.remove(), 2500);