window.addEventListener("DOMContentLoaded", function() {
   
   
   var browser = window.browser || window.chrome
   var extension = window.browser && window.browser.runtime || chrome.extension
   
   var otherBookmarks = 0;
   chrome.bookmarks.getTree(function(tree){
      otherBookmarks = tree[0].children[1];
   });
   
   var profilesList = document.getElementById('profilesList')
   
   profilesList.addEventListener('mouseenter', function(event) {
      if (event.offsetY > this.children[0].clientHeight) return
      this.children[1].style.display = 'block'
      this.children[1].style.visibility = 'visible'
      this.children[1].classList.add('visible')
      var self = this
      setTimeout(function() { XScroll.updateThumbPosition(self.children[1]) }, 30)
   })
   
   profilesList.addEventListener('mousemove', function(event) {
      if (event.offsetY < this.children[0].clientHeight && this.children[1].style.visibility != 'visible') {
         this.children[1].style.display = 'block'
         this.children[1].style.visibility = 'visible'
         this.children[1].classList.add('visible')
         var self = this
         setTimeout(function() { XScroll.updateThumbPosition(self.children[1]) }, 30)
      }
   })
   
   profilesList.addEventListener('mouseleave', function() {
      this.children[1].classList.remove('visible')
   })
   
   profilesList.children[1].addEventListener('click', function() {
      this.classList.remove('visible')
   })
   
   profilesList.children[0].addEventListener('click', function() {
      if (!this.parentNode.children[1].classList.contains('visible')) {
         this.parentNode.children[1].style.display = 'block'
         this.parentNode.children[1].style.visibility = 'visible'
      }
      this.parentNode.children[1].classList.toggle('visible')
   })
   
   profilesList.children[1].addEventListener('transitionend', function() {
      if (!this.classList.contains('visible')) {
         this.style.visibility = 'hidden'
         var self = this
         setTimeout(function () { self.style.display = 'none' }, 10)
      }
   })
   
   var profiles = []
   var activeProfile = null
   
   extension.sendMessage({ operation: 'getProfiles' }, function(result) {
      if (result && result.data) {
         profiles = result.data
         delete localStorage.lastConnectionError
      }
      if (result === null || result && result.error) {
         localStorage.lastConnectionError = Date.now()
      }
   })
   
   browser.storage.local.get(['profile_id'], function(result) {
      activeProfile = result.profile_id
   })
   
   function reloadProfiles() {
      extension.sendMessage({ operation: 'getProfiles' }, function(result) {
         if (result && result.data) {
            profiles = result.data
            delete localStorage.lastConnectionError
            loadProfiles()
         }
         if (result === null || result && result.error) {
            localStorage.lastConnectionError = Date.now()
         }
      })
   }
   
   function loadProfiles() {
      var list = document.getElementById('profilesList').children[1]
      list.innerHTML = ''
      var offset = new Date().getTimezoneOffset() * 60 * 1000
      profiles.forEach(function(profile) {
         var el = document.createElement('div')
         el.className = 'item profile'
         el.setAttribute('data-id', profile.id)
         var time = new Date(+(new Date(profile.createdAt))-offset).toUTCString()
         time = time.split(' ').slice(1, -1).join(' ')
         el.innerHTML = '<div class="title">' + profile.name + '</div><div class="created_at">Created at ' + time + '</div>'
         list.appendChild(el)
      })
      setTimeout(function() {
         initProfilesList()
      }, 0)
   }
   
   function initProfilesList() {
      var list = document.getElementById('profilesList')
      if (list.children[1].children.length == 0) return
      var st0 = getComputedStyle(list.children[1], '')
      var st = getComputedStyle(list.children[1].children[0], '')
      list.children[1].style.height = ''
      var contentHeight = list.children[1].children.length * list.children[1].children[0].clientHeight
      if (contentHeight != parseInt(st0.minHeight) || contentHeight < parseInt(st0.maxHeight)) {
         setTimeout(function() {
            var c = list.children[1].children[0].classList.contains('item') ? list.children[1] : list.children[1].children[0]
            list.children[1].style.height = Math.ceil(c.children.length * Math.max(44, c.children[0].clientHeight)) + parseFloat(st0.paddingTop) + parseFloat(st0.paddingBottom) +
                                             Math.round(parseFloat(st0.borderTopWidth)) + Math.round(parseFloat(st0.borderBottomWidth)) + 'px'
            if (c != list.children[1]) {
               c.style.width = '100%'
               c.style.height = '100%'
               
               setTimeout(function() {
                  XScroll.scrollToY(list.children[1], 0)
                  c.style.width = ''
                  c.style.height = ''
                  list.children[1].style.visibility = ''
                  list.children[1].style.display = 'none'
               }, 10)
            }
         }, 500)
      }
      list.children[0].innerHTML = ''
      var el = document.createElement('div')
      el.className = 'profile'
      el.innerHTML = list.children[1].children[0].innerHTML
      list.children[0].appendChild(el)
      
      for (var i = 0; i < list.children[1].children.length; i++) {
         list.children[1].children[i].onclick = function() {
            var list = document.getElementById('profilesList')
            list.children[0].children[0].innerHTML = this.innerHTML
            if (this.getAttribute('data-id')) {
               list.setAttribute('data-value', this.getAttribute('data-id'))
               loadFolderTree(this.getAttribute('data-id'))
               profile_id = this.getAttribute('data-id')
               
               document.getElementById('currentProfileTooltip').classList.toggle('hidden', profile_id != activeProfile)
               document.getElementById('deleteButton').classList.toggle('disabled', profile_id == activeProfile)
            }
         }
      }
      
      if (list.children.length && list.children[1].children[0].getAttribute('data-id') != '') {
         list.children[1].children[0].onclick()
      }
      
      XScroll.init(list.children[1], true)
   }
   
   function loadFolderTree(profile_id) {
      extension.sendMessage({ operation: 'getFolderTree', data: { profileId: profile_id }}, function(result) {
         if (!result || result.error) return
         renderFolderTree(result)
      })
   }
   
   function loadFolderContent(path) {
      extension.sendMessage({ operation: 'getFolderItems', data: { profileId: profile_id, path: path,  }}, function(result) {
         if (!result || result.error) return
         renderFolderContent(result, path)
      })
   }
   
   function renderFolderTree(data) {
      
      function processItem(item, container) {
         var el = document.createElement('div')
         el.classList.add('folder')
         
         var title = document.createElement('div')
         title.classList.add('title')
         var span = document.createElement('span')
         span.textContent = item.title
         title.appendChild(span)
         
         el.appendChild(title)
         
         if (item.children) {
            var c = document.createElement('div')
            c.classList.add('items')
            item.children.forEach(function(child) {
               processItem(child, c)
            })
            el.appendChild(c)
         }
         el.path = item.path
         el.onclick = function(event) {
            loadFolderContent(this.path)
            selectFoldersWithPath(this.path)
            event.stopPropagation()
         }
         
         container.appendChild(el)
      }
      
      document.querySelector('#folderTree').innerHTML = ''
      
      data.forEach(function(el) {
         processItem(el, document.querySelector('#folderTree'))
      })
      
      XScroll.init(document.querySelector('#folderTree'), true)
   }
   
   function renderFolderContent(data, path) {
      
      function processItem(item, container) {
         var el = document.createElement('div')
         el.classList.add('folder')
         
         var title = document.createElement('div')
         title.classList.add('title')
         var span = document.createElement('span')
         span.textContent = item.title
         title.appendChild(span)
         
         el.appendChild(title)
         el.path = item.url || item.title != '..' ? [...path, item.title] : path.slice(0, -1)
         
         if (item.url) el.setAttribute('data-url', item.url)
         el.setAttribute('title', item.title)
         
         el.classList.toggle('folder', item.title != '..' && !item.url)
         el.classList.toggle('item', item.title != '..' && !!item.url)
         el.classList.toggle('parent', item.title == '..' && !item.url)
         
         el.onclick = function() {
            if (el.getAttribute('data-url')) {
               window.open(el.getAttribute('data-url'))
            }
         }
         
         el.ondblclick = function() {
            loadFolderContent(this.path)
            selectFoldersWithPath(this.path)
         }
         
         container.appendChild(el)
      }
      
      document.querySelector('#folderContent').innerHTML = ''
      
      if (path.length) {
         processItem({ url: null, title: '..' }, document.querySelector('#folderContent'))
      }
      
      data.forEach(function(el) {
         processItem(el, document.querySelector('#folderContent'))
      })
      
      XScroll.init(document.querySelector('#folderContent'), true)
   }
   
   function selectFoldersWithPath(path) {
      var items = document.querySelectorAll('#folderTree .folder')
      Array.prototype.forEach.call(items, function(el) {
         el.classList.toggle('selected', JSON.stringify(el.path) == JSON.stringify(path))
      })
   }
   
   var profile_id = null
   
   document.getElementById('renameButton').onclick = function() {
      if (this.classList.contains('disabled')) return
      var list = document.getElementById('profilesList')
      var input = document.getElementById('profileEditName')
      input.value = list.children[0].children[0].children[0].textContent
      setTimeout(function() { input.focus() }, 50)
      document.getElementById('renameProfileDialog').classList.remove('hidden')
      document.getElementById('deleteProfileDialog').classList.add('hidden')
      document.getElementById('modal_layer').classList.remove('hidden')
   }
   
   document.getElementById('deleteButton').onclick = function() {
      if (this.classList.contains('disabled')) return
      document.getElementById('renameProfileDialog').classList.add('hidden')
      document.getElementById('deleteProfileDialog').classList.remove('hidden')
      document.getElementById('modal_layer').classList.remove('hidden')
   }

   document.getElementById('profileEditName').onkeydown = function(e) {
      if (e.key == 'Enter') {
         document.getElementById('nameEditBtn').click()
      }
   }
   
   document.getElementById('nameEditBtn').onclick = function() {
      var input = document.getElementById('profileEditName')
      extension.sendMessage({ operation: 'renameProfile', data: { profileId: profile_id, value: input.value } }, function(result) {
         reloadProfiles()
      })
      document.getElementById('modal_layer').classList.add('hidden')
   }
   
   document.getElementById('renameCancelButton').onclick = function() {
      document.getElementById('modal_layer').classList.add('hidden')
   }
   
   document.getElementById('deleteConfirmButton').onclick = function() {
      extension.sendMessage({ operation: 'deleteProfile', data: { profileId: profile_id } }, function(result) {
         reloadProfiles()
      })
      document.getElementById('modal_layer').classList.add('hidden')
   }
   
   document.getElementById('deleteCancelButton').onclick = function() {
      document.getElementById('modal_layer').classList.add('hidden')
   }
   
   /*
   document.getElementById('logoutLink').onclick = function() {
      extension.sendMessage({ operation: 'logout' }, function(result) {
         if (result) {
            document.getElementById('loginScreen').classList.remove('hidden')
            document.getElementById('startScreen').classList.add('hidden')
            document.getElementById('selectFoldersScreen').classList.add('hidden')
            document.getElementById('mainScreen').classList.add('hidden')
            document.getElementById('errorScreen').classList.add('hidden')
            document.getElementById('logout').classList.add('hidden')
         }
      })
   }
   */
   
   document.getElementById('sync_enabled').checked = !(localStorage.syncEnabled === 'false')
   var interval = parseInt(Math.floor(parseInt(localStorage.syncInterval) / 60000))
   document.getElementById('sync_interval').value = !isNaN(interval) ? interval : 5
   
   Array.prototype.forEach.call(document.getElementById('navigation').children, function(el) {
      if (localStorage.accessToken != 'null' && (localStorage.profileId != 'null' || el.getAttribute('data-id') != '2')) {
         el.classList.remove('disabled')
         el.removeAttribute('title')
      } else {
         if (el.classList.contains('disabled')) {
            var title = localStorage.accessToken == 'null' ? 'You need to authorize first' : 'You need to select profile first'
            el.setAttribute('title', title)
         }
      }
   })

   var items = document.getElementById('navigation').children
   
   for (var i = 0; i < items.length; i++) {
      items[i].onclick = function() {
         if (this.classList.contains('disabled')) return
         var items = document.getElementById('navigation').children
         for (var i = 0; i < items.length; i++) {
            items[i].classList.remove('active')
         }
         this.classList.add('active')
         
         var id = this.getAttribute('data-id')
         if (id != '') {
            var error = false
            var blocks = document.getElementById('content').children
            for (var i = 0; i < blocks.length; i++) {
               if (blocks[i].id == 'errorScreen') continue
               
               if (blocks[i].getAttribute('data-id') == id) {
                  if (id == '3' && localStorage.lastConnectionError && Date.now() - parseInt(localStorage.lastConnectionError) < 10000) {
                     // Show error
                     blocks[i].style.display = 'none'
                     error = true
                     continue
                  } else if (id == '3' && localStorage.lastConnectionError) {
                     // Retry to connect
                     var self = this
                     document.getElementById('loaderWrap').classList.remove('hidden')
                     setTimeout(function() {
                        extension.sendMessage({ operation: 'getProfiles' }, function(result) {
                           if (result && result.data) {
                              profiles = result.data
                              delete localStorage.lastConnectionError
                           }
                           if (result === null || result && result.error) {
                              localStorage.lastConnectionError = Date.now()
                           }
                           document.getElementById('loaderWrap').classList.add('hidden')
                           self.click()
                        })
                     }, 50)
                     return
                  }
                  
                  if (id == '3' && !blocks[i].ready) {
                     loadProfiles()
                     blocks[i].ready = true
                  }
                  blocks[i].style.display = ''
               } else {
                  blocks[i].style.display = 'none'
               }
            }
            
            document.getElementById('errorScreen').classList.toggle('hidden', !error)
            
            setTimeout(function() {
               var els = document.querySelectorAll('.scrollable')
               Array.prototype.forEach.call(els, function(el) {
                  if (!el.configured) return
                  XScroll.updateThumbPosition(el)
               })
            }, 30)
         }
      }
   }
   
   document.getElementById('sync_enabled').checked = localStorage.syncEnabled !== 'false'
   var interval = parseInt(Math.floor(parseInt(localStorage.syncInterval) / 60000))
   document.getElementById('sync_interval').value = !isNaN(interval) ? interval : 5
   
   document.getElementById('sync_enabled').onchange = function() {
      extension.sendMessage({ operation: 'setParameter', data: { name: 'sync_enabled', value: this.checked } })
   }
   
   document.getElementById('sync_interval').onchange = function() {
      extension.sendMessage({ operation: 'setParameter', data: { name: 'sync_interval', value: this.value } })
   }
   
   function updateNavigation(result) {
      var el = document.querySelector('#navigation > [data-id="2"]')
      if (result.history) {
         el.classList.remove('disabled')
         el.removeAttribute('title')
      } else {
         if (el.classList.contains('disabled')) {
            var title = result.error && result.error.toLowerCase() == 'unauthorized' ? 'You need to authorize first' : 'You need to select profile first'
            el.setAttribute('title', title)
         }
      }
   }
   
   function hideItem(item) {
      item.addEventListener('transitionend', function() {
         setTimeout(function() {
            item.style.display = 'none'
            var parent = item.parentNode
            parent.removeChild(item)
            if (!parent.children.length) {
               parent.innerHTML = '<div style="font-style: italic">Nothing found</div>'
            }
         }, 150)
      })
      item.style.opacity = '0'
   }
   
   if (!document.querySelector('#navigation > [data-id="2"]').classList.contains('disabled')) {
      loadRemoveHistory()
   }
   
   function loadRemoveHistory() {
      extension.sendMessage({ operation: 'getRemoveHistory' }, function(result) {
         if (result) updateNavigation(result)
         if (result && result.history && result.history.length) {
            var list = document.getElementById('remove_history')
            list.innerHTML = ''
            result.history.forEach(el => {
               var item = document.createElement('div')
               item.className = 'item'
               item.data = el
               var title = document.createElement('span')
               title.className = 'title'
               title.textContent = el.details.title
               item.appendChild(title)
               
               var urlWrap = document.createElement('span')
               item.appendChild(urlWrap)
               
               var url = document.createElement('a')
               url.className = 'link'
               url.target = '_blank'
               url.href = el.url
               url.textContent = el.url
               urlWrap.appendChild(url)
               item.appendChild(urlWrap)
               
               
               var restoreWrap = document.createElement('span')
               item.appendChild(restoreWrap)
               
               var link = document.createElement('span')
               link.className = 'link restore'
               link.textContent = 'Restore'
               restoreWrap.appendChild(link)
               
               list.appendChild(item)
            })
            list.addEventListener('click', function(event) {
               if (event.target.classList.contains('restore')) {
                  var item = event.target.parentNode
                  while (item && item.parentNode.id != 'remove_history') {
                     item = item.parentNode
                  }
                  extension.sendMessage({ operation: 'restoreBookmark', data: item.data }, function(result) {
                     hideItem(item)
                  })
               }
            })
            XScroll.init(list)
         }
      })
   }
   
})
