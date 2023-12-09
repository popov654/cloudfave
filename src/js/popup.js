window.addEventListener("DOMContentLoaded", function() {
   
   var extension = window.browser && window.browser.runtime || chrome.extension
   var browser = window.browser || window.chrome
   
   var isFirefox = browser.runtime.getURL('').match(/^moz-/)
   
   if (isFirefox && !browser.storage.local._get) {
      browser.storage.local._get = browser.storage.local.get
      browser.storage.local.get = function(params, callback) {
         browser.storage.local._get(params).then(callback, (err) => console.log(err))
      }
      browser.storage.local._set = browser.storage.local.set
      browser.storage.local.set = function(obj, callback) {
         browser.storage.local._set(obj).then(callback, (err) => console.log(err))
      }
   }
   
   var otherBookmarks = 0;
   chrome.bookmarks.getTree(function(tree){
      otherBookmarks = tree[0].children[1];
   });
   
   var loginForm = document.getElementById('loginForm')
   loginForm.getElementsByTagName('button')[0].classList.add('disabled')
   document.getElementById('registerLink').classList.add('disabled')
   loginForm.getElementsByTagName('input')[0].oninput = 
   loginForm.getElementsByTagName('input')[1].oninput = function() {
      var username = loginForm.getElementsByTagName('input')[0].value
      var password = loginForm.getElementsByTagName('input')[1].value
      var btn = loginForm.getElementsByTagName('button')[0]
      var link = document.getElementById('registerLink')
      btn.classList.toggle('disabled', !username.length || !password.length)
      link.classList.toggle('disabled', !username.length || !password.length)
   }
   loginForm.onsubmit = function(event) {
      var username = loginForm.getElementsByTagName('input')[0].value
      var password = loginForm.getElementsByTagName('input')[1].value
      event.preventDefault()
      
      if (!username.length || !password.length) {
         return
      }
      
      var btn = loginForm.getElementsByTagName('button')[0]
      btn.classList.add('disabled')
      hideError()
      getElementsByClass('loader', document.body, 'div')[0].style.display = 'block'
      
      browser.runtime.sendMessage({ operation: 'authorize', data: { username, password } }, function(result) {
         getElementsByClass('loader', document.body, 'div')[0].style.display = 'none'
         if (result === null || result && result.status == 500) {
            document.getElementById('loginScreen').classList.add('hidden')
            setTimeout(function() {
               document.getElementById('errorScreen').classList.remove('hidden')
            }, 200)
         } else if (result && result.status >= 400 && result.status < 500) {
            btn.classList.remove('disabled')
            showError('Invalid username or password')
         } else if (result && result.status == 200) {
            hideError()
            document.getElementById('loginScreen').classList.add('hidden')
            browser.runtime.sendMessage({ operation: 'getProfiles' }, function(result) {
               if (result && result.data) {
                  document.getElementById('startScreen').classList.remove('hidden')
                  document.getElementById('logout').classList.remove('hidden')
                  setTimeout(function() { loadProfiles(result.data) }, 20)
               }
               if (result && result.error) {
                  browser.storage.local.set({ access_token: null, profile_id: null })
               }
            })
            setTimeout(function() {
               document.getElementById('startScreen').classList.remove('hidden')
            }, 300)
         }
      })
      
      return false
   }
   
   function showError(msg) {
      document.getElementById('loginError').textContent = msg
      document.getElementById('loginError').classList.add('visible')
   }
   
   function hideError() {
      document.getElementById('loginError').classList.remove('visible')
   }
   
   var profilesList = document.getElementById('profilesList')
   
   document.getElementById('newProfileName').onfocus = function() {
      this.parentNode.parentNode.previousElementSibling.checked = true
   }
   
   profilesList.addEventListener('mouseenter', function(event) {
      if (!document.getElementById('selectExistingProfile').checked) return
      if (event.offsetY > this.children[0].clientHeight) return
      this.children[1].style.visibility = 'visible'
      this.children[1].classList.add('visible')
   })
   
   profilesList.addEventListener('mousemove', function(event) {
      if (!document.getElementById('selectExistingProfile').checked) return
      if (event.offsetY < this.children[0].clientHeight && this.children[1].style.visibility != 'visible') {
         this.children[1].style.visibility = 'visible'
         this.children[1].classList.add('visible')
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
         this.parentNode.children[1].style.visibility = 'visible'
      }
      this.parentNode.children[1].classList.toggle('visible')
   })
   
   profilesList.children[1].addEventListener('transitionend', function() {
      if (!this.classList.contains('visible')) {
         this.style.visibility = 'hidden'
      }
   })
   
   function loadProfiles(profiles) {
      console.log(profiles)
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
         performChecks(profiles)
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
            list.children[1].style.height = Math.ceil(c.children.length * c.children[0].clientHeight) + parseFloat(st0.paddingTop) + parseFloat(st0.paddingBottom) +
                                             Math.round(parseFloat(st0.borderTopWidth)) + Math.round(parseFloat(st0.borderBottomWidth)) + 'px'
            XScroll.scrollToY(list.children[1], 0)
         }, 800)
      }
      list.children[0].innerHTML = ''
      var el = document.createElement('div')
      el.className = 'profile'
      el.innerHTML = list.children[1].children[0].innerHTML
      list.children[0].appendChild(el)
      if (list.children[1].children[0].getAttribute('data-id')) {
         list.setAttribute('data-value', list.children[1].children[0].getAttribute('data-id'))
      }
      
      for (var i = 0; i < list.children[1].children.length; i++) {
         list.children[1].children[i].onclick = function() {
            var list = document.getElementById('profilesList')
            list.children[0].children[0].innerHTML = this.innerHTML
            if (this.getAttribute('data-id')) {
               list.setAttribute('data-value', this.getAttribute('data-id'))
            }
         }
      }
      XScroll.init(list.children[1], true)
   }
   
   function performChecks(profiles) {
      var maxProfiles = 5
      if (profiles.length == 0) {
         var offset = document.getElementById('createNewProfile').clientWidth
         document.getElementById('selectExistingProfile').disabled = true
         document.getElementById('createNewProfile').style.visibility = 'hidden'
         document.getElementById('createNewProfile').nextElementSibling.style.marginLeft = -(offset + 5) + 'px'
         document.getElementById('selectExistingProfile').parentNode.style.display = 'none'
      } else if (profiles.length >= maxProfiles) {
         var offset = document.getElementById('selectExistingProfile').clientWidth
         document.getElementById('createNewProfile').disabled = true
         document.getElementById('selectExistingProfile').checked = true
         document.getElementById('selectExistingProfile').style.visibility = 'hidden'
         document.getElementById('selectExistingProfile').nextElementSibling.style.marginLeft = -(offset + 5) + 'px'
         document.getElementById('createNewProfile').parentNode.style.display = 'none'
      } else {
         document.getElementById('selectExistingProfile').disabled = false
         document.getElementById('createNewProfile').disabled = false
         document.getElementById('selectExistingProfile').style.visibility = ''
         document.getElementById('createNewProfile').style.visibility = ''
         document.getElementById('createNewProfile').nextElementSibling.style.marginLeft = ''
         document.getElementById('selectExistingProfile').parentNode.style.display = ''
      }
   }
   
   var usernameField = document.getElementById('username')
   var passwordField = document.getElementById('password')
   
   function convertToLatin(e) {
      if (e.ctrlKey || e.key && e.key.match(/^Shift|Alt|Control|Backspace|Delete|Tab|Space|Enter$/)) return
      var start = this.selectionStart
      var end = this.selectionEnd
      var code = e.keyCode >= 188 ? e.keyCode - 144 : e.keyCode
      var ch = String.fromCharCode(code).toLowerCase()
      if (e.shiftKey) {
         switch (ch) {
            case '1':
               ch = '!'
               break
            case '2':
               ch = '@'
               break
            case '3':
               ch = '#'
               break
            case '4':
               ch = '$'
               break
            case '5':
               ch = '%'
               break
            case '6':
               ch = '^'
               break
            case '7':
               ch = '&'
               break
            case '8':
               ch = '*'
               break
            case '9':
               ch = '('
               break
            case '0':
               ch = ')'
               break
            case '-':
               ch = '_'
               break
            default:
               ch = ch.match(/^[a-z]$/) ? ch.toUpperCase() : ''
               break
         }
      }
      this.value = this.value.slice(0, start) + ch + this.value.slice(end)
      e.preventDefault()
      fireEvent(this, 'input')
   }
   
   function fireEvent(element, type) {
      var event
      var w = window
      if ('$' in w && w.$.trigger && w.$.trigger instanceof Function) {
         w['$'](element).trigger(type)
         return
      }
      if (type == 'click' && element.click) {
         element.click()
         return
      }
      var document = w.document
      if (document.createEvent){
         event = document.createEvent("HTMLEvents")
         event.initEvent(type, true, true)
         event.eventName = type
         element.dispatchEvent(event)
      } else {
         event = document.createEventObject()
         event.eventName = type
         event.eventType = type
         element.fireEvent("on" + event.eventType, event)
      }
   }
   
   usernameField.addEventListener('keydown', convertToLatin)
   usernameField.addEventListener('input', filterEmail)
   passwordField.addEventListener('keydown', convertToLatin)
   
   document.getElementById('passToggle').onclick = function() {
      var visible = passwordField.type != 'password'
      if (visible) {
         passwordField.type = 'password'
         this.classList.remove('visible')
      } else {
         passwordField.type = 'text'
         this.classList.add('visible')
      }
   }
   
   
   var profileNameField = document.getElementById('newProfileName')
   
   function checkProfileName() {
      var title = profileNameField.value
      document.getElementById('nextButton').classList.toggle('disabled', title.trim().match(/^\s*$/))
   }
   
   function filterEmail() {
      this.value = this.value.replace(/[^a-z0-9@._-]/g, '').replace(/^[@_.-]+/, '')
   }
   
   profileNameField.addEventListener('focus', checkProfileName)
   profileNameField.addEventListener('input', checkProfileName)
   
   document.getElementById('selectExistingProfile').nextElementSibling.lastElementChild.style.visibility = 'hidden'
   
   document.getElementById('createNewProfile').onchange = 
   document.getElementById('selectExistingProfile').onchange = function() {
      var el = document.getElementById('selectExistingProfile')
      el.nextElementSibling.lastElementChild.style.visibility = el.checked ? '' : 'hidden'
   }
   
   document.getElementById('nextButton').onclick = function() {
      if (this.classList.contains('disabled')) return
      var loader = getElementsByClass('loader', document.body, 'div')[0]
      if (document.getElementById('createNewProfile').checked) {
         loader.style.position = 'relative'
         loader.style.top = '-80px'
         var title = profileNameField.value
         if (title.trim().match(/^\s*$/)) return
         document.getElementById('nextButton').classList.add('disabled')
         browser.runtime.sendMessage({ operation: 'createProfile', name: title }, function(result) {
            loader.style.display = 'none'
            if (result) {
               setProfileId(result)
            } else {
               document.getElementById('startScreen').classList.add('hidden')
               document.getElementById('errorScreen').classList.remove('hidden')
            }
         })
      } else {
         var id = document.getElementById('profilesList').getAttribute('data-value')
         setProfileId(id)
      }
   }
   
   function setProfileId(id) {
      var operation = document.getElementById('createNewProfile').checked ? 'setProfileId' : 'loadProfile'
      var data = { id }
      if (operation == 'loadProfile') {
         data.merge = !!document.getElementById('mergeExistingData') && document.getElementById('mergeExistingData').checked
      }
      browser.runtime.sendMessage({ operation, data }, function(result) {
         if (!result) return
         setProfileName(result.name)
         document.getElementById('startScreen').classList.add('hidden')
         setTimeout(function() {
            document.getElementById('selectFoldersScreen').classList.remove('hidden')
            initUI(2)
         }, 300)
      })
   }
   
   document.getElementById('folderTree').onclick = function(event) {
      var el = event.target
      while (el != null) {
         if (el.classList && el.classList.contains('title') && event.target.tagName != 'INPUT') {
            el.parentNode.getElementsByTagName('input')[0].click()
            el.parentNode.classList.toggle('checked')
            break
         }
         el = el.parentNode
      }
   }
   
   function toggleFolders(value) {
      Array.prototype.forEach.call(document.querySelectorAll('#folderTree input'), function(el) {
         el.checked = value
         el.parentNode.classList.toggle('checked', value)
      })
   }
   
   var links = document.querySelectorAll('#selectFoldersScreen .extra_links > span')
   links[0].onclick = () => toggleFolders(true)
   links[1].onclick = () => toggleFolders(false)
   
   document.getElementById('nextButton2').onclick = function() {
      var folders = []
      Array.prototype.forEach.call(document.querySelectorAll('#folderTree input'), function(el) {
         if (!el.checked) {
            folders.push(el.parentNode.parentNode.path)
         }
      })
      browser.runtime.sendMessage({ operation: 'setIgnoredFolders', data: folders }, function() {
         document.getElementById('selectFoldersScreen').classList.add('hidden')
         browser.runtime.sendMessage({ operation: 'getProfileName' }, function(result) {
            if (result && result.name) {
               setProfileName(result.name)
               updateLastSyncTime()
               document.getElementById('errorScreen').classList.add('hidden')
               document.getElementById('mainScreen').classList.remove('hidden')
               document.getElementById('logout').classList.remove('hidden')
            } else if (result && result.error) {
               localStorage.lastConnectionError = Date.now()
               document.getElementById('selectFoldersScreen').classList.add('hidden')
               document.getElementById('logout').classList.add('hidden')
               setTimeout(function() {
                  document.getElementById('errorScreen').classList.remove('hidden')
               }, 300)
            }
         })
      })
   }
   
   function walkTree(list, callback, data) {
      for (var i = 0; i < list.length; i++) {
         if (list[i].parentId && list[i].parentId != '0') {
            callback(list[i], data)
         }
         if (list[i].children) {
            walkTree(list[i].children, callback, data)
         }
      }
   }
   
   function loadFolderTree(data) {
      
      function processItem(item, container) {
         var el = document.createElement('div')
         el.classList.add('folder')
         
         var title = document.createElement('div')
         title.classList.add('title')
         var span = document.createElement('span')
         span.textContent = item.title
         var cbx = document.createElement('input')
         cbx.type = 'checkbox'
         title.appendChild(cbx)
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
         
         container.appendChild(el)
      }
      
      data.forEach(function(el) {
         processItem(el, document.querySelector('#folderTree'))
      })
      
      toggleFolders(true)
      
      XScroll.init(document.querySelector('#folderTree'), true)
   }
   
   document.getElementById('profileEditName').onkeydown = function(e) {
      if (e.key == 'Enter') {
         document.getElementById('nameEditBtn').click()
      }
   }
   
   document.getElementById('profileEditName').onblur = function() {
      var self = this
      setTimeout(function() {
         self.style.display = 'none'
         self.value = ''
         self._value = ''
         document.getElementById('activeProfile').style.display = ''
         document.getElementById('nameEditBtn').children[0].style.fill = ''
         self.style.right = ''
      }, 130)
   }
   
   document.getElementById('nameEditBtn').onclick = function() {
      var input = document.getElementById('profileEditName')
      if (input.style.display != 'inline-block') {
         document.getElementById('activeProfile').style.display = 'none'
         input.style.display = 'inline-block'
         input.value = document.getElementById('activeProfile').textContent.trim()
         input._value = input.value
         this.children[0].style.fill = '#2c2c2c'
         this.style.right = parseInt(getComputedStyle(this, '').right)-3 + 'px'
         input.focus()
      } else {
         if (!input.value.match(/^\s*$/)) {
            document.getElementById('activeProfile').textContent = input.value
            browser.runtime.sendMessage({ operation: 'renameProfile', data: { value: input.value } }, function(result) {
               // Do nothing
            })
         }
         input.style.display = 'none'
         input.value = ''
         document.getElementById('activeProfile').style.display = ''
         this.children[0].style.fill = ''
         this.style.right = ''
      }
   }
   
   document.getElementById('syncButton').onclick = function() {
      browser.runtime.sendMessage({ operation: 'sync' }, function(result) {
         if (result) {
            setLastSyncTime(Date.now())
         }
      })
   }
   
   document.getElementById('logoutLink').onclick = function() {
      browser.runtime.sendMessage({ operation: 'logout' }, function(result) {
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
   
   document.getElementById('registerLink').onclick = function() {
      if (this.classList.contains('disabled')) return
      if (!document.getElementById('username').value.trim().length || !document.getElementById('password').value.trim().length) {
         return
      }
      
      hideError()
      getElementsByClass('loader', document.body, 'div')[0].style.display = 'block'
      
      var username = document.getElementById('username').value
      var password = document.getElementById('password').value
      
      browser.runtime.sendMessage({ operation: 'register', data: { username, password } }, function(result) {
         getElementsByClass('loader', document.body, 'div')[0].style.display = 'none'
         if (result === null || result.status == 500) {
            document.getElementById('loginScreen').classList.add('hidden')
            setTimeout(function() {
               document.getElementById('errorScreen').classList.remove('hidden')
            }, 200)
         } else if (result.status >= 400 && result.status < 500) {
            document.getElementById('registerLink').classList.remove('disabled')
            showError(result.error)
         } else if (result.status == 200) {
            hideError()
            document.getElementById('loginScreen').classList.add('emailSent')
         }
      })
   }
   
   document.getElementById('google_signin').onclick = function() {
      var url = 'https://accounts.google.com/o/oauth2/v2/auth/oauthchooseaccount?client_id=1051843566407-qfq4f9tmm7sigput90sb20b3fiqocefs.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fcloudfave.ext.io/oauth/google&response_type=token&scope=openid%20email'
      browser.tabs.create({ url: url })
      window.close()
   }
   
   function setProfileName(value) {
      document.getElementById('activeProfile').textContent = value
   }
   
   function updateLastSyncTime() {
      browser.storage.local.get(['last_sync'], function(result) {
         setLastSyncTime(result.last_sync)
      })
   }
   
   function setLastSyncTime(time) {
      if (parseInt(time) == 0) {
         document.getElementById('lastSyncTime').previousSibling.textContent = ''
         document.getElementById('lastSyncTime').textContent = 'Not synced yet'
         return
      }
      document.getElementById('lastSyncTime').previousSibling.textContent = 'Last synced '
      var delta = Math.floor((Date.now() - parseInt(time)) / 1000)
      if (delta <= 0) {
         document.getElementById('lastSyncTime').textContent = 'just now'
         return
      }
      if (delta >= 3600 * 24) {
         var days = Math.floor(delta / (3600 * 24))
         document.getElementById('lastSyncTime').textContent = days + ' days ago'
         return
      }
      if (delta >= 3600) {
         var hours = Math.floor(delta / 3600)
         document.getElementById('lastSyncTime').textContent = hours + ' hours ago'
         return
      }
      if (delta >= 60) {
         var mins = Math.floor(delta / 60)
         document.getElementById('lastSyncTime').textContent = mins + ' minutes ago'
         return
      }
      document.getElementById('lastSyncTime').textContent = delta + ' seconds ago'
   }
   
   var screen = 0
   
   var disconnected = false
   var lastConnectionError = 0
   
   browser.storage.local.get(['access_token', 'profile_id', 'ignored_folders', 'last_connection_error'], function(result) {
      if (result.access_token) {
         screen = result.profile_id && result.ignored_folders ? 3 : result.profile_id ? 2 : 1
      }
      if (result.last_connection_error !== undefined && result.last_connection_error !== null) {
         lastConnectionError = parseInt(result.last_connection_error)
         disconnected = Date.now() - lastConnectionError < 60000
      }
      
      initUI(screen, disconnected)
   })
   
   function addLoader(container) {
      var loader = document.createElement('div')
      loader.classList.add('loader')
      
      container.style.position = 'relative'
      loader.style.position = 'absolute'
      loader.style.left = '50%'
      loader.style.top = '50%'
      
      setTimeout(function() {
         var st = getComputedStyle(loader, '')
         var w = -parseFloat(st.width) / 2
         var h = -parseFloat(st.height) / 2
         loader.style.marginLeft = w + 'px'
         loader.style.marginTop = h + 'px'
      }, 0)
      
      container.appendChild(loader)
   }
   
   function removeLoader(container) {
      for (var i = 0; i < container.children.length; i++) {
         if (container.children[i].classList.contains('loader')) {
            container.removeChild(container.children[i])
         }
      }
   }
   
   function initUI(screen, disconnected) {
      if (disconnected) {
         document.getElementById('loginScreen').classList.add('hidden')
         document.getElementById('startScreen').classList.add('hidden')
         document.getElementById('selectFoldersScreen').classList.add('hidden')
         document.getElementById('mainScreen').classList.add('hidden')
         document.getElementById('errorScreen').classList.remove('hidden')
         document.getElementById('logout').classList.add('hidden')
      }
      if (screen > 0) {
         document.getElementById('loginScreen').classList.add('hidden')
         if (screen == 1) {
            var timer = null
            browser.runtime.sendMessage({ operation: 'getProfiles' }, function(result) {
               if (result && result.data) {
                  document.getElementById('errorScreen').classList.add('hidden')
                  document.getElementById('startScreen').classList.remove('hidden')
                  document.getElementById('logout').classList.remove('hidden')
                  loadProfiles(result.data)
               } else if (result && result.error) {
                  browser.storage.local.set({ access_token: null, profile_id: null })
                  clearTimeout(timer)
                  document.getElementById('errorScreen').classList.add('hidden')
                  document.getElementById('loginScreen').classList.remove('hidden')
               } else if (result == null) {
                  localStorage.lastConnectionError = Date.now()
                  clearTimeout(timer)
                  document.getElementById('startScreen').classList.add('hidden')
                  setTimeout(function() {
                     document.getElementById('errorScreen').classList.remove('hidden')
                     document.getElementById('logout').classList.add('hidden')
                  }, 300)
               }
            })
            if (!disconnected) timer = setTimeout(function() {
               document.getElementById('startScreen').classList.remove('hidden')
               document.getElementById('logout').classList.remove('hidden')
            }, 200)
         } else if (screen == 2) {
            var timer = null
            addLoader(document.getElementById('folderTree'))
            browser.runtime.sendMessage({ operation: 'getFolderTree' }, function(result) {
               removeLoader(document.getElementById('folderTree'))
               if (result && !result.error) {
                  loadFolderTree(result)
                  document.getElementById('errorScreen').classList.add('hidden')
                  document.getElementById('selectFoldersScreen').classList.remove('hidden')
                  document.getElementById('logout').classList.remove('hidden')
               } else if (result && result.error) {
                  browser.storage.local.set({ access_token: null, profile_id: null })
                  clearTimeout(timer)
                  document.getElementById('errorScreen').classList.add('hidden')
                  document.getElementById('loginScreen').classList.remove('hidden')
               } else if (result == null) {
                  localStorage.lastConnectionError = Date.now()
                  clearTimeout(timer)
                  document.getElementById('selectFoldersScreen').classList.add('hidden')
                  document.getElementById('mainScreen').classList.add('hidden')
                  document.getElementById('logout').classList.add('hidden')
                  setTimeout(function() {
                     document.getElementById('errorScreen').classList.remove('hidden')
                  }, 300)
               }
            })
            if (!disconnected) timer = setTimeout(function() {
               document.getElementById('selectFoldersScreen').classList.remove('hidden')
            }, 200)
         } else {
            var timer = null
            browser.runtime.sendMessage({ operation: 'getProfileName' }, function(result) {
               if (result && result.name) {
                  setProfileName(result.name)
                  updateLastSyncTime()
                  document.getElementById('errorScreen').classList.add('hidden')
                  document.getElementById('mainScreen').classList.remove('hidden')
                  document.getElementById('logout').classList.remove('hidden')
               } else if (result && result.error) {
                  localStorage.lastConnectionError = Date.now()
                  clearTimeout(timer)
                  document.getElementById('mainScreen').classList.add('hidden')
                  document.getElementById('logout').classList.add('hidden')
                  setTimeout(function() {
                     document.getElementById('errorScreen').classList.remove('hidden')
                  }, 300)
               }
            })
            if (!disconnected) timer = setTimeout(function() {
               document.getElementById('mainScreen').classList.remove('hidden')
               document.getElementById('logout').classList.remove('hidden')
            }, 200)
         }
      }
   }
   
})