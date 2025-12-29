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

  async createList(title, duration) {
    return this._call({ action: "create", title, duration })
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
let isStopping = false

function sanitizeInput(text) {
  if (!text) return text;

  let clean = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  if (/^[\=\+\-\@]/.test(clean)) {
    return "'" + clean;
  }

  return clean;
}

function getSafeJson(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

function cleanStorage() {
  const history = getSafeJson('history_lists')
  const cleanHistory = history.filter(item => item && item.id)
  if (cleanHistory.length !== history.length) {
    localStorage.setItem('history_lists', JSON.stringify(cleanHistory))
  }
}

async function loadContent() {
  cleanStorage() 

  const params = new URLSearchParams(window.location.search);
  const listId = params.get("id")
  const viewMode = params.get("view")
  const placeholder = document.getElementById("app")

  const activeSessions = getSafeJson('active_sessions')
  const hostSession = activeSessions.find(s => s.id === listId)

  const history = getSafeJson('history_lists')
  const archivedSession = history.find(h => h.id === listId)

  const isHost = (viewMode !== 'guest') && (!!hostSession || !!archivedSession)

  if (!listId) {
    loadDashboard(placeholder)
    return
  }

  const listData = await API.getList(listId)

  if (listData && listData.id) {
    if (isHost) {
      loadHostView(placeholder, listData, false)
    } else {
      loadUserView(placeholder, listData)
    }
  } 
  else {
    if (isHost) {
      const archived = getArchivedList(listId)
      if (archived) {
        loadHostView(placeholder, archived, true)
      } else {
        if (hostSession) {
          saveToHistory({
            id: hostSession.id,
            title: hostSession.title,
            createdAt: hostSession.createdAt,
            items: hostSession.items || [], 
            participants: hostSession.participants || 0
          })
          removeFromActive(listId)
          window.location.reload()
        } else {
          load404(placeholder)
        }
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
  const select = container.querySelector('#durationSelect')
  const inputObj = container.querySelector('#newTitleInput') 

  if(btn && inputObj) {

    btn.addEventListener('click', async () => {
      const titleVal = inputObj.value.trim()
      const title = titleVal || "Quick List" 
      const duration = select.value

      btn.innerText = "Creating..."
      const response = await API.createList(title, duration)

      if (response && response.id) {

        const newSession = {
          id: response.id,
          title: title,
          createdAt: new Date().toISOString(),
          items: [], 
          expiry: response.expiry 
        }

        const sessions = getSafeJson('active_sessions')
        sessions.push(newSession)
        localStorage.setItem('active_sessions', JSON.stringify(sessions))

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
  let currentData = { ...initialData }

  if (!isArchived && initialData.isExpired) {
    isStopping = true
    saveToHistory(initialData) 
    removeFromActive(initialData.id)
    API.stopList(initialData.id) 
    window.location.href = 'index.html' 
    return
  }

  const res = await fetch('./host.html');
  container.innerHTML = await res.text();

  container.querySelector('#listTitle').innerHTML = sanitizeInput(initialData.title);

  if (isArchived) {
    container.querySelector('#archiveBadge').style.display = 'inline-block';
    container.querySelector('#hostControls').style.display = 'none'; 

    container.querySelector('#listHeader').innerText = 'Final List:';
  } else {
    container.querySelector('#guestLink').href = `?id=${initialData.id}&view=guest`;
  }

  updateHostDisplay(initialData)

  const copyArea = document.getElementById('copyTarget')
  const header = document.getElementById('listHeader')
  const linkField = document.getElementById('linkField')
  const urlHeader = document.getElementById('urlHeader')
  setupCopyOnClick(copyArea, header)
  setupCopyOnClick(linkField, urlHeader)

  if(!isArchived) {
    startPolling(initialData.id, (newData) => {
      if (isStopping) return; 

      if(newData) {
        currentData = newData 
        updateHostDisplay(newData)

        if (newData.isExpired) {
           isStopping = true
           stopPolling()
           saveToHistory(newData)
           removeFromActive(initialData.id)
           API.stopList(initialData.id)
           alert("This list has expired and is now archived.")
           window.location.href = 'index.html'
        }

      } else {
        stopPolling()
        saveToHistory(currentData)
        removeFromActive(initialData.id) 
        alert("This list has been stopped remotely.")
        window.location.href = 'index.html'
      }
    })

    const stopBtn = document.getElementById('stopBtn')
    if(stopBtn) {
      stopBtn.addEventListener('click', async () => {
        if(confirm("Stop this list? It will be archived.")) {
          isStopping = true
          stopPolling()

          stopBtn.innerText = "Archiving..."
          stopBtn.disabled = true

          const archiveObj = {
            id: initialData.id,
            title: currentData.title || initialData.title || "Untitled",
            items: Array.isArray(currentData.items) ? currentData.items : [],
            createdAt: initialData.createdAt || new Date().toISOString(),
            participants: currentData.participants || 0
          }

          saveToHistory(archiveObj)
          removeFromActive(initialData.id)

          await API.stopList(initialData.id)

          setTimeout(() => {
            window.location.href = 'index.html'
          }, 100)
        }
      })
    }
  }
}

async function loadUserView(container, listData) {
  const res = await fetch('./user.html');
  container.innerHTML = await res.text();

  if (listData.isExpired) {
    alert("This list has expired and is no longer accepting items.")
    window.location.reload()
    return
  }

  container.querySelector('h1').innerText = sanitizeInput(listData.title)

  const form = container.querySelector('#addForm')
  const input = container.querySelector('#itemInput')
  const btn = form.querySelector('button')
  const myItemsList = container.querySelector('#myItems')

  let myItems = getSafeJson(`my_items_${listData.id}`)
  renderUserItems(myItems, myItemsList, listData.id)

  startPolling(listData.id, (newData) => {
    if(!newData || newData.isExpired) {
      stopPolling()
      window.location.reload() 
    }
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const val = input.value.trim()
    if(!val) return

    input.disabled = true
    btn.disabled = true
    const originalText = btn.innerText
    btn.innerText = "Adding..."

    const success = await API.addItem(listData.id, val)

    input.disabled = false
    btn.disabled = false
    btn.innerText = originalText
    input.focus()

    if (success) {
      myItems.push(val)

      localStorage.setItem(`my_items_${listData.id}`, JSON.stringify(myItems))

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

function setupCopyOnClick(inputEl, headerEl, successText = "Copied!") {
  if (!inputEl) return

  inputEl.style.cursor = "pointer"
  inputEl.addEventListener("click", () => {
    inputEl.select()
    navigator.clipboard.writeText(inputEl.value).then(() => {
      const original = headerEl.innerText
      headerEl.innerText = successText
      headerEl.style.color = "var(--brand-green)"

      setTimeout(() => {
        headerEl.innerText = original
        headerEl.style.color = ""
      }, 1500)
    })
  })
}

function updateHostDisplay(data) {
  const textarea = document.getElementById('copyTarget')
  const linkArea = document.getElementById('linkField')
  const pageUrl = window.location.href
  if(!textarea) return

  let text = `${sanitizeInput(data.title)}\n`
  if (data.items && Array.isArray(data.items)) {
    data.items.forEach((item, index) => {
      text += `${index + 1}. ${sanitizeInput(item)}\n`
    })
  }

  if (document.activeElement !== textarea) {
    textarea.value = text
    linkArea.value = pageUrl
  }

  const activeSessions = getSafeJson('active_sessions')
  const sessionIndex = activeSessions.findIndex(s => s.id === data.id)
  if (sessionIndex > -1) {
    activeSessions[sessionIndex].items = data.items
    activeSessions[sessionIndex].participants = data.participants
    localStorage.setItem('active_sessions', JSON.stringify(activeSessions))
  }
}

function renderUserItems(items, ul, listId) {
  ul.innerHTML = ''

  const wrapper = ul.closest('.user-list-wrapper')
  if (wrapper) {
    if (items.length > 0) {
      wrapper.classList.remove('hidden')
    } else {
      wrapper.classList.add('hidden')
    }
  }

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

        localStorage.setItem(`my_items_${listId}`, JSON.stringify(items))

        renderUserItems(items, ul, listId)
      }
    })

    ul.appendChild(li)
  })
}

function saveToHistory(data) {
  const history = getSafeJson('history_lists')
  if (!data || !data.id) return

  const existingIndex = history.findIndex(h => h && h.id === data.id)
  if (existingIndex > -1) {
    history[existingIndex] = data
  } else {
    history.push(data)
  }

  localStorage.setItem('history_lists', JSON.stringify(history))
}

function removeFromActive(id) {
  const sessions = getSafeJson('active_sessions')
  const newSessions = sessions.filter(s => s.id !== id)
  localStorage.setItem('active_sessions', JSON.stringify(newSessions))
}

function deleteHistoryItem(id) {
  if(confirm("Permanently delete this archived list?")) {
    const history = getSafeJson('history_lists')
    const newHistory = history.filter(h => h.id !== id)
    localStorage.setItem('history_lists', JSON.stringify(newHistory))
    renderHistoryTable()
  }
}

function getArchivedList(id) {
  const history = getSafeJson('history_lists')
  return history.find(h => h.id === id)
}

function renderHistoryTable() {
  const tbody = document.querySelector('tbody')
  if(!tbody) return

  const activeSessions = getSafeJson('active_sessions')
  const history = getSafeJson('history_lists')

  const sessionEl = document.querySelector('.sessions')

  if(activeSessions.length === 0 && history.length === 0) {
    if(sessionEl) sessionEl.classList.add('hidden')
    return
  }

  if(sessionEl) sessionEl.classList.remove('hidden')

  const activeRows = activeSessions.map(s => {
    const dateStr = s.createdAt ? s.createdAt.split('T')[0] : 'Today';
    return `
    <tr onclick="window.location.href='?id=${s.id}'" style="cursor:pointer">
      <td>${dateStr}</td>
      <td>${sanitizeInput(s.title)}</td>
      <td><span class="status-badge status-active">Active</span></td>
      <td>-</td>
      <td></td>
    </tr>
  `}).join('')

  const archivedRows = history.map(h => {
    if(!h || !h.id) return '' 
    const dateStr = h.createdAt ? h.createdAt.split('T')[0] : 'Unknown';
    const itemCount = (h.items && Array.isArray(h.items)) ? h.items.length : 0;

    return `
    <tr>
      <td onclick="window.location.href='?id=${h.id}'" style="cursor:pointer">${dateStr}</td>
      <td onclick="window.location.href='?id=${h.id}'" style="cursor:pointer">${sanitizeInput(h.title)}</td>
      <td onclick="window.location.href='?id=${h.id}'" style="cursor:pointer"><span class="status-badge status-archived">Archived</span></td>
      <td onclick="window.location.href='?id=${h.id}'" style="cursor:pointer">${itemCount}</td>
      <td class="action-cell">
        <button class="delete-history-btn" onclick="deleteHistoryItem('${h.id}')" title="Delete Archive">×</button>
      </td>
    </tr>
  `}).join('')

  tbody.innerHTML = activeRows + archivedRows

  window.deleteHistoryItem = deleteHistoryItem
}

loadContent()
