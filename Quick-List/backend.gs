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
      const title = params.title || "Quick List"
      const date = new Date().toISOString()
      
      sheet.appendRow([id, title, "[]", date, 0])
      result = { id: id }
    } 
    
    else if (action === "get") {
      const id = params.id
      const data = getRowById(sheet, id)
      if (data) {
        result = {
          id: data[0],
          title: data[1],
          items: JSON.parse(data[2]),
          createdAt: data[3],
          participants: data[4]
        }
      } else {
        result = null
      }
    }

    else if (action === "add") {
      const id = params.id
      const item = params.item
      const rowIndex = getRowIndexById(sheet, id)
      
      if (rowIndex > -1) {
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
        const rowValues = sheet.getRange(rowIndex, 1, 1, 5).getValues()[0]
        
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

function getRowById(sheet, id) {
  const data = sheet.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      return data[i]
    }
  }
  return null
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
