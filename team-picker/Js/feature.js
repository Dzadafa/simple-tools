function add_list(parentObj, value){
  value = value.trim()

  if (emptyString(value)) return
  let newList = document.createElement('li');
  newList.innerHTML = `${value} <i class="fa-solid fa-trash"></i>`;

  const trashIcon = newList.querySelector('.fa-trash');
  trashIcon.addEventListener('click', () => {
    remove_list(newList, value)
    eachItemUpdate() 
  });

  memberList.push(value)

  eachItemUpdate() 

  return parentObj.appendChild(newList);
}

function randomizedTeamsGenerator(parentObj, list){
  parentObj.innerHTML = ''
  for (let i=0;i<list.length;i++){
    let members = `<p style="background: var(--${(i % 3) + 1});">Team ${i+1}</p>`
    for(let j=0;j<list[i].length;j++){
      members += `<li>${list[i][j]}</li>`
    }
    const team = document.createElement('ul')
    team.innerHTML = members
    team.classList.add('result-animation')
    parentObj.append(team)
    team.style.animationDelay = `${i * 1}s`

    team.addEventListener("animationend", (e) => {
      alert("dumbass")
      team.classList.remove('result-animation')
    })
  }
}

function emptyString(str) {
  const cleanedStr = str.replace(/[\s\u200B\u200C\u200D\uFEFF]/g, '');
  return cleanedStr === '';
}

function remove_list(Obj, value){
  Obj.remove();
  const index = memberList.indexOf(value)
  memberList.splice(index, 1)
}

function randomSplitList(arr, index) {
  let copy = [...arr];
  let randomItems = [];
  for (let i=0; i < index; i++){
    randomItems.push([])
  }

  for (let i = 0; i < arr.length; i++){
    randomItem = Math.floor(Math.random() * copy.length)
    randomItems[i % index].push(copy.splice(randomItem, 1)[0])
  }
  return randomItems;
}

function isNumberKey(event) {
  if (
    event.key === "Backspace" ||
    event.key === "Delete" ||
    event.key === "Tab" ||
    event.key === "Escape" ||
    event.key === "Enter" ||
    (event.key >= "ArrowLeft" && event.key <= "ArrowRight")
  ) {
    return true;
  }

  if (event.key >= "0" && event.key <= "9") {
    return true;
  }

  return false;
}

function delay(callback, ms) {
  var timer = 0;
  return function() {
    var context = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      callback.apply(context, args);
    }, ms || 0);
  };
}

function customAlert(prompt, vibrateDevice=false, customParentSelector, customTime=3000) {
  const body = document.body;

  const existed = document.querySelectorAll('.modal-custom-alert')
  if (existed.length > 3) {
    existed[existed.length].remove()
  }

  const newAlert = document.createElement('p');
  newAlert.innerHTML = `<i class="fa-solid fa-exclamation"></i> ${prompt}`;
  newAlert.classList.add('modal-custom-alert', 'fade-in');

  customParentSelector? document.querySelector(customParentSelector).appendChild(newAlert) : body.appendChild(newAlert);
  if (vibrateDevice) navigator.vibrate(100);
  setTimeout(() => {
    newAlert.classList.remove('fade-in');
  }, 500);
  setTimeout(() => {
    newAlert.classList.add('fade-out');
    setTimeout(() => {
      newAlert.remove();
    }, 500);
  }, customTime);
}

function elementToImg (targetId) {
  const element = document.getElementById(targetId);

  html2canvas(element, {scale: 5}).then(canvas => {
    const link = document.createElement('a');
    link.download = 'result.png'; 

    link.href = canvas.toDataURL('image/png'); 
    document.body.appendChild(link); 
    link.click(); 

    setTimeout(() => {
      document.body.removeChild(link); 
      URL.revokeObjectURL(link.href); 
    }, 100); 
  });
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}