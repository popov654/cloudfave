window.addEventListener('load', function() {
   var session_token = document.body.getAttribute('session-token')
   if (!session_token) {
      var url = new URL(location.href)
      session_token = url.searchParams.get('session-id')
   }
   if (session_token) {
      chrome.runtime.sendMessage({ 'operation': 'oauthLogin',
                                   'access_token': session_token
      })
   }
})