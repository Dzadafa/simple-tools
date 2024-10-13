function addItem(parent, category, currency, amount){
  let newItem = document.createElement('section')
  newItem.classList.add('item')

  newItem.innerHTML = `
  <div class="item-details">
    <h3>${category}</h3>
    <p>${currency} ${thousandSeparator(amount)}</p>
  </div>
  <div class="item-action">
    <i class="fa-solid fa-square-minus"></i>
  </div>
  `;

  parent.appendChild(newItem);
  totalChange(amount)
  addCategories(category, amount, currency)

  newItem.querySelector('.fa-square-minus').addEventListener('click', () => {
    categories = removeObjValue(categories, category)
    removeItem(newItem, amount)
  })
}

function addItemJSON(parent, categoriesArr) {
  while (parent.hasChildNodes()) {removeItem(parent.childNodes[0], 0);}
  totalChange(undefined, undefined, true);
  categoriesArr.forEach(item => addItem(parent, item.name, item.currency, item.amount));
}

function removeItem(item, amount) {
  item.remove();
  totalChange(amount, '-'); 
}


function totalChange(newValue=0, operation='+', clear=false) {
  const element = document.getElementById('total');
  if (clear) total = 0;
  else total += operation === '+' ? parseFloat(newValue) : parseFloat(-newValue);
  element.textContent = thousandSeparator(total)
}

function removeObjValue(obj, name){
  return obj.filter(item => item.name !== name)
}


function lengthLimit(e, obj, limit){
  if (obj.value.length >= limit && e.key !== "Backspace" && e.key !== "Delete") e.preventDefault();
}

function thousandSeparator(num){
  return parseFloat(num).toLocaleString('de-DE');
}

function addCategories(name, amount, currency){
  const data = {
    'name'    : name,
    'amount'  : parseFloat(amount),
    'currency': currency
  }

  categories.push(data)
}

function getCustomizedDate() {
  const dmy = new Date();
  const year = dmy.getFullYear();
  const month = String(dmy.getMonth() + 1).padStart(2, '0'); 
  const date = String(dmy.getDate()).padStart(2, '0'); 
  return `${year}-${month}-${date}`;
}

function addSpendingData(date, categories, total){
    spendingData.spending = spendingData.spending.filter(i => i.date !== date);

  let scheme = {
    "date": date,
    "categories": categories,
    "total": parseFloat(total)
  }

  spendingData.spending.push(scheme)
}

function saveToLocal(data){
  localStorage.setItem('spendingData', JSON.stringify(data))
}

function getFromLocal(){
  const savedData = localStorage.getItem('spendingData');
  return savedData ? JSON.parse(savedData) : {"spending": []}
}