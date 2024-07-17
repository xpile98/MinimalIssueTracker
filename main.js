document.addEventListener('DOMContentLoaded', (event) => {
  flatpickr(".flatpickr", {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      defaultDate: new Date()
  });

  const statusToggle = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const closeModal = document.getElementsByClassName('close')[0];
  const issueForm = document.getElementById('issueForm');
  const projectSelect = document.getElementById('project');
  const projectList = document.getElementById('projectList');
  const modal = document.getElementById('issueModal');
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.querySelector('.search-button');
  const allIssuesLink = document.getElementById('allIssuesLink');
  const unsolvedIssuesLink = document.getElementById('unsolvedIssuesLink');
  const solvedIssuesLink = document.getElementById('solvedIssuesLink');
  const addButton = document.getElementById('addButton');
  const deleteButton = document.querySelector('.delete-button');
  const confirmModal = document.getElementById('confirmModal');
  const confirmYes = document.getElementById('confirmYes');
  const confirmNo = document.getElementById('confirmNo');
  const closeConfirm = document.getElementsByClassName('close-confirm')[0];

  let issues = JSON.parse(localStorage.getItem('issues')) || [];
  let projects = JSON.parse(localStorage.getItem('projects')) || [];

  statusToggle.addEventListener('change', function() {
      if (this.checked) {
          statusText.textContent = '해결됨';
      } else {
          statusText.textContent = '미해결';
      }
  });

  projectList.addEventListener('change', function() {
      if (this.value) {
          projectSelect.value = this.value;
      } else {
          projectSelect.value = '';
      }
  });

  function updateIssueCounts() {
      document.getElementById('allIssuesCount').textContent = issues.length;
      document.getElementById('unsolvedIssuesCount').textContent = issues.filter(issue => issue.status === 'unsolved').length;
      document.getElementById('solvedIssuesCount').textContent = issues.filter(issue => issue.status === 'solved').length;
  }

  function renderIssues(issuesToRender = issues, searchTerm = '') {
    const issueGrid = document.getElementById('issueGrid');
    issueGrid.innerHTML = '';
    issuesToRender.forEach((issue) => {
        const truncatedMethod = getHighlightedSnippet(issue.method, searchTerm, 100);
        const statusClass = issue.status === 'unsolved' ? 'status-unsolved' : 'status-solved';
        const issueCard = document.createElement('div');
        issueCard.className = 'issue-card';
        issueCard.innerHTML = `
            <div class="issue-card-content">
                <div class="issue-header">
                    <h3>${highlightText(issue.project, searchTerm)}</h3>
                    <span class="status-indicator ${statusClass}"></span>
                </div>
                <p><strong>이슈:</strong> ${highlightText(issue.issue, searchTerm)}</p>
                <p><strong>방법:</strong> ${highlightText(truncatedMethod, searchTerm)}</p>
            </div>
        `;
        issueCard.addEventListener('click', () => openModal(issue));
        issueGrid.appendChild(issueCard);
    });
    updateIssueCounts();
}

function getHighlightedSnippet(text, searchTerm, snippetLength) {
    if (!searchTerm) return text.length > snippetLength ? text.substring(0, snippetLength) + '...' : text;

    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const match = text.match(regex);
    if (!match) return text.length > snippetLength ? text.substring(0, snippetLength) + '...' : text;

    const matchIndex = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    const start = Math.max(0, matchIndex - Math.floor(snippetLength / 2));
    const end = Math.min(text.length, start + snippetLength);

    const snippet = text.substring(start, end);
    return snippet.length < text.length ? snippet + '...' : snippet;
}

function highlightText(text, searchTerm) {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}


  function openModal(issue = null) {
      if (issue) {
          document.getElementById('issueId').value = issue.id;
          document.getElementById('project').value = issue.project;
          document.getElementById('issue').value = issue.issue;
          document.getElementById('status').checked = issue.status === 'solved';
          document.getElementById('statusText').textContent = issue.status === 'solved' ? '해결됨' : '미해결';
          document.getElementById('method').value = issue.method;
          document.getElementById('date')._flatpickr.setDate(issue.date);
          deleteButton.style.display = 'block';
      } else {
          issueForm.reset();
          document.getElementById('issueId').value = '';
          document.getElementById('date')._flatpickr.setDate(new Date());
          deleteButton.style.display = 'none';
      }
      modal.style.display = 'block';
      updateProjectList();  // 모달이 열릴 때마다 프로젝트 리스트를 업데이트
  }

  closeModal.onclick = function() {
      modal.style.display = 'none';
  }

  window.onclick = function(event) {
      if (event.target == modal) {
          modal.style.display = 'none';
      }
  }

  issueForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const issueId = document.getElementById('issueId').value;
      const selectedProject = projectSelect.value;
      if (!projects.includes(selectedProject)) {
          projects.push(selectedProject);
          localStorage.setItem('projects', JSON.stringify(projects));
      }
      const newIssue = {
          id: issueId || Date.now().toString(),
          project: selectedProject,
          issue: document.getElementById('issue').value,
          status: document.getElementById('status').checked ? 'solved' : 'unsolved',
          method: document.getElementById('method').value,
          date: document.getElementById('date').value
      };

      if (issueId) {
          const issueIndex = issues.findIndex(issue => issue.id === issueId);
          if (issueIndex !== -1) {
              issues[issueIndex] = newIssue;
          }
      } else {
          issues.push(newIssue);
      }

      localStorage.setItem('issues', JSON.stringify(issues));
      renderIssues();
      modal.style.display = 'none';
  });

  deleteButton.addEventListener('click', function(e) {
      e.preventDefault();
      confirmModal.style.display = 'block';
  });

  confirmYes.addEventListener('click', function() {
      const issueId = document.getElementById('issueId').value;
      if (issueId) {
          issues = issues.filter(issue => issue.id !== issueId);
          localStorage.setItem('issues', JSON.stringify(issues));
          renderIssues();
          modal.style.display = 'none';
      }
      confirmModal.style.display = 'none';
  });

  confirmNo.addEventListener('click', function() {
      confirmModal.style.display = 'none';
  });

  closeConfirm.onclick = function() {
      confirmModal.style.display = 'none';
  }

  window.onclick = function(event) {
      if (event.target == confirmModal) {
          confirmModal.style.display = 'none';
      }
  }

  function performSearch() {
      const searchTerm = searchInput.value.toLowerCase();
      const filteredIssues = issues.filter(issue => 
          issue.project.toLowerCase().includes(searchTerm) || 
          issue.issue.toLowerCase().includes(searchTerm) ||
          issue.method.toLowerCase().includes(searchTerm) ||  // 방법 내용 검색 추가
          issue.date.includes(searchTerm)
      );
      renderIssues(filteredIssues, searchTerm);
  }

  searchInput.addEventListener('input', performSearch);
  searchButton.addEventListener('click', performSearch);

  allIssuesLink.addEventListener('click', function(e) {
      e.preventDefault();
      renderIssues();
  });

  unsolvedIssuesLink.addEventListener('click', function(e) {
      e.preventDefault();
      const unresolvedIssues = issues.filter(issue => issue.status === 'unsolved');
      renderIssues(unresolvedIssues);
  });

  solvedIssuesLink.addEventListener('click', function(e) {
      e.preventDefault();
      const solvedIssues = issues.filter(issue => issue.status === 'solved');
      renderIssues(solvedIssues);
  });

  addButton.addEventListener('click', function() {
      openModal();
  });

  function updateProjectList() {
      const currentProjects = issues.map(issue => issue.project);
      projectList.innerHTML = '<option value="">프로젝트 선택</option>';
      projects.filter(project => currentProjects.includes(project))
              .forEach(project => {
                  const option = document.createElement('option');
                  option.value = project;
                  option.textContent = project;
                  projectList.appendChild(option);
              });
  }

  updateProjectList();
  renderIssues();

  const settingsLink = document.getElementById('settingsLink');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettings = document.getElementsByClassName('close-settings')[0];
  const backupMenu = document.getElementById('backupMenu');
  const backupContent = document.getElementById('backupContent');
  const settingsSections = document.getElementsByClassName('settings-section');

  settingsLink.addEventListener('click', function(e) {
      e.preventDefault();
      settingsModal.style.display = 'block';
  });

  closeSettings.onclick = function() {
      settingsModal.style.display = 'none';
  }

  window.onclick = function(event) {
      if (event.target == settingsModal) {
          settingsModal.style.display = 'none';
      }
  }

  backupMenu.addEventListener('click', function() {
      Array.from(settingsSections).forEach(section => section.style.display = 'none');
      backupContent.style.display = 'block';
  });

  // 파일 다운로드
  document.getElementById('rawFileDownload').addEventListener('click', function() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(issues));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "issues.json");
      document.body.appendChild(downloadAnchorNode); // required for firefox
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  });

  // 파일 업로드
  document.getElementById('rawFileUpload').addEventListener('click', function() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = function(event) {
          const file = event.target.files[0];
          const reader = new FileReader();
          reader.onload = function(event) {
              try {
                  const uploadedIssues = JSON.parse(event.target.result);
                  issues = uploadedIssues;
                  localStorage.setItem('issues', JSON.stringify(issues));
                  renderIssues();
              } catch (e) {
                  alert('Invalid JSON file');
              }
          };
          reader.readAsText(file);
      };
      input.click();
  });
});

// 구글 로그인 초기화
gapi.load('auth2', function() {
  gapi.auth2.init({
      client_id: 'YOUR_GOOGLE_CLIENT_ID'
  }).then(function(auth2) {
      auth2.isSignedIn.listen(updateSignInStatus);
      updateSignInStatus(auth2.isSignedIn.get());
  });
});

function updateSignInStatus(isSignedIn) {
  if (isSignedIn) {
      var profile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
      document.getElementById('name').innerText = 'Hello, ' + profile.getName();
      loadIssuesFromGoogle(profile.getId());
  } else {
      document.getElementById('name').innerText = '';
  }
}

function onSignIn(googleUser) {
  var profile = googleUser.getBasicProfile();
  document.getElementById('name').innerText = 'Hello, ' + profile.getName();
  loadIssuesFromGoogle(profile.getId());
}

function onSignOut() {
  var auth2 = gapi.auth2.getAuthInstance();
  auth2.signOut().then(function() {
      document.getElementById('name').innerText = '';
      localStorage.removeItem('issues');
      issues = [];
      renderIssues();
  });
}

document.getElementById('logout-button').addEventListener('click', onSignOut);

function loadIssuesFromGoogle(userId) {
  gapi.client.load('drive', 'v3', function() {
      gapi.client.drive.files.list({
          'q': `'${userId}' in owners and name='issues.json' and trashed=false`,
          'spaces': 'drive',
          'fields': 'files(id, name)'
      }).then(function(response) {
          var files = response.result.files;
          if (files && files.length > 0) {
              var fileId = files[0].id;
              gapi.client.drive.files.get({
                  fileId: fileId,
                  alt: 'media'
              }).then(function(response) {
                  issues = JSON.parse(response.body);
                  renderIssues();
              });
          } else {
              issues = [];
              renderIssues();
          }
      });
  });
}

function saveIssuesToGoogle() {
  var issueData = JSON.stringify(issues);
  var blob = new Blob([issueData], {type: 'application/json'});
  var metadata = {
      'name': 'issues.json',
      'mimeType': 'application/json'
  };

  var accessToken = gapi.auth.getToken().access_token; // Use the access token
  var form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
  form.append('file', blob);

  fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: new Headers({'Authorization': 'Bearer ' + accessToken}),
      body: form,
  }).then((response) => response.json()).then(function(response) {
      console.log(response);
  });
}