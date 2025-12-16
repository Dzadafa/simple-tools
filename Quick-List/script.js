const MockAPI = {
  _getDb() {
    return JSON.parse(localStorage.getItem('mock_db_active_lists') || '{}')
  },

  _saveDb(db) {
    localStorage.setItem('mock_db_active_lists', JSON.stringify(db))
  },
  
  async createList(title) {
    const db = this._getDb()
    const id = "list_" + Date.now()
    
    db[id] = {
      id,
      title,
      items: [],
      createdAt: new Date().toISOString(),
      participants: 0
    }
    
    this._saveDb(db)
    return id
  },

  async getList(id) {
    const db = this._getDb()
    if (db[id]) return db[id]
    return null
  },

  async addItem(id, item) {
    const db = this._getDb()
    if (db[id]) {
      db[id].items.push(item)
      db[id].participants += 1 
      this._saveDb(db)
      return true
    }
    return false
  },

  async deleteItem(id, itemText) {
    const db = this._getDb()
    if (db[id]) {
      const index = db[id].items.indexOf(itemText)
      if (index > -1) {
        db[id].items.splice(index, 1)
        this._saveDb(db)
        return true
      }
    }
    return false
  },

  async stopList(id) {
    const db = this._getDb()
    const list = db[id]
    if (list) {
      delete db[id]
      this._saveDb(db)
      return list
    }
    return null
  }
}

async function loadContent() {
  const params = new URLSearchParams(window.location.search);
  const listId = params.get("id")
  const viewMode = params.get("view")
  const placeholder = document.getElementById("app")
  
  const myHostedLists = JSON.parse(localStorage.getItem('my_hosted_lists') || '[]')
  
  const isHost = (viewMode !== 'guest') && myHostedLists.includes(listId)

  if (!listId) {
    loadDashboard(placeholder)
    return
  }

  const listData = await MockAPI.getList(listId)

  if (listData) {
    if (isHost) {
      loadHostView(placeholder, listData)
    } else {
      loadUserView(placeholder, listData)
    }
  } else {
    if (isHost) {
      const archived = getArchivedList(listId)
      if (archived) {
        loadHostView(placeholder, archived, true)
      } else {
        load404(placeholder)
      }
    } else {
      load404(placeholder)
    }
  }
}

async function loadDashboard(container) {
  const res = await fetch('./default.html');
  container.innerHTML = await res.text();
  
  const btn = container.querySelector('#createBtn')
  const inputObj = document.createElement('input')
  inputObj.type = 'text'
  inputObj.id = 'newTitleInput'
  inputObj.placeholder = "List Title (e.g. Standup)"
  inputObj.className = "dashboard-input"
  
  if(btn) {
    btn.parentNode.insertBefore(inputObj, btn)
  
    btn.addEventListener('click', async () => {
      const titleVal = inputObj.value.trim()
      const title = titleVal || "Quick List" 
      
      const newId = await MockAPI.createList(title)
      
      const hosted = JSON.parse(localStorage.getItem('my_hosted_lists') || '[]')
      hosted.push(newId)
      localStorage.setItem('my_hosted_lists', JSON.stringify(hosted))
      
      window.location.search = `?id=${newId}`
    })
  }
  
  renderHistoryTable()
}

async function loadHostView(container, listData, isArchived = false) {
  container.innerHTML = `
    <div class="container">
      <h1>${listData.title} ${isArchived ? '<span class="badge">Archived</span>' : ''}</h1>
      
      ${!isArchived ? `
        <div style="margin-bottom: 20px; display:flex; gap:10px; flex-direction:column; align-items:center;">
          <a href="?id=${listData.id}&view=guest" target="_blank" style="color: var(--accent-blue-600); font-weight:bold; font-size: 0.9em;">Open Guest View (New Tab)</a>
          <button class="stop-btn" id="stopBtn">Stop & Archive</button>
        </div>
      ` : ''}
      
      <div class="list-display">
        <h3>${isArchived ? 'Final List:' : 'Live List:'}</h3>
        <textarea readonly id="copyTarget" class="copy-area"></textarea>
      </div>
      
      <button class="secondary-btn" onclick="window.location.href='index.html'">Back to Dashboard</button>
    </div>
  `

  updateHostDisplay(listData)

  if(!isArchived) {
    document.getElementById('stopBtn').addEventListener('click', async () => {
      const finalData = await MockAPI.stopList(listData.id)
      if(finalData) {
        saveToHistory(finalData)
        window.location.reload()
      }
    })
  }
}

async function loadUserView(container, listData) {
  const res = await fetch('./user.html');
  container.innerHTML = await res.text();
  
  container.querySelector('h1').innerText = listData.title
  
  const form = container.querySelector('#addForm')
  const input = container.querySelector('#itemInput')
  const myItemsList = container.querySelector('#myItems')

  let myItems = JSON.parse(sessionStorage.getItem(`my_items_${listData.id}`) || '[]')
  
  renderUserItems(myItems, myItemsList, listData.id)

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const val = input.value.trim()
    if(!val) return
    
    await MockAPI.addItem(listData.id, val)
    
    myItems.push(val)
    sessionStorage.setItem(`my_items_${listData.id}`, JSON.stringify(myItems))
    
    renderUserItems(myItems, myItemsList, listData.id)
    input.value = ''
  })
}

async function load404(container) {
  const res = await fetch('./404.html');
  container.innerHTML = await res.text();
}

function updateHostDisplay(data) {
  const textarea = document.getElementById('copyTarget')
  if(!textarea) return

  let text = `${data.title}\n`
  data.items.forEach((item, index) => {
    text += `${index + 1}. ${item}\n`
  })
  
  textarea.value = text
}

function renderUserItems(items, ul, listId) {
  ul.innerHTML = ''
  
  items.forEach((item, idx) => {
    const li = document.createElement('li')
    li.innerHTML = `
      <span>${item}</span>
      <button class="delete-item-btn" title="Remove">×</button>
    `
    
    li.querySelector('.delete-item-btn').addEventListener('click', async () => {
      if(confirm('Remove this item?')) {
        await MockAPI.deleteItem(listId, item)
        
        items.splice(idx, 1) 
        sessionStorage.setItem(`my_items_${listId}`, JSON.stringify(items))
        
        renderUserItems(items, ul, listId)
      }
    })
    
    ul.appendChild(li)
  })
}

function saveToHistory(data) {
  const history = JSON.parse(localStorage.getItem('history_lists') || '[]')
  
  const existingIndex = history.findIndex(h => h.id === data.id)
  if (existingIndex > -1) {
    history[existingIndex] = data
  } else {
    history.push(data)
  }
  
  localStorage.setItem('history_lists', JSON.stringify(history))
}

function getArchivedList(id) {
  const history = JSON.parse(localStorage.getItem('history_lists') || '[]')
  return history.find(h => h.id === id)
}

function renderHistoryTable() {
  const tbody = document.querySelector('tbody')
  if(!tbody) return
  
  const history = JSON.parse(localStorage.getItem('history_lists') || '[]')
  
  if(history.length === 0) {
    const sessionEl = document.querySelector('.sessions')
    if(sessionEl) sessionEl.classList.add('hidden')
    return
  }
  
  document.querySelector('.sessions').classList.remove('hidden')
  
  tbody.innerHTML = history.map(h => `
    <tr onclick="window.location.href='?id=${h.id}'" style="cursor:pointer">
      <td>${h.createdAt.split('T')[0]}</td>
      <td>${h.title}</td>
      <td>${h.items.length}</td>
    </tr>
  `).join('')
}

loadContent()
