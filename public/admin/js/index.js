

// --- HELPER FUNCTION TO UPDATE HEADER / SIDEBAR ---
function updateSidebarUserInfo(user) {
    const nameEl = document.getElementById('displayUserName');
    const roleEl = document.getElementById('displayUserRole');
    const initialEl = document.getElementById('displayUserInitials');

    if (nameEl) nameEl.textContent = user.name || "Guest User";
    if (roleEl) roleEl.textContent = user.position || "Staff";

    if (initialEl) {
        // Logic for initials (e.g., "John Doe" -> "JD")
        const initials = user.name
            ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
            : "??";
        initialEl.textContent = initials;
    }
}

// --- ON PAGE LOAD ---
// Load the user info from localStorage and update header/sidebar
document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('loggedInUser') || localStorage.getItem('authUser');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        updateSidebarUserInfo(user);
    }
});





// --- SOUND PRIMING FOR AUTOPLAY ---
document.addEventListener('click', enableSound, { once: true });
document.addEventListener('keydown', enableSound, { once: true });

function enableSound() {
    const sound = document.getElementById('notif-sound');
    if (!sound) return;
    sound.play().then(() => {
        sound.pause();
        sound.currentTime = 0;
        console.log("🔊 Sound unlocked!");
    }).catch(() => {});
}

// --- PLAY SOUND ---
function playNotificationSound() {
    const sound = document.getElementById('notif-sound');
    if (!sound) return;
    sound.currentTime = 0;
    sound.play().catch(() => {
        console.warn("🔇 Sound blocked (needs user interaction)");
    });
}

// --- SHOW BANNER ---
function showNotificationBanner(notif) {
    const container = document.getElementById('notif-banner-container');
    const banner = document.createElement('div');
    banner.className = "bg-white border-l-4 border-[#003D7A] shadow-2xl rounded-lg p-4 flex items-center gap-4 min-w-[300px] animate-bounce-in cursor-pointer";

    banner.onclick = () => {
        if (notif.url) window.location.href = notif.url;
        markAsRead(notif._id);
    };

    banner.innerHTML = `
        <div class="text-[#003D7A] text-xl"><i class="fas fa-bell"></i></div>
        <div>
            <p class="font-bold text-gray-800 text-sm">${notif.title}</p>
            <p class="text-xs text-gray-600">${notif.message}</p>
        </div>
    `;

    container.appendChild(banner);
    setTimeout(() => {
        banner.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        setTimeout(() => banner.remove(), 500);
    }, 4000);
}

// --- UPDATE DROPDOWN BADGE ---
function updateBadge() {
    const badge = document.getElementById('notificationBadge');
    const countHeader = document.getElementById('notificationCount');
    if (!badge || !countHeader) return;

    let count = parseInt(countHeader.innerText) || 0;
    count++;
    badge.classList.remove('hidden');
    countHeader.innerText = `${count} new`;
}

// --- ADD NOTIFICATION TO DROPDOWN LIST ---
function addNotificationToUI(n) {
    const listContainer = document.getElementById('notificationsList');
    const badge = document.getElementById('notificationBadge');
    const countHeader = document.getElementById('notificationCount');
    if (!listContainer || !badge || !countHeader) return;

    // Remove placeholder if exists
    const emptyState = listContainer.querySelector('.text-gray-400');
    if (emptyState) listContainer.innerHTML = '';

    const newItem = document.createElement('div');
    newItem.className = "notification-item border-b border-gray-200 p-4 hover:bg-gray-50 cursor-pointer transition bg-blue-50";
    newItem.onclick = () => markAsRead(n._id);

    newItem.innerHTML = `
        <div class="flex gap-3">
            <div class="flex-shrink-0">
                <div class="w-10 h-10 ${getIconBg(n.type)} rounded-full flex items-center justify-center">
                    <i class="${getIcon(n.type)}"></i>
                </div>
            </div>
            <div class="flex-1">
                <p class="font-semibold text-gray-800 text-sm">${n.title}</p>
                <p class="text-xs text-gray-600 mt-1">${n.message}</p>
                <p class="text-xs text-gray-400 mt-2">Just now</p>
            </div>
            <div class="w-2 h-2 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
        </div>
    `;
    listContainer.prepend(newItem);
}

// --- MARK NOTIFICATION AS READ ---
async function markAsRead(id) {
    try {
        await fetch(`/api/notifications/mark-read/${id}`, { method: 'PUT' });
        refreshNotifications();
    } catch (err) {
        console.error("Error marking read:", err);
    }
}

// --- MARK ALL AS READ ---
async function markAllAsRead(e) {
    e.stopPropagation();
    try {
        await fetch('/api/notifications/mark-all-read', { method: 'PUT' });
        refreshNotifications();
    } catch (err) {
        console.error(err);
    }
}

// --- REFRESH NOTIFICATION LIST ---
async function refreshNotifications() {
    try {
        const response = await fetch('/api/notifications/all?recipientRole=admin');
        const notifications = await response.json();

        const listContainer = document.getElementById('notificationsList');
        const badge = document.getElementById('notificationBadge');
        const countHeader = document.getElementById('notificationCount');
        if (!listContainer || !badge || !countHeader) return;

        const unreadNotifications = notifications.filter(n => !n.isRead);
        const unreadCount = unreadNotifications.length;

        if (unreadCount > 0) {
            badge.classList.remove('hidden');
            countHeader.innerText = `${unreadCount} new`;
        } else {
            badge.classList.add('hidden');
            countHeader.innerText = `0 new`;
        }

        if (notifications.length === 0) {
            listContainer.innerHTML = `
                <div class="p-8 text-center text-gray-400">
                    <i class="fas fa-bell-slash text-3xl mb-2"></i>
                    <p class="text-sm">No notifications yet</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = notifications.map(n => `
            <div class="notification-item border-b border-gray-200 p-4 hover:bg-gray-50 cursor-pointer transition ${n.isRead ? 'bg-white' : 'bg-blue-50'}"
                 onclick="markAsRead('${n._id}')">
                <div class="flex gap-3">
                    <div class="flex-shrink-0">
                        <div class="w-10 h-10 ${getIconBg(n.type)} rounded-full flex items-center justify-center">
                            <i class="${getIcon(n.type)}"></i>
                        </div>
                    </div>
                    <div class="flex-1">
                        <p class="font-semibold ${n.isRead ? 'text-gray-600' : 'text-gray-800'} text-sm">${n.title}</p>
                        <p class="text-xs text-gray-600 mt-1">${n.message}</p>
                        <p class="text-xs text-gray-400 mt-2">${timeAgo(n.createdAt)}</p>
                    </div>
                    ${!n.isRead ? '<div class="w-2 h-2 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>' : ''}
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error refreshing notifications:", err);
    }
}

async function triggerNotification(title, message, type, url = null) {
    try {
        await fetch('/api/notifications/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, message, type, url })
        });
    } catch (err) {
        console.error("Notification trigger failed:", err);
    }
}

// --- ICON HELPERS ---
function getIcon(type) {
    if (type === 'PAYROLL') return 'fas fa-file-invoice-dollar text-green-600';
    if (type === 'ATTENDANCE') return 'fas fa-user-clock text-orange-600';
    return 'fas fa-user-plus text-blue-600';
}

function getIconBg(type) {
    if (type === 'PAYROLL') return 'bg-green-100';
    if (type === 'ATTENDANCE') return 'bg-orange-100';
    return 'bg-blue-100';
}

// --- TIME AGO HELPER ---
function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}

// --- INITIAL LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    refreshNotifications();
});

// --- DROPDOWN TOGGLE ---
const notifBtn = document.getElementById('notificationBtn');
const notifDropdown = document.getElementById('notificationDropdown');

notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle('hidden');
    if (!notifDropdown.classList.contains('hidden')) {
        refreshNotifications();
    }
});
document.addEventListener('click', () => notifDropdown.classList.add('hidden'));



    // Load external content files
        function loadContent(page) {
            const contentArea = document.getElementById('contentArea');
            
            // Update active nav link
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('bg-blue-50', 'border-l-4', 'border-[#003D7A]', 'text-[#003D7A]');
                link.classList.add('text-gray-700', 'hover:bg-gray-100');
            });
            
            // Only update nav link if it exists (some pages like notifications don't have nav links)
            const navLink = document.querySelector(`[data-page="${page}"]`);
            if (navLink) {
                navLink.classList.add('bg-blue-50', 'border-l-4', 'border-[#003D7A]', 'text-[#003D7A]');
                navLink.classList.remove('text-gray-700', 'hover:bg-gray-100');
            }
            

            // Load external page file
            const pageFile = `./pages/${page}.html`;
            
            fetch(pageFile)
                .then(response => {
                    if (!response.ok) throw new Error('Page not found');
                    return response.text();
                })
                .then(html => {
                    contentArea.innerHTML = html;
                    // Re-initialize scripts for loaded content
                    initializePageScripts(page);
                })
                .catch(error => {
                    contentArea.innerHTML = `<div class="text-center text-red-500 mt-20"><p>Error loading page: ${error.message}</p></div>`;
                });


        }

        function initializePageScripts(page){

    if(page === "employees"){
        requestAnimationFrame(loadEmployees);
    }

}

async function loadEmployees(page = 1) {
    try {
        console.log("Loading employees...");

        // 1. Grab filter values
        const search = document.getElementById('employeeSearch')?.value || "";
        const role = document.getElementById('roleFilter')?.value || ""; 
        const status = document.getElementById('statusFilter')?.value || "";

        // 2. Fetch with query parameters
        const url = `/api/employees/list?page=${page}&search=${encodeURIComponent(search)}&role=${role}&status=${status}`;
        const response = await fetch(url);
        const data = await response.json(); 

        const tableBody = document.getElementById('employeeTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = "";

        if (!data.employees || data.employees.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-10 text-center text-gray-500 italic">No employees found matching your criteria.</td></tr>`;
            return;
        }

        data.employees.forEach(emp => {
            const initials = (emp.fullName || "??")
                .split(" ")
                .filter(n => n).map(n => n[0]).join("")
                .substring(0, 2).toUpperCase();

            // Dynamic Status Colors
            let statusClass = 'bg-gray-100 text-gray-700';
            if (emp.status === 'Active') statusClass = 'bg-green-100 text-green-700';
            else if (emp.status === 'Inactive') statusClass = 'bg-red-100 text-red-700';
            else if (emp.status === 'On Leave') statusClass = 'bg-yellow-100 text-yellow-700';

            const row = `
            <tr class="border-b border-gray-200 hover:bg-gray-50 transition">
    <td class="px-6 py-4">
        <div class="flex items-center gap-3">
            <img 
    src="${emp.profilePic}" 
    class="w-8 h-8 rounded-full object-cover border"
    onerror="this.src='/images/default-avatar.png'"
/>
            <div>
                <div class="font-medium text-gray-900">${emp.fullName}</div>
                <div class="text-[10px] text-gray-400">${emp.employeeId}</div>
            </div>
        </div>
    </td>

    <td class="px-6 py-4">
        <div class="text-sm text-gray-600">${emp.email || 'N/A'}</div>
        <div class="text-[10px] text-gray-400">${emp.phoneNumber || 'N/A'}</div>
    </td>

    <td class="px-6 py-4 text-sm text-gray-600 uppercase font-semibold">${emp.role}</td>
    <td class="px-6 py-4 text-sm text-gray-600">${emp.position}</td>

    <td class="px-6 py-4 text-sm">
        <span class="px-2 py-1 rounded-full ${statusClass} text-xs font-medium">${emp.status}</span>
    </td>

    <td class="px-6 py-4 text-sm text-gray-600">${emp.hireDate || 'N/A'}</td>

    <td class="px-6 py-4 text-sm">
  <div class="flex gap-2">
   <button onclick="editEmployee('${emp.employeeId}', '${emp.role}')" 
        class="p-2 text-blue-600 hover:bg-blue-50 rounded transition">
  <i class="fas fa-edit"></i>
</button>
    <button onclick="deleteEmployee('${emp.employeeId}', '${emp.role}')" class="p-2 text-red-600 hover:bg-red-50 rounded transition flex items-center justify-center">
      <i class="fas fa-trash"></i>
    </button>
  </div>
</td>
</tr>`;
            tableBody.insertAdjacentHTML("beforeend", row);
        });

        // Update pagination UI text (e.g., "Showing 1 to 10 of 50")
        if(typeof updatePagination === "function") updatePagination(data);

    } catch (error) {
        console.error("Employee fetch failed:", error);
    }
}



async function editEmployee(employeeId, role) {
    console.log("Edit employee:", employeeId, role);

    // --- 1. Open the modal first ---
    // If the modal doesn't exist yet, openAddEmployeeModal() will create it
    await openAddEmployeeModal(); 

    // --- 2. Now safely select modal ---
    const modal = document.getElementById('addEmployeeModal');
    if (!modal) return alert("Modal failed to load.");

    // Change header
    modal.querySelector('h2').textContent = "Edit Employee";

    // Change submit button
    const submitBtn = document.getElementById('onboardBtn');
    submitBtn.innerHTML = `<i class="fas fa-save"></i> Update Employee`;

    // Override click to call updateEmployee
    submitBtn.onclick = (e) => {
        e.preventDefault();
        updateEmployee(employeeId, role);
    };

    // --- 3. Fetch employee data ---
    try {
        const res = await fetch(`/api/employees/${role}/${employeeId}`);
        if (!res.ok) throw new Error('Failed to fetch employee');
        const data = await res.json();
        const emp = data.employee;

        // Populate form fields
        document.getElementById('employeeID').value = emp.employeeId || '';
        document.getElementById('firstName').value = emp.firstName || '';
        document.getElementById('lastName').value = emp.lastName || '';
        document.getElementById('middleName').value = emp.middleName || '';
        document.getElementById('suffix').value = emp.suffix || '';
        document.getElementById('gender').value = emp.gender || '';
        document.getElementById('dob').value = emp.dob ? new Date(emp.dob).toISOString().slice(0,10) : '';
        document.getElementById('email').value = emp.email || '';
        document.getElementById('phone').value = emp.phoneNumber || '';
        document.getElementById('address').value = emp.address || '';
        document.getElementById('emergency').value = emp.emergencyNo || '';
        document.getElementsByName('emergencyName')[0].value = emp.emergencyName || '';
        document.getElementsByName('emergencyRelation')[0].value = emp.emergencyRelation || '';
        document.getElementById('department').value = emp.department || '';
        document.getElementById('position').value = emp.position || '';
        document.getElementById('grade').value = emp.grade || '';
        document.getElementById('contractType').value = emp.contractType || '';

        // Profile picture preview
        const imagePreview = document.getElementById('imagePreview');
        const uploadPlaceholder = document.getElementById('uploadPlaceholder');
        if (emp.profilePic) {
            imagePreview.src = emp.profilePic;
            imagePreview.classList.remove('hidden');
            uploadPlaceholder.classList.add('hidden');
        }

        // Documents
        if (emp.documents && emp.documents.length > 0) {
            const container = document.getElementById('documentsContainer');
            container.innerHTML = '';
            emp.documents.forEach(doc => addDocument(doc));
        }

    } catch (err) {
        console.error("Error fetching employee:", err);
        alert("Failed to load employee data");
    }
}

async function updateEmployee(employeeId, role) {
    const form = document.getElementById('addEmployeeForm');
    const formData = new FormData(form);

    // Remove empty file input if no new file selected
    const fileInput = form.querySelector('input[type="file"][name="profilePic"]');
    if (fileInput && fileInput.files.length === 0) formData.delete('profilePic');

    try {
        const res = await fetch(`/api/employees/${role}/${employeeId}`, {
            method: 'PUT',
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Update failed");

        alert("Employee updated successfully!");

        // --- CLOSE MODAL AND CLEAR FORM ---
        const modal = document.getElementById('addEmployeeModal');
        if (modal) modal.classList.add('hidden');
        form.reset();
        const imagePreview = document.getElementById('imagePreview');
        const uploadPlaceholder = document.getElementById('uploadPlaceholder');
        if (imagePreview) { imagePreview.src = ''; imagePreview.classList.add('hidden'); }
        if (uploadPlaceholder) uploadPlaceholder.classList.remove('hidden');

        // Reload employee list or table
        loadEmployees(); // your function to refresh the list
    } catch (err) {
        console.error("Update Error:", err);
        alert("Error updating employee: " + err.message);
    }
}


// Function to show the modal
function deleteEmployee(employeeId, role) {
    const modal = document.getElementById('deleteModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    
    // Show the modal
    modal.classList.remove('hidden');

    // Attach the actual delete logic to the Red button
    confirmBtn.onclick = async () => {
        // Change button state to show processing
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Deleting...`;

        try {
            const res = await fetch(`/api/employees/${role}/${employeeId}`, {
                method: "DELETE"
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "Failed to delete");

            // Success! 
            closeDeleteModal();
            loadEmployees(); // Refresh the table
            
            // Optional: A non-intrusive toast notification instead of alert
            console.log("Deleted successfully");

        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        } finally {
            // Reset button state
            confirmBtn.disabled = false;
            confirmBtn.innerText = "Delete";
        }
    };
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
}

function updatePagination(data) {
    const info = document.getElementById('paginationInfo');
    const controls = document.getElementById('paginationControls');
    if (!info || !controls) return;

    // Use the exact keys returned by the backend
    const currentPage = data.page; 
    const totalPages = data.pages;
    const totalEmployees = data.total;
    
    // Constant limit used in backend
    const pageSize = 10; 
    
    // 1. Update the Summary Text
    const start = totalEmployees > 0 ? (currentPage - 1) * pageSize + 1 : 0;
    const end = Math.min(currentPage * pageSize, totalEmployees);

    info.innerText = totalEmployees > 0 
        ? `Showing ${start} to ${end} of ${totalEmployees} employees`
        : `Showing 0 employees`;

    // 2. Clear and Generate Buttons
    let html = '';

    // Previous Button
    html += `
        <button onclick="loadEmployees(${currentPage - 1})" 
            class="w-8 h-8 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            ${currentPage <= 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>`;

    // Page Numbers (with simple logic to avoid huge button lists)
    for (let i = 1; i <= totalPages; i++) {
        const isActive = i === currentPage;
        const activeClass = isActive 
            ? 'bg-blue-800 text-white font-medium shadow-sm' 
            : 'border border-gray-300 text-gray-600 hover:bg-gray-100';
        
        html += `
            <button onclick="loadEmployees(${i})" 
                class="w-8 h-8 rounded transition ${activeClass}">
                ${i}
            </button>`;
    }

    // Next Button
    html += `
        <button onclick="loadEmployees(${currentPage + 1})" 
            class="w-8 h-8 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            ${currentPage >= totalPages || totalPages === 0 ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>`;

    controls.innerHTML = html;
}
        // Initialize scripts for each page
        function initializePageScripts(page) {


             if(page === "employees"){
               setTimeout(loadEmployees, 200);
           }

            if (page === 'dashboard') {
                // Employee Profile Modal functions
                window.viewEmployeeProfile = function(name, initials, position, department, performance, rating, awards, tenure) {
                    document.getElementById('modalEmployeeName').textContent = name;
                    document.getElementById('modalEmployeeInitials').textContent = initials;
                    document.getElementById('modalEmployeeRole').textContent = position + ' • ' + department;
                    document.getElementById('modalPerformance').textContent = performance;
                    document.getElementById('modalRating').textContent = rating;
                    document.getElementById('modalAwards').textContent = awards;
                    document.getElementById('modalTenure').textContent = tenure;
                    document.getElementById('employeeProfileModal').classList.remove('hidden');
                };

                window.closeEmployeeProfileModal = function() {
                    document.getElementById('employeeProfileModal').classList.add('hidden');
                };

                window.goToFullProfile = function() {
                    closeEmployeeProfileModal();
                    loadContent('employees');
                };

                // Close modal when clicking outside
                const profileModal = document.getElementById('employeeProfileModal');
                if (profileModal) {
                    profileModal.addEventListener('click', function(e) {
                        if (e.target === this) {
                            closeEmployeeProfileModal();
                        }
                    });
                }
            } 
            
            
        
            
            else if (page === 'employees') {
    // Export dropdown toggle
    window.toggleExportDropdown = function() {
        const dropdown = document.getElementById('exportDropdown');
        dropdown.classList.toggle('hidden');
    };

    // Export to Excel
    window.exportToExcel = function() {
        document.getElementById('exportDropdown').classList.add('hidden');
        showExportModal('excel');
    };

    // Export to PDF
    window.exportToPDF = function() {
        document.getElementById('exportDropdown').classList.add('hidden');
        showExportModal('pdf');
    };

    // Show Export Modal & Generate Real File
    window.showExportModal = function(type) {
        const modal = document.getElementById('exportModal');
        const icon = document.getElementById('exportIcon');
        const title = document.getElementById('exportTitle');
        const message = document.getElementById('exportMessage');
        const progressBar = document.getElementById('exportProgressBar');
        const closeBtn = document.getElementById('exportCloseBtn');
        const progress = document.getElementById('exportProgress');

        // Reset Modal State
        closeBtn.classList.add('hidden');
        progress.classList.remove('hidden');
        progressBar.style.width = '0%';
        modal.classList.remove('hidden');

        if (type === 'excel') {
            icon.innerHTML = '<i class="fas fa-spinner fa-spin text-green-600 text-2xl"></i>';
            icon.className = 'w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4';
            title.textContent = 'Preparing Excel File...';
        } else {
            icon.innerHTML = '<i class="fas fa-spinner fa-spin text-red-600 text-2xl"></i>';
            icon.className = 'w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4';
            title.textContent = 'Preparing PDF File...';
        }

        // Simulate a brief "preparation" phase before triggering real download
        let progressValue = 0;
        const interval = setInterval(() => {
            progressValue += 25;
            progressBar.style.width = progressValue + '%';

            if (progressValue >= 100) {
                clearInterval(interval);
                
                // --- REAL FILE GENERATION START ---
                const table = document.querySelector('table'); // Targets the employee table
                
                if (type === 'excel') {
                    const wb = XLSX.utils.table_to_book(table, { sheet: "Employees" });
                    XLSX.writeFile(wb, "Employee_Roster.xlsx");
                    
                    icon.innerHTML = '<i class="fas fa-check text-green-600 text-2xl"></i>';
                    title.textContent = 'Excel Downloaded!';
                    closeBtn.innerHTML = '<i class="fas fa-check mr-2"></i> Finished';
                } else {
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF();
                    doc.text("Employee Roster", 14, 15);
                    doc.autoTable({ html: table, startY: 20 });
                    doc.save("Employee_Roster.pdf");
                    
                    icon.innerHTML = '<i class="fas fa-check text-red-600 text-2xl"></i>';
                    title.textContent = 'PDF Downloaded!';
                    closeBtn.innerHTML = '<i class="fas fa-check mr-2"></i> Finished';
                }
                // --- REAL FILE GENERATION END ---

                message.textContent = 'Your file has been generated and saved.';
                progress.classList.add('hidden');
                closeBtn.classList.remove('hidden');
            }
        }, 100);
    };

    // Close Export Modal
    window.closeExportModal = function() {
        document.getElementById('exportModal').classList.add('hidden');
    };

    // Outside click handlers
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('exportDropdown');
        if (dropdown && !e.target.closest('.relative') && !e.target.closest('button')) {
            dropdown.classList.add('hidden');
        }
    });

    const exportModal = document.getElementById('exportModal');
    if (exportModal) {
        exportModal.addEventListener('click', function(e) {
            if (e.target === this) this.classList.add('hidden');
        });
    }




// ========== TAB & NAVIGATION LOGIC ==========
function switchTab(tabName) {
    // 1. Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    
    // 2. Show selected tab content
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) activeTab.classList.remove('hidden');

    // 3. Update Sidebar UI
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active', 'text-[#003D7A]', 'bg-blue-50', 'border-[#003D7A]');
        btn.classList.add('text-gray-600', 'border-transparent');
        
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active', 'text-[#003D7A]', 'bg-blue-50', 'border-[#003D7A]');
            btn.classList.remove('text-gray-600', 'border-transparent');
        }
    });

    // 4. Update Progress Bar
    const progressMap = { profile: 25, employment: 50, documents: 75, qr: 100 };
    const countMap = { profile: 1, employment: 2, documents: 3, qr: 4 };
    
    document.getElementById('progressBar').style.width = `${progressMap[tabName]}%`;
    document.getElementById('tabCount').innerText = countMap[tabName];
}



// ========== AUTO-GENERATION & VALIDATION ==========
function openAddEmployeeModal() {
    document.getElementById('addEmployeeModal').classList.remove('hidden');
    // Generate a temporary ID (e.g., EMP-2026-XXXX)
    const tempId = 'EMP-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
    document.getElementById('employeeID').value = tempId;
    document.getElementById('qrEmployeeID').value = tempId;
}

function closeAddEmployeeModal() {
    document.getElementById('addEmployeeModal').classList.add('hidden');
    document.getElementById('addEmployeeForm').reset();
    switchTab('profile');
}

function updateTabAvailability() {
    // Simple check: if firstName and Email are filled, show the "Next" buttons
    const isProfileDone = document.getElementById('firstName').value && document.getElementById('email').value;
    document.getElementById('profileCompleteMsg').style.display = isProfileDone ? 'flex' : 'none';
    
    const isEmploymentDone = document.getElementById('department').value && document.getElementById('manager').value;
    document.getElementById('employmentCompleteMsg').style.display = isEmploymentDone ? 'flex' : 'none';
}

}
            
            
            else if (page === 'scheduling') {

                 loadEmployees(); // ✅ ADD THIS
                 loadEmployeesBulk();
                 loadShifts();

                 
               async function renderCalendar(month, year) {
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    try {
        // ✅ Fetch shifts + employees in parallel
        const [shiftRes, empRes] = await Promise.all([
            fetch(`/api/shifts?month=${month}&year=${year}`),
            fetch('/api/employees/list')
        ]);

        const shiftData = await shiftRes.json();
        const empData = await empRes.json();

        const shifts = shiftData.shifts || [];
        const employees = empData.employees || [];

        // ✅ Create employee map for quick lookup
        const empMap = {};
        employees.forEach(emp => {
            empMap[emp.employeeId] = emp.fullName;
        });

        const daysInMonth = new Date(year, month, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'p-2 bg-white rounded border min-h-24 hover:bg-gray-50 transition';

            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

            cell.innerHTML = `<div class="text-sm font-bold mb-1">${day}</div>`;

            // ✅ FIX timezone issue
            const dayShifts = shifts.filter(s => 
                formatDate(s.date) === dateStr
            );

            dayShifts.forEach(s => {
                const tag = document.createElement('div');

                // 🎨 Department color coding
                let colorClass = 'bg-blue-100 text-blue-700';
                if (s.department === 'icu') colorClass = 'bg-red-100 text-red-700';
                if (s.department === 'emergency') colorClass = 'bg-yellow-100 text-yellow-700';
                if (s.department === 'ward') colorClass = 'bg-green-100 text-green-700';

                tag.className = `${colorClass} text-xs px-2 py-1 rounded mt-1 cursor-move`;

                // ✅ Show employee name instead of ID
                const name = empMap[s.employeeId] || s.employeeId;

                tag.textContent = `${name} (${s.shift[0].toUpperCase()})`;

                // ===== DRAG =====
                tag.draggable = true;
                tag.dataset.shiftId = s._id;
                tag.addEventListener('dragstart', dragStart);

                // ===== CLICK TO EDIT (optional but ready) =====
                tag.addEventListener('click', () => openEditShiftModal(s));

                cell.appendChild(tag);
            });

            // ===== DROP TARGET =====
            cell.dataset.date = dateStr;

            cell.addEventListener('dragover', e => e.preventDefault());

            cell.addEventListener('drop', dropShift);

            grid.appendChild(cell);
        }

    } catch (err) {
        console.error('Error rendering calendar:', err);
    }
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function openEditShiftModal(shift) {
    console.log('Edit shift:', shift);

    // Example:
    document.getElementById('quickAssignEmployee').value = shift.employeeId;
    document.getElementById('quickAssignShift').value = shift.shift;
    document.getElementById('quickAssignDate').value = formatDate(shift.date);
    document.getElementById('quickAssignDept').value = shift.department;

    openModal('quickAssignModal');
}
                window.openModal = function(modalId) {
                    const modal = document.getElementById(modalId);
                    if (modal) {
                        modal.classList.remove('hidden');
                    }
                };
async function loadEmployees() {
    try {
        const res = await fetch('/api/employees/list');
        const data = await res.json();

        const select = document.getElementById('quickAssignEmployee');
        select.innerHTML = '<option value="">Choose an employee</option>';

        data.employees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.employeeId; // ✅ IMPORTANT
            option.textContent = `${emp.fullName} - ${emp.position}`;
            select.appendChild(option);
        });

    } catch (err) {
        console.error('Failed to load employees', err);
    }
}
async function loadEmployeesBulk() {
    try {
        console.log('Fetching employees...'); // debug

        const res = await fetch('/api/employees/list');

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        console.log('Employee data received:', data);

        if (!data.employees || !Array.isArray(data.employees)) {
            throw new Error('Invalid employee data format');
        }

        const container = document.getElementById('bulkEmployeeContainer');
        if (!container) {
            throw new Error('Container #bulkEmployeeContainer not found in DOM');
        }
        container.innerHTML = ''; // clear existing content

        const colorClasses = [
            { bg: 'bg-blue-100', text: 'text-blue-700' },
            { bg: 'bg-green-100', text: 'text-green-700' },
            { bg: 'bg-purple-100', text: 'text-purple-700' },
            { bg: 'bg-orange-100', text: 'text-orange-700' },
            { bg: 'bg-pink-100', text: 'text-pink-700' },
            { bg: 'bg-teal-100', text: 'text-teal-700' },
        ];

        data.employees.forEach(emp => {
            const initials = emp.fullName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

            const color = colorClasses[Math.floor(Math.random() * colorClasses.length)];

            const label = document.createElement('label');
            label.className = 'flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer';

            label.innerHTML = `
    <input 
        type="checkbox" 
        class="bulk-staff-cb w-4 h-4 text-green-600 rounded focus:ring-green-500" 
        value="${emp.employeeId}"
        data-name="${emp.fullName}">
    <div class="w-8 h-8 ${color.bg} ${color.text} rounded-full flex items-center justify-center text-xs font-bold">
        ${initials}
    </div>
    <div>
        <p class="text-sm font-medium text-gray-900">${emp.fullName}</p>
        <p class="text-xs text-gray-500">${emp.position}</p>
    </div>
`;

            container.appendChild(label);
        });

        console.log('Employees rendered successfully');
    } catch (err) {
        console.error('Failed to load employees:', err);
    }
}

async function loadShifts() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    try {
        const res = await fetch(`/api/shifts?month=${month}&year=${year}`);
        const data = await res.json();

        if (!data.success) throw new Error('Failed to load shifts');

        const shifts = data.shifts;

        if (currentView === 'month') {
            renderCalendar(month, year, shifts); // ✅ pass shifts
        } else {
            renderWeek(today, shifts); // ✅ pass shifts
        }

    } catch (err) {
        console.error('Error loading shifts', err);
    }
}


function renderWeek(date) {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());

    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);

        const cell = document.createElement('div');
        cell.className = 'p-4 border';

        cell.innerHTML = `
            <div class="font-bold">${d.toDateString()}</div>
        `;

        grid.appendChild(cell);
    }
}


let draggedShiftId = null;

function dragStart(e) {
    draggedShiftId = e.target.dataset.shiftId;
}

async function dropShift(e) {
    const newDate = e.currentTarget.dataset.date;

    if (!draggedShiftId) return;

    try {
        // Fetch the dragged shift details first
        const shiftRes = await fetch(`/api/shifts/${draggedShiftId}`);
        const shiftData = await shiftRes.json();

        if (!shiftData.success) throw new Error('Failed to get shift details');

        const employeeId = shiftData.shift.employeeId;

        // Check if the employee already has a shift on the new date
        const checkRes = await fetch(`/api/shifts/check?employeeId=${employeeId}&date=${newDate}`);
        const checkData = await checkRes.json();

        if (!checkData.success) throw new Error('Failed to check existing shifts');

        if (checkData.exists) {
            alert('❌ Employee already has a shift on this date');
            return; // stop the drop
        }

        // Proceed to update the shift
        await fetch(`/api/shifts/${draggedShiftId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: newDate })
        });

        loadShifts(); // reload calendar
    } catch (err) {
        console.error(err);
        alert('❌ Error moving shift');
    } finally {
        draggedShiftId = null; // reset
    }
}

let currentView = 'month';

function setView(view) {
    currentView = view;
    loadShifts();
}

              
                // ====== QUICK ASSIGN FUNCTIONS ======
                window.closeQuickAssignModal = function() {
                    document.getElementById('quickAssignModal').classList.add('hidden');
                    document.getElementById('quickAssignEmployee').value = '';
                    document.getElementById('quickAssignShift').value = '';
                    document.getElementById('quickAssignDate').value = '';
                    document.getElementById('quickAssignDept').value = 'opd';
                    document.getElementById('quickAssignNotes').value = '';
                };

                window.saveQuickAssign = async function() {
    const employeeId = document.getElementById('quickAssignEmployee').value;
    const shift = document.getElementById('quickAssignShift').value;
    const date = document.getElementById('quickAssignDate').value;
    const notes = document.getElementById('quickAssignNotes').value;

    if (!employeeId || !shift || !date) {
        alert('Please fill in all required fields');
        return;
    }

    try {
        const res = await fetch('/api/shifts/assign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                employeeId,
                date,
                shift,
                notes
            })
        });

        const data = await res.json();

        if (data.success) {
            alert('✅ Shift saved successfully!');
            closeQuickAssignModal();

            // OPTIONAL: reload shifts on calendar
            loadShifts();
        } else {
            alert('❌ Failed to save shift');
        }

    } catch (err) {
        console.error(err);
        alert('❌ Server error');
    }
};

                const quickAssignModal = document.getElementById('quickAssignModal');
                if (quickAssignModal) {
                    quickAssignModal.addEventListener('click', function(e) {
                        if (e.target === this) closeQuickAssignModal();
                    });
                }

                // ====== BULK ASSIGN FUNCTIONS ======
                window.bulkAssignStep = 1;

                window.closeBulkAssignModal = function() {
                    document.getElementById('bulkAssignModal').classList.add('hidden');
                    resetBulkAssign();
                };

                window.resetBulkAssign = function() {
                    window.bulkAssignStep = 1;
                    updateBulkAssignStep();
                    document.querySelectorAll('.bulk-staff-cb').forEach(cb => cb.checked = false);
                    document.getElementById('selectAllStaff').checked = false;
                    document.getElementById('bulkStartDate').value = '';
                    document.getElementById('bulkEndDate').value = '';
                    document.getElementById('bulkShiftPattern').value = '';
                    updateSelectedStaffCount();
                };

                window.toggleSelectAllStaff = function() {
                    const selectAll = document.getElementById('selectAllStaff').checked;
                    document.querySelectorAll('.bulk-staff-cb').forEach(cb => cb.checked = selectAll);
                    updateSelectedStaffCount();
                };

                window.updateSelectedStaffCount = function() {
                    const count = document.querySelectorAll('.bulk-staff-cb:checked').length;
                    document.getElementById('selectedStaffCount').textContent = count + ' employees selected';
                };

                document.querySelectorAll('.bulk-staff-cb').forEach(cb => {
                    cb.addEventListener('change', updateSelectedStaffCount);
                });

                window.updateBulkAssignStep = function() {
                    for (let i = 1; i <= 3; i++) {
                        const stepEl = document.getElementById('bulkStep' + i);
                        const contentEl = document.getElementById('bulkStepContent' + i);
                        
                        if (i <= window.bulkAssignStep) {
                            stepEl.className = 'w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm';
                        } else {
                            stepEl.className = 'w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold text-sm';
                        }

                        contentEl.classList.toggle('hidden', i !== window.bulkAssignStep);
                    }

                    document.getElementById('bulkBackBtn').classList.toggle('hidden', window.bulkAssignStep === 1);
                    document.getElementById('bulkNextBtn').classList.toggle('hidden', window.bulkAssignStep === 3);
                    document.getElementById('bulkConfirmBtn').classList.toggle('hidden', window.bulkAssignStep !== 3);
                };

                window.bulkAssignNext = function() {
    if (window.bulkAssignStep === 1) {
        if (document.querySelectorAll('.bulk-staff-cb:checked').length === 0) {
            alert('Please select at least one employee');
            return;
        }
    } else if (window.bulkAssignStep === 2) {
        const startDate = document.getElementById('bulkStartDate').value;
        const endDate = document.getElementById('bulkEndDate').value;
        const pattern = document.getElementById('bulkShiftPattern').value;
        if (!startDate || !endDate || !pattern) {
            alert('Please fill in all required fields');
            return;
        }

        // Get selected employees
        const selectedEmployees = Array.from(document.querySelectorAll('.bulk-staff-cb:checked'))
            .map(cb => ({ id: cb.value, name: cb.dataset.name }));

        // Update summary counts
        document.getElementById('previewStaffCount').textContent = selectedEmployees.length + ' employees';
        document.getElementById('previewDateRange').textContent = startDate + ' - ' + endDate;
        const shiftType = document.getElementById('bulkShiftType').value;
        document.getElementById('previewPattern').textContent = shiftType.charAt(0).toUpperCase() + shiftType.slice(1) + ' Shift';

        // Total shifts (for info)
        const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
        document.getElementById('previewTotalShifts').textContent = (days * selectedEmployees.length) + ' shifts';

        // Build the week table (7 days starting from startDate)
        const tbody = document.querySelector('#bulkStepContent3 tbody');
        tbody.innerHTML = ''; // Clear previous

        // Function to get 7 consecutive dates starting from startDate
        const getWeekDates = (start) => {
            const weekDates = [];
            const startD = new Date(start);
            for (let i = 0; i < 7; i++) {
                const d = new Date(startD);
                d.setDate(startD.getDate() + i);
                weekDates.push(d);
            }
            return weekDates;
        };

        const weekDates = getWeekDates(startDate);

        // Update table headers dynamically to show Mon, Tue, etc.
        const headers = document.querySelectorAll('#bulkStepContent3 thead th');
        weekDates.forEach((d, i) => {
            headers[i + 1].textContent = d.toLocaleDateString('en-US', { weekday: 'short' });
        });

        // Populate rows
        selectedEmployees.forEach(emp => {
            const tr = document.createElement('tr');
            let rowHtml = `<td class="px-4 py-2 font-medium">${emp.name}</td>`;
            weekDates.forEach(() => {
                rowHtml += `<td class="px-4 py-2"><span class="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">${shiftType.charAt(0).toUpperCase()}</span></td>`;
            });
            tr.innerHTML = rowHtml;
            tbody.appendChild(tr);
        });
    }

    window.bulkAssignStep++;
    updateBulkAssignStep();
};

                window.bulkAssignBack = function() {
                    window.bulkAssignStep--;
                    updateBulkAssignStep();
                };

                window.confirmBulkAssign = async function() {
    const selectedEmployees = Array.from(document.querySelectorAll('.bulk-staff-cb:checked'))
        .map(cb => cb.value);

    const startDate = document.getElementById('bulkStartDate').value;
    const endDate = document.getElementById('bulkEndDate').value;
    const shift = document.getElementById('bulkShiftType').value;

    if (!selectedEmployees.length || !startDate || !endDate || !shift) {
        alert('Missing required fields');
        return;
    }

    let current = new Date(startDate);
    const last = new Date(endDate);

    let requests = [];

    while (current <= last) {
        const formattedDate = current.toISOString().split('T')[0];

        selectedEmployees.forEach(empId => {
            requests.push(
                fetch('/api/shifts/assign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        employeeId: empId,
                        date: formattedDate,
                        shift
                    
                    })
                })
            );
        });

        current.setDate(current.getDate() + 1);
    }

    try {
        await Promise.all(requests);

        alert('✅ Bulk shifts assigned successfully!');
        closeBulkAssignModal();
        loadShifts();

    } catch (err) {
        console.error(err);
        alert('❌ Error saving bulk shifts');
    }
};

                const bulkAssignModal = document.getElementById('bulkAssignModal');
                if (bulkAssignModal) {
                    bulkAssignModal.addEventListener('click', function(e) {
                        if (e.target === this) closeBulkAssignModal();
                    });
                }

            
            } else if (page === 'payroll') {
                // Initialize payroll tab functionality
                window.switchPayrollTab = function(tabName, clickedBtn) {
                    // Hide all tab content
                    const tabContents = document.querySelectorAll('.payroll-tab-content');
                    tabContents.forEach(content => content.classList.add('hidden'));

                    // Show selected tab content
                    const selectedTab = document.getElementById(tabName + '-tab');
                    if (selectedTab) {
                        selectedTab.classList.remove('hidden');
                    }

                    // Update active button styling - remove active from all
                    const buttons = document.querySelectorAll('.payroll-tab');
                    buttons.forEach(btn => {
                        btn.classList.remove('border-[#003D7A]', 'text-[#003D7A]');
                        btn.classList.add('border-transparent', 'text-gray-600');
                    });

                    // Add active styling to clicked button
                    if (clickedBtn) {
                        clickedBtn.classList.remove('border-transparent', 'text-gray-600');
                        clickedBtn.classList.add('border-[#003D7A]', 'text-[#003D7A]');
                    }
                };

                
               

                // Add click outside listener for employee salary modal
                const employeeSalaryModal = document.getElementById('employeeSalaryModal');
                if (employeeSalaryModal) {
                    employeeSalaryModal.addEventListener('click', function(e) {
                        if (e.target === this) closeEmployeeSalaryModal();
                    });
                }

 // --- GLOBAL STATE ---
let currentPage = 1;
const rowsPerPage = 5; 
let allEmployees = []; 

// This function now just resets the page and triggers the render engine
window.handleSearch = function() {
    const searchInput = document.getElementById('payroll-search');
    const searchTerm = searchInput.value.trim();
    
    // Optional: Show/Hide a clear button if you add one to the HTML
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) {
        clearBtn.style.display = searchTerm.length > 0 ? 'block' : 'none';
    }

    currentPage = 1; 
    renderTablePage();
}

// --- 1. INITIAL FETCH ---
async function fetchAndRenderPayroll() {
    try {
        const response = await fetch('/api/employees/payroll-list');
        const result = await response.json();
        
        if (result.success && result.employees) {
            allEmployees = result.employees; 
            renderTablePage(); 
        }
    } catch (err) {
        console.error("Error fetching live payroll:", err);
    }
}
let payrollStats = [];

async function loadPayrollData() {
    const btn = document.querySelector('button[onclick="loadPayrollData()"]');
    const originalContent = btn.innerHTML;
    
    try {
        // Change button to loading state
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Calculating...';
        btn.disabled = true;

        const start = document.getElementById('startDate')?.value;
        const end = document.getElementById('endDate')?.value;

        let url = '/api/payroll/calculate-all';
        if (start && end) {
            url += `?startDate=${start}&endDate=${end}`;
        }

        const response = await fetch(url);
        payrollStats = await response.json();
        
        currentPage = 1;
        renderTablePage();
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        // Restore button state
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

// --- 2. RENDER ENGINE (Handles Paging & Tables) ---
function renderTablePage() {
    const payrollBody = document.querySelector('#employee-tab table tbody');
    const allowanceBody = document.querySelector('#allowances-tab table tbody');
    const deductionsBody = document.querySelector('#deductions-tab table tbody');
    const mastersBody = document.querySelector('#masters-tab tbody');

    if (!payrollBody || !allowanceBody || !deductionsBody || !mastersBody) return;

    const searchTerm = document.getElementById('payroll-search')?.value.toLowerCase().trim() || '';
    const activeList = searchTerm 
        ? allEmployees.filter(emp => 
            (emp.fullName && emp.fullName.toLowerCase().includes(searchTerm)) || 
            (emp.employeeId && emp.employeeId.toLowerCase().includes(searchTerm)))
        : allEmployees;

    payrollBody.innerHTML = ''; 
    allowanceBody.innerHTML = '';
    deductionsBody.innerHTML = '';
    mastersBody.innerHTML = '';

    if (activeList.length === 0) {
        const noResultsHTML = `<tr><td colspan="12" class="text-center py-10 text-gray-500 italic">No employees found matching "${searchTerm}"</td></tr>`;
        [payrollBody, allowanceBody, deductionsBody, mastersBody].forEach(el => el.innerHTML = noResultsHTML);
        updatePaginationUI(0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedEmployees = activeList.slice(startIndex, endIndex);

    let totals = { basic: 0, allowances: 0, tax: 0, sss: 0, philhealth: 0, pagibig: 0, deductions: 0, gross: 0, net: 0 };

    // --- RENDER INDIVIDUAL ROWS ---
    paginatedEmployees.forEach(emp => {
        // Find matching stats from the API data
        const stats = payrollStats.find(s => s.empId === emp.employeeId) || { 
            multiplier: 0, 
            totalWorkHours: 0, 
            payableDays: 0 
        };

        // Use the multiplier from API (actual days worked)
        
        const currentMultiplier = stats.multiplier; 
        
        // Use payableDays for salary (handles half-days correctly)
        const totalBasic = Number(emp.baseSalary || 0) * stats.payableDays; 
        const totalAllow = Number(emp.totalAllowances || 0);
        const totalDeduct = Number(emp.totalDeductions || 0);
        const grossPay = totalBasic + totalAllow;
        const netPay = grossPay - totalDeduct;

        // Update Totals for the footer
        totals.basic += totalBasic;
        totals.allowances += totalAllow;
        totals.tax += Number(emp.tax || 0);
        totals.sss += Number(emp.sss || 0);
        totals.philhealth += Number(emp.philhealth || 0);
        totals.pagibig += Number(emp.pagibig || 0);
        totals.deductions += totalDeduct;
        totals.gross += grossPay;
        totals.net += netPay;

        const initials = emp.fullName ? emp.fullName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '??';
        let imgSrc = emp.profilePic;
        if (imgSrc && !imgSrc.startsWith('http') && !imgSrc.startsWith('/')) imgSrc = '/' + imgSrc;
        const hasPhoto = imgSrc && !imgSrc.includes('default-avatar.png');

        const avatarHTML = `
            <div class="flex items-center gap-3">
                ${hasPhoto ? `<img src="${imgSrc}" class="w-10 h-10 rounded-full object-cover border border-gray-200" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : ''}
                <div class="${hasPhoto ? 'hidden' : 'flex'} w-10 h-10 bg-blue-800 text-white rounded-full items-center justify-center font-bold text-sm">${initials}</div>
                <div>
                    <p class="font-semibold text-gray-900">${emp.fullName}</p>
                    <p class="text-xs text-gray-500">${emp.employeeId}</p>
                </div>
            </div>`;

        // Employee Tab Row (Added Hours and Days)
        payrollBody.insertAdjacentHTML('beforeend', `
            <tr class="border-b border-gray-200 hover:bg-gray-50">
                <td class="px-4 py-4">${avatarHTML}</td>
                <td class="px-4 py-4 text-sm text-gray-700">${emp.position}</td>
                <td class="px-4 py-4 text-sm text-center font-medium text-blue-600">${stats.totalWorkHours} hrs</td>
                <td class="px-4 py-4 text-sm text-center font-medium text-gray-600">${currentMultiplier} days</td>
                <td class="px-4 py-4 text-sm"><span class="${getBadgeStyle(emp.contractType)} text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">${emp.contractType}</span></td>
                <td class="px-4 py-4 text-sm font-bold text-gray-900">₱${totalBasic.toLocaleString()}</td>
                <td class="px-4 py-4 text-sm text-green-600 font-semibold">+₱${totalAllow.toLocaleString()}</td>
            </tr>`);

        // Allowances Tab Row
        allowanceBody.insertAdjacentHTML('beforeend', `
            <tr class="border-b border-gray-200 hover:bg-gray-50">
                <td class="px-4 py-4">${avatarHTML}</td>
                <td class="px-4 py-4 text-sm text-gray-700">${emp.position}</td>
                <td class="px-4 py-4 text-sm font-medium text-gray-900">₱${Number(emp.housing || 0).toLocaleString()}</td>
                <td class="px-4 py-4 text-sm font-medium text-gray-900">₱${Number(emp.travel || 0).toLocaleString()}</td>
                <td class="px-4 py-4 text-sm font-medium text-gray-900">₱${Number(emp.meal || 0).toLocaleString()}</td>
                <td class="px-4 py-4 text-sm font-medium text-gray-900">₱${Number(emp.hazardPay || 0).toLocaleString()}</td>
                <td class="px-4 py-4">
                    <button onclick="openEditAllowancesModal('${emp.fullName}', '${emp.employeeId}', '${emp.position}', ${emp.housing || 0}, ${emp.travel || 0}, ${emp.meal || 0}, ${emp.hazardPay || 0})" class="text-[#003D7A] hover:text-[#0052A3]"><i class="fas fa-edit"></i></button>
                </td>
            </tr>`);

        // Deductions Tab Row
        deductionsBody.insertAdjacentHTML('beforeend', `
            <tr class="border-b border-gray-200 hover:bg-gray-50">
                <td class="px-4 py-4">${avatarHTML}</td>
                <td class="px-4 py-4 text-sm font-medium text-gray-900">₱${Number(emp.tax || 0).toLocaleString()}</td>
                <td class="px-4 py-4 text-sm font-medium text-gray-900">₱${Number(emp.philhealth || 0).toLocaleString()}</td>
                <td class="px-4 py-4 text-sm font-medium text-gray-900">₱${Number(emp.sss || 0).toLocaleString()}</td>
                <td class="px-4 py-4 text-sm font-medium text-gray-900">₱${Number(emp.pagibig || 0).toLocaleString()}</td>
                <td class="px-4 py-4 text-sm font-bold text-red-500">₱${totalDeduct.toLocaleString()}</td>
                <td class="px-4 py-4">
                    <button onclick="openEditDeductionsModal('${emp.fullName}', '${emp.employeeId}', ${emp.tax || 0}, ${emp.philhealth || 0}, ${emp.sss || 0}, ${emp.pagibig || 0})" class="text-[#003D7A] hover:text-[#0052A3]"><i class="fas fa-edit"></i></button>
                </td>
            </tr>`);

        // Masters Tab Row
        mastersBody.insertAdjacentHTML('beforeend', `
            <tr class="border-b border-gray-200 hover:bg-gray-50">
                <td class="px-4 py-3">${avatarHTML}</td>
                <td class="px-4 py-3 text-right font-semibold">₱${totalBasic.toLocaleString()}</td>
                <td class="px-4 py-3 text-right text-green-600">+₱${totalAllow.toLocaleString()}</td>
                <td class="px-4 py-3 text-right text-red-600">-₱${Number(emp.tax || 0).toLocaleString()}</td>
                <td class="px-4 py-3 text-right text-red-600">-₱${Number(emp.sss || 0).toLocaleString()}</td>
                <td class="px-4 py-3 text-right text-red-600">-₱${Number(emp.philhealth || 0).toLocaleString()}</td>
                <td class="px-4 py-3 text-right text-red-600">-₱${Number(emp.pagibig || 0).toLocaleString()}</td>
                <td class="px-4 py-3 text-right font-bold text-red-600">-₱${totalDeduct.toLocaleString()}</td>
                <td class="px-4 py-3 text-right font-semibold">₱${grossPay.toLocaleString()}</td>
                <td class="px-4 py-3 text-right font-bold text-gray-900">₱${netPay.toLocaleString()}</td>
            </tr>`);
    });

    // --- 6. ADD MASTERS TOTAL FOOTER ---
    mastersBody.insertAdjacentHTML('beforeend', `
        <tr class="bg-blue-800 text-white font-bold sticky bottom-0">
            <td class="px-4 py-3">Totals</td>
            <td class="px-4 py-3 text-right">₱${totals.basic.toLocaleString()}</td>
            <td class="px-4 py-3 text-right text-green-300">+₱${totals.allowances.toLocaleString()}</td>
            <td class="px-4 py-3 text-right">-₱${totals.tax.toLocaleString()}</td>
            <td class="px-4 py-3 text-right">-₱${totals.sss.toLocaleString()}</td>
            <td class="px-4 py-3 text-right">-₱${totals.philhealth.toLocaleString()}</td>
            <td class="px-4 py-3 text-right">-₱${totals.pagibig.toLocaleString()}</td>
            <td class="px-4 py-3 text-right">-₱${totals.deductions.toLocaleString()}</td>
            <td class="px-4 py-3 text-right">₱${totals.gross.toLocaleString()}</td>
            <td class="px-4 py-3 text-right">₱${totals.net.toLocaleString()}</td>
        </tr>`);

    // --- 7. UPDATE UI & SUMMARY CARDS ---
    updatePaginationUI(activeList.length);
    
    // Summary Card updates
    const elEmp = document.getElementById('summary-total-employees');
    const elPay = document.getElementById('summary-total-payroll');
    const elText = document.getElementById('summary-progress-text');
    const elBar = document.getElementById('summary-progress-bar');

    if (elEmp) elEmp.textContent = activeList.length.toLocaleString();
    if (elPay) elPay.textContent = `₱${totals.net.toLocaleString()}`;
    
    if (elText && elBar) {
        const percent = allEmployees.length > 0 ? Math.round((activeList.length / allEmployees.length) * 100) : 0;
        elText.textContent = `${percent}%`;
        elBar.style.width = `${percent}%`;
        elBar.className = percent < 100 ? "bg-yellow-400 h-2 rounded-full" : "bg-green-400 h-2 rounded-full";
    }
}

window.loadPayrollData = async function() {
    const monthInput = document.getElementById('payroll-month').value; // e.g., "2026-03"
    const period = document.getElementById('payroll-period').value; // "15th", "30th", or ""

    if (!monthInput) {
        alert("Please select a month.");
        return;
    }

    let start, end;

    if (period === "15th") {
        // 1st to 15th of the month
        const [year, month] = monthInput.split('-');
        start = `${year}-${month}-01`;
        end = `${year}-${month}-15`;
    } else if (period === "30th") {
        // 16th to the end of the month
        const [year, month] = monthInput.split('-');
        start = `${year}-${month}-16`;
        const lastDay = new Date(year, month, 0).getDate();
        end = `${year}-${month}-${lastDay}`;
    } else {
        // Custom range
        start = document.getElementById('startDate').value;
        end = document.getElementById('endDate').value;
        if (!start || !end) {
            alert("Please select start and end dates for custom range.");
            return;
        }
    }

    // Update your visual inputs
    document.getElementById('startDate').value = start;
    document.getElementById('endDate').value = end;

    try {
        // Fetch from the API using the calculated range
        const response = await fetch(`/api/payroll/calculate-all?startDate=${start}&endDate=${end}`);
        const result = await response.json();
        
        // Update the global stats and re-render the table
        payrollStats = result; 
        renderTablePage(); 
        
    } catch (error) {
        console.error("Error calculating payroll:", error);
        alert("Failed to calculate payroll for this period.");
    }
};

// --- 3. PAGINATION UI CONTROLS ---
window.updatePaginationUI = function(totalCount) {
    const totalPages = Math.ceil(totalCount / rowsPerPage) || 1;
    const start = totalCount > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0;
    const end = Math.min(currentPage * rowsPerPage, totalCount);
    
    const infoText = `Showing ${start} to ${end} of ${totalCount} employees`;
    document.querySelectorAll('.pagination-info').forEach(el => el.textContent = infoText);

    const controlsHTML = `
        <button onclick="changePage(${currentPage - 1}, ${totalCount})" ${currentPage === 1 ? 'disabled' : ''} class="w-8 h-8 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition disabled:opacity-50">
            <i class="fas fa-chevron-left"></i>
        </button>
        ${Array.from({ length: totalPages }, (_, i) => i + 1).map(num => `
            <button onclick="changePage(${num}, ${totalCount})" class="w-8 h-8 rounded ${currentPage === num ? 'bg-blue-800 text-white' : 'border border-gray-300 hover:bg-gray-100'} font-medium">
                ${num}
            </button>
        `).join('')}
        <button onclick="changePage(${currentPage + 1}, ${totalCount})" ${currentPage === totalPages ? 'disabled' : ''} class="w-8 h-8 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition disabled:opacity-50">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    document.querySelectorAll('.pagination-controls').forEach(el => el.innerHTML = controlsHTML);
}

window.changePage = function(page, totalCount) {
    const totalPages = Math.ceil(totalCount / rowsPerPage) || 1;
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTablePage();
}

function getBadgeStyle(type) {
    const t = type?.toUpperCase();
    if (t === 'PER VISIT' || t === 'CONTRACT') return 'bg-pink-100 text-pink-700 border border-pink-200';
    if (t === 'HYBRID') return 'bg-orange-100 text-orange-700 border border-orange-200';
    return 'bg-blue-100 text-blue-700 border border-blue-200';
}

fetchAndRenderPayroll();
loadPayrollData();


// 1. Open Modal and Populate Data
window.openEditAllowancesModal = function(name, id, position, housing, travel, meal, hazard) {
    document.getElementById('allowancesEmpName').textContent = name;
    document.getElementById('allowancesEmpId').textContent = id;
    document.getElementById('allowancesEmpPosition').textContent = position;
    
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('allowancesEmpAvatar').textContent = initials;

    document.getElementById('housingAllowance').value = housing || 0;
    document.getElementById('travelAllowance').value = travel || 0;
    document.getElementById('mealAllowance').value = meal || 0;
    document.getElementById('hazardPay').value = hazard || 0;

    calculateAllowancesTotal();
    document.getElementById('editAllowancesModal').classList.remove('hidden');
};

// 2. Primary Save Function (Database Integration)
// --- Save Allowances + Trigger Notification ---
window.saveAllowances = async function() {
    const empId = document.getElementById('allowancesEmpId').textContent;
    const name = document.getElementById('allowancesEmpName').textContent;

    const payload = {
        employeeId: empId,
        housing: parseFloat(document.getElementById('housingAllowance').value) || 0,
        travel: parseFloat(document.getElementById('travelAllowance').value) || 0,
        meal: parseFloat(document.getElementById('mealAllowance').value) || 0,
        hazardPay: parseFloat(document.getElementById('hazardPay').value) || 0
    };

    try {
        const saveBtn = document.querySelector('#editAllowancesModal button[onclick="saveAllowances()"]');
        if(saveBtn) saveBtn.disabled = true;

        const response = await fetch('/api/employees/update-allowances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            closeEditAllowancesModal();
            document.getElementById('allowanceSuccessName').textContent = name;
            document.getElementById('allowanceSuccessModal')?.classList.remove('hidden');

            if (typeof fetchAndRenderPayroll === "function") {
                fetchAndRenderPayroll();
            }

            // --- Trigger notification ---
            await triggerNotification(
    "Allowances Updated",
    `Allowances for ${name} were updated.`,
    "ALLOWANCE",
    "/admin/payroll.html#allowances"
);
        } else {
            alert('Error updating allowances: ' + data.message);
        }
    } catch (err) {
        console.error('Save error:', err);
        alert('Failed to connect to server.');
    } finally {
        const saveBtn = document.querySelector('#editAllowancesModal button[onclick="saveAllowances()"]');
        if(saveBtn) saveBtn.disabled = false;
    }
};

// 3. Calculation Logic
window.calculateAllowancesTotal = function() {
    const housing = parseFloat(document.getElementById('housingAllowance')?.value) || 0;
    const travel = parseFloat(document.getElementById('travelAllowance')?.value) || 0;
    const meal = parseFloat(document.getElementById('mealAllowance')?.value) || 0;
    const hazard = parseFloat(document.getElementById('hazardPay')?.value) || 0;
    
    const total = housing + travel + meal + hazard;
    const totalElement = document.getElementById('allowancesTotal');
    if (totalElement) {
        totalElement.textContent = '₱' + total.toLocaleString();
    }
};

// 4. Modal Controls
window.closeEditAllowancesModal = () => document.getElementById('editAllowancesModal')?.classList.add('hidden');
window.closeAllowanceSuccessModal = () => document.getElementById('allowanceSuccessModal')?.classList.add('hidden');

// 5. Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const editModal = document.getElementById('editAllowancesModal');
    if (editModal) {
        editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditAllowancesModal(); });
    }
    const successModal = document.getElementById('allowanceSuccessModal');
    if (successModal) {
        successModal.addEventListener('click', (e) => { if (e.target === successModal) closeAllowanceSuccessModal(); });
    }
});



window.openEditDeductionsModal = function(name, id, tax, philhealth, sss, pagibig) {
    document.getElementById('deductEmployeeName').textContent = name;
    document.getElementById('deductEmployeeId').textContent = id;
    document.getElementById('input-tax').value = tax;
    document.getElementById('input-philhealth').value = philhealth;
    document.getElementById('input-sss').value = sss;
    document.getElementById('input-pagibig').value = pagibig;
    
    document.getElementById('editDeductionsModal').classList.remove('hidden');
    document.getElementById('editDeductionsModal').classList.add('flex');
};

window.closeDeductionsModal = function() {
    document.getElementById('editDeductionsModal').classList.add('hidden');
    document.getElementById('editDeductionsModal').classList.remove('flex');
};

window.saveDeductions = async function() {
    const payload = {
        employeeId: document.getElementById('deductEmployeeId').textContent,
        tax: parseFloat(document.getElementById('input-tax').value) || 0,
        philhealth: parseFloat(document.getElementById('input-philhealth').value) || 0,
        sss: parseFloat(document.getElementById('input-sss').value) || 0,
        pagibig: parseFloat(document.getElementById('input-pagibig').value) || 0
    };

    try {
        const response = await fetch('/api/employees/update-deductions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.success) {
            closeDeductionsModal();
            fetchAndRenderPayroll(); // Refresh the table

            // --- Trigger notification ---
            await triggerNotification(
    "Deductions Updated",
    `Deductions for Employee ID ${payload.employeeId} were updated.`,
    "DEDUCTION",
    "/admin/payroll.html#deductions"
);
        } else {
            alert("Failed to save deductions: " + data.message);
        }
    } catch (err) {
        console.error("Save failed:", err);
        alert("Failed to save deductions.");
    }
};

window.saveEntirePayroll = async function() {
    const payrollMonth = document.getElementById('payroll-month').value;
    const payrollPeriod = document.getElementById('payroll-period').value;
    const saveBtn = event.currentTarget;

    if (!payrollMonth || !payrollPeriod) {
        alert("Please select a month and period before saving payroll.");
        return;
    }

    if (!allEmployees || allEmployees.length === 0) {
        alert("No payroll data available to save.");
        return;
    }

    const originalContent = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    await loadPayrollData();

    if (!payrollStats || payrollStats.length === 0) {
        alert("Please calculate payroll for the selected month and period before saving.");
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalContent;
        return;
    }

    const payload = {
        month: payrollMonth,
        period: payrollPeriod,
        payrollRecords: allEmployees.map(emp => {
            const stats = payrollStats.find(s => s.empId === emp.employeeId) || { payableDays: 0, multiplier: 0 };
            const totalBasic = Number(emp.baseSalary || 0) * stats.payableDays;
            const totalAllow = Number(emp.totalAllowances || 0);
            const totalDeduct = Number(emp.totalDeductions || 0);

            return {
                employeeId: emp.employeeId,
                fullName: emp.fullName,
                position: emp.position,
                contractType: emp.contractType,
                profilePic: emp.profilePic,
                baseSalary: totalBasic,
                allowances: totalAllow,
                deductions: totalDeduct,
                netPay: (totalBasic + totalAllow) - totalDeduct,
                payableDays: stats.payableDays,
                shiftDays: stats.multiplier,
                breakdown: {
                    tax: Number(emp.tax || 0),
                    sss: Number(emp.sss || 0),
                    philhealth: Number(emp.philhealth || 0),
                    pagibig: Number(emp.pagibig || 0),
                    housing: Number(emp.housing || 0),
                    travel: Number(emp.travel || 0),
                    meal: Number(emp.meal || 0),
                    hazardPay: Number(emp.hazardPay || 0)
                }
            };
        })
    };

    try {
        const response = await fetch('/api/payroll/save-period', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.success) {
            alert(`Payroll for ${payrollMonth} (${payrollPeriod}) saved!`);

            // --- ADD THIS BLOCK ---
            
// Payroll notification
await triggerNotification(
    'Payroll Finalized',
    `Monthly payroll for ${payrollMonth} (${payrollPeriod}) has been saved to the database.`,
    'PAYROLL',
    `/admin/payroll.html#${payrollMonth}-${payrollPeriod}` // link to that payroll period
);
            // ----------------------
            
        } else {
            alert("Error: " + result.message);
        }
    } catch (err) {
        alert("Failed to connect to the server.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalContent;
    }
};

window.loadSavedPayroll = async function() {
    const month = document.getElementById('payroll-month').value;
    const period = document.getElementById('payroll-period').value;
    
    try {
        const response = await fetch(`/api/payroll/load-period?month=${month}&period=${period}`);
        const result = await response.json();

        if (result.success && result.data) {
            allEmployees = result.data.records.map(rec => ({
                employeeId: rec.employeeId,
                fullName: rec.fullName,
                position: rec.position,
                contractType: rec.contractType,
                profilePic: rec.profilePic,
                baseSalary: rec.baseSalary / 14, 
                totalAllowances: rec.allowances,
                totalDeductions: rec.deductions,
                tax: rec.breakdown.tax,
                sss: rec.breakdown.sss,
                philhealth: rec.breakdown.philhealth,
                pagibig: rec.breakdown.pagibig,
                housing: rec.breakdown.housing,
                travel: rec.breakdown.travel,
                meal: rec.breakdown.meal,
                hazardPay: rec.breakdown.hazardPay
            }));
            currentPage = 1;
            renderTablePage();
            alert(`Loaded: ${month} - ${period} period`);
        } else {
            alert("No payroll records found for this specific period.");
        }
    } catch (err) {
        alert("Failed to load payroll data.");
    }
};

window.resetToLivePayroll = async function() {
    if (confirm("This will clear the loaded historical view and show current live employee data. Continue?")) {
        // Call the loading function to fetch live data and refresh the table
        await loadPayrollData();
        await fetchAndRenderPayroll();
        
        alert("Switched back to live payroll data.");
    }
};


// --- MODAL CONTROLS ---
// 1. Open Modal and Sync Date
window.openPayslipModal = async function() {
    const modal = document.getElementById('payslipModal');
    
    // Sync the date from your main payroll filter
    const mainMonthInput = document.getElementById('payroll-month');
    const modalMonthInput = document.getElementById('modal-payroll-month');
    if (mainMonthInput && modalMonthInput) {
        modalMonthInput.value = mainMonthInput.value;
    }

    modal.classList.remove('hidden');
    // Pre-load employee list for the "Selected" option
    await fetchEmployeeListForModal();
};

// 2. Fetch Employee List from API
async function fetchEmployeeListForModal() {
    const listContainer = document.getElementById('modal-employee-list');
    try {
        const res = await fetch('/api/employees/list');
        const data = await res.json();
        
        listContainer.innerHTML = ''; // Clear previous
        
        data.employees.forEach(emp => {
            const item = document.createElement('label');
            item.className = "flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer border-b border-gray-50 last:border-0";
            
            // Added data-email attribute to the checkbox so we can retrieve it during generation
            item.innerHTML = `
                <input type="checkbox" 
                       value="${emp.employeeId}" 
                       data-email="${emp.email || ''}" 
                       class="emp-checkbox w-4 h-4 rounded text-[#003D7A]">
                <img src="${emp.profilePic}" class="w-6 h-6 rounded-full object-cover">
                <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-gray-800">${emp.fullName}</span>
                        <span class="text-[10px] text-gray-400">(${emp.employeeId})</span>
                    </div>
                    <span class="text-[10px] text-[#003D7A] italic">${emp.email || 'No email provided'}</span>
                </div>
            `;
            listContainer.appendChild(item);
        });
    } catch (err) {
        console.error("Error loading employees:", err);
    }
}

// 3. Toggle Visibility of Employee List
window.toggleEmployeeList = function() {
    const type = document.getElementById('generate-for-type').value;
    const container = document.getElementById('employee-selection-container');
    if (type === 'selected') {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
};

// 4. Updated Generate Function with Real Filtering
window.generatePayslips = async function() {
    const format = document.querySelector('input[name="format"]:checked').value;
    const monthInput = document.getElementById('modal-payroll-month').value;
    const periodInput = document.getElementById('modal-payroll-period').value; // Get the 1-15 or 16-end value
    const genType = document.getElementById('generate-for-type').value;

    if (!monthInput) {
        alert("Please select a payroll month.");
        return;
    }

    if (payrollStats.length === 0) {
        alert("Please calculate payroll data on the main screen first.");
        return;
    }

    // Generate the actual date range string (e.g., "March 16 - 31, 2026")
    const dateRangeLabel = getPayrollDateRange(monthInput, periodInput);

    // Filter Stats based on selection
    let statsToProcess = [];
    if (genType === 'selected') {
        const selectedIds = Array.from(document.querySelectorAll('.emp-checkbox:checked')).map(cb => cb.value);
        if (selectedIds.length === 0) {
            alert("Please select at least one employee.");
            return;
        }
        statsToProcess = payrollStats.filter(s => selectedIds.includes(s.empId));
    } else {
        statsToProcess = payrollStats;
    }

    closePayslipModal();
    const loader = document.getElementById('generatingPayslipsModal');
    if(loader) loader.classList.remove('hidden');

    // Convert period format for storage (1-15 or 16-end -> 15th or 30th)
    const periodForStorage = periodInput === '1-15' ? '15th' : '30th';

    // Small delay to allow UI to update
    setTimeout(async () => {
        try {
            // SAVE PAYROLL DATA TO DATABASE
            await savePayrollToDatabase(monthInput, periodForStorage, statsToProcess);

            // Then generate/distribute payslips
            if (format === 'individual' || format === 'combined' || format === 'email') {
                await createActualPDF(format, dateRangeLabel, statsToProcess); 
            } else if (format === 'excel') {
                downloadExcel(dateRangeLabel, statsToProcess);
            }
            
            if(loader) loader.classList.add('hidden');
            alert(`Successfully processed ${format} for ${statsToProcess.length} employees.`);
        } catch (error) {
            if(loader) loader.classList.add('hidden');
            console.error('Error in generatePayslips:', error);
            alert(`Error processing payslips: ${error.message}`);
        }
    }, 1500);
};

// Helper function to save payroll data to the database
async function savePayrollToDatabase(monthInput, period, statsToProcess) {
    const payrollRecords = statsToProcess.map(stat => {
        const emp = allEmployees.find(e => e.employeeId === stat.empId);
        if (!emp) return null;

        const totalBasic = Number(emp.baseSalary || 0) * stat.payableDays;
        const totalAllow = Number(emp.totalAllowances || 0);
        const totalDeduct = Number(emp.totalDeductions || 0);

        return {
            employeeId: emp.employeeId,
            fullName: emp.fullName,
            position: emp.position,
            contractType: emp.contractType,
            profilePic: emp.profilePic,
            baseSalary: totalBasic,
            allowances: totalAllow,
            deductions: totalDeduct,
            netPay: (totalBasic + totalAllow) - totalDeduct,
            breakdown: {
                tax: Number(emp.tax || 0),
                sss: Number(emp.sss || 0),
                philhealth: Number(emp.philhealth || 0),
                pagibig: Number(emp.pagibig || 0),
                housing: Number(emp.housing || 0),
                travel: Number(emp.travel || 0),
                meal: Number(emp.meal || 0),
                hazardPay: Number(emp.hazardPay || 0)
            }
        };
    }).filter(r => r !== null);

    const payload = {
        month: monthInput,
        period: period,
        payrollRecords: payrollRecords
    };

    try {
        const response = await fetch('/api/payroll/save-period', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!result.success) {
            // Don't throw error, just log it - allow payslips to still generate
            console.warn('Payroll save warning:', result.message);
        }
        return result;
    } catch (error) {
        console.error('Error saving payroll to database:', error);
        // Don't throw - allow payslips to still be generated even if save fails
    }
}

window.closePayslipModal = () => document.getElementById('payslipModal').classList.add('hidden');

async function createActualPDF(format, dateRangeLabel, statsToProcess) {
    const { jsPDF } = window.jspdf;
    let doc = new jsPDF();
    
    for (let index = 0; index < statsToProcess.length; index++) {
        const stat = statsToProcess[index];
        // 1. Find employee in the main data array
        const emp = allEmployees.find(e => e.employeeId === stat.empId);
        if (!emp) continue;

        // Reset document or add page to prevent overlapping
        if (format === 'combined' && index > 0) {
            doc.addPage();
        } else if (format === 'individual' || format === 'email') {
            doc = new jsPDF();
        }

        const totalBasic = Number(emp.baseSalary || 0) * stat.payableDays;
        const totalAllow = Number(emp.totalAllowances || 0);
        const totalDeduct = Number(emp.totalDeductions || 0);
        const netPay = (totalBasic + totalAllow) - totalDeduct;

        // --- PDF Content ---
        doc.setFontSize(16);
        doc.setTextColor(0, 61, 122);
        doc.text("ZEAL COMMUNITY MEDICAL MISSION FOUNDATION", 105, 15, { align: "center" });
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Official Payslip: ${dateRangeLabel}`, 105, 22, { align: "center" });

        // Employee Info Table
        doc.autoTable({
            startY: 30,
            body: [
                ["Employee Name:", emp.fullName, "Employee ID:", emp.employeeId],
                ["Position:", emp.position || "N/A", "Payable Days:", `${stat.payableDays} Days`],
                ["Work Hours:", `${stat.totalWorkHours} hrs`, "Lates:", stat.totalLates]
            ],
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 2 }
        });

        // Financials Table
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
            body: [
                ['Base Salary', `P${totalBasic.toLocaleString()}`, 'Tax', `P${Number(emp.tax || 0).toLocaleString()}`],
                ['Allowances', `P${totalAllow.toLocaleString()}`, 'SSS', `P${Number(emp.sss || 0).toLocaleString()}`],
                ['', '', 'PhilHealth', `P${Number(emp.philhealth || 0).toLocaleString()}`],
                ['', '', 'Pag-IBIG', `P${Number(emp.pagibig || 0).toLocaleString()}`],
            ],
            foot: [['Total Gross', `P${(totalBasic + totalAllow).toLocaleString()}`, 'Total Deduct', `P${totalDeduct.toLocaleString()}`]],
            headStyles: { fillColor: [0, 61, 122] },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] }
        });

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`NET PAY: P${netPay.toLocaleString()}`, 190, doc.lastAutoTable.finalY + 15, { align: "right" });

        // --- Output Handling ---
        
        // Save individual files
        if (format === 'individual') {
            const fileName = `Payslip_${emp.fullName.replace(/\s+/g, '_')}_${dateRangeLabel.replace(/[\s,]+/g, '_')}.pdf`;
            doc.save(fileName);
        } 
        // Send via Email
        else if (format === 'email') {
            // Get email from array OR fallback to the data attribute in the UI checkbox
            let targetEmail = emp.email;
            
            if (!targetEmail) {
                const cb = document.querySelector(`.emp-checkbox[value="${emp.employeeId}"]`);
                targetEmail = cb ? cb.getAttribute('data-email') : null;
            }

            if (targetEmail && targetEmail !== "undefined" && targetEmail !== "") {
                const pdfBase64 = doc.output('datauristring').split(',')[1];
                await sendPayslipEmail(targetEmail, emp.fullName, dateRangeLabel, pdfBase64);
            } else {
                console.error(`Skipped email for ${emp.fullName}: No valid email found.`);
            }
        }
    }

    // Save combined file
    if (format === 'combined') {
        doc.save(`Payroll_Batch_${dateRangeLabel.replace(/[\s,]+/g, '_')}.pdf`);
    }
}

function getPayrollDateRange(monthValue, periodValue) {
    const [year, month] = monthValue.split('-');
    const date = new Date(year, month - 1);
    const monthName = date.toLocaleString('default', { month: 'long' });

    if (periodValue === "1-15") {
        return `${monthName} 1 - 15, ${year}`;
    } else {
        const lastDay = new Date(year, month, 0).getDate();
        return `${monthName} 16 - ${lastDay}, ${year}`;
    }
}

window.downloadExcel = function(dateRangeLabel, statsToProcess) {
    const dataToExport = statsToProcess.map(stat => {
        const emp = allEmployees.find(e => e.employeeId === stat.empId);
        
        // Match PDF calculations exactly
        const totalBasic = Number(emp?.baseSalary || 0) * stat.payableDays;
        const totalAllowances = Number(emp?.totalAllowances || 0);
        
        // Individual Deductions
        const tax = Number(emp?.tax || 0);
        const sss = Number(emp?.sss || 0);
        const philhealth = Number(emp?.philhealth || 0);
        const pagibig = Number(emp?.pagibig || 0);
        
        const totalDeductions = Number(emp?.totalDeductions || 0);
        const netPay = (totalBasic + totalAllowances) - totalDeductions;

        return {
            "Employee ID": emp?.employeeId || stat.empId,
            "Full Name": emp?.fullName || "N/A",
            "Position": emp?.position || "N/A",
            "Payable Days": stat.payableDays,
            "Total Work Hours": stat.totalWorkHours,
            "Total Lates": stat.totalLates,
            // Earnings breakdown
            "Daily Rate": Number(emp?.baseSalary || 0),
            "Total Basic Pay": totalBasic,
            "Allowances": totalAllowances,
            "Gross Pay": (totalBasic + totalAllowances),
            // Deductions breakdown (Mirrors the PDF Financials Table)
            "Withholding Tax": tax,
            "SSS Contribution": sss,
            "PhilHealth": philhealth,
            "Pag-IBIG": pagibig,
            "Total Deductions": totalDeductions,
            // Final
            "NET PAY": netPay,
            "Payroll Period": dateRangeLabel
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll Details");

    // Clean filename for the Excel file
    const safeFileName = dateRangeLabel.replace(/[\s,]+/g, '_');
    XLSX.writeFile(workbook, `Payroll_Full_Report_${safeFileName}.xlsx`);
};

async function sendPayslipEmail(email, name, period, base64File) {
    console.log("[Debug] Sending to:", email);
    if (!email) {
        console.error(`[Error] Missing email for ${name}`);
        return false; 
    }
    try {
        const response = await fetch('/api/payroll/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: email,
                subject: `Payslip for ${period}`,
                employeeName: name,
                pdfData: base64File,
                fileName: `Payslip_${name.replace(/\s+/g, '_')}.pdf`
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Failed to send");
        console.log(`[OK] Sent to ${name}`);
        return true;
    } catch (error) {
        console.error(`[FAIL] ${name}:`, error.message);
        return false;
    }
}


            } else if (page === 'performance') {
                // Initialize performance page functionality
                window.selectEmployee = function(clickedBtn, employeeId) {
                    // Remove active state from all employee buttons
                    const buttons = document.querySelectorAll('.employee-select-btn');
                    buttons.forEach(btn => {
                        btn.classList.remove('bg-blue-800', 'text-white', 'border-blue-800');
                        btn.classList.add('text-gray-900', 'border-transparent');
                        // Reset the position text color
                        const positionText = btn.querySelector('p:last-child');
                        if (positionText) {
                            positionText.classList.remove('opacity-80');
                            positionText.classList.add('text-gray-500');
                        }
                    });

                    // Add active state to clicked button
                    if (clickedBtn) {
                        clickedBtn.classList.remove('text-gray-900', 'border-transparent');
                        clickedBtn.classList.add('bg-blue-800', 'text-white', 'border-blue-800');
                        // Update position text color for active state
                        const positionText = clickedBtn.querySelector('p:last-child');
                        if (positionText) {
                            positionText.classList.remove('text-gray-500');
                            positionText.classList.add('opacity-80');
                        }
                    }

                    // Load employee performance data (placeholder)
                    loadEmployeePerformance(employeeId);
                };

                window.loadEmployeePerformance = function(employeeId) {
                    // Placeholder - would load employee-specific data
                    console.log('Loading performance for:', employeeId);
                };

                window.showPerformanceSection = function(sectionName) {
                    // Hide all sections
                    const sections = document.querySelectorAll('.performance-section');
                    sections.forEach(section => section.classList.add('hidden'));

                    // Show selected section
                    const selectedSection = document.getElementById(sectionName + '-section');
                    if (selectedSection) {
                        selectedSection.classList.remove('hidden');
                    }
                };
            } else if (page === 'notifications') {
                // Initialize notifications page functionality
                window.filterNotifications = function(type, clickedBtn) {
                    document.querySelectorAll('.notification-filter').forEach(btn => {
                        btn.classList.remove('bg-blue-800', 'text-white');
                        btn.classList.add('text-gray-600', 'hover:bg-gray-100');
                    });
                    clickedBtn.classList.remove('text-gray-600', 'hover:bg-gray-100');
                    clickedBtn.classList.add('bg-blue-800', 'text-white');

                    document.querySelectorAll('.notification-item').forEach(item => {
                        if (type === 'all') {
                            item.style.display = 'block';
                        } else if (type === 'unread') {
                            item.style.display = item.dataset.unread === 'true' ? 'block' : 'none';
                        } else {
                            item.style.display = item.dataset.type === type ? 'block' : 'none';
                        }
                    });
                };

                window.markAllAsRead = function() {
                    document.querySelectorAll('.notification-item[data-unread="true"]').forEach(item => {
                        item.dataset.unread = 'false';
                        item.classList.add('bg-gray-50/50');
                        const dot = item.querySelector('.w-2.h-2.bg-blue-500');
                        if (dot) dot.remove();
                    });
                    alert('All notifications marked as read');
                };

                window.openCreateNotificationModal = function() {
                    document.getElementById('createNotificationModal').classList.remove('hidden');
                };

                window.closeCreateNotificationModal = function() {
                    document.getElementById('createNotificationModal').classList.add('hidden');
                    // Reset form
                    document.getElementById('scheduleNotif').checked = false;
                    document.getElementById('scheduleDateTimeContainer').classList.add('hidden');
                    document.getElementById('sendNotifBtnText').textContent = 'Send Notification';
                };

                window.toggleScheduleDateTime = function() {
                    const checkbox = document.getElementById('scheduleNotif');
                    const container = document.getElementById('scheduleDateTimeContainer');
                    const btnText = document.getElementById('sendNotifBtnText');
                    
                    if (checkbox.checked) {
                        container.classList.remove('hidden');
                        btnText.textContent = 'Schedule Notification';
                        // Set default date/time to tomorrow
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(9, 0, 0, 0);
                        document.getElementById('scheduleDate').value = tomorrow.toISOString().split('T')[0];
                        document.getElementById('scheduleTime').value = '09:00';
                    } else {
                        container.classList.add('hidden');
                        btnText.textContent = 'Send Notification';
                    }
                };

                window.sendNotification = function() {
                    const recipient = document.getElementById('notifRecipient').value;
                    const title = document.getElementById('notifTitle').value;
                    const message = document.getElementById('notifMessage').value;
                    const isScheduled = document.getElementById('scheduleNotif').checked;

                    if (!recipient || !title || !message) {
                        alert('Please fill in all required fields');
                        return;
                    }

                    if (isScheduled) {
                        const date = document.getElementById('scheduleDate').value;
                        const time = document.getElementById('scheduleTime').value;
                        if (!date || !time) {
                            alert('Please set the date and time for scheduled notification');
                            return;
                        }
                        alert('Notification scheduled for ' + date + ' at ' + time);
                    } else {
                        alert('Notification sent successfully to ' + (recipient === 'all' ? 'all employees' : 'selected employee(s)'));
                    }
                    
                    closeCreateNotificationModal();
                    document.getElementById('notifTitle').value = '';
                    document.getElementById('notifMessage').value = '';
                };
            } 
            
            
          else if (page === 'attendance') {

// 1. Setup & Scope
let currentStaffData = {};

const tableBody = document.getElementById('attendanceTableBody');
const idInput = document.getElementById('manualEmployeeId');
const submitBtn = document.getElementById('submitCheckIn');
const resetBtn = document.getElementById('resetAttendanceBtn');

const API_URL = "/api/attendance";
const EMPLOYEE_LIST_URL = "/api/employees/list";
const SHIFT_API_URL = "/api/shifts";

// Store today's scheduled employees
let todayShiftMap = new Map();

// Stores employees fetched from server
let activeEmployeeList = [];

const fetchTodayShifts = async () => {
    try {
        const res = await fetch(`${SHIFT_API_URL}`);
        const data = await res.json();

        todayShiftMap.clear();

        // ✅ LOCAL DATE (Philippines safe)
        const todayStr = new Date().toLocaleDateString('en-CA');

        const shiftsArray = Array.isArray(data) ? data : data.shifts;

        (shiftsArray || []).forEach(shift => {
            const shiftDateStr = new Date(shift.date).toLocaleDateString('en-CA');

            if (shiftDateStr === todayStr) {
                todayShiftMap.set(shift.employeeId, shift);
            }
        });

        // ✅ DEBUG
        console.log("=== TODAY SHIFT FILTER (LOCAL TIME) ===");
        console.log("Today (PH):", todayStr);
        console.log("Total shifts today:", todayShiftMap.size);

        (shiftsArray || []).forEach(shift => {
            console.log({
                employeeId: shift.employeeId,
                rawDate: shift.date,
                localDate: new Date(shift.date).toLocaleDateString('en-CA')
            });
        });

    } catch (err) {
        console.error("Failed to fetch shifts:", err);
    }
};

// --- FETCH EMPLOYEES ---
const fetchEmployees = async () => {
    try {

        const response = await fetch(`${EMPLOYEE_LIST_URL}?limit=1000`);
        const data = await response.json();

        activeEmployeeList = data.employees.filter(emp => 
    todayShiftMap.has(emp.employeeId)
);

        updateAbsenceTracking();

    } catch (err) {
        console.error("Failed to fetch employee list:", err);
    }
};

// --- FIND EMPLOYEE ---
const getEmployeeFromList = (empId) => {
    return activeEmployeeList.find(e => e.employeeId === empId);
};

// --- RESET DAILY ATTENDANCE ---
window.resetDailyLog = async function() {

    if (!confirm("Are you sure you want to clear all records for a new day?")) return;

    try {

        await fetch(API_URL, { method: 'DELETE' });

        if (tableBody) tableBody.innerHTML = '';

        updateAbsenceTracking();

        alert("Attendance log has been reset.");

    } catch (err) {

        console.error("Reset failed:", err);

    }

};

const saveToDB = async (record) => {
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });
    } catch (err) {
        console.error("Save to MongoDB failed:", err);
    }
};

const loadFromDB = async () => {
    try {
        const response = await fetch(API_URL);
        const records = await response.json();
        if (tableBody) {
            tableBody.innerHTML = ''; 
            records.forEach(record => renderRow(record));
        }
        updateAbsenceTracking();
    } catch (err) {
        console.error("Load from MongoDB failed:", err);
    }
};

// --- TIME HELPERS ---

const convertTo24Hour = (timeStr) => {
    if (!timeStr || timeStr === '--:-- --') return '';
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
};

const formatTo12Hour = (time24) => {
    if (!time24) return '--:-- --';
    let [hours, minutes] = time24.split(':');
    hours = parseInt(hours);
    const modifier = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${modifier}`;
};

const calculateDuration = (startStr, endStr) => {
    const parseToMinutes = (str) => {
        if (!str || str === '--:-- --') return null;
        if (str.includes('AM') || str.includes('PM')) {
            const [time, mod] = str.split(' ');
            let [h, m] = time.split(':').map(Number);
            if (h === 12 && mod === 'AM') h = 0;
            if (h !== 12 && mod === 'PM') h += 12;
            return h * 60 + m;
        }
        const [h, m] = str.split(':').map(Number);
        return h * 60 + m;
    };
    const startMin = parseToMinutes(startStr);
    const endMin = parseToMinutes(endStr);
    if (startMin === null || endMin === null) return "0.0";
    let diff = endMin - startMin;
    if (diff < 0) diff += 1440; 
    return (diff / 60).toFixed(1);
};

const getCheckInStatus = (checkInStr) => {
    const [time, mod] = checkInStr.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (h === 12 && mod === 'AM') h = 0;
    if (h !== 12 && mod === 'PM') h += 12;
    const totalMinutes = h * 60 + m;
    if (totalMinutes >= 720) return { label: "Absent", classes: "bg-red-100 text-red-700" };
    if (totalMinutes > 480) return { label: `Late (${totalMinutes - 480}m)`, classes: "bg-amber-100 text-amber-700" };
    return { label: "On Time", classes: "bg-green-100 text-green-700" };
};

const getStatusClasses = (status) => {
    if (status === "Completed") return "bg-blue-100 text-blue-700";
    if (status.includes("Late")) return "bg-amber-100 text-amber-700";
    if (status === "On Time") return "bg-green-100 text-green-700";
    if (status === "Modified") return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
};

const modal = document.getElementById('editTimeModal');

function closeEditModal() {
  const modal = document.getElementById('editTimeModal');
  modal.style.display = 'none';
}

// Optional: Close modal when clicking outside of it
window.onclick = function(event) {
  if (event.target == modal) {
    modal.classList.add('hidden');
  }
}

// --- CORE FUNCTIONS ---

window.handleCheckIn = async function(isQR = false) {
    const empId = idInput.value.trim();

    const shift = todayShiftMap.get(empId);
    const employee = getEmployeeFromList(empId);

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const existingRow = document.getElementById(`row-${empId}`);

    // Prepare payload template
    let updatePayload = {
        empId: employee ? employee.employeeId : empId,
        name: employee ? employee.fullName : "Unknown",
        role: employee ? (employee.position || employee.role) : "Unknown",
        profilePic: employee ? employee.profilePic : null, // ADD THIS LINE
        initials: employee ? employee.fullName.split(' ').map(n => n[0]).join('').toUpperCase() : empId.slice(-3),
        color: "bg-indigo-500"
    };

    // Guard-friendly checks
    if (!employee || !shift) {
        if (!isQR) {
            alert(!employee ? "Employee ID not found." : "This employee has no shift scheduled today.");
        }
        return null; // Don't proceed
    }

    // Check-in / Check-out logic
    if (existingRow) {
        const checkOutCell = existingRow.querySelector('.check-out-cell');
        if (checkOutCell.textContent !== '--:-- --') {
            if (!isQR) alert("Already checked out.");
            return null;
        }

        const checkInTimeStr = existingRow.querySelector('.check-in-cell').textContent;
        updatePayload.checkIn = checkInTimeStr;
        updatePayload.checkOut = timeString;
        updatePayload.duration = `${calculateDuration(checkInTimeStr, timeString)}h`;
        updatePayload.status = "Completed";
    } else {
        const status = getCheckInStatus(timeString);
        updatePayload.checkIn = timeString;
        updatePayload.checkOut = '--:-- --';
        updatePayload.duration = "0.0h";
        updatePayload.status = status.label;
    }

    // Add shift info
    updatePayload.shift = shift.shift;
    updatePayload.department = shift.department;
    updatePayload.shiftDate = shift.date;

    await saveToDB(updatePayload);
    await loadFromDB();

    // Notification (optional for guard)
    const actionType = updatePayload.checkOut !== '--:-- --' ? 'Check-out' : 'Check-in';
    await triggerNotification(
        'Attendance Logged',
        `${employee.fullName} recorded a ${actionType} at ${timeString}.`,
        'ATTENDANCE',
        `/admin/attendance.html#employee-${employee._id}`
    );

    idInput.value = '';

    return updatePayload; // Useful for QR scanner to show info
};

const renderRow = (data) => {
    const tr = document.createElement('tr');
    tr.id = `row-${data.empId}`;
    tr.className = "border-b border-gray-200 hover:bg-gray-50";
    tr.innerHTML = `
        <td class="px-4 py-4">
            <div class="flex items-center gap-3">
                <div>
                   <p class="font-semibold text-gray-900">${data.name}</p>
<p class="text-xs text-gray-500">${data.role}</p>
<p class="text-xs text-blue-500">${data.shift || ''} ${data.department ? '• ' + data.department : ''}</p>
                </div>
            </div>
        </td>
        <td class="px-4 py-4"><span class="check-in-cell text-sm font-semibold text-gray-900">${data.checkIn}</span></td>
        <td class="px-4 py-4"><span class="check-out-cell text-sm text-gray-600">${data.checkOut}</span></td>
        <td class="px-4 py-4"><span class="status-badge ${getStatusClasses(data.status)} text-xs font-semibold px-3 py-1 rounded-full">${data.status}</span></td>
        <td class="px-4 py-4"><span class="duration-cell text-sm text-gray-700">${data.duration}</span></td>
        <td class="px-4 py-4">
            <button onclick="openEditModal('${data.empId}')" class="text-[#003D7A] hover:text-[#0052A3] font-medium text-sm">
                <i class="fas fa-edit"></i>
            </button>
        </td>
    `;
    tableBody.prepend(tr);
};

window.updateAbsenceTracking = function() {
    const container = document.getElementById('absenceListContainer');
    if (!container || todayShiftMap.size === 0) return;
    
    container.innerHTML = '';

    todayShiftMap.forEach((shift, empId) => {
        if (!document.getElementById(`row-${empId}`)) {

            const employee = getEmployeeFromList(empId);
            if (!employee) return;

            const div = document.createElement('div');
            div.className = "border-l-4 border-red-500 pl-4 py-2 mb-2 bg-white shadow-sm";

            div.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <p class="font-semibold text-sm text-gray-800">${employee.fullName}</p>
                        <p class="text-xs text-gray-500">${shift.shift.toUpperCase()}</p>
                    </div>
                    <span class="bg-red-50 text-red-600 text-[10px] px-2 py-1 rounded font-bold uppercase">Absent</span>
                </div>`;

            container.appendChild(div);
        }
    });
};

window.openEditModal = function(empId) {
    const row = document.getElementById(`row-${empId}`);
    const employee = getEmployeeFromList(empId);
    currentStaffData = { empId, name: employee ? employee.fullName : "Unknown" };
    
    document.getElementById('modalStaffName').textContent = currentStaffData.name;
    document.getElementById('checkInTime').value = convertTo24Hour(row.querySelector('.check-in-cell').textContent);
    document.getElementById('checkOutTime').value = convertTo24Hour(row.querySelector('.check-out-cell').textContent);
    document.getElementById('editTimeModal').classList.remove('hidden');
};

window.saveTimeChanges = async function() {
    const checkIn = document.getElementById('checkInTime').value;
    const checkOut = document.getElementById('checkOutTime').value;
    const row = document.getElementById(`row-${currentStaffData.empId}`);
    
    if (!row) return;

   const updatePayload = {
    empId: currentStaffData.empId,
    name: currentStaffData.name,
    checkIn: formatTo12Hour(checkIn),
    checkOut: formatTo12Hour(checkOut),
    duration: `${calculateDuration(checkIn, checkOut)}h`,
    status: "Modified"
}; // ✅ ADD THIS
    

    await saveToDB(updatePayload);
    await loadFromDB();
    document.getElementById('editTimeModal').classList.add('hidden');
};

// --- INITIALIZE ---
const init = async () => {
    await fetchTodayShifts();   // ✅ load shifts first
    await fetchEmployees();     // ✅ then filter employees
    await loadFromDB();
    await updateAbsenceTracking();
};
init();

if (submitBtn) submitBtn.onclick = (e) => { e.preventDefault(); window.handleCheckIn(); };
if (resetBtn) resetBtn.onclick = (e) => { e.preventDefault(); window.resetDailyLog(); };


window.saveAttendanceByDate = async function() {
    const selectedDate = document.getElementById('attendance-date').value;

    if (!selectedDate) {
        alert("Please select a date.");
        return;
    }

    const rows = document.querySelectorAll('#attendanceTableBody tr');

    if (rows.length === 0) {
        alert("No attendance data to save.");
        return;
    }

    // ✅ FIRST CONFIRMATION
    const confirmSave = confirm(`Save attendance for ${selectedDate}?`);
    if (!confirmSave) return;

    const payload = {
        date: selectedDate,
        records: []
    };

    rows.forEach(row => {
        payload.records.push({
            empId: row.id.replace('row-', ''),
            name: row.querySelector('.font-semibold').textContent,
            checkIn: row.querySelector('.check-in-cell').textContent,
            checkOut: row.querySelector('.check-out-cell').textContent,
            status: row.querySelector('.status-badge').textContent,
            duration: row.querySelector('.duration-cell').textContent
        });
    });

    try {
        const res = await fetch('/api/attendance/save-date', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (result.success) {

            // ✅ SECOND CONFIRMATION (overwrite warning)
            if (result.overwritten) {
                alert(`Existing attendance for ${selectedDate} was overwritten.`);
            } else {
                alert(`Attendance for ${selectedDate} saved!`);
            }

            await triggerNotification(
                'Attendance Saved',
                `Attendance for ${selectedDate} has been archived.`,
                'ATTENDANCE',
                `/admin/attendance.html#${selectedDate}`
            );

        } else {
            alert("Error saving attendance.");
        }

    } catch (err) {
        console.error(err);
        alert("Server error.");
    }
};

window.loadAttendanceByDate = async function() {
    const selectedDate = document.getElementById('attendance-date').value;

    if (!selectedDate) {
        alert("Please select a date.");
        return;
    }

    // ✅ CONFIRM BEFORE LOADING (important to avoid overwriting UI)
    const confirmLoad = confirm(`Load attendance for ${selectedDate}? This will replace current data.`);
    if (!confirmLoad) return;

    try {
        const res = await fetch(`/api/attendance/load-date?date=${selectedDate}`);
        const result = await res.json();

        if (result.success && result.data) {

            tableBody.innerHTML = '';

            result.data.records.forEach(record => {
                renderRow(record);
            });

            updateAbsenceTracking();

            alert(`Loaded attendance for ${selectedDate}`);

        } else {
            alert("No saved attendance for this date.");
        }

    } catch (err) {
        console.error(err);
        alert("Failed to load attendance.");
    }
};

window.resetToLiveAttendance = async function() {
    if (confirm("Switch back to today's live attendance?")) {
        await loadFromDB();
        alert("Back to live attendance.");
    }
};



// ===== Prevent selecting future dates =====
// ===== Set attendance date to today and prevent future dates =====
const attendanceDateInput = document.getElementById('attendance-date');
if (attendanceDateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    attendanceDateInput.value = todayStr; // ✅ default to today
    attendanceDateInput.max = todayStr;   // ✅ prevent future dates
}



const scannerChannel = new BroadcastChannel('qr_scanner_channel');

scannerChannel.onmessage = (event) => {
    const rawValue = event.data;
    console.log("Main Window: Received QR ->", rawValue);

    const inputField = document.getElementById('manualEmployeeId');
    // Find the button specifically (using classes since it has no ID)
    const submitBtn = document.querySelector('button[onclick="handleCheckIn()"]');

    if (inputField) {
        inputField.value = rawValue;
        console.log("Main Window: Input field filled.");

        // Trigger 'input' event so UI knows it changed
        inputField.dispatchEvent(new Event('input', { bubbles: true }));

        // AUTOMATIC BUTTON PUSH
        if (submitBtn) {
            console.log("Main Window: Clicking Submit Button...");
            submitBtn.click(); 
        } else {
            console.warn("Main Window: Submit button not found, falling back to function call.");
            if (typeof handleCheckIn === 'function') {
                handleCheckIn(true);
            }
        }
    } else {
        console.error("Main Window: Could not find input 'manualEmployeeId'");
    }
};



}


            // Add more pages as needed
        }

    

        // Load dashboard on page load
        window.addEventListener('load', function() {
            loadContent('dashboard');
        });

        // Initial load when the page opens
refreshNotifications();


    

  
    
        function openComposeModal() {
            document.getElementById('composeModal').classList.remove('hidden');
            document.getElementById('messagesDropdown').classList.add('hidden');
        }

        function closeComposeModal() {
            document.getElementById('composeModal').classList.add('hidden');
        }

        function sendMessage() {
            alert('Message sent successfully!');
            closeComposeModal();
        }
    

    /**
 * LOGOUT LOGIC
 * Clears session data and redirects to login
 */
window.handleLogout = function() {
    // 1. Clear the specific user data
    localStorage.removeItem('currentUser');
    
    // 2. Optional: Clear everything if you want a total reset
    // localStorage.clear(); 

    // 3. Redirect to the login page
    window.location.href = "../employee/login.html";
};
