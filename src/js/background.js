var origin = 'https://cloudfave.org/api'

var mode = 0

var userId = null;
var accessToken = null;
var profileId = null;
var folderId = -1;
var profiles = []
var ignoredFolders = null

var lastSync = 0;
var syncEnabled = true;
var syncInterval = 300000;

var profileName = ''
   
var browser = browser || chrome
var extension = browser.runtime


var firefoxIds = { 0: 'root________', 1: 'toolbar_____', 2: 'unfiled_____', 3: 'mobile______' }
var isFirefox = browser.runtime.getURL('').match(/^moz-/)

if (isFirefox) {
   browser.storage.local._get = browser.storage.local.get
   browser.storage.local.get = function(params, callback) {
      browser.storage.local._get(params).then(callback, (err) => console.log(err))
   }
   browser.storage.local._set = browser.storage.local.set
   browser.storage.local.set = function(obj, callback) {
      browser.storage.local._set(obj).then(callback, (err) => console.log(err))
   }
}

browser.runtime.onInstalled.addListener(() => {
   if (!browser.alarms) return
   browser.alarms.clear('timer', () => {
      browser.alarms.create('timer', { periodInMinutes: Math.max(5, syncInterval / 60000) })
   })
})

if (browser.alarms) {
   browser.alarms.get('timer', (alarm) => {
      if (!alarm) {
         browser.alarms.create('timer', { periodInMinutes: Math.max(5, syncInterval / 60000) })
      }
   })
   browser.alarms.onAlarm.addListener(() => {
      loadUserConfig(function() {
         if (!syncEnabled) return
         console.log('Syncing data...')
         sync().then(() => console.log('Done.')).catch(e => { console.log(e) })
      })
   })
}

loadUserConfig(function() {
   getProfiles()
})

function loadUserConfig(callback) {
   browser.storage.local.get(['access_token', 'profile_id', 'ignored_folders', 'last_sync', 'sync_enabled', 'sync_interval'], 
      function(result) {
         accessToken = result.access_token || null
         profileId = result.profile_id || null
         ignoredFolders = result.ignored_folders || null
         lastSync = result.last_sync || 0
         syncEnabled = !(result.sync_enabled === false)
         syncInterval = result.sync_interval || 300000
         
         if (callback) callback()
      }
   );
}

async function getProfiles() {
   if (!accessToken) return { error: 'Unathorized' }
   try {
      var res = await fetch(origin + '/getProfiles', {
         headers: {
            'Authorization': 'Bearer: ' + accessToken
         }
      })
      let result = await res.json()
      return { status: res.status, data: result.data, error: result.error }
   } catch (e) {
      return null
   }
}

function updateProfileName(id, name) {
   for (var profile of profiles) {
      if (profile.id == id) {
         profile.name = name
      }
   }
}

function removeProfile(id) {
   for (var i = 0; i < profiles.length; i++) {
      if (profiles[i].id == id) {
         profiles.splice(i--, 1)
      }
      if (profileId == id) {
         profileId = profiles[i].id
      }
   }
}

async function getProfileName() {
   if (!accessToken || !profileId) return
   try {
      var res = await fetch(origin + '/' + profileId + '/info', {
         headers: {
            'Authorization': 'Bearer: ' + accessToken
         }
      })
      res = await res.json()
      profileName = res.name
      return profileName
   } catch (e) {
      return null
   }
}

function setParameter(data) {
   switch (data.name) {
      case 'sync_enabled':
         if (browser.alarms) {
            if (data.value) {
               browser.alarms.clear('timer', () => {
                  browser.alarms.create('timer', { periodInMinutes: Math.max(5, syncInterval / 60000) })
               })
            } else {
               browser.alarms.clear('timer')
            }
         }
         syncEnabled = !!data.value
         browser.storage.local.set({ sync_enabled: syncEnabled })
         break
      case 'sync_interval':
         var interval = parseInt(data.value)
         if (!isNaN(interval)) {
            syncInterval = Math.max(5, Math.floor(interval)) * 60000
            browser.storage.local.set({ sync_interval: syncInterval })
            if (browser.alarms) {
               browser.alarms.clear('timer', () => {
                  browser.alarms.create('timer', { periodInMinutes: Math.max(5, syncInterval / 60000) })
               })
            }
         }
         break
   }
}

extension.onMessage.addListener(function(request, sender, sendResponse) {
   loadUserConfig(function() {
   
      if (request.operation == 'getUIScreen') {
         var result = accessToken == null ? 0 : (profileId == null ? 1 : (!ignoredFolders ? 2 : 3))
         sendResponse({ result })
      }
      else if (request.operation == 'getProfileName') {
         getProfileName().then(() => sendResponse({ name: profileName }))
      }
      else if (request.operation == 'setProfileId') {
         profileId = request.data.id
         browser.storage.local.set({ profileId: request.data.id }, function() {
            getProfileName().then(() => sendResponse({ name: profileName }))
         })
         updateOptionsPage()
      }
      else if (request.operation == 'setParameter') {
         setParameter(request.data)
      }
      else if (request.operation == 'authorize') {
         authorize(request.data.username, request.data.password, false).then(res => sendResponse(res))
      }
      else if (request.operation == 'oauthLogin') {
         accessToken = request.access_token
         browser.storage.local.set({ access_token: accessToken })
      }
      else if (request.operation == 'register') {
         register(request.data.username, request.data.password).then(res => sendResponse(res))
      }
      else if (request.operation == 'createProfile') {
         exportData(async function(result) {
            var res = await createProfile(request.name, result)
            if (!res || !res.profileId) {
               sendResponse(0)
            } else {
               lastSync = +res.timestamp || Date.now() + 1000
               profileId = res.profileId
               browser.storage.local.set({ profile_id: res.profileId, snapshot: result, last_sync: lastSync }, function() {
                  sendResponse(res.profileId)
               })
               updateOptionsPage()
            }
         })
      }
      else if (request.operation == 'renameProfile') {
         var profile_id = request.data && request.data.profileId || profileId
         renameProfile(profile_id, request.data.value).then(() => {
            updateProfileName(profile_id, request.data.value)
            sendResponse(1)
         })
      }
      else if (request.operation == 'deleteProfile') {
         var profile_id = request.data && request.data.profileId || profileId
         deleteProfile(profile_id, sendResponse).then(() => {
            removeProfile(profile_id)
            sendResponse(1)
         })
      }
      else if (request.operation == 'loadProfile') {
         var onFinish = function(result) {
            if (result.timestamp) {
               lastSync = +result.timestamp || Date.now() + 1000
               browser.storage.local.set({ last_sync: lastSync })
            }
            saveSnapshot()
         }
         loadData(request.data.id).then(result => {
            if (request.data.merge) {
               exportData(async function(res) {
                  await mergeData(request.data.id, res)
                  importData(result.data, onFinish)
               })
            } else {
               importData(result.data, onFinish)
            }
            profileId = request.data.id
            lastSync = Date.now() + 1000
            browser.storage.local.set({ profile_id: request.data.id, snapshot: result.data, last_sync: lastSync }, async function() {
               getProfileName().then(() => sendResponse({ id: profileId, name: profileName }))
            })
            updateOptionsPage()
         })
      }
      else if (request.operation == 'getRemoveHistory') {
         fetch(origin + '/' + profileId + '/removed-items', {
            method: 'GET',
            headers: {
               'Content-Type': 'application/json',
               'Authorization': 'Bearer: ' + accessToken
            }
         })
         .then(response => response.json())
         .then(response => {
            sendResponse(response)
         })
         .catch(e => {
            sendResponse({ error: 'Connection error' })
         })
      }
      else if (request.operation == 'restoreBookmark') {
         restoreBookmark(request.data, sendResponse)
      }
      else if (request.operation == 'getProfiles') {
         getProfiles().then(res => sendResponse(res))
      }
      else if (request.operation == 'getFolderTree') {
         var profile_id = request.data && request.data.profileId || profileId
         loadDirectoryTree(profile_id).then(result => {
            if (!result) {
               sendResponse(null)
            } else {
               if (result.error) {
                  sendResponse(result)
               } else {
                  sendResponse(Tree.getDirectoryStructure({ id: 0, children: result.directories }))
               }
            }
         })
      }
      else if (request.operation == 'getFolderItems') {
         var profile_id = request.data && request.data.profileId || profileId
         loadFolderItems(profile_id, request.data.path || []).then(result => {
            if (!result) {
               sendResponse(null)
            } else {
               sendResponse(result)
            }
         })
      }
      else if (request.operation == 'setIgnoredFolders') {
         browser.storage.local.set({ ignored_folders: request.data }, function() {
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
         sync()
            .then(() => {
               sendResponse(1)
            })
            .catch(() => {
               sendResponse(0)
            })
      }
      else if (request.operation == 'logout') {
         logout().then(() => sendResponse(1))
      }
      
   })
   return true
})

async function logout() {
   await fetch(origin + '/logout?ssid=' + accessToken, {
      headers: {
			'Authorization': 'Bearer: ' + accessToken
		}
   })
   accessToken = null
   profileId = null
   ignoredFolders = null
   browser.storage.local.set({ access_token: accessToken, profile_id: profileId, ignored_folders: ignoredFolders })
   updateOptionsPage()
}

async function register(username, password) {
   if (!username || !username.length || !password || !password.length) {
      return
   }
   try {
      var res = await fetch(origin + '/register', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({ username, password })
      })
      var data = await res.json()
      return { status: res.status, message: data.message, error: data.error }
   } catch (e) {
      res = { error: e, status: 500 }
      console.log(e)
      return res
   }
}

async function authorize(username, password, secure) {
   if (!username || !username.length || !password || !password.length) {
      return
   }
   if (accessToken != null) {
      await logout()
   }
   return await doAuth(username, password, secure)
}

async function doAuth(username, password, secure, callback) {
   try {
      var res = await fetch(origin + '/login', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({ username, password })
      })
      if (res.status == 200) {
         var result = await res.json()
         accessToken = result.token
         browser.storage.local.set({ access_token: accessToken })
         updateOptionsPage()
      }
      return { status: res.status, message: result.message, error: result.error }
   } catch (e) {
      res = { error: e, status: 500 }
      console.log(e)
      return res
   }
}

function updateOptionsPage() {
   var url = browser.runtime.getURL('options.html')
   browser.tabs.query({ url: url }, function(tabs) {
      if (browser.runtime.lastError) console.error(browser.runtime.lastError)
      for (var i = 0; i < tabs.length; i++) {
         if (tabs[i].url == url) {
            browser.tabs.reload(tabs[i].id)
         }
      }
   })
}

async function loadProfilesList() {
   if (!userId || !accessToken) return
   var res = await fetch(origin + '/getProfiles', {
      headers: {
         'Authorization': 'Bearer: ' + accessToken
      }
   })
   var result = await res.json()
   if (result.data) {
      profiles = result.data
   }
   return profiles
}

async function loadData(profile_id) {
   var res = await fetch(origin + '/' + profile_id + '/get', {
      headers: {
         'Authorization': 'Bearer: ' + accessToken
      }
   })
   return await res.json()
}

async function loadFolderItems(profile_id, path, callback) {
   var res = await fetch(origin + '/' + profile_id + '/items', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
         'Authorization': 'Bearer: ' + accessToken
      },
      body: JSON.stringify({ path })
   })
   return await res.json()
}

async function mergeData(profile_id, data) {
   var res = await fetch(origin + '/' + profile_id + '/merge', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
         'Authorization': 'Bearer: ' + accessToken
      }, 
      body: JSON.stringify(data)
   })
   return await res.json()
}
   
async function loadDirectoryTree(profile_id) {
   try {
      var res = await fetch(origin + '/' + profile_id + '/directories', {
         headers: {
            'Authorization': 'Bearer: ' + accessToken
         }
      })
      return await res.json()
   } catch (e) {
      return null
   }
}

async function createProfile(name, data) {
   try {
      var res = await fetch(origin + '/createProfile', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer: ' + accessToken
         },
         body: JSON.stringify({ name, data })
      })
      return await res.json()
   } catch (e) {
      return null
   }
}

async function renameProfile(profile_id, name) {
   try {
      var res = await fetch(origin + '/' + profile_id + '/rename', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer: ' + accessToken
         },
         body: JSON.stringify({ value: name })
      })
      return await res.json()
   } catch (e) {
      return null
   }
}

async function deleteProfile(profile_id, callback) {
   try {
      var res = await fetch(origin + '/' + profile_id + '/delete', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer: ' + accessToken
         },
         body: JSON.stringify({})
      })
      return await res.json()
   } catch (e) {
      return null
   }
}

function restoreBookmark(data, callback) {
   browser.storage.local.get(['snapshot'], function(res) {
      if (res.snapshot && data.url && data.path && data.details && data.details.title) {
         
         var path = data.path.slice()
         
         var list = res.snapshot[0].children
         
         var error = false, parent_id = '0'
         
         while (path.length && list) {
            var el = list.find(el => el.title == path[0])
            if (!el) {
               error = true
               break
            }
            parent_id = el.id
            path = path.slice(1)
            list = el.children
         }
         
         if (error) {
            callback(false)
         }
         
         var exists = list.find(el => el.url == data.url)
      
         if (!exists) {
            browser.bookmarks.create(
               {
                  parentId: parent_id,
                  title: data.details.title,
                  url: data.url
               },
               function(bookmark) {
                  if (bookmark) {
                     sendUpdates([{ action: 'add', url: data.url, path: data.path, details: data.details }])
                     .then(() => {
                        lastSync = s.lastSync = Date.now()
                        callback(true)
                     })
                  } else {
                     callback(false)
                  }
               }
            );
         }
      }
   })
}

function importData(data, callback) {
   
   if (isFirefox && data[0].children.length > 3) {
      var el = data[0].children[2]
      data[0].children[2] = data[0].children[3]
      data[0].children[3] = el
      data[0].children.splice(4, data[0].children.length - 4)
   } else if (data[0].children.length > 3) {
      for (var i = data[0].children[3].children.length-1; i >= 0; i--) {
         data[0].children[1].children.unshift(data[0].children[3].children[i])
      }
      data[0].children.splice(3, data[0].children.length - 3)
   }
   
   browser.bookmarks.getTree(function(tree){
      var folder = getRootFolder(tree)
      if (folder.id == 0) folder = folder.children[1]
      
      var count = 0
      
      var last_parent_id = 0
      var last_parent = data[0]
      
      processItem(data, 0, null, function() { callback(data) })
      
      function sortDirectory(parent) {
         if (mode == 0 && parent && parent.total_list && parent.ex_list) {
            if (parent.total_list.length > parent.ex_list.length) {
               parent.total_list = parent.total_list.sort(function(el1, el2) {
                  return el1.dateAdded - el2.dateAdded
               })
            }
            if (parent.id != 0 && parent.id != firefoxIds[0]) {
               for (var i = 0; i < parent.total_list.length; i++) {
                  browser.bookmarks.move(parent.total_list[i].id, { index: i })
               }
            }
            parent.ex_list = []
            parent.total_list = []
         }
      }
      
      function folderId(id) {
         if (isFirefox && id.toString().match(/^\d+$/)) {
            return firefoxIds[id]
         }
         if (!isFirefox && !id.toString().match(/^\d+$/)) {
            for (var key in firefoxIds) {
               if (firefoxIds[key] == id) {
                  return key
               }
            }
         }
         return id
      }

      function processItem(data, index, parent, parentFinish) {
         
         function onfinish(next) {
            if (index+1 >= data.length) {
               if (parent) sortDirectory(parent)
               if (parentFinish) parentFinish()
            } else {
               processItem(data, index+1, parent, parentFinish)
            }
         }
         
         if (data.length == 0) {
            onfinish()
            return
         }
         
         var parent_id = parent && folderId(parent.id) || folder.id
         
         data[index].path = parent && parent.path ? parent.path.concat(data[index].title) : []
         
         if (parent && !parent.ex_list) {
            parent.ex_list = []
            parent.total_list = []
            last_parent_id = parent_id
            browser.bookmarks.getChildren(parent_id, function(list) {
               if (browser.runtime.lastError || !list) {
                  console.log('Error getting children of node ' + parent.id)
                  onfinish()
                  return
               }
               for (var i = 0; i < list.length; i++) {
                  parent.ex_list.push(list[i])
                  parent.total_list.push(list[i])
               }
               processItem(data, index, parent, parentFinish)
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
         
         var skip = data[index].id == 0 || data[index].id == firefoxIds[0] ||
                    index < 3 && parent_id == 0 ||
                    index < 4 && parent_id == firefoxIds[0] ||
                    !data[index].title && !data[index].url || exists
         
         if (!skip) {
            browser.bookmarks.create(
               {
                  parentId: parent_id,
                  title: data[index].title,
                  url: data[index].url
               },
               function(bookmark) {
                  if (!bookmark) {
                     onfinish()
                     return
                  }
                  if (parent && parent.total_list) {
                     parent.total_list.push(bookmark)
                  }
                  // console.log(bookmark.url ? "Added bookmark: " + bookmark.url : "Added folder: " + bookmark.title);
                  data[index].id = bookmark.id
                  
                  if (data[index].children && data[index].children.length) {
                     processItem(data[index].children, 0, data[index], onfinish)
                  } else {
                     onfinish()
                  }
               }
            );
         }
         if (skip && data[index].children && data[index].children.length) {
            processItem(data[index].children, 0, data[index], onfinish)
         } else if (skip) {
            onfinish()
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

function normalizeFolders(root) {
   for (var i = 0; i < root.children.length; i++) {
      root.children[i].title = getDefaultNameById(root.children[i].id)
   }
   if (root.children.length > 3) {
      for (var i = 0; i < root.children.length; i++) {
         if (root.children[i].title == 'Bookmarks menu') {
            var el = root.children[i]
            el.children = el.children.filter(el => el.type == 'folder' || el.url && !el.url.match(/^(place|data):/))
            root.children.splice(i, 1)
            root.children.splice(3, 0, el)
            break
         }
      }
      root.children.splice(4, root.children.length - 4)
   }
}

function exportData(callback) {
   browser.bookmarks.getTree(function(result) {
      normalizeFolders(result[0])
      var default_id = result[0].children[1].id
      walkTree(result, null, function(element) {
         if (element.parentId === undefined) {
            element.parentId = default_id
         }
         delete element.path
      })
      callback(result)
   });
}

function saveSnapshot(callback) {
   browser.bookmarks.getTree(function(result) {
      var root = result[0]
      for (var i = 0; i < root.children.length; i++) {
         root.children[i].title = getDefaultNameById(root.children[i].id)
      }
      browser.storage.local.set({ snapshot: result }, function() {
         if (callback) callback(result)
      })
   });
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

async function compareWithSnapshot() {
   
   await createSnapshotIfNull()
   var { log, snapshot } = await checkForNewItems()
   
   return new Promise(function(resolve) {

      var map = {}
      
      setTimeout(function() {
         
         var outer = snapshot[0].children
         
         compareItem(snapshot[0], [], outer.slice()).then(() => resolve(log))
         
         function findIndexByURL(list, url, title) {
            for (var i = 0; i < list.length; i++) {
               if (url && list[i].url == url || !url && list[i].title == title) return i
            }
            return -1
         }
         
         async function compareItem(el, path, _list) {
            
            return new Promise(async function(resolve) {
            
               if (containsPath(ignoredFolders, path)) {
                  resolve()
                  return
               }
               
               if (el.children) {
                  var cl = el.children, _cl = el.children.slice()
                  for (var j = 0; j < cl.length; j++) {
                     var title = cl[j].title
                     if (isRootFolder(cl[j].parentId)) {
                        title = getDefaultNameByIndex(j)
                     }
                     await compareItem(cl[j], path.concat(title), _cl)
                  }
                  
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
               
               try {
                  browser.bookmarks.get(el.id, function(result) {
                     if (browser.runtime.lastError || result == null) {
                        var pos = findIndexByURL(_list, el.url, el.title)
                        _list.splice(pos, 1)
                        for (var j = pos; j < _list.length; j++) {
                           _list[j].index--
                        }
                        log.push({ action: 'delete', url: el.url, title: el.title, path: path });
                        
                        resolve()
                     } else {
                        if (!result[0].url && isRootFolder(result[0].parentId)) {
                           result[0].title = getDefaultNameById(result[0].id)
                        }
                        if (result[0].title != el.title) {
                           log.push({ action: 'modify', url: list[i].url, title: list[i].title, path: path, details: { title: result[0].title }})
                        }
                        if (result[0].url != el.url) {
                           log.push({ action: 'modify', url: list[i].url, path: path, details: { url: result[0].url }})
                        }
                        if (result[0].parentId != el.parentId) {
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
                              
                              var oldIndex = findIndexByURL(_list, el.url, el.title)
                              setBeforeAndAfter(_list, oldIndex, details)
                              log.splice(pos, 0, { action: 'modify', url: el.url, title: el.title, path: path, details: details })
                              
                              map[pathStr][1].push({ url: el.url, details });
                              
                              resolve()
                           })
                        }
                        else if (result[0].index != el.index) {
                           var pathStr = path.join('>')
                           if (!map[pathStr]) map[pathStr] = [[], []]
                           var details = { index: result[0].index }
                           
                           var oldIndex = findIndexByURL(_list, el.url, el.title)
                           setBeforeAndAfter(_list, oldIndex, details)
                           //log.push({ action: 'modify', url: list[i].url, title: list[i].title, path: path, details: details })
                           
                           if (details.index > oldIndex) {
                              map[pathStr][1].push({ url: el.url, title: el.title, details })
                           } else if (details.index < oldIndex) {
                              map[pathStr][0].push({ url: el.url, title: el.title, details })
                           }
                           resolve()
                        } else {
                           resolve()
                        }
                     }
                  })
               } catch (e) {
                  console.log(e)
               }
            })
         }
      }, 50)
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
   if (!list) return false
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
   
      var log = []
      
      browser.bookmarks.getTree(function(tree){
         browser.storage.local.get(['snapshot'], function(res) {
            var snapshot = res.snapshot
            
            walkTree(tree[0].children, tree[0], function(element) {
               if (element.url && element.url.match(/^(place|data):/)) {
                  return
               }
               getFullPath(element.parentId, tree).then(path => {
                  if (ignoredFolders && containsPath(ignoredFolders, path)) {
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
               })
            }, function() {
               setTimeout(function() {
                  resolve({ log, snapshot })
               }, 100)
            })
         })
      })
   })
}

function walkTree(list, parent, callback, onfinish) {
   for (var i = 0; i < list.length; i++) {
      list[i].path = parent && parent.path ? parent.path.concat(list[i].title) : []
      if (ignoredFolders && containsPath(ignoredFolders, list[i].path)) {
         return
      }
      if (callback && list[i].parentId && list[i].parentId != '0') callback(list[i])
      if (list[i].children) {
         walkTree(list[i].children, list[i], callback, onfinish)
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
            resolve(getFullPath(result[0].parentId).then(res => { pathCache[parentId] = res.concat(result[0].title); return pathCache[parentId] }))
         }
      })
   })
}


var changesToSend = []
var syncing = false

async function sync() {
   if (!accessToken || !profileId || !ignoredFolders || syncing) return Promise.reject()
   var _last = lastSync
   syncing = true
   pathCache = {}
   try {
      var changesToSend = await compareWithSnapshot()
      await applyRemoteUpdates()
      lastSync = Date.now() + 1000
      await sendUpdates(changesToSend)
      saveSnapshot()
      browser.storage.local.set({ last_sync: lastSync })
      syncing = false
      return Promise.resolve()
   } catch (e) {
      lastSync = _last
      syncing = false
      return Promise.reject()
   }
}

async function applyRemoteUpdates() {
   try {
      var response = await fetch(origin + '/' + profileId + '/check?since=' + lastSync, {
         method: 'GET',
         headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer: ' + accessToken
         }
      })
      response = await response.json()
      if (response.error) {
         return Promise.reject()
      }
      folderCache = {}
      for (var i = 0; i < response.data.length; i++) {
         await executeCommand(response.data[i])
      }
      if (response.timestamp) {
         lastSync = +response.timestamp || Date.now() + 1000
      }
      return Promise.resolve()
   } catch(e) {
      console.log(e)
      return Promise.reject()
   }
}

async function sendUpdates(log) {
   return fetch(origin + '/' + profileId + '/update', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer: ' + accessToken
		},
      body: JSON.stringify(log)
	})
}

async function executeCommand(data) {
   if (containsPath(ignoredFolders, data.path)) {
      return
   }
   if (!isFirefox && data.path[0] == 'Bookmarks menu') {
      data.path[0] = 'Other bookmarks'
      if (data.details && data.details.path && data.details.path[0] == 'Bookmarks menu') {
         data.details.path[0] = 'Other bookmarks'
      }
   }
   switch (data.action) {
      case 'add':
         await executeAddBookmark(data)
         break
      case 'modify':
         await executeModifyBookmark(data)
         break
      case 'delete':
         await executeDeleteBookmark(data)
         break
   }
}

async function executeAddBookmark(data) {
   var folder = await findFolderByPath(data.path)
   if (!folder) folder = { id: 2 }
   if (data.details.index < 0) {
      data.details.index = 0
   }
   if (data.details.index > folder.children.length) {
      data.details.index = folder.children.length
   }
   if (folder.children.find(el => (el.title == data.details.title && el.url == data.url))) {
      return Promise.resolve()
   }
   return new Promise(function (resolve, reject) {
      browser.bookmarks.create(
         {
            parentId: folder.id,
            title: data.details.title,
            url: data.url,
            index: folder.children.length
         },
         function(bookmark) {
            console.log("Added remote bookmark: " + bookmark.url);
            resolve()
         }
      );
   });
}

async function executeModifyBookmark(data) {
   var item = await findBookmarkByPath(data.path, data.url, data.title)
   if (!item) return Promise.resolve()
   if (data.details.index !== undefined || data.details.path) {
      var details = {}
      if (data.details.index !== undefined) {
         details.index = data.details.index
         delete data.details.index
      }
      return new Promise(async function (resolve, reject) {
         if (data.details.path) {
            var folder = await findFolderByPath(data.details.path)
            
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
                     resolve()
                  }
               );
            });
         } else {
            browser.bookmarks.getSubTree(item.parentId, function(parent) {
               calculateIndex(data, item.index, parent[0], details)
               browser.bookmarks.move(
                  item.id,
                  details,
                  function(bookmark) {
                     console.log("Moved remote bookmark: " + bookmark.url);
                     resolve()
                  }
               );
            });
         }
         if (data.details.url || data.details.title) {
            browser.bookmarks.update(
               item.id,
               data.details,
               function(bookmark) {
                  console.log("Modified remote bookmark: " + bookmark.url);
                  resolve()
               }
            );
         }
      });
   }
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

async function executeDeleteBookmark(data) {
   var item = await findBookmarkByPath(data.path, data.url, data.title)
   if (!item) return Promise.resolve()

   return new Promise(function (resolve, reject) {
      if (!item.children) {
         browser.bookmarks.remove(
            item.id,
            function(bookmark) {
               console.log("Deleted remote bookmark: " + item.url);
               resolve()
            }
         );
      } else {
         browser.bookmarks.removeTree(
            item.id,
            function(folder) {
               console.log("Deleted remote folder: " + item.title);
               resolve()
            }
         );
      }
   });
}

function findFolderByPath(path) {
   if (folderCache[path.join('>')]) {
      return Promise.resolve(folderCache[path.join('>')])
   }
   return new Promise(function(resolve) {
      browser.bookmarks.getTree(function(tree){
         var folder = getRootFolder(tree)
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

async function findBookmarkByPath(path, url, title) {
   return (function(path) {
      return new Promise(function(resolve) {
         browser.bookmarks.getTree(function(tree){
            var folder = getRootFolder(tree)
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
