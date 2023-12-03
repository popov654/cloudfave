var origin = 'https://cloudfave.org/api'

var mode = 0

var s = localStorage;

var userId = s.userId || null;
var accessToken = s.accessToken || null;
var profileId = s.profileId || null;
var folderId = -1;
var profiles = []
var ignoredFolders = null

var lastSync = s.lastSync || 0;
var syncInterval = s.syncInterval || 300000;
   
var browser = browser || chrome
var extension = browser.extension || browser.runtime
   
if (!extension.onMessage) extension = browser.runtime

var firefoxIds = { 0: 'root________', 1: 'toolbar_____', 2: 'unfiled_____', 3: 'mobile______' }
var isFirefox = !chrome.app

window.addEventListener("load", function(){
   
   s.profileName = ''
   loadUserConfig(function() {
      getProfiles()
      getProfileName()
   })

}, false);

function loadUserConfig(callback) {
   browser.storage.local.get(['access_token', 'profile_id', 'ignored_folders', 'last_sync', 'sync_interval'], function(result) {
      accessToken = result.access_token || null
      profileId = result.profile_id || null
      ignoredFolders = result.ignored_folders || null
      lastSync = result.last_sync || 0
      syncInterval = result.sync_interval || 300000
      s.accessToken = accessToken
      s.profileId = profileId
      s.ignoredFolders = JSON.stringify(ignoredFolders)
      s.lastSync = lastSync
      s.syncInterval = syncInterval
      
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
      if (callback) callback({ name: s.profileName })
   }
   xhr.onerror = function() {
      if (callback) callback(null)
   }
   xhr.send(null)
}

extension.onMessage.addListener(function(request, sender, sendResponse) {
   if (request.operation == 'getUIScreen') {
      var result = accessToken == null ? 0 : (profileId == null ? 1 : (!ignoredFolders ? 2 : 3))
      sendResponse({ result })
   }
   else if (request.operation == 'getProfileName') {
      getProfileName(sendResponse)
   }
   else if (request.operation == 'setProfileId') {
      profileId = s.profileId = request.data.id
      browser.storage.local.set({ profileId: request.data.id }, function() {
         getProfileName(function() {
            sendResponse({ id: profileId, name: s.profileName })
         })
      })
   }
   else if (request.operation == 'update') {
      updateUserConfig(request.data)
   }
   else if (request.operation == 'authorize') {
      authorize(request.data.username, request.data.password, false, sendResponse)
   }
   else if (request.operation == 'register') {
      register(request.data.username, request.data.password, sendResponse)
   }
   else if (request.operation == 'oauthLogin') {
      accessToken = s.accessToken = request.access_token
      browser.storage.local.set({ access_token: accessToken })
   }
   else if (request.operation == 'createProfile') {
      exportData(function(result) {
         createProfile(request.name, result, function(res) {
            if (!res || !res.profileId) {
               sendResponse(0)
            } else {
               lastSync = s.lastSync = +res.timestamp || Date.now() + 1000
               profileId = s.profileId = res.profileId
               browser.storage.local.set({ profile_id: res.profileId, snapshot: result, last_sync: lastSync }, function() {
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
      var onFinish = function(result) {
         if (result.timestamp) {
            lastSync = s.lastSync = +result.timestamp || Date.now() + 1000
            browser.storage.local.set({ last_sync: lastSync })
         }
         saveSnapshot()
      }
      loadData(request.data.id, function(result) {
         if (request.data.merge) {
            exportData(function(res) {
               mergeData(request.data.id, res)
               importData(result.data, onFinish)
            })
         } else {
            importData(result.data, onFinish)
         }
         profileId = s.profileId = request.data.id
         lastSync = s.lastSync = Date.now() + 1000
         browser.storage.local.set({ profile_id: request.data.id, snapshot: result.data, last_sync: lastSync }, function() {
            getProfileName(function() {
               sendResponse({ id: profileId, name: s.profileName })
            })
         })
      })
   }
   else if (request.operation == 'getProfiles') {
      getProfiles(function(result) {
         sendResponse(result)
      })
   }
   else if (request.operation == 'getFolderTree') {
      loadDirectoryTree(profileId, function(result) {
         if (!result) {
            sendResponse(null)
         } else {
            sendResponse(Tree.getDirectoryStructure({ id: 0, children: result.directories }))
         }
      })
   }
   else if (request.operation == 'setIgnoredFolders') {
      browser.storage.local.set({ ignored_folders: request.data }, function() {
         ignoredFolders = s.ignoredFolders = JSON.stringify(request.data)
         sendResponse(1)
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
         sendResponse(1)
      }).catch(() => {
         sendResponse(0)
      })
   }
   else if (request.operation == 'logout') {
      logout(() => {
         sendResponse(1)
      })
   }
   return true
})

function logout(callback) {
   var xhr = new XMLHttpRequest()
   xhr.open('GET', origin + '/logout?ssid=' + accessToken, true)
   xhr.setRequestHeader('Authorization', 'Bearer: ' + accessToken)
   xhr.onload = function() {
      accessToken = s.accessToken = null
      profileId = s.profileId = null
      ignoredFolders = s.ignoredFolders = null
      browser.storage.local.set({ access_token: accessToken, profile_id: profileId, ignored_folders: ignoredFolders })
      if (callback) callback()
   }
   xhr.send(null)
}

function register(username, password, callback) {
   if (!username || !username.length || !password || !password.length) {
      return
   }
   var xhr = new XMLHttpRequest()
   xhr.open('POST', origin + '/register', true)
   xhr.setRequestHeader('Content-Type', 'application/json')
   xhr.onload = function() {
      if (this.status == 200) {
         accessToken = JSON.parse(this.responseText).token
         browser.storage.local.set({ access_token: accessToken })
         s.accessToken = accessToken
      }
      if (callback) callback(JSON.parse(this.responseText))
   }
   xhr.onerror = function() {
      if (callback) callback(this.responseText ? JSON.parse(this.responseText) : null)
   }
   xhr.send(JSON.stringify({ username, password }))
}
function authorize(username, password, secure, callback) {
   if (!username || !username.length || !password || !password.length) {
      return
   }
   if (accessToken != null) {
      logout(function() {
         doAuth(username, password, secure, callback)
      })
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

function loadDirectoryTree(profile_id, callback) {
   var xhr = new XMLHttpRequest()
   xhr.open('GET', origin + '/' + profile_id + '/directories', true)
   xhr.setRequestHeader('Authorization', 'Bearer: ' + accessToken)
   xhr.onload = function() {
      var result = JSON.parse(this.response)
      console.log(result)
      callback(result)
   }
   xhr.onerror = function() {
      if (callback) callback(0)
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
   var folder = null
   browser.bookmarks.getTree(function(tree){
      folder = getRootFolder(tree)
      if (folder.id == 0) folder = folder.children[1]
      
      var count = 0
      
      var last_parent_id = 0
      var last_parent = data[0]
      
      processItem(data, 0, null, sortDirectory, callback)
      
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
      
      function folderId(id) {
         return isFirefox ? firefoxIds[id] : id
      }

      function processItem(data, index, parent, itemComplete, allComplete) {
         var parent_id = parent && folderId(parent.id) || folder.id
         
         data[index].path = parent && parent.path ? parent.path.concat(data[index].title) : []
         
         if (parent && !parent.ex_list) {
            parent.ex_list = []
            parent.total_list = []
            last_parent_id = parent_id
            browser.bookmarks.getChildren(parent_id, function(list) {
               if (browser.runtime.lastError || !list) {
                  console.log('Error getting children of node ' + parent.id)
                  return
               }
               for (var i = 0; i < list.length; i++) {
                  parent.ex_list.push(list[i])
                  parent.total_list.push(list[i])
               }
               processItem(data, index, parent, itemComplete, allComplete)
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
                    isFirefox && index < 4 && parent_id == firefoxIds[0] ||
                    !data[index].title && !data[index].url || exists
         
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
   if (folderId > -1 && folderId < 2 || isFirefox && folderId > -1 && folderId < 4) {
      folder = tree[0].children[folderId]
   }
   return folder
}

function isRootFolder(id) {
   return id == 0 || isFirefox && firefoxIds[0] == id
}

function exportData(callback) {
   browser.bookmarks.getTree(function(result) {
      result[0].children[0].title = 'Bookmarks panel'
      result[0].children[1].title = 'Other bookmarks'
      var default_id = result[0].children[1].id
      walkTree(result, null, function(element) {
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
   
   return createSnapshotIfNull().then(checkForNewItems).then(res => {
      
      var { log, snapshot } = res
   
      return new Promise(function(resolve) {
   
         var map = {}
         
         setTimeout(function() {
            
            var outer = snapshot[0].children
            
            compareItem(outer, 0, [], outer.slice())
            
            function findIndexByURL(list, url, title) {
               for (var i = 0; i < list.length; i++) {
                  if (url && list[i].url == url || !url && list[i].title == title) return i
               }
               return -1
            }
            
            function compareItem(list, i, path, _list, parentFinish) {
               
               function onfinish() {
                  if (i+1 >= list.length) {
                     if (parentFinish) parentFinish()
                     else resolve(log)
                  }
               }
               
               if (list.length == 0 || containsPath(ignoredFolders, path)) {
                  onfinish()
                  return
               }
               
               try {
                  browser.bookmarks.get(list[i].id, function(result) {
                     if (browser.runtime.lastError || result == null) {
                        var pos = findIndexByURL(_list, list[i].url, list[i].title)
                        _list.splice(pos, 1)
                        for (var j = pos; j < _list.length; j++) {
                           _list[j].index--
                        }
                        log.push({ action: 'delete', url: list[i].url, title: list[i].title, path: path });
                        
                        onfinish()
                     } else {
                        if (!result[0].url && isRootFolder(result[0].parentId)) {
                           result[0].title = getDefaultNameById(result[0].id)
                        }
                        if (result[0].title != list[i].title) {
                           log.push({ action: 'modify', url: list[i].url, title: list[i].title, path: path, details: { title: result[0].title }})
                        }
                        if (result[0].url != list[i].url) {
                           log.push({ action: 'modify', url: list[i].url, path: path, details: { url: result[0].url }})
                        }
                        if (result[0].parentId != list[i].parentId) {
                           var pathStr = path.join('>')
                           if (!map[pathStr]) map[pathStr] = [[], []]
                           var new_path = []
                           getFullPath(result[0].parentId, snapshot).then(function(new_path) {
                              var pos = log.length
                              while (pos > 0 && log[pos-1].action == 'modify' && 
                                 JSON.stringify(log[pos-1].path) == JSON.stringify(new_path)) {
                                 pos--
                              }
                              var details = { path: new_path, index: result[0].index }
                              
                              var oldIndex = findIndexByURL(_list, list[i].url, list[i].title)
                              setBeforeAndAfter(_list, oldIndex, details)
                              log.splice(pos, 0, { action: 'modify', url: list[i].url, title: list[i].title, path: path, details: details })
                              
                              map[pathStr][1].push({ url: list[i].url, details });
                              
                              if (!list[i].children) onfinish()
                           })
                        }
                        else if (result[0].index != list[i].index) {
                           var pathStr = path.join('>')
                           if (!map[pathStr]) map[pathStr] = [[], []]
                           var details = { index: result[0].index }
                           
                           var oldIndex = findIndexByURL(_list, list[i].url, list[i].title)
                           setBeforeAndAfter(_list, oldIndex, details)
                           //log.push({ action: 'modify', url: list[i].url, title: list[i].title, path: path, details: details })
                           
                           if (details.index > oldIndex) {
                              map[pathStr][1].push({ url: list[i].url, title: list[i].title, details })
                           } else if (details.index < oldIndex) {
                              map[pathStr][0].push({ url: list[i].url, title: list[i].title, details })
                           }
                           if (!list[i].children) onfinish()
                        } else {
                           if (!list[i].children || containsPath(ignoredFolders, path.concat(list[i].title))) onfinish()
                        }
                        if (list[i].children && !containsPath(ignoredFolders, path.concat(list[i].title))) {
                           var title = list[i].title
                           if (isRootFolder(list[i].parentId)) {
                              title = getDefaultNameByIndex(i)
                           }
                           compareItem(list[i].children, 0, path.concat(title), list[i].children.slice(), onfinish)
                        }
                     }
                     if (i+1 < list.length) {
                        compareItem(list, i+1, path, _list, parentFinish)
                     } else {
                        // Directory end
                        var pathStr = path.join('>')
                        if (map[pathStr] && (map[pathStr][0].length || map[pathStr][1].length)) {
                           var index = map[pathStr][0].length <= map[pathStr][1].length && map[pathStr][0].length > 0 ? 0 : 1
                           var a = map[pathStr][index]
                           for (var j = 0; j < a.length; j++) {
                              log.push({ action: 'modify', url: a[j].url, title: a[j].title, path: path, details: a[j].details })
                           }
                           delete map[pathStr]
                        }
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
   
   var el = list.splice(pos, 1)[0]
   list.splice(details.index, 0, el)
   
   for (var i = 0; i < list.length; i++) {
      if (list[i] == el) {
         details.before = i > 0 ? { url: list[i-1].url, title: list[i-1].title } : null
         details.after = i < list.length-1 ? { url: list[i+1].url, title: list[i+1].title } : null
         break
      }
   }
   details.folder_size = list.length
}

function containsPath(list, path) {
   for (var i = 0; i < list.length; i++) {
      if (!list[i].length || list[i].length != path.length) {
         continue
      }
      var flag = true
      for (var j = 0; j < list[i].length; j++) {
         if (list[i][j] != path[j]) {
            flag = false
            break
         }
      }
      if (flag) return true
   }
   return false
}

function checkForNewItems() {
   
   return new Promise(function(resolve) {
   
      var folder = 0
      var log = []
      
      browser.bookmarks.getTree(function(tree){
         browser.storage.local.get(['snapshot'], function(res) {
            var snapshot = res.snapshot
            walkTree(tree[0].children, tree[0], function(element) {
               getFullPath(element.parentId, tree).then(path => {
                  if (containsPath(ignoredFolders, path)) {
                     return
                  }
                  var elementDepth = path.length
                  var root = folderId > -1 ? snapshot[0].children[folderId] : snapshot[0]
                  var found = searchInFolderById(element.id, elementDepth, root.children, 0)
                  if (!found) {
                     console.log(element.url ? 'New bookmark found: ' + element.url : 'New folder found: ' + element.title)
                     if (log && log instanceof Array) {
                        log.push({ action: 'add', url: element.url, path, details: { title: element.title, index: element.index }})
                     }
                     Tree.insert(snapshot[0], element, path)
                  }
                  resolve({ log, snapshot })
               })
            })
         })
      })
   
   })
}

function walkTree(list, parent, callback, onfinish) {
   for (var i = 0; i < list.length; i++) {
      if (callback && list[i].parentId && list[i].parentId != '0') callback(list[i])
      if (list[i].children) {
         walkTree(list[i].children, parent, callback, onfinish)
      }
      if (onfinish && i == list.length-1 && isRootFolder(list[i].parentId)) {
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
var folderCache = {}

function getDefaultName(root, folderId) {
   if (!isFirefox && root[0].children[0].id == folderId ||
        isFirefox && root[0].children[1].id == folderId) {
      return 'Bookmarks panel'
   }
   else if (!isFirefox && root[0].children[1].id == folderId ||
             isFirefox && root[0].children[2].id == folderId) {
      return 'Other bookmarks'
   }
   else if (isFirefox && root[0].children[0].id == folderId) {
      return 'Bookmarks menu'
   }
   else if (!isFirefox && root[0].children.length > 2 && root[0].children[2].id == folderId ||
             isFirefox && root[0].children[3].id == folderId) {
      return 'Mobile bookmarks'
   }
   return null
}

function getDefaultNameById(folderId) {
   if (!isFirefox) {
      return ['', 'Bookmarks panel', 'Other bookmarks', 'Mobile bookmarks'][+folderId];
   } else {
      var map = { 'root________': '',
                  'toolbar_____': 'Bookmarks panel',
                  'unfiled_____': 'Other bookmarks',
                  'menu________': 'Bookmarks menu',
                  'mobile______': 'Mobile bookmarks'
      }
      return map[folderId]
   }
   return null
}

function getDefaultNameByIndex(index) {
   if (!isFirefox) {
      return ['Bookmarks panel', 'Other bookmarks'][index]
   } else {
      return ['Bookmarks menu', 'Bookmarks panel', 'Other bookmarks', 'Mobile bookmarks'][index]
   }
   return null
}

function getFullPath(parentId, tree) {
   if (isRootFolder(parentId)) return Promise.resolve([])
   parentId = parentId + ''
   if (pathCache[parentId]) return Promise.resolve(pathCache[parentId])
   return new Promise(function(resolve) {
      browser.bookmarks.get(parentId, function(result) {
         if (!result) return
         if (result[0].parentId && isRootFolder(result[0].parentId)) {
            var name = getDefaultName(tree, result[0].id)
            if (name) {
               pathCache[parentId] = [name]
               resolve([name])
            }
            else {
               pathCache[parentId] = [result[0].title]
               resolve([result[0].title])
            }
         } else {
            resolve(getFullPath(result[0].parentId, tree).then(res => { pathCache[parentId] = res.concat(result[0].title); return pathCache[parentId] }))
         }
      })
   })
}

var timer = setInterval(() => sync().catch(e => { console.log(e) }), syncInterval)

var changesToSend = []
var syncing = false

function sync() {
   if (!accessToken || !profileId || !ignoredFolders || syncing) return Promise.reject()
   var _last = lastSync
   syncing = true
   pathCache = {}
   return compareWithSnapshot()
      .then(log => { changesToSend = log})
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
      return new Promise(function(resolve) {
         folderCache = {}
         executeCommand(response.data, 0, resolve)
         if (response.timestamp) {
            lastSync = s.lastSync = +response.timestamp || Date.now() + 1000
         }
      })
   })
   .catch(e => {
      console.log(e)
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

function executeCommand(log, index, onfinish) {
   if (!log.length || index >= log.length) {
      if (onfinish) onfinish()
      return
   }
   var next = function() {
      if (index < log.length-1) {
         executeCommand(log, index+1, onfinish)
      } else {
         if (onfinish) onfinish()
      }
   }
   
   if (containsPath(ignoredFolders, log[index].path)) {
      index++
      next()
      return
   }
   
   switch (log[index].action) {
      case 'add':
         executeAddBookmark(log, index, next)
         break
      case 'modify':
         executeModifyBookmark(log, index, next)
         break
      case 'delete':
         executeDeleteBookmark(log, index, next)
         break
   }
}

function executeAddBookmark(log, index, callback) {
   var data = log[index]
   findFolderByPath(data.path).then(folder => {
      if (!folder) folder = { id: 2 }
      if (data.details.index < 0) {
         data.details.index = 0
      }
      if (data.details.index > folder.children.length) {
         data.details.index = folder.children.length
      }
      if (folder.children.find(el => (el.title == data.details.title && el.url == data.url))) {
         if (callback) callback()
         return
      }
      browser.bookmarks.create(
         {
            parentId: folder.id,
            title: data.details.title,
            url: data.url,
            index: folder.children.length
         },
         function(bookmark) {
            console.log("Added remote bookmark: " + bookmark.url);
            if (callback) callback()
         }
      );
   });
}

function executeModifyBookmark(log, index, callback) {
   var data = log[index]
   findBookmarkByPath(data.path, data.url, data.title).then(item => {
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
                        if (callback) callback()
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
                     if (callback) callback()
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
               if (callback) callback()
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

function executeDeleteBookmark(log, index, callback) {
   var data = log[index]
   var item = findBookmarkByPath(data.path, data.url, data.title).then(item => {
      if (!item) return
      if (!item.children) {
         browser.bookmarks.remove(
            item.id,
            function(bookmark) {
               console.log("Deleted remote bookmark: " + item.url);
               if (callback) callback()
            }
         );
      } else {
         browser.bookmarks.removeTree(
            item.id,
            function(folder) {
               console.log("Deleted remote folder: " + item.title);
               if (callback) callback()
            }
         );
      }
   });
}

function findFolderByPath(path) {
   var folder = 0
   if (folderCache[path.join('>')]) {
      return Promise.resolve(folderCache[path.join('>')])
   }
   return new Promise(function(resolve) {
      browser.bookmarks.getTree(function(tree){
         folder = getRootFolder(tree)
         if (folderId > -1) {
            path = path.slice(1)
         }
         var result = findItem(folder.children, path)
         folderCache[path.join('>')] = result
         resolve(result)
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
         else if (isRootFolder(list[i].parentId) && path[0] == getDefaultNameByIndex(i)) {
            if (path.length == 1) {
               return list[i]
            }
            return findItem(list[i].children, path.slice(1))
         }
      }
      return null
   }
}

function findBookmarkByPath(path, url, title) {
   var folder = 0
   return (function(path) {
      return new Promise(function(resolve) {
         browser.bookmarks.getTree(function(tree){
            folder = getRootFolder(tree)
            if (folderId > -1) {
               path = path.slice(1)
            }
            resolve(findItem(folder.children, path, url, title))
         })
      })
   })(path)
   
   function findItem(list, path, url, title) {
      for (var i = 0; i < list.length; i++) {
         if (path.length == 0 && equals(list[i], { url, title })) {
            return list[i]
         }
         else if (list[i].title == path[0]) {
            if (!url && title == list[i].title) {
               return list[i]
            }
            if (path.length == 1 && !list[i].children) {
               return null
            }
            return findItem(list[i].children, path.slice(1), url, title)
         } else if (isRootFolder(list[i].parentId) && path[0] == getDefaultNameByIndex(i)) {
            return findItem(list[i].children, path.slice(1), url, title)
         }
      }
      return null
   }
   
   function equals(el1, el2) {
      return el1.url && el2.url && el1.url == el2.url || !el1.url && !el2.url && el1.title == el2.title;
   }
}

const Tree = {
   getSubTree: function(root, path) {
      if (path.length == 0) {
         return root;
      }
      path = path.slice();
      var list = root.children;
      while (path.length > 0) {
        var directory = path.shift();
        var found = false;
        for (var i = 0; i < list.length; i++) {
            if (list[i].title == directory) {
               if (path.length == 0 && list[i].children) {
                  return list[i];
               } else if (path.length == 0) {
                  return null;
               }
               var list = list[i].children;
               found = true;
               break;
            }
        }
        if (!found) break;
      }
      return null;
   },
   getDirectoryStructure: function(root) {

      function filterTree(root, path) {
         var new_list = root.children.filter(el => el.children);
         for (var i = 0; i < new_list.length; i++) {
            var copy = {};
            Object.assign(copy, new_list[i]);
            new_list[i] = copy;
            new_list[i].path = path.concat(new_list[i].title);
            filterTree(new_list[i], new_list[i].path);
         }
         root.children = new_list;
      }

      var copy = {};
      Object.assign(copy, root);
      filterTree(copy, []);
      return copy.children;
   },
   walkTree: function(list, callback) {
      for (var i = 0; i < list.length; i++) {
         callback(list[i]);
         if (list[i].children) {
            this.walkTree(list[i].children, callback);
         }
      }
   },
   insert: function(root, element, path = []) {
      if (!element || !element.title) return;
      var subTree = this.getSubTree(root, path);
      if (subTree == null) return;
      if (this.nodeExists(subTree.children, element)) return;
      var id = this.findMaxId([root]) + 1;
      var index = this.findMaxIndex(subTree.children) + 1;
      element.index = index;
      element = { dateAdded: Date.now(), id, ...element };
      if (!element.url) element.children = [];
      subTree.children.push(element);
   },
   modify: function(root, url, details, path = []) {
      var subTree = this.getSubTree(root, path);
      if (subTree == null) return;
      for (var i = 0; i < subTree.children.length; i++) {
         if (subTree.children[i].url == url) {
            if (details.index !== undefined) {
               this.calculateIndex(subTree.children, i, details);
            }
            for (var key of ['title', 'url', 'index']) {
               if (details[key] !== undefined) {
                  subTree.children[i][key] = details[key];
               }
            }
            break;
         }
      }
   },
   move: function(root, url, pathSrc, pathDst) {
      if (!pathSrc || !pathDst || JSON.stringify(pathSrc) == JSON.stringify(pathDst)) {
            return;
      }
      var subTreeSrc = this.getSubTree(root, pathSrc);
      var subTreeDst = this.getSubTree(root, pathDst);
      if (subTreeSrc == null || subTreeDst == null) {
         return;
      }
      var element = null;
      for (var i = 0; i < subTreeSrc.children.length; i++) {
         if (subTreeSrc.children[i].url == url) {
             element = subTreeSrc.children.splice(i--, 1)[0];
         }
      }
      if (subTreeDst == null) return;
      var index = this.findMaxIndex(subTreeDst.children);
      element = { ...element, index };
      subTreeDst.children.push(element);
   },
   remove: function(root, url, path = []) {
      var subTree = this.getSubTree(root, path);
      if (subTree == null) return;
      for (var i = 0; i < subTree.children.length; i++) {
         if (subTree.children[i].url == url) {
            subTree.children.splice(i--, 1);
         }
      }
   },
   merge: function(dstRoot, srcRoot) {
      this.mergeSubtree(dstRoot, srcRoot, dstRoot);
   },
   mergeSubtree: function(dstRoot, srcRoot, root) {
      if (!srcRoot.children || !dstRoot.children) return;
      for (var i = 0; i < srcRoot.children.length; i++) {
        var el = srcRoot.children[i];
        var dst = this.findNode(dstRoot.children, el);
        if (!dst) {
            var _id = this.findMaxId(root.children) + 1;
            el.id = _id++;
            if (el.children) {
               this.walkTree(el.children, (el) => {
                  el.id = _id++;
               });
            }
            this.insertByDate(dstRoot.children, el);
        } else if (el.children) {
            this.mergeSubtree(dst, el, root);
        }
      }
   },
   insertByDate: function(list, el) {
      if (!el.dateAdded) {
         list.push(el);
         return;
      }
      var pos = 0;
      while (pos < list.length-1 && list[pos+1].dateAdded <= el.dateAdded) {
         pos++;
      }
      list.splice(pos, 0, el);
   },
   calculateIndex: function(list, pos, details) {
      if (list.length == 0 || list.length == details.folder_size || details.index === undefined) {
         return;
      }
      var found = false;
      if (details.before) {
         var pos = 0
         while (pos < list.length && !(list[pos].url == details.before.url && list[pos].title == details.before.title)) {
            pos++;
         }
         if (pos < list.length && list[pos].url == details.before.url && list[pos].title == details.before.title) {
            details.index = pos+1;
            found = true;
         }
      }
      if (!found && details.after) {
         var pos = 0
         while (pos < list.length && !(list[pos].url == details.after.url && list[pos].title == details.after.title)) {
            pos++;
         }
         if (pos < list.length && list[pos].url == details.after.url && list[pos].title == details.after.title) {
            details.index = pos;
            found = true;
         }
      }
      if (!found) {
         details.index = parseInt(details.index) < pos ? 0 : list.length-1;
      } else {
         details.index = Math.max(0, Math.min(list.length-1, parseInt(details.index)));
      }
      if (details.before || details.after) {
         if (details.before && details.index > 0 && !this.nodeEquals(list[details.index-1], details.before)) {
            details.before = { url: list[details.index-1].url, title: list[details.index-1].title };
         }
         if (details.after && details.index < list.length-1 && !this.nodeEquals(list[details.index], details.after)) {
            details.after = { url: list[details.index].url, title: list[details.index].title };
         }
      }
   },
   nodeEquals: function(el1, el2) {
      return el1.url == el2.url && el1.title == el2.title;
   },
   nodeExists: function(list, element) {
      for (var i = 0; i < list.length; i++) {
         if (element.url && list[i].url == element.url || !element.url && list[i].title == element.title) {
            return true;
         }
      }
      return false;
   },
   findNode: function(list, element) {
      for (var i = 0; i < list.length; i++) {
        if (element.url && list[i].url == element.url || !element.url && list[i].title == element.title) {
            return list[i];
        }
      }
      return null;
   },
   findMaxId: function(items) {
      var maxId = 0;
      walkTree(items, (el) => {
         var id = parseInt(el.id);
         if (isNaN(id)) return;
         if (id > maxId) {
            maxId = id;
         }
      });
      return maxId;
   },
   findMaxIndex: function(items) {
      var maxIndex = 0;
      items.forEach((el) => {
         var index = parseInt(el.index);
         if (isNaN(index)) return;
         if (index > maxIndex) {
            maxIndex = index;
         }
      });
      return maxIndex;
   }
}
