function getElementsByClass(searchClass, node, tag) {
   var classElements = new Array();
   if ( node == null )
      node = document;
   if ( tag == null )
      tag = '*';
   var els = node.getElementsByTagName(tag);
   var elsLen = els.length;

   var pattern = new RegExp("(^|\\s)"+searchClass+"(\\s|$)");
   for (i = 0, j = 0; i < elsLen; i++) {
      if ( pattern.test(els[i].className) ) {
         classElements[j] = els[i];
         j++;
      }
   }
   return classElements;
}

window.addEventListener("DOMContentLoaded", function() {
   
   var extension = window.browser && window.browser.runtime || chrome.extension
   
   var otherBookmarks = 0;
   chrome.bookmarks.getTree(function(tree){
      otherBookmarks = tree[0].children[1];
   });
   
   var loginForm = document.getElementById('loginForm')
   loginForm.getElementsByTagName('button')[0].classList.add('disabled')
   loginForm.getElementsByTagName('input')[0].oninput = 
   loginForm.getElementsByTagName('input')[1].oninput = function() {
      var username = loginForm.getElementsByTagName('input')[0].value
      var password = loginForm.getElementsByTagName('input')[1].value
      var btn = loginForm.getElementsByTagName('button')[0]
      btn.classList.toggle('disabled', !username.length || !password.length)
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
      getElementsByClass('loader', document.body, 'div')[0].style.display = 'block'
      
      extension.sendMessage({ operation: 'authorize', data: { username, password } }, function(result) {
         getElementsByClass('loader', document.body, 'div')[0].style.display = 'none'
         if (result === null) {
            document.getElementById('loginScreen').classList.add('hidden')
            setTimeout(function() {
               document.getElementById('errorScreen').classList.remove('hidden')
            }, 200)
         } else if (result === false) {
            btn.classList.remove('disabled')
            document.getElementById('loginError').classList.add('visible')
         } else {
            document.getElementById('loginError').classList.remove('visible')
            document.getElementById('loginScreen').classList.add('hidden')
            extension.sendMessage({ operation: 'getProfiles' }, function(result) {
               if (result) loadProfiles()
            })
            setTimeout(function() {
               document.getElementById('startScreen').classList.remove('hidden')
            }, 300)
         }
      })
      
      return false
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
   
   function loadProfiles() {
      console.log(localStorage.profiles)
      var profiles = JSON.parse(localStorage.profiles)
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
      initProfilesList()
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
   
   var usernameField = document.getElementById('username')
   var passwordField = document.getElementById('password')
   
   function convertToLatin(e) {
      if (e.key && e.key.match(/^Shift|Alt|Control|Backspace|Delete|Tab|Space|Enter$/)) return
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
   
   document.getElementById('nextButton').onclick = function() {
      if (this.classList.contains('disabled')) return
      if (document.getElementById('createNewProfile').checked) {
         getElementsByClass('loader', document.body, 'div')[0].style.display = 'block'
         var title = profileNameField.value
         if (title.trim().match(/^\s*$/)) return
         document.getElementById('nextButton').classList.add('disabled')
         extension.sendMessage({ operation: 'createProfile', name: title }, function(result) {
            getElementsByClass('loader', document.body, 'div')[0].style.display = 'none'
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
      extension.sendMessage({ operation, data }, function(result) {
         if (!result) return
         setProfileName()
         document.getElementById('startScreen').classList.add('hidden')
         setTimeout(function() {
            document.getElementById('mainScreen').classList.remove('hidden')
         }, 300)
      })
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
            extension.sendMessage({ operation: 'renameProfile', data: { value: input.value } }, function(result) {
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
      extension.sendMessage({ operation: 'sync' }, function(result) {
         if (result.success) {
            setLastSyncTime()
         }
      })
   }
   
   function setProfileName() {
      document.getElementById('activeProfile').textContent = localStorage.profileName
   }
   
   function setLastSyncTime() {
      if (parseInt(localStorage.lastSync) == 0) {
         document.getElementById('lastSyncTime').previousSibling.textContent = ''
         document.getElementById('lastSyncTime').textContent = 'Not synced yet'
         return
      }
      document.getElementById('lastSyncTime').previousSibling.textContent = 'Last synced '
      var delta = Math.floor((Date.now() - parseInt(localStorage.lastSync)) / 1000)
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
   
   var screen = localStorage.accessToken == 'null' ? 0 : (localStorage.profileId == 'null' ? 1 : 2)
   
   var disconnected = localStorage.lastConnectionError && Date.now() - parseInt(localStorage.lastConnectionError) < 60000
   
   if (disconnected) {
      document.getElementById('loginScreen').classList.add('hidden')
      document.getElementById('startScreen').classList.add('hidden')
      document.getElementById('mainScreen').classList.add('hidden')
      document.getElementById('errorScreen').classList.remove('hidden')
   }
   
   if (screen > 0) {
      document.getElementById('loginScreen').classList.add('hidden')
      if (screen == 1) {
         var timer = null
         extension.sendMessage({ operation: 'getProfiles' }, function(result) {
            if (result) {
               document.getElementById('errorScreen').classList.add('hidden')
               document.getElementById('startScreen').classList.remove('hidden')
               loadProfiles()
            }
            else if (result === null) {
               localStorage.lastConnectionError = Date.now()
               clearTimeout(timer)
               document.getElementById('startScreen').classList.add('hidden')
               setTimeout(function() {
                  document.getElementById('errorScreen').classList.remove('hidden')
               }, 300)
            }
         })
         if (!disconnected) timer = setTimeout(function() {
            document.getElementById('startScreen').classList.remove('hidden')
         }, 200)
      } else {
         var timer = null
         extension.sendMessage({ operation: 'getProfileName' }, function(result) {
            if (result) {
               setProfileName()
               setLastSyncTime()
               document.getElementById('errorScreen').classList.add('hidden')
               document.getElementById('mainScreen').classList.remove('hidden')
            } else if (!result && result !== undefined) {
               localStorage.lastConnectionError = Date.now()
               clearTimeout(timer)
               document.getElementById('mainScreen').classList.add('hidden')
               setTimeout(function() {
                  document.getElementById('errorScreen').classList.remove('hidden')
               }, 300)
            }
         })
         if (!disconnected) timer = setTimeout(function() {
            document.getElementById('mainScreen').classList.remove('hidden')
         }, 200)
      }
   }
   
})