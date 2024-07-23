import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { doc, collection, addDoc, getDocs, query, where, deleteDoc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', (event) => {

    flatpickr(".flatpickr", {
        enableTime: false,
        dateFormat: "Y-m-d",
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

    statusToggle.addEventListener('change', function () {
        if (this.checked) {
            statusText.textContent = '해결됨';
        } else {
            statusText.textContent = '미해결';
        }
    });

    projectList.addEventListener('change', function () {
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

    const searchContainer = document.querySelector('.search-container');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    function toggleSidebar() {
        if (sidebar.style.display === 'block') {
            sidebar.style.display = 'none';
        } else {
            sidebar.style.display = 'block';
        }
    }

    function hideSidebar() {
        if (sidebar.style.display === 'block') {
            sidebar.style.display = 'none';
        }
    }

    addButton.addEventListener('click', (event) => {
        event.stopPropagation();
        openModal();
    });

    document.addEventListener('click', hideSidebar);
    sidebar.addEventListener('click', (event) => {
        event.stopPropagation();
    });

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

    closeModal.onclick = function () {
        modal.style.display = 'none';
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }

    function saveIssue(issue) {
        const user = auth.currentUser;
        if (user) {
            issue.userId = user.uid;
            if (issue.id) {
                // 업데이트
                const issueRef = doc(db, "issues", issue.id);
                updateDoc(issueRef, issue).then(() => {
                    console.log("이슈 업데이트 성공");
                    loadData(user);
                }).catch(error => {
                    console.error("이슈 업데이트 오류: ", error);
                });
            } else {
                // 새 이슈 추가
                addDoc(collection(db, "issues"), issue).then((docRef) => {
                    console.log("이슈 저장 성공: ", docRef.id);
                    issue.id = docRef.id;

                    // DB 사용시 이슈 로드 방법 수정
                    //renderIssues();
                    loadData(user);
                }).catch(error => {
                    console.error("이슈 저장 오류: ", error);
                });
            }
        } else {
            // 로컬 저장
            if (issue.id) {
                const index = issues.findIndex(i => i.id === issue.id);
                issues[index] = issue;
            } else {
                issue.id = Date.now().toString();
                issues.push(issue);
            }
            localStorage.setItem('issues', JSON.stringify(issues));
            renderIssues();
        }
    }

    issueForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const issueId = document.getElementById('issueId').value;
        const selectedProject = projectSelect.value;
        if (!projects.includes(selectedProject)) {
            projects.push(selectedProject);
            localStorage.setItem('projects', JSON.stringify(projects));
        }
        const newIssue = {
            id: issueId || null,
            project: selectedProject,
            issue: document.getElementById('issue').value,
            status: document.getElementById('status').checked ? 'solved' : 'unsolved',
            method: document.getElementById('method').value,
            date: document.getElementById('date').value
        };

        saveIssue(newIssue);
        modal.style.display = 'none';
    });

    function deleteIssue(issueId) {
        const user = auth.currentUser;
        if (user) {
            const issueRef = doc(db, "issues", issueId);
            deleteDoc(issueRef).then(() => {
                console.log("이슈 삭제 성공");
                issues = issues.filter(issue => issue.id !== issueId);
                renderIssues();
            }).catch(error => {
                console.error("이슈 삭제 오류: ", error);
            });
        } else {
            issues = issues.filter(issue => issue.id !== issueId);
            localStorage.setItem('issues', JSON.stringify(issues));
            renderIssues();
        }
    }

    deleteButton.addEventListener('click', function (e) {
        e.preventDefault();
        confirmModal.style.display = 'block';
    });

    confirmYes.addEventListener('click', function () {
        const issueId = document.getElementById('issueId').value;
        if (issueId) {
            deleteIssue(issueId);
        }
        confirmModal.style.display = 'none';
        modal.style.display = 'none';
    });

    confirmNo.addEventListener('click', function () {
        confirmModal.style.display = 'none';
    });

    closeConfirm.onclick = function () {
        confirmModal.style.display = 'none';
    }

    window.onclick = function (event) {
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

    allIssuesLink.addEventListener('click', function (e) {
        e.preventDefault();
        renderIssues();
    });

    unsolvedIssuesLink.addEventListener('click', function (e) {
        e.preventDefault();
        const unresolvedIssues = issues.filter(issue => issue.status === 'unsolved');
        renderIssues(unresolvedIssues);
    });

    solvedIssuesLink.addEventListener('click', function (e) {
        e.preventDefault();
        const solvedIssues = issues.filter(issue => issue.status === 'solved');
        renderIssues(solvedIssues);
    });

    addButton.addEventListener('click', function () {
        openModal();
    });

    function updateProjectList() {
        const currentProjects = issues.map(issue => issue.project);
        projectList.innerHTML = '<option value="">선택</option>';
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

    settingsLink.addEventListener('click', function (e) {
        e.preventDefault();
        settingsModal.style.display = 'block';
    });

    closeSettings.onclick = function () {
        settingsModal.style.display = 'none';
    }

    window.onclick = function (event) {
        if (event.target == settingsModal) {
            settingsModal.style.display = 'none';
        }
    }

    backupMenu.addEventListener('click', function () {
        Array.from(settingsSections).forEach(section => section.style.display = 'none');
        backupContent.style.display = 'block';
    });

    // 파일 다운로드
    document.getElementById('rawFileDownload').addEventListener('click', function () {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(issues));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "issues.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    // 파일 업로드
    document.getElementById('rawFileUpload').addEventListener('click', function () {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = function (event) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = function (event) {
                try {
                    const uploadedIssues = JSON.parse(event.target.result);
                    const user = auth.currentUser;

                    if (user) {
                        // 로그인 상태에서 Firestore DB에 저장
                        const batch = writeBatch(db);
                        uploadedIssues.forEach(issue => {
                            issue.userId = user.uid; // userId 추가
                            const issueRef = doc(collection(db, 'issues'));
                            batch.set(issueRef, issue);
                        });
                        batch.commit().then(() => {
                            console.log("이슈 저장 성공");
                            issues = uploadedIssues;
                            renderIssues();
                        }).catch(error => {
                            console.error("이슈 저장 오류: ", error);
                        });
                    } else {
                        // 로그아웃 상태에서 로컬 스토리지에 저장
                        issues = uploadedIssues;
                        localStorage.setItem('issues', JSON.stringify(issues));
                        renderIssues();
                    }
                } catch (e) {
                    alert('Invalid JSON file');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    });

    // 로그인 모달 요소
    const loginModal = document.getElementById('loginModal');
    const loginIcon = document.getElementById('loginIcon');
    const closeLoginModal = document.getElementById('closeLoginModal');
    const loginForm = document.getElementById('loginForm');

    // 로그아웃 모달 요소
    const logoutModal = document.getElementById('logoutButtonContainer');
    const logoutIcon = document.getElementById('logoutIcon');
    const closeLogoutModal = document.getElementById('closeLogoutModal');
    const logoutButton = document.getElementById('logoutButton');

    // 로그인 아이콘 클릭 이벤트
    loginIcon.addEventListener('click', () => {
        loginModal.style.display = 'block';
    });

    // 로그인 모달 닫기 이벤트
    closeLoginModal.addEventListener('click', () => {
        loginModal.style.display = 'none';
    });

    
    // 로그아웃 아이콘 클릭 이벤트
    logoutIcon.addEventListener('click', () => {
        logoutModal.style.display = 'block';
    });

    // 로그아웃 모달 닫기 이벤트
    closeLogoutModal.addEventListener('click', () => {
        logoutModal.style.display = 'none';
    });

    // 로그인 폼 제출 이벤트
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        console.log("로그인 시도: ", email);
        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                console.log("로그인 성공: ", userCredential.user);
                loginModal.style.display = 'none'; // 로그인 성공 시 모달 닫기
                loginIcon.style.display = 'none';
                logoutIcon.style.display = 'block';
            })
            .catch((error) => {
                console.error('로그인 오류:', error);
        });
    });


    // 로그아웃 버튼 클릭 이벤트
    logoutButton.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log("로그아웃 성공");
            logoutModal.style.display = 'none';
            loginIcon.style.display = 'block';
            logoutIcon.style.display = 'none';
            clearData();
        });
    });



    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', (event) => {
        if (event.target == loginModal) {
            loginModal.style.display = 'none';
        }
        if (event.target == logoutModal) {
            logoutModal.style.display = 'none';
        }
    });

    function loadData(user) {
        if (!user) {
            console.error("사용자 정보가 없습니다.");
            return;
        }

        const q = query(collection(db, "issues"), where("userId", "==", user.uid));
        getDocs(q).then((querySnapshot) => {
            let loadedIssues = [];
            querySnapshot.forEach((doc) => {
                loadedIssues.push({ ...doc.data(), id: doc.id });
            });
            issues = loadedIssues;
            renderIssues();
        }).catch(error => {
            console.error("데이터 로드 오류: ", error);
        });
    }

    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log("사용자 로그인 상태: ", user);
            loginIcon.style.display = 'none';
            logoutIcon.style.display = 'block';
            loadData(user);
        } else {
            console.log("사용자 로그아웃 상태");
            loginIcon.style.display = 'block';
            logoutIcon.style.display = 'none';
            issues = JSON.parse(localStorage.getItem('issues')) || [];
            renderIssues();
        }
    });

    function clearData() {
        renderIssues([]);
    }

});
