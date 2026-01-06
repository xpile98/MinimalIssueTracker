import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { doc, collection, addDoc, getDocs, query, where, deleteDoc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', (event) => {

    flatpickr(".flatpickr", {
        enableTime: false,
        dateFormat: "Y-m-d",
        defaultDate: new Date()
    });

    // DOM 요소 참조
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

    // 상태 변수
    let issues = JSON.parse(localStorage.getItem('issues')) || [];
    let projects = JSON.parse(localStorage.getItem('projects')) || [];
    let currentSearchTerm = ''; // 현재 검색어 저장
    let isLoading = false;

    // 상태 토글 이벤트
    statusToggle.addEventListener('change', function () {
        statusText.textContent = this.checked ? '해결됨' : '미해결';
    });

    // 프로젝트 선택 이벤트
    projectList.addEventListener('change', function () {
        projectSelect.value = this.value || '';
    });

    // 이슈 카운트 업데이트
    function updateIssueCounts() {
        document.getElementById('allIssuesCount').textContent = issues.length;
        document.getElementById('unsolvedIssuesCount').textContent =
            issues.filter(issue => issue.status === 'unsolved').length;
        document.getElementById('solvedIssuesCount').textContent =
            issues.filter(issue => issue.status === 'solved').length;
    }

    // 이슈 렌더링 (빈 상태 메시지 추가)
    function renderIssues(issuesToRender = issues, searchTerm = '') {
        const issueGrid = document.getElementById('issueGrid');
        issueGrid.innerHTML = '';

        if (isLoading) {
            issueGrid.innerHTML = '<div class="empty-state">로딩 중...</div>';
            return;
        }

        if (issuesToRender.length === 0) {
            const emptyMessage = searchTerm
                ? `"${searchTerm}"에 대한 검색 결과가 없습니다.`
                : '등록된 이슈가 없습니다. + 버튼을 눌러 이슈를 추가하세요.';
            issueGrid.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
            updateIssueCounts();
            return;
        }

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
                    <div class="issue-date">${highlightText(issue.date, searchTerm)}</div>
                </div>
            `;
            issueCard.addEventListener('click', () => openModal(issue));
            issueGrid.appendChild(issueCard);
        });
        updateIssueCounts();
    }

    // 사이드바 관련 (모바일 대응)
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    function toggleSidebar() {
        const isVisible = sidebar.style.display === 'block';
        sidebar.style.display = isVisible ? 'none' : 'block';
    }

    function hideSidebar() {
        if (window.innerWidth <= 768 && sidebar.style.display === 'block') {
            sidebar.style.display = 'none';
        }
    }

    // 모바일 메뉴 버튼 추가
    const header = document.querySelector('header');
    const menuButton = document.createElement('button');
    menuButton.className = 'mobile-menu-button';
    menuButton.innerHTML = '<i class="material-icons">menu</i>';
    menuButton.style.display = 'none';
    menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebar();
    });
    header.insertBefore(menuButton, header.firstChild);

    // 반응형 체크
    function checkResponsive() {
        if (window.innerWidth <= 768) {
            menuButton.style.display = 'block';
            sidebar.style.display = 'none';
        } else {
            menuButton.style.display = 'none';
            sidebar.style.display = 'block';
        }
    }
    window.addEventListener('resize', checkResponsive);
    checkResponsive();

    // 사이드바 외부 클릭 시 닫기
    document.addEventListener('click', hideSidebar);
    sidebar.addEventListener('click', (e) => e.stopPropagation());
    addButton.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal();
    });

    // 검색 관련 함수
    function getHighlightedSnippet(text, searchTerm, snippetLength) {
        if (!text) return '';
        if (!searchTerm) return text.length > snippetLength ? text.substring(0, snippetLength) + '...' : text;

        const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
        const match = text.match(regex);
        if (!match) return text.length > snippetLength ? text.substring(0, snippetLength) + '...' : text;

        const matchIndex = text.toLowerCase().indexOf(searchTerm.toLowerCase());
        const start = Math.max(0, matchIndex - Math.floor(snippetLength / 2));
        const end = Math.min(text.length, start + snippetLength);

        const snippet = text.substring(start, end);
        return snippet.length < text.length ? snippet + '...' : snippet;
    }

    function highlightText(text, searchTerm) {
        if (!text) return '';
        if (!searchTerm) return text;
        const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 모달 열기
    function openModal(issue = null) {
        if (issue) {
            document.getElementById('issueId').value = issue.id;
            document.getElementById('project').value = issue.project;
            document.getElementById('issue').value = issue.issue;
            document.getElementById('status').checked = issue.status === 'solved';
            document.getElementById('statusText').textContent = issue.status === 'solved' ? '해결됨' : '미해결';
            document.getElementById('method').value = issue.method || '';
            document.getElementById('date')._flatpickr.setDate(issue.date);
            deleteButton.style.display = 'block';
        } else {
            issueForm.reset();
            document.getElementById('issueId').value = '';
            document.getElementById('date')._flatpickr.setDate(new Date());
            document.getElementById('statusText').textContent = '미해결';
            deleteButton.style.display = 'none';
        }
        modal.style.display = 'block';
        updateProjectList();
    }

    // 모달 닫기
    closeModal.onclick = () => modal.style.display = 'none';

    // 프로젝트 리스트에서 중복 제거 및 정렬 함수
    function extractProjectsFromIssues(issueList) {
        const projectSet = new Set();
        issueList.forEach(issue => {
            if (issue.project && issue.project.trim() !== '') {
                projectSet.add(issue.project.trim());
            }
        });
        return Array.from(projectSet).sort();
    }

    // 이슈 저장
    function saveIssue(issue) {
        const user = auth.currentUser;

        // 프로젝트 리스트 업데이트 (로컬)
        if (issue.project && !projects.includes(issue.project)) {
            projects.push(issue.project);
            projects.sort();
            localStorage.setItem('projects', JSON.stringify(projects));
        }

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
                    alert("이슈 업데이트 중 오류가 발생했습니다.");
                });
            } else {
                // 새 이슈 추가
                addDoc(collection(db, "issues"), issue).then((docRef) => {
                    console.log("이슈 저장 성공: ", docRef.id);
                    issue.id = docRef.id;
                    loadData(user);
                }).catch(error => {
                    console.error("이슈 저장 오류: ", error);
                    alert("이슈 저장 중 오류가 발생했습니다.");
                });
            }
        } else {
            // 로컬 저장
            if (issue.id) {
                const index = issues.findIndex(i => i.id === issue.id);
                if (index !== -1) issues[index] = issue;
            } else {
                issue.id = Date.now().toString();
                issues.push(issue);
            }
            localStorage.setItem('issues', JSON.stringify(issues));
            renderIssues();
            updateProjectList();
        }
    }

    // 폼 제출
    issueForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const issueId = document.getElementById('issueId').value;
        const selectedProject = projectSelect.value.trim();

        if (!selectedProject) {
            alert('프로젝트 이름을 입력해주세요.');
            return;
        }

        const newIssue = {
            id: issueId || null,
            project: selectedProject,
            issue: document.getElementById('issue').value.trim(),
            status: document.getElementById('status').checked ? 'solved' : 'unsolved',
            method: document.getElementById('method').value.trim(),
            date: document.getElementById('date').value
        };

        saveIssue(newIssue);
        modal.style.display = 'none';
    });

    // 이슈 삭제
    function deleteIssue(issueId) {
        const user = auth.currentUser;
        if (user) {
            const issueRef = doc(db, "issues", issueId);
            deleteDoc(issueRef).then(() => {
                console.log("이슈 삭제 성공");
                loadData(user);
            }).catch(error => {
                console.error("이슈 삭제 오류: ", error);
                alert("이슈 삭제 중 오류가 발생했습니다.");
            });
        } else {
            issues = issues.filter(issue => issue.id !== issueId);
            localStorage.setItem('issues', JSON.stringify(issues));
            projects = extractProjectsFromIssues(issues);
            localStorage.setItem('projects', JSON.stringify(projects));
            renderIssues(issues, currentSearchTerm);
            updateProjectList();
        }
    }

    // 삭제 확인
    deleteButton.addEventListener('click', (e) => {
        e.preventDefault();
        confirmModal.style.display = 'block';
    });

    confirmYes.addEventListener('click', () => {
        const issueId = document.getElementById('issueId').value;
        if (issueId) deleteIssue(issueId);
        confirmModal.style.display = 'none';
        modal.style.display = 'none';
    });

    confirmNo.addEventListener('click', () => confirmModal.style.display = 'none');
    closeConfirm.onclick = () => confirmModal.style.display = 'none';

    // 검색
    function performSearch() {
        currentSearchTerm = searchInput.value.toLowerCase();
        const filteredIssues = issues.filter(issue =>
            issue.project.toLowerCase().includes(currentSearchTerm) ||
            issue.issue.toLowerCase().includes(currentSearchTerm) ||
            (issue.method && issue.method.toLowerCase().includes(currentSearchTerm)) ||
            issue.date.includes(currentSearchTerm)
        );
        renderIssues(filteredIssues, currentSearchTerm);
    }

    searchInput.addEventListener('input', performSearch);

    // 사이드바 필터링
    allIssuesLink.addEventListener('click', (e) => {
        e.preventDefault();
        currentSearchTerm = '';
        searchInput.value = '';
        renderIssues();
    });

    unsolvedIssuesLink.addEventListener('click', (e) => {
        e.preventDefault();
        const unresolvedIssues = issues.filter(issue => issue.status === 'unsolved');
        renderIssues(unresolvedIssues, currentSearchTerm);
    });

    solvedIssuesLink.addEventListener('click', (e) => {
        e.preventDefault();
        const solvedIssues = issues.filter(issue => issue.status === 'solved');
        renderIssues(solvedIssues, currentSearchTerm);
    });

    // 프로젝트 리스트 업데이트
    function updateProjectList() {
        projectList.innerHTML = '<option value="">선택</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            projectList.appendChild(option);
        });
        populateProjectFilterLinks();
    }

    // 프로젝트별 필터 링크
    function populateProjectFilterLinks() {
        const sidebarMenu = document.querySelector('.sidebar-menu');
        document.querySelectorAll('.project-filter').forEach(e => e.remove());

        if (projects.length === 0) return;

        const projectHeader = document.createElement('div');
        projectHeader.textContent = '프로젝트별 보기';
        projectHeader.style.padding = '8px 24px';
        projectHeader.style.fontWeight = 'bold';
        projectHeader.style.color = '#ccc';
        projectHeader.className = 'project-filter';
        sidebarMenu.appendChild(projectHeader);

        const projectFilterContainer = document.createElement('div');
        projectFilterContainer.id = 'projectFilterContainer';
        projectFilterContainer.className = 'project-filter';
        sidebarMenu.appendChild(projectFilterContainer);

        projects.forEach(project => {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'sidebar-item project-filter';
            link.innerHTML = `<i class="material-icons">folder</i> <span>${project}</span>`;

            link.addEventListener('click', (e) => {
                e.preventDefault();
                const filtered = issues.filter(issue => issue.project === project);
                renderIssues(filtered, currentSearchTerm);
            });

            projectFilterContainer.appendChild(link);
        });
    }

    updateProjectList();
    renderIssues();

    // 설정 모달
    const settingsLink = document.getElementById('settingsLink');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementsByClassName('close-settings')[0];
    const backupMenu = document.getElementById('backupMenu');
    const backupContent = document.getElementById('backupContent');

    settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        settingsModal.style.display = 'block';
    });

    closeSettings.onclick = () => settingsModal.style.display = 'none';

    backupMenu.addEventListener('click', () => {
        Array.from(document.getElementsByClassName('settings-section'))
            .forEach(section => section.style.display = 'none');
        backupContent.style.display = 'block';
    });

    // 파일 다운로드
    document.getElementById('rawFileDownload').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," +
            encodeURIComponent(JSON.stringify(issues, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `issues_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    // 파일 업로드
    document.getElementById('rawFileUpload').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const uploadedIssues = JSON.parse(event.target.result);
                    if (!Array.isArray(uploadedIssues)) {
                        throw new Error('Invalid format');
                    }

                    const user = auth.currentUser;

                    if (user) {
                        // Firestore에 저장
                        const batch = writeBatch(db);
                        uploadedIssues.forEach(issue => {
                            issue.userId = user.uid;
                            const issueRef = doc(collection(db, 'issues'));
                            batch.set(issueRef, issue);
                        });
                        batch.commit().then(() => {
                            console.log("이슈 업로드 성공");
                            loadData(user);
                            alert("데이터를 성공적으로 불러왔습니다.");
                        }).catch(error => {
                            console.error("이슈 저장 오류: ", error);
                            alert("데이터 업로드 중 오류가 발생했습니다.");
                        });
                    } else {
                        // 로컬 저장
                        issues = uploadedIssues;
                        projects = extractProjectsFromIssues(issues);
                        localStorage.setItem('issues', JSON.stringify(issues));
                        localStorage.setItem('projects', JSON.stringify(projects));
                        renderIssues();
                        updateProjectList();
                        alert("데이터를 성공적으로 불러왔습니다.");
                    }
                } catch (e) {
                    console.error(e);
                    alert('올바른 JSON 파일이 아닙니다.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    });

    // 로그인 관련
    const loginModal = document.getElementById('loginModal');
    const loginIcon = document.getElementById('loginIcon');
    const closeLoginModal = document.getElementById('closeLoginModal');
    const loginForm = document.getElementById('loginForm');
    const logoutModal = document.getElementById('logoutButtonContainer');
    const logoutIcon = document.getElementById('logoutIcon');
    const closeLogoutModal = document.getElementById('closeLogoutModal');
    const logoutButton = document.getElementById('logoutButton');

    loginIcon.addEventListener('click', () => loginModal.style.display = 'block');
    closeLoginModal.addEventListener('click', () => loginModal.style.display = 'none');
    logoutIcon.addEventListener('click', () => logoutModal.style.display = 'block');
    closeLogoutModal.addEventListener('click', () => logoutModal.style.display = 'none');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                console.log("로그인 성공: ", userCredential.user);
                loginModal.style.display = 'none';
                loginIcon.style.display = 'none';
                logoutIcon.style.display = 'block';
            })
            .catch((error) => {
                console.error('로그인 오류:', error);
                alert('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
            });
    });

    logoutButton.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log("로그아웃 성공");
            logoutModal.style.display = 'none';
            loginIcon.style.display = 'block';
            logoutIcon.style.display = 'none';
            issues = JSON.parse(localStorage.getItem('issues')) || [];
            projects = JSON.parse(localStorage.getItem('projects')) || [];
            renderIssues();
            updateProjectList();
        }).catch((error) => {
            console.error('로그아웃 오류:', error);
        });
    });

    // Firestore 데이터 로드
    function loadData(user) {
        if (!user) {
            console.error("사용자 정보가 없습니다.");
            return;
        }

        isLoading = true;
        renderIssues();

        const q = query(collection(db, "issues"), where("userId", "==", user.uid));
        getDocs(q).then((querySnapshot) => {
            let loadedIssues = [];

            querySnapshot.forEach((doc) => {
                const issueData = { ...doc.data(), id: doc.id };
                loadedIssues.push(issueData);
            });

            issues = loadedIssues;
            projects = extractProjectsFromIssues(issues);
            localStorage.setItem('issues', JSON.stringify(issues));
            localStorage.setItem('projects', JSON.stringify(projects));

            isLoading = false;
            renderIssues();
            updateProjectList();
        }).catch(error => {
            console.error("데이터 로드 오류: ", error);
            isLoading = false;
            alert("데이터를 불러오는 중 오류가 발생했습니다.");
        });
    }

    // 인증 상태 감지
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
            projects = JSON.parse(localStorage.getItem('projects')) || [];
            renderIssues();
            updateProjectList();
        }
    });

    // 통합 모달 닫기 이벤트
    window.addEventListener('click', (event) => {
        if (event.target === modal) modal.style.display = 'none';
        if (event.target === confirmModal) confirmModal.style.display = 'none';
        if (event.target === settingsModal) settingsModal.style.display = 'none';
        if (event.target === loginModal) loginModal.style.display = 'none';
        if (event.target === logoutModal) logoutModal.style.display = 'none';
    });

    // 키보드 단축키
    document.addEventListener('keydown', (e) => {
        // ESC로 모달 닫기
        if (e.key === 'Escape') {
            modal.style.display = 'none';
            confirmModal.style.display = 'none';
            settingsModal.style.display = 'none';
            loginModal.style.display = 'none';
            logoutModal.style.display = 'none';
        }
        // Ctrl/Cmd + K로 검색 포커스
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
        }
    });
});