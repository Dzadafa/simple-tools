if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/spending-calc/sw.js')
      // .then(registration => {
      //   console.log('Service Worker registered with scope:', registration.scope);
      // })
      // .catch(error => {
      //   console.log('Service Worker registration failed:', error);
      // });
  });
}


const categoryInput = document.getElementById('category');
const amountInput = document.getElementById('amount');
const currencySelect = document.getElementById('currency');
const submitButton = document.getElementById('submit');
const outputDiv = document.querySelector('.output');
const saveButton = document.getElementById('save')
const dateTitle = document.querySelector('.swap-date h3')
const inputDate = document.getElementById('inputDate')

var total = 0;
let spendingData = {"spending": []}
let categories = []

var date = getCustomizedDate()

document.addEventListener('DOMContentLoaded', () => {
  spendingData = getFromLocal();
  const spending = spendingData.spending;
  inputDate.value = date

  inputDate.setAttribute('max', getCustomizedDate());

  if (spending.length) {
    spending
      .filter(item => item.date === date)
      .forEach(item => addItemJSON(outputDiv, item.categories))
  }
});


submitButton.addEventListener('click', () => {
  const category = categoryInput.value;
  const currency = currencySelect.value === 'dollar' ? '$':'Rp';
  const amount = amountInput.value;

  if (category && amount) {
    addItem(outputDiv, category, currency, amount)
    amountInput.value = '';
    categoryInput.value = '';
  }
})

saveButton.addEventListener('click', () => {
  addSpendingData(date, categories, total)
  saveToLocal(spendingData)
})

inputDate.addEventListener('change', (e) => {
  categories = []
  const spending = spendingData.spending
  date = inputDate.value

  const existingEntry = spendingData.spending.find(i => i.date === date);

  if (date !== getCustomizedDate()) saveButton.disabled = true;
  else saveButton.disabled = false;

  if (existingEntry){
    spending
      .filter(item => item.date === date)
      .forEach(item => addItemJSON(outputDiv, item.categories)) 
  } else {
    addItemJSON(outputDiv, [])
  }
})
