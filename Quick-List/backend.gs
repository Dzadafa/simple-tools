function doGet(e) {
  return handleRequest(e)
}

function doPost(e) {
  return handleRequest(e)
}

function handleRequest(e) {
  const lock = LockService.getScriptLock()
  lock.tryLock(10000)

  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = doc.getSheets()[0]
    const action = e.parameter.action
    const params = e.parameter

    let result = {}

    if (action === "create") {
      const id = "list_" + new Date().getTime()
      const rawTitle = params.title || "Quick List"
      const title = sanitize(rawTitle).substring(0, 50)
      const date = new Date().toISOString()

      const durationHours = parseInt(params.duration) || 24
      const expiryDate = new Date(new Date().getTime() + (durationHours * 60 * 60 * 1000)).toISOString()

      sheet.appendRow([id, title, "[]", date, 0, expiryDate])
      result = { id: id, expiry: expiryDate }
    } 

    else if (action === "get") {
      const id = params.id
      const rowIndex = getRowIndexById(sheet, id)

      if (rowIndex > -1) {
        const rowData = sheet.getRange(rowIndex, 1, 1, 6).getValues()[0]
        const expiryStr = rowData[5]
        const isExpired = expiryStr ? (new Date() > new Date(expiryStr)) : false

        result = {
          id: rowData[0],
          title: rowData[1],
          items: JSON.parse(rowData[2]),
          createdAt: rowData[3],
          participants: rowData[4],
          isExpired: isExpired 
        }
      } else {
        result = null
      }
    }

    else if (action === "add") {
      const id = params.id
      const rawItem = params.item
      const item = sanitize(rawItem).substring(0, 200)

      const rowIndex = getRowIndexById(sheet, id)

      if (rowIndex > -1 && item.length > 0) {

        const range = sheet.getRange(rowIndex, 3, 1, 3) 
        const values = range.getValues()[0]

        let items = JSON.parse(values[0])
        let participants = values[2]

        items.push(item)
        participants += 1

        sheet.getRange(rowIndex, 3).setValue(JSON.stringify(items))
        sheet.getRange(rowIndex, 5).setValue(participants)

        result = { success: true }
      } else {
        result = { success: false }
      }
    }

    else if (action === "delete") {
      const id = params.id
      const item = params.item
      const rowIndex = getRowIndexById(sheet, id)

      if (rowIndex > -1) {
        const cell = sheet.getRange(rowIndex, 3)
        let items = JSON.parse(cell.getValue())

        const idx = items.indexOf(item)
        if (idx > -1) {
          items.splice(idx, 1)
          cell.setValue(JSON.stringify(items))
          result = { success: true }
        } else {
          result = { success: false }
        }
      } else {
        result = { success: false }
      }
    }

    else if (action === "stop") {
      const id = params.id
      const rowIndex = getRowIndexById(sheet, id)

      if (rowIndex > -1) {
        const rowValues = sheet.getRange(rowIndex, 1, 1, 6).getValues()[0]

        result = {
          id: rowValues[0],
          title: rowValues[1],
          items: JSON.parse(rowValues[2]),
          createdAt: rowValues[3],
          participants: rowValues[4]
        }

        sheet.deleteRow(rowIndex)
      } else {
        result = null
      }
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
  } finally {
    lock.releaseLock()
  }
}

// this being run by the trigger, either hourly or daily
function removeExpiredLists() {
  const lock = LockService.getScriptLock()
  lock.tryLock(10000)

  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = doc.getSheets()[0]
    const data = sheet.getDataRange().getValues()
    const now = new Date()
    const BUFFER_DAYS = 7 

    for (let i = data.length - 1; i >= 1; i--) {
      const expiryStr = data[i][5]
      if (expiryStr) {
        const expiryDate = new Date(expiryStr)

        const deadDate = new Date(expiryDate.getTime() + (BUFFER_DAYS * 24 * 60 * 60 * 1000))

        if (now > deadDate) {
          sheet.deleteRow(i + 1)
        }
      }
    }
  } catch (e) {
    console.error("Auto-delete failed: " + e.toString())
  } finally {
    lock.releaseLock()
  }
}

function getRowIndexById(sheet, id) {
  const data = sheet.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      return i + 1
    }
  }
  return -1
}

function sanitize(str) {
  if (!str) return ""
  let clean = String(str)
  if (/^[\=\+\-\@]/.test(clean)) {
    clean = "'" + clean
  }
  return clean
}
