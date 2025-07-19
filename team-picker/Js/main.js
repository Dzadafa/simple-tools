const listInput = document.querySelector('input#new-member-name')
const memberItems = document.querySelector('ul.member-items')
const randomizedTeams = document.querySelector('div.randomized-list')
const main = document.querySelector('main')
const plusIcon = document.querySelector('i.fa-plus')
const settingBtn = document.querySelector('i.fa-gear')
const generateBtn = document.querySelector('.generateBtn')
const downloadBtn = document.querySelector('.downloadBtn')

let memberList = [];
let groupAmount = 2;
let maxPeople = 2;
let randomizedList = [];
const customAlertParent = '.custom-modal-alert-group'

window.onload = () => customAlert("This page is not available offline yet", false, customAlertParent, 4000)

listInput.onkeydown = (e) => {
  if (e.key === 'Enter') {
    const safeInput = escapeHTML(listInput.value);
    const succeed = add_list(memberItems, safeInput);
    succeed? listInput.value = '' : {};
  }
}

downloadBtn.onclick = async (e) => {
  const target = randomizedTeams.parentElement
  if (randomizedList.length >= 1) {
    
    try {
      const wm = document.createElement('div')
      wm.classList.add('watermark')
      target.appendChild(wm)

      target.classList.add('capture')
      await elementToImg('download-target');  // Wait for image generation
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      target.classList.remove('capture')
      target.querySelector('.watermark').remove()
    }
  } else {
    customAlert("Can't download an empty result", true, customAlertParent);
  }
};

generateBtn.onclick = (e) => {
  if (memberList.length >= 3) {
    randomizedList = randomSplitList(memberList, groupAmount)
    randomizedTeamsGenerator(randomizedTeams, randomizedList)
  } else customAlert("You need at least 3 players to start!", true, customAlertParent);
}

const eachItemUpdate = () => {
  const memberListLength = memberList.length
  if (memberListLength >= 4) settingBtn.ariaDisabled = false 
  else {
    settingBtn.ariaDisabled = true;
    groupAmount = 2
  }
  if (groupAmount > Math.floor(memberListLength / 2) && memberListLength >= 4) groupAmount = Math.floor(memberListLength / 2)
}

settingBtn.addEventListener('click', e => {if (memberList.length > 2) settingsModal()})

plusIcon.addEventListener('click', e => {
  const succeed = add_list(memberItems, listInput.value);
  succeed? listInput.value = '' : {};
})

//Settings Popup
function settingsModal(){
  const body = document.body

  const bodyOverflowY = (e) => e? body.style.overflowY = 'auto' : body.style.overflowY = 'hidden'

  bodyOverflowY(false)

  const modal = document.createElement('div')
  modal.classList.add('settings')

  modal.innerHTML = `
  <div id="blur"></div>
  <section>
  <i class="fa-solid fa-xmark"></i>
  <h2>Settings</h2>
  <label for="group-amount">
    <p>Number of Group: </p>
    <input name="group-amount" id="group-amount" type="number" value="${groupAmount}" onkeydown="return isNumberKey(event)">
  </label>
  <label for="max-member">
    <p>Max people: </p>
    <input name="max-people" id="max-member" type="number" value="${maxPeople}" onkeydown="return isNumberKey(event)">
  </label>
  <button class="btnStyle1 saveSettings" disabled>Save</button>
  </section>
  `

  const items = ['.fa-xmark', '#blur']
  const newValue = modal.querySelector('input[name=group-amount]')
  const newValue2 = modal.querySelector('input[name="max-people"]')
  const saveBtn = modal.querySelector('button.saveSettings')

  for (const i of items){
    const c = modal.querySelector(i)
    c.onclick = (e) => {
      bodyOverflowY(true)
      modal.remove()
    }
  }


  const condition = () => {
    const val1 = parseInt(newValue.value) || 0;
    const val2 = parseInt(newValue2.value) || 0;

    return (
      ((val1 < 2 || val1 > Math.floor(memberList.length / 2)) || groupAmount == val1) &&
      ((val1 >= 2 && val1 >= 2 && 
      Math.ceil(memberList.length / val1) <= Math.ceil(memberList.length / val2)) || maxPeople == val2)
    );
  }

  saveBtn.disabled = condition();

  saveBtn.onclick = e => {
    groupAmount = parseInt(newValue.value)
    maxPeople = parseInt(newValue2.value)
    bodyOverflowY(true)
    modal.remove()
  }

  newValue.onkeyup = delay( e => {
    const val1 = parseInt(newValue.value) || 0;
    const val2 = parseInt(newValue2.value) || 0;

    if (val1 > 1){
      const BtnCons = condition()
      saveBtn.disabled = BtnCons
      newValue2.value = Math.ceil(memberList.length / val1) > 1? Math.ceil(memberList.length / val1) : Math.ceil(memberList.length / groupAmount);
    } else {
      saveBtn.disabled = true
    }
  }, 100)

  main.append(modal)
}