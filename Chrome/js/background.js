var origin = 'http://localhost:3000'

var mode = 0

var s = localStorage;

var userId = s.userId || null;
var accessToken = s.accessToken || null;
var profileId = s.profileId || null;
var folderId = -1;
var profiles = []

var lastSync = s.lastSync || 0;
   
var browser = browser || chrome
var extension = browser.extension || browser.runtime
   
if (!extension.onMessage) extension = browser.runtime

window.addEventListener("load", function(){
   
   s.profileName = ''
   loadUserConfig(function() {
      getProfiles()
      getProfileName()
   })

}, false);

function loadUserConfig(callback) {
   browser.storage.local.get(['access_token', 'profile_id', 'folder_id', 'last_sync'], function(result) {
      accessToken = result.access_token || null
      profileId = result.profile_id || null
      folderId = result.folder_id || -1
      lastSync = result.last_sync || 0
      s.accessToken = accessToken
      s.profileId = profileId
      s.folderId = folderId
      s.lastSync = lastSync
      
      if (callback) callback()
   });
}

function getProfiles(callback) {
   s.profiles = '[]'
   if (!accessToken) return
   var xhr = new XMLHttpRequest()
   xhr.open('GET', origin + '/getProfiles', true)
   xhr.setRequestHeader('Authorization', 'Bearer: ' + accessToken)
   xhr.onload = function() {
      try {
         var res = JSON.parse(this.responseText)
         if (res.data) {
            profiles = res.data
            s.profiles = JSON.stringify(profiles)
            if (callback) callback(profiles)
         }
      } catch (ex) {}
   }
   xhr.onerror = function() {
      if (callback) callback(null)
   }
   xhr.send(null)
}

function getProfileName(callback) {
   if (!accessToken || !profileId) return
   var xhr = new XMLHttpRequest()
   xhr.open('GET', origin + '/' + localStorage.profileId + '/info', true)
   xhr.setRequestHeader('Authorization', 'Bearer: ' + accessToken)
   xhr.onload = function() {
      s.profileName = JSON.parse(this.responseText).name
      if (callback) callback(1)
   }
   xhr.onerror = function() {
      if (callback) callback(0)
   }
   xhr.send(null)
}

extension.onMessage.addListener(function(request, sender, sendResponse) {
   if (request.operation == 'getUIScreen') {
      var result = accessToken == null ? 0 : (profileId == null ? 1 : 2)
      sendResponse({ result })
   }
   else if (request.operation == 'getProfileName') {
      getProfileName(sendResponse)
   }
   else if (request.operation == 'setProfileId') {
      profileId = s.profileId = request.data.id
      browser.storage.local.set({ profileId: request.data.id }, function() {
         getProfileName(sendResponse)
      })
   }
   else if (request.operation == 'update') {
      updateUserConfig(request.data)
   }
   else if (request.operation == 'authorize') {
      authorize(request.data.username, request.data.password, false, sendResponse)
   }
   else if (request.operation == 'createProfile') {
      exportData(function(result) {
         createProfile(request.name, result, function(res) {
            if (!res || !res.profileId) {
               sendResponse(0)
            } else {
               lastSync = s.lastSync = +res.timestamp || Date.now() + 1000
               browser.storage.local.set({ snapshot: result, last_sync: lastSync }, function() {
                  sendResponse(res.profileId)
               })
            }
         })
      })
   }
   else if (request.operation == 'renameProfile') {
      renameProfile(request.data.value)
   }
   else if (request.operation == 'loadProfile') {
      loadData(request.data.id, function(result) {
         if (request.data.merge) {
            exportData(function(res) {
               mergeData(request.data.id, res)
               importData(result.data, function() { saveSnapshot() })
            })
         } else {
            importData(result.data, function() { saveSnapshot() })
         }
         profile_id = s.profile_id = request.data.id
         lastSync = s.lastSync = Date.now() + 1000
         browser.storage.local.set({ profile_id: request.data.id, snapshot: result.data, last_sync: lastSync }, function() {
            sendResponse(request.data.id)
         })
      })
   }
   else if (request.operation == 'getProfiles') {
      getProfiles(function(result) {
         sendResponse(result)
      })
   }
   else if (request.operation == 'saveSnapshot') {
      saveSnapshot(function() {
         browser.storage.local.get(['snapshot'], function(result) {
            var snapshot = result.snapshot
            sendResponse(snapshot)
         })
      })
   }
   else if (request.operation == 'sync') {
      sync().then(() => {
         sendResponse({ success: 1 })
      }).catch(() => {
         sendResponse({ error: 1 })
      })
   }
   return true
})

function authorize(username, password, secure, callback) {
   if (!username || !username.length || !password || !password.length) {
      return
   }
   if (accessToken != null) {
      var xhr = new XMLHttpRequest()
      xhr.open('GET', origin + '/logout?ssid=' + accessToken, true)
      xhr.setRequestHeader('Authorization', 'Bearer: ' + accessToken)
      xhr.onload = function() {
         accessToken = s.accessToken = null
         browser.storage.local.set({ access_token: accessToken })
         doAuth(username, password, secure, callback)
      }
      xhr.send(null)
   } else {
      doAuth(username, password, secure, callback)
   }
}

function doAuth(username, password, secure, callback) {
   var xhr = new XMLHttpRequest()
   xhr.open('POST', origin + '/login', true)
   xhr.setRequestHeader('Content-Type', 'application/json')
   xhr.onload = function() {
      if (this.status == 200) {
         accessToken = JSON.parse(this.responseText).token
         browser.storage.local.set({ access_token: accessToken })
         s.accessToken = accessToken
      }
      if (callback) callback(this.status == 200)
   }
   xhr.onerror = function() {
      if (callback) callback(null)
   }
   xhr.send(JSON.stringify({ username, password }))
}

function loadProfilesList(callback) {
   if (!userId || !accessToken) return
   var xhr = new XMLHttpRequest()
   xhr.open('GET', origin + '/getProfiles', true)
   xhr.setRequestHeader('Authorization', 'Bearer: ' + accessToken)
   xhr.onload = function() {
      var result = JSON.parse(this.responseText)
      if (result.data) {
         profiles = result.data
         s.profiles = JSON.stringify(profiles)
      }
      if (callback) callback(profiles)
   }
   xhr.send(null)
}

function loadData(profile_id, callback) {
   var xhr = new XMLHttpRequest()
   xhr.open('GET', origin + '/' + profile_id + '/get', true)
   xhr.setRequestHeader('Authorization', 'Bearer: ' + accessToken)
   xhr.onload = function() {
      var result = JSON.parse(this.response)
      console.log(result)
      callback(result)
   }
   xhr.send(null)
}

function mergeData(profile_id, data, callback) {
   var xhr = new XMLHttpRequest()
   xhr.open('POST', origin + '/' + profile_id + '/merge', true)
   xhr.setRequestHeader('Content-Type', 'application/json')
   xhr.setRequestHeader('Authorization', 'Bearer: ' + accessToken)
   xhr.onload = function() {
      var result = JSON.parse(this.response)
      console.log(result)
      if (callback) callback(result)
   }
   xhr.send(JSON.stringify(data))
}

function createProfile(name, data, callback) {
   var xhr = new XMLHttpRequest()
   xhr.open('POST', origin + '/createProfile', true)
   xhr.setRequestHeader('Content-Type', 'application/json')
   xhr.setRequestHeader('Authorization', 'Bearer: ' + accessToken)
   xhr.onload = function() {
      var result = JSON.parse(this.response)
      if (callback) callback(result)
   }
   xhr.onerror = function() {
      if (callback) callback(0)
   }
   xhr.send(JSON.stringify({ name, data }))
}

function renameProfile(name, callback) {
   var xhr = new XMLHttpRequest()
   xhr.open('POST', origin + '/' + profileId + '/rename', true)
   xhr.setRequestHeader('Content-Type', 'application/json')
   xhr.setRequestHeader('Authorization', 'Bearer: ' + accessToken)
   xhr.onload = function() {
      var result = JSON.parse(this.response)
      if (callback) callback(result)
   }
   xhr.onerror = function() {
      if (callback) callback(result)
   }
   xhr.send(JSON.stringify({ value: name }))
}

function importData(data, callback) {
   var folder = 0
   browser.bookmarks.getTree(function(tree){
      folder = getRootFolder(tree)
      if (folder.id == 0) folder = folder.children[1]
      
      var count = 0
      
      var last_parent_id = 0
      var last_parent = data[0]
      
      processItem(data.data, 0, null, sortDirectory, callback)
      
      if (data.timestamp) {
         lastSync = s.lastSync = +data.timestamp || Date.now() + 1000
         browser.storage.local.set({ last_sync: lastSync })
      }
      
      function sortDirectory(parent) {
         if (mode == 0 && parent && parent.total_list && parent.ex_list) {
            if (parent.total_list.length > parent.ex_list.length) {
               parent.total_list = parent.total_list.sort(function(el1, el2) {
                  return el1.dateAdded - el2.dateAdded
               })
            }
            if (parent.id != 0) {
               for (var i = 0; i < parent.total_list.length; i++) {
                  browser.bookmarks.move(parent.total_list[i].id, { index: i })
               }
            }
            parent.ex_list = []
            parent.total_list = []
         }
      }

      function processItem(data, index, parent, itemComplete, allComplete) {
         var parent_id = parent && parent.id || folder.id
         
         if (parent && !parent.ex_list) {
            parent.ex_list = []
            parent.total_list = []
            last_parent_id = parent_id
            browser.bookmarks.getChildren(parent.id, function(list) {
               if (browser.runtime.lastError || !list) {
                  console.log('Error getting children of node ' + parent.id)
                  return
               }
               for (var i = 0; i < list.length; i++) {
                  parent.ex_list.push(list[i])
                  parent.total_list.push(list[i])
               }
               processItem(data, index, parent)
            });
            return
         }
         
         count = 0
         
         var exists = false
         if (parent && parent.ex_list) {
            for (var i = 0; i < parent.ex_list.length; i++) {
               if (!data[index].url && parent.ex_list[i].title == data[index].title || 
                    data[index].url && parent.ex_list[i].url == data[index].url) {
                  data[index].id = parent.ex_list[i].id
                  exists = true
                  break
               }
            }
         }
         
         var skip = data[index].id == 0 ||
                    index < 2 && parent_id == 0 ||
                    !data[index].title && !data[index].url ||
                    exists
         if (!skip) {
            browser.bookmarks.create(
               {
                  parentId: parent_id,
                  title: data[index].title,
                  url: data[index].url
               },
               function(bookmark) {
                  if (!bookmark) return
                  if (parent && parent.total_list) {
                     parent.total_list.push(bookmark)
                  }
                  console.log(bookmark.url ? "Added bookmark: " + bookmark.url : "Added folder: " + bookmark.title);
                  data[index].id = bookmark.id
                  if (data[index].children && data[index].children.length) {
                     processItem(data[index].children, 0, data[index], itemComplete, allComplete)
                  }
                  if (index+1 < data.length) {
                     processItem(data, index+1, parent, itemComplete, allComplete)
                  }
                  if (itemComplete && index+1 == data.length) {
                     itemComplete(parent)
                     if (parent == null && allComplete) {
                        allComplete(parent)
                     }
                  }
               }
            );
         }
         if (skip && data[index].children && data[index].children.length) {
            processItem(data[index].children, 0, data[index], itemComplete, allComplete)
         }
         if (skip && index+1 < data.length) {
            processItem(data, index+1, parent, itemComplete, allComplete)
         }
         if (skip && itemComplete && index+1 == data.length) {
            itemComplete(parent)
            if (parent == null && allComplete) {
               allComplete(data)
            }
         }
      }
   })
}

function getRootFolder(tree) {
   var folder = tree[0]
   if (folderId > -1 && folderId < 2) {
      folder = tree[0].children[folderId]
   }
   return folder
}

function exportData(callback) {
   browser.bookmarks.getTree(function(result) {
      result[0].children[0].title = 'Bookmarks panel'
      result[0].children[1].title = 'Other bookmarks'
      var default_id = result[0].children[1].id
      walkTree(result, function(element) {
         if (element.parentId === undefined) {
            element.parentId = default_id
         }
      })
      callback(result)
   });
}

function saveSnapshot(callback) {
   exportData(function(data) {
      browser.storage.local.set({ snapshot: data }, callback)
   })
}

function createSnapshotIfNull() {
   return new Promise(function(resolve, reject) {
      browser.storage.local.get(['snapshot'], function(res) {
         if (res.snapshot) {
            resolve()
         } else {
            saveSnapshot(resolve)
         }
      })
   })
}

function compareWithSnapshot() {
   
   return createSnapshotIfNull().then(checkForNewItems).then(log => {
   
      return new Promise(function(resolve) {
   
         var outer = null
         
         setTimeout(function() {
            browser.storage.local.get(['snapshot'], function(res) {
               var root = folderId > -1 ? res.snapshot[0].children[folderId] : res.snapshot[0]
               outer = root.children
               compareItem(outer, 0, [])
            })
            
            function compareItem(list, i, path) {
               
               if (list.length == 0) return
                  
               if (list[i].children) {
                  var title = list[i].title
                  if (i == 0 && list[i].parentId == 0) {
                     title = 'Bookmarks panel'
                  }
                  else if (i == 1 && list[i].parentId == 0) {
                     title = 'Other bookmarks'
                  }
                  compareItem(list[i].children, 0, path.concat(title))
                  if (i+1 < list.length) {
                     compareItem(list, i+1, path)
                  } else {
                     if (list == outer) resolve(log)
                  }
                  return
               }
               
               try {
                  browser.bookmarks.get(list[i].id, function(result) {
                     if (browser.runtime.lastError || result == null) {
                        log.push({ action: 'delete', url: list[i].url, path: path })
                     } else {
                        if (result[0].title != list[i].title) {
                           log.push({ action: 'modify', url: list[i].url, path: path, details: { title: result[0].title }})
                        }
                        if (result[0].url != list[i].url) {
                           log.push({ action: 'modify', url: list[i].url, path: path, details: { url: result[0].url }})
                        }
                        if (result[0].parentId != list[i].parentId) {
                           var new_path = []
                           getFullPath(result[0].parentId).then(function(new_path) {
                              var pos = log.length
                              while (pos > 0 && log[pos-1].action == 'modify' && 
                                 JSON.stringify(log[pos-1].path) == JSON.stringify(new_path)) {
                                 pos--
                              }
                              var details = { path: new_path, index: result[0].index }
                              setBeforeAndAfter(list, i, details)
                              log.splice(pos, 0, { action: 'modify', url: list[i].url, path: path, details: details })
                           })
                        }
                        else if (result[0].index != list[i].index) {
                           var details = { index: result[0].index }
                           setBeforeAndAfter(list, i, details)
                           log.push({ action: 'modify', url: list[i].url, path: path, details: details })
                        }
                     }
                     if (i+1 < list.length) {
                        compareItem(list, i+1, path)
                     } else {
                        if (list == outer) resolve(log)
                     }
                  })
               } catch (e) {}
            }
         }, 50)
      })
   })
}

function setBeforeAndAfter(list, pos, details) {
   if (details.index === undefined || details.index < 0 || details.index >= list.length) {
      details.index = list.length-1
   }
   var i = parseInt(details.index)
   details.folder_size = list.length
   details.before = i > 0 ? { url: list[i-1].url, title: list[i-1].title } : null
   details.after = i < list.length-1 ? { url: list[i+1].url, title: list[i+1].title } : null
   var el = list.splice(pos, 1)[0]
   list.splice(i, 0, el)
}

function checkForNewItems() {
   
   return new Promise(function(resolve) {
   
      var folder = 0
      var log = []
      
      browser.bookmarks.getTree(function(tree){
         folder = getRootFolder(tree)

         browser.bookmarks.getSubTree(folder.id, function(result) {
            browser.storage.local.get(['snapshot'], function(res) {
               var snapshot = res.snapshot
               walkTree(result, function(element) {
                  getFullPath(element.parentId).then(path => {
                     var elementDepth = path.length
                     var root = folderId > -1 ? snapshot[0].children[folderId] : snapshot[0]
                     var found = searchInFolderById(element.id, elementDepth, root.children, 0)
                     if (!found) {
                        console.log(element.url ? 'New bookmark found: ' + element.url : 'New folder found: ' + element.title)
                        if (log && log instanceof Array) {
                           log.push({ action: 'add', url: element.url, path, details: { title: element.title, index: element.index }})
                        }
                     }
                  })
               }, function() {
                  resolve(log)
               })
            })
         })
      })
   
   })
}

function walkTree(list, callback, onfinish) {
   for (var i = 0; i < list.length; i++) {
      if (list[i].parentId && list[i].parentId != '0') callback(list[i])
      if (list[i].children) {
         walkTree(list[i].children, callback, onfinish)
      }
      if (i == list.length-1 && list[i].parentId == '0' && onfinish) {
         onfinish()
      }
   }
}

function searchInFolderById(id, elementDepth, list, depth) {
   for (var i = 0; i < list.length; i++) {
      if (list[i].id == id) return true
      if (list[i].children && elementDepth >= depth+1 && searchInFolderById(id, elementDepth, list[i].children, depth+1)) {
         return true
      }
   }
   return false
}

var pathCache = {}

function getFullPath(parentId) {
   if (parentId == 0) return Promise.resolve([])
   parentId = parentId + ''
   if (pathCache[parentId]) return Promise.resolve(pathCache[parentId])
   return new Promise(function(resolve) {
      browser.bookmarks.get(parentId, function(result) {
         if (result[0].parentId == 0) {
            browser.bookmarks.getTree(function(tree){
               if (tree[0].children[0].id == result[0].id) {
                  pathCache[parentId] = ['Bookmarks panel']
                  resolve(['Bookmarks panel'])
               }
               else if (tree[0].children[1].id == result[0].id) {
                  pathCache[parentId] = ['Other bookmarks']
                  resolve(['Other bookmarks'])
               }
               else {
                  pathCache[parentId] = [result[0].title]
                  resolve([result[0].title])
               }
            })
         } else {
            resolve(getFullPath(result[0].parentId).then(res => { pathCache[parentId] = res.concat(result[0].title); return pathCache[parentId] }))
         }
      })
   })
}

var timer = setInterval(sync, 300000)

var changesToSend = []
var syncing = false

function sync() {
   if (!accessToken || !profileId || syncing) return Promise.reject()
   var _last = lastSync
   syncing = true
   pathCache = {}
   return compareWithSnapshot().then(log => { changesToSend = log })
     .then(applyRemoteUpdates)
     .then(() => { lastSync = Date.now() + 1000 })
     .then(() => { sendUpdates(changesToSend) })
     .then(() => {
        saveSnapshot()
        browser.storage.local.set({ last_sync: lastSync })
        syncing = false
     })
     .catch(() => { lastSync = _last; syncing = false })
}

function applyRemoteUpdates() {
   return fetch(origin + '/' + profileId + '/check?since=' + lastSync, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer: ' + accessToken
		}
	})
   .then(response => response.json())
   .then(response => {
      var log = response.data
      for (var i = 0; i < log.length; i++) {
         executeCommand(log[i])
      }
      if (response.timestamp) {
         lastSync = s.lastSync = +response.timestamp || Date.now() + 1000
      }
   })
}

function sendUpdates(log) {
   return fetch(origin + '/' + profileId + '/update', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer: ' + accessToken
		},
      body: JSON.stringify(log)
	})
}

function executeCommand(data) {
   switch (data.action) {
      case 'add':
         executeAddBookmark(data)
         break
      case 'modify':
         executeModifyBookmark(data)
         break
      case 'delete':
         executeDeleteBookmark(data)
         break
   }
}

function executeAddBookmark(data) {
   findFolderByPath(data.path).then(folder => {
      if (!folder) folder = { id: 2 }
      if (data.details.index < 0) {
         data.details.index = 0
      }
      if (data.details.index > folder.children.length) {
         data.details.index = folder.children.length
      }
      browser.bookmarks.create(
         {
            parentId: folder.id,
            title: data.details.title,
            url: data.url,
            index: data.details.index
         },
         function(bookmark) {
            console.log("Added remote bookmark: " + bookmark.url);
         }
      );
   });
}

function executeModifyBookmark(data) {
   findBookmarkByPath(data.path, data.url).then(item => {
      if (!item) return
      if (data.details.index !== undefined || data.details.path) {
         var details = {}
         if (data.details.index !== undefined) {
            details.index = data.details.index
            delete data.details.index
         }
         if (data.details.path) {
            findFolderByPath(data.details.path).then(folder => {
               if (folder != null) {
                  details.parentId = folder.id
               }
            
               delete data.details.path
               
               browser.bookmarks.getSubTree(item.parentId, function(parent) {
                  if (details.index != undefined) {
                     calculateIndex(data, item.index, parent[0], details)
                  }
                  browser.bookmarks.move(
                     item.id,
                     details,
                     function(bookmark) {
                        console.log("Moved remote bookmark: " + bookmark.url);
                     }
                  );
               });
            })
         } else {
            browser.bookmarks.getSubTree(item.parentId, function(parent) {
               calculateIndex(data, item.index, parent[0], details)
               browser.bookmarks.move(
                  item.id,
                  details,
                  function(bookmark) {
                     console.log("Moved remote bookmark: " + bookmark.url);
                  }
               );
            });
         }
      }
      if (data.details.url || data.details.title) {
         browser.bookmarks.update(
            item.id,
            data.details,
            function(bookmark) {
               console.log("Modified remote bookmark: " + bookmark.url);
            }
         );
      }
   });
}

function calculateIndex(data, pos, folder, details) {
   if (details.index !== undefined) {
      var found = false
      if (data.details.before) {
         var pos = 0
         while (pos < folder.children.length && 
                !(folder.children[pos].url == data.details.before.url &&
                  folder.children[pos].title == data.details.before.title)) {
            pos++
         }
         if (pos < folder.children.length &&
             folder.children[pos].url == data.details.before.url &&
             folder.children[pos].title == data.details.before.title) {
            details.index = pos+1
            found = true
         }
      }
      else if (data.details.after) {
         var pos = 0
         while (pos < folder.children.length && 
                !(folder.children[pos].url == data.details.after.url &&
                  folder.children[pos].title == data.details.after.title)) {
            pos++
         }
         if (pos < folder.children.length &&
             folder.children[pos].url == data.details.after.url &&
             folder.children[pos].title == data.details.after.title) {
            details.index = pos
            found = true
         }
      }
      if (!found) {
         details.index = parseInt(details.index) < pos ? 0 : folder.children.length-1
      } else {
         details.index = Math.max(0, Math.min(folder.children.length-1, details.index))
      }
   }
}

function executeDeleteBookmark(data) {
   var item = findBookmarkByPath(data.path, data.url).then(item => {
      if (!item) return
      if (!item.children) {
         browser.bookmarks.remove(
            item.id,
            function(bookmark) {
               console.log("Deleted remote bookmark: " + item.url);
            }
         );
      } else {
         browser.bookmarks.removeTree(
            item.id,
            function(folder) {
               console.log("Deleted remote folder: " + folder.title);
            }
         );
      }
   });
}

function findFolderByPath(path) {
   var folder = 0
   return new Promise(function(resolve) {
      browser.bookmarks.getTree(function(tree){
         folder = getRootFolder(tree)

         browser.bookmarks.getSubTree(folder.id, function(result) {
            if (folderId > -1) {
               path = path.slice(1)
            }
            resolve(findItem(folder.children, path))
         })
      })
   })
   
   function findItem(list, path) {
      for (var i = 0; i < list.length; i++) {
         if (list[i].title == path[0]) {
            if (path.length == 1 && !list[i].children) {
               return null
            }
            else if (path.length == 1) {
               return list[i]
            }
            return findItem(list[i].children, path.slice(1))
         }
         else if (list[i].parentId === '0' && i == 0 && path[0] == 'Bookmarks panel' ||
                  list[i].parentId === '0' && i == 1 && path[0] == 'Other bookmarks') {
            if (path.length == 1) {
               return list[i]
            }
            return findItem(list[i].children, path.slice(1))
         }
      }
      return null
   }
}

function findBookmarkByPath(path, url) {
   var folder = 0
   return (function(path) {
      return new Promise(function(resolve) {
         browser.bookmarks.getTree(function(tree){
            folder = getRootFolder(tree)

            browser.bookmarks.getSubTree(folder.id, function(result) {
               if (folderId > -1) {
                  path = path.slice(1)
               }
               resolve(findItem(folder.children, path, url))
            })
         })
      })
   })(path)
   
   function findItem(list, path, url) {
      for (var i = 0; i < list.length; i++) {
         if (path.length == 0 && list[i].url == url) {
            return list[i]
         }
         else if (list[i].title == path[0]) {
            if (path.length == 1 && !list[i].children) {
               return null
            }
            return findItem(list[i].children, path.slice(1), url)
         } else if (list[i].parentId === '0' && i == 0 && path[0] == 'Bookmarks panel' ||
                    list[i].parentId === '0' && i == 1 && path[0] == 'Other bookmarks') {
            return findItem(list[i].children, path.slice(1), url)
         }
      }
      return null
   }
}
