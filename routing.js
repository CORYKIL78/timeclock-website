// ============================================================================
// GitHub Pages Client-Side Router
// Determines which HTML file should be served based on current pathname
// ============================================================================

(function() {
  const pathname = window.location.pathname;
  const currentFile = pathname.split('/').pop() || 'index.html';
  
  let targetFile = null;
  let needsRedirect = false;

  // Determine which file should be serving this route
  if (pathname === '/' || pathname === '') {
    targetFile = '/portal-directory.html';
    needsRedirect = currentFile !== 'portal-directory.html';
  } 
  else if (pathname === '/admin' || pathname === '/admin/') {
    targetFile = '/admin/backup.html';
    needsRedirect = currentFile !== 'backup.html';
  } 
  else if (pathname.startsWith('/cirklestaff/ocportal/')) {
    targetFile = '/admin/backup.html';
    needsRedirect = currentFile !== 'backup.html';
  } 
  else if (pathname === '/cirklestaff/ocportal' || pathname === '/cirklestaff/ocportal/') {
    targetFile = '/admin/backup.html';
    needsRedirect = currentFile !== 'backup.html';
  }
  else if (pathname.startsWith('/cirklestaff/')) {
    targetFile = '/index.html';
    needsRedirect = currentFile !== 'index.html';
  } 
  else if (pathname === '/cirklestaff' || pathname === '/cirklestaff/') {
    targetFile = '/index.html';
    needsRedirect = currentFile !== 'index.html';
  }
  else if (pathname.startsWith('/clients/') || pathname === '/clients' || pathname === '/clients/') {
    targetFile = '/maintenance.html';
    needsRedirect = currentFile !== 'maintenance.html';
  }
  else if (pathname.startsWith('/departments/') || pathname === '/departments' || pathname === '/departments/') {
    targetFile = '/maintenance.html';
    needsRedirect = currentFile !== 'maintenance.html';
  }
  else if (pathname.startsWith('/adminportal/') || pathname === '/adminportal' || pathname === '/adminportal/') {
    targetFile = '/admin/backup.html';
    needsRedirect = currentFile !== 'backup.html';
  }
  else {
    targetFile = '/index.html';
    needsRedirect = currentFile !== 'index.html' && currentFile !== '';
  }

  // If we need to redirect, do so
  if (needsRedirect && targetFile) {
    window.location.href = targetFile;
  }
})();
