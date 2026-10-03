const categoryDefinitions = [
  { id: 'shops', label: 'محلات', icon: '🏪' },
  { id: 'restaurants', label: 'مطاعم', icon: '🍽️' },
  { id: 'tricycles', label: 'تروسيكلات', icon: '🛺' },
  { id: 'pickup', label: 'ربع نقل', icon: '🚚' },
  { id: 'electrician', label: 'كهربائي', icon: '🔌' },
  { id: 'carpenters', label: 'نجارين', icon: '🪚' },
  { id: 'doors-windows', label: 'ابواب وشبابيك والوميتال', icon: '🚪' },
  { id: 'painters', label: 'نقاشين', icon: '🖌️' },
  { id: 'appliances', label: 'تصليح تلاجات وغسالات وتكيفات', icon: '🧺' },
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
  ['نجار أبواب وشبابيك والوميتال', 'carpenters'],
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
const searchInput = document.querySelector('#search-input');
const professionGrid = document.querySelector('#profession-grid');
const professionView = document.querySelector('#profession-view');
const resultsView = document.querySelector('#results-view');
const selectedProfessionTitle = document.querySelector('#selected-profession-title');
const providerResults = document.querySelector('#provider-results');
const resultsSummary = document.querySelector('#results-summary');
const resultsEmpty = document.querySelector('#results-empty');
const toast = document.querySelector('#toast');
let selectedProfession = null;
let toastTimer;
let listings = [];

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

function normalizeNumbers(data) {
  const records = Array.isArray(data)
    ? data
    : Array.isArray(data?.numbers)
      ? data.numbers
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.value)
          ? data.value
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
      id: String(record.id || record.ID || ''),
      name,
      phone,
      category,
      description: String(record.description || record.details || '').trim(),
    };
  }).filter((listing) => listing && listing.name && listing.phone && listing.category);
}

function requestPublicListings() {
  return new Promise((resolve, reject) => {
    const callbackName = `directoryCallback${Date.now()}${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timeoutId = window.setTimeout(() => finish(new Error('Directory request timed out')), 10000);

    function finish(error, data) {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
      if (error) reject(error);
      else resolve(data);
    }

    window[callbackName] = (data) => finish(null, data);
    script.onerror = () => finish(new Error('Directory request failed'));
    script.src = `${DIRECTORY_API_URL}?action=list&callback=${encodeURIComponent(callbackName)}`;
    document.head.append(script);
  });
}

async function loadNumbers() {
  try {
    const response = await requestPublicListings();
    if (response?.error) throw new Error(response.error);
    return normalizeNumbers(response);
  } catch {
    showToast('تعذر تحميل بيانات الدليل الآن');
    return [];
  }
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
  details.append(name);
  if (listing.description) {
    const description = document.createElement('div');
    description.style.cssText = 'font-size:12px; color:#9CA3AF; margin-top:4px;';
    description.textContent = listing.description;
    details.append(description);
  }
  const phone = document.createElement('p');
  phone.className = 'provider-phone';
  phone.dir = 'ltr';
  phone.textContent = listing.phone;
  details.append(phone);

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
try {
  localStorage.removeItem('tanbish_numbers');
  localStorage.removeItem('tanbish-guide-listings');
  localStorage.removeItem('tanbish_sheet_url');
} catch {
  showToast('تعذر مسح بيانات الدليل القديمة من هذا المتصفح');
}
try {
  const savedTheme = localStorage.getItem('tanbish-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') document.body.dataset.theme = savedTheme;
} catch {
  document.body.dataset.theme = 'dark';
}
setTheme(document.body.dataset.theme || 'dark');

loadNumbers().then((loadedNumbers) => {
  listings = loadedNumbers;
  updateDirectory();
});

addStars(document.querySelector('.site-starfield'), 105, 'site-star');
const splashScreen = document.querySelector('#splash-screen');
addStars(splashScreen.querySelector('.splash-stars'), 85, 'splash-star');
window.setTimeout(() => splashScreen.classList.add('is-leaving'), 2000);
window.setTimeout(() => splashScreen.remove(), 2500);