// INNOVA IA — Dynamic WhatsApp Redirect
// Reads ?wa= param from URL and updates all WhatsApp buttons
// If no ?wa= param, uses the default number
(function() {
  var DEFAULT_WA = '573112657801'; // Angel - número por defecto

  var params = new URLSearchParams(window.location.search);
  var waNumber = params.get('wa') ? params.get('wa').replace(/[^0-9]/g,'') : DEFAULT_WA;
  var refCode  = params.get('ref') || '';

  // Store globally for use in page scripts
  window.INNOVA_WA = waNumber;
  window.INNOVA_REF = refCode;

  // Function to patch all wa.me links on the page
  function patchWaLinks() {
    var links = document.querySelectorAll('a[href*="wa.me"]');
    links.forEach(function(link) {
      // Extract existing message if any
      var href = link.href;
      var msgMatch = href.match(/text=([^&]*)/);
      var existingMsg = msgMatch ? decodeURIComponent(msgMatch[1]) : '';
      // Rebuild with correct number
      link.href = 'https://wa.me/' + waNumber + (existingMsg ? '?text=' + encodeURIComponent(existingMsg) : '');
    });

    // Also patch buttons with onclick wa.me
    var btns = document.querySelectorAll('button, a');
    btns.forEach(function(el) {
      if(el.onclick) {
        var onclickStr = el.onclick.toString();
        if(onclickStr.includes('wa.me')) {
          el.addEventListener('click', function(e) {
            e.preventDefault();
            window.open('https://wa.me/' + waNumber, '_blank');
          });
        }
      }
    });
  }

  // Patch on DOM ready and after a delay (for dynamic content)
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchWaLinks);
  } else {
    patchWaLinks();
  }
  setTimeout(patchWaLinks, 1000);
  setTimeout(patchWaLinks, 3000);

  // Also intercept any programmatic wa.me redirects
  var origOpen = window.open;
  window.open = function(url, target, features) {
    if(url && url.includes('wa.me/')) {
      var fixed = url.replace(/wa\.me\/\d+/, 'wa.me/' + waNumber);
      return origOpen.call(this, fixed, target, features);
    }
    return origOpen.call(this, url, target, features);
  };

})();
