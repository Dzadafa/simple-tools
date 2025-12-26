const API = {
  async _call(payload) {
    try {
      const res = await fetch('/api/proxy', { 
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })
      
      const data = await res.json()
      return data
    } catch (e) {
      console.error(e)
      return null
    }
  },

  async createList(title) {
    return this._call({ action: "create", title })
  },

  async getList(id) {
    return this._call({ action: "get", id })
  },

  async addItem(id, item) {
    return this._call({ action: "add", id, item })
  },

  async deleteItem(id, item) {
    return this._call({ action: "delete", id, item })
  },

  async stopList(id) {
    return this._call({ action: "stop", id })
  }
}

let pollTimer = null
const POLL_INTERVAL = 3000

// --- SECURITY FUNCTION ---
function sanitizeInput(text) {
  if (!text) return text;
  
  // 1. Block XSS (HTML Injection)
  let clean = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // 2. Block Excel Formula Injection
  // If string starts with =, +, -, or @, prepend a single quote to force text mode
  if (/^[\=\+\-\@]/.test(clean)) {
    return "'" + clean;
  }
  
  return clean;
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

  const listData = await API.getList(listId)

  if (listData && listData.id) {
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
      
      btn.innerText = "Creating..."
      const response = await API.createList(title)
      
      if (response && response.id) {
        const hosted = JSON.parse(localStorage.getItem('my_hosted_lists') || '[]')
        hosted.push(response.id)
        localStorage.setItem('my_hosted_lists', JSON.stringify(hosted))
        
        window.location.search = `?id=${response.id}`
      } else {
        alert("Error creating list. Check your URL.")
        btn.innerText = "Create"
      }
    })
  }
  
  renderHistoryTable()
}

async function loadHostView(container, initialData, isArchived = false) {
  // Use sanitizeInput instead of escapeHtml
  container.innerHTML = `
    <div class="container">
      <h1>${sanitizeInput(initialData.title)} ${isArchived ? '<span class="badge">Archived</span>' : ''}</h1>
      
      ${!isArchived ? `
        <div style="margin-bottom: 20px; display:flex; gap:10px; flex-direction:column; align-items:center;">
          <a href="?id=${initialData.id}&view=guest" target="_blank" style="color: var(--accent-blue-600); font-weight:bold; font-size: 0.9em;">Open Guest View (New Tab)</a>
          <button class="stop-btn" id="stopBtn">Stop & Archive</button>
        </div>
      ` : ''}
      
      <div class="list-display">
        <h3 id="listHeader">${isArchived ? 'Final List:' : 'Live List:'}</h3>
        <textarea readonly id="copyTarget" class="copy-area" title="Click to Copy"></textarea>
      </div>
      
      <button class="secondary-btn" onclick="window.location.href='index.html'">Back to Dashboard</button>
    </div>
  `

  updateHostDisplay(initialData)

  const copyArea = document.getElementById('copyTarget')
  const header = document.getElementById('listHeader')
  
  if(copyArea) {
    copyArea.style.cursor = "pointer"
    copyArea.addEventListener('click', () => {
      copyArea.select()
      navigator.clipboard.writeText(copyArea.value).then(() => {
        const originalText = header.innerText
        header.innerText = "Copied!"
        header.style.color = "var(--brand-green)"
        
        setTimeout(() => {
          header.innerText = originalText
          header.style.color = ""
        }, 1500)
      })
    })
  }

  if(!isArchived) {
    startPolling(initialData.id, (newData) => {
      if(newData) {
        updateHostDisplay(newData)
      } else {
        stopPolling()
        alert("This list has been stopped remotely.")
        window.location.href = 'index.html'
      }
    })

    document.getElementById('stopBtn').addEventListener('click', async () => {
      if(confirm("Stop this list? It will be deleted from the server and saved to your history.")) {
        stopPolling()
        const finalData = await API.stopList(initialData.id)
        if(finalData) {
          saveToHistory(finalData)
          window.location.reload()
        }
      }
    })
  }
}

async function loadUserView(container, listData) {
  const res = await fetch('./user.html');
  container.innerHTML = await res.text();
  
  container.querySelector('h1').innerText = sanitizeInput(listData.title)
  
  const form = container.querySelector('#addForm')
  const input = container.querySelector('#itemInput')
  const myItemsList = container.querySelector('#myItems')

  let myItems = JSON.parse(sessionStorage.getItem(`my_items_${listData.id}`) || '[]')
  renderUserItems(myItems, myItemsList, listData.id)

  startPolling(listData.id, (newData) => {
    if(!newData) {
      stopPolling()
      window.location.reload() 
    }
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const val = input.value.trim()
    if(!val) return
    
    input.disabled = true
    const success = await API.addItem(listData.id, val)
    input.disabled = false
    input.focus()

    if (success) {
      myItems.push(val)
      sessionStorage.setItem(`my_items_${listData.id}`, JSON.stringify(myItems))
      renderUserItems(myItems, myItemsList, listData.id)
      input.value = ''
    } else {
      alert("Error adding item. The list might be stopped.")
    }
  })
}

async function load404(container) {
  const res = await fetch('./404.html');
  container.innerHTML = await res.text();
}

function startPolling(id, callback) {
  if(pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    const data = await API.getList(id)
    callback(data)
  }, POLL_INTERVAL)
}

function stopPolling() {
  if(pollTimer) clearInterval(pollTimer)
}

function updateHostDisplay(data) {
  const textarea = document.getElementById('copyTarget')
  if(!textarea) return

  let text = `${sanitizeInput(data.title)}\n`
  if (data.items && Array.isArray(data.items)) {
    data.items.forEach((item, index) => {
      // sanitizeInput here handles both XSS and Excel Formula
      text += `${index + 1}. ${sanitizeInput(item)}\n`
    })
  }
  
  if (document.activeElement !== textarea) {
    textarea.value = text
  }
}

function renderUserItems(items, ul, listId) {
  ul.innerHTML = ''
  
  items.forEach((item, idx) => {
    const li = document.createElement('li')
    li.innerHTML = `
      <span>${sanitizeInput(item)}</span>
      <button class="delete-item-btn" title="Remove">×</button>
    `
    
    li.querySelector('.delete-item-btn').addEventListener('click', async () => {
      if(confirm('Remove this item?')) {
        await API.deleteItem(listId, item)
        
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
      <td>${sanitizeInput(h.title)}</td>
      <td>${h.items.length}</td>
    </tr>
  `).join('')
}

loadContent()
