window.addEventListener("DOMContentLoaded", function() {
   
   
   var browser = window.browser || window.chrome
   var extension = window.browser && window.browser.runtime || chrome.extension
   
   var otherBookmarks = 0;
   chrome.bookmarks.getTree(function(tree){
      otherBookmarks = tree[0].children[1];
   });
   
   /*
   
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
   
   
   var profileNameField = document.getElementById('newProfileName')
   
   profileNameField.addEventListener('focus', checkProfileName)
   profileNameField.addEventListener('input', checkProfileName)
   
   
   
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
   
   function setProfileName(value) {
      document.getElementById('activeProfile').textContent = value
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
            var blocks = document.getElementById('content').children
            for (var i = 0; i < blocks.length; i++) {
               if (blocks[i].getAttribute('data-id') == id) {
                  blocks[i].style.display = ''
               } else {
                  blocks[i].style.display = 'none'
               }
            }
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
         }
      })
   }
   
})
