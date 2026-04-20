// ============================================
// MODAL LOADING & INITIALIZATION
// ============================================

/**
 * Loads the add employee modal and returns a promise
 */
function loadAddEmployeeModal() {
    const modalPath = './pages/employee-add.html';
    const modalContainer = document.getElementById('modalContainer');

    if (!modalContainer) {
        console.error('❌ Modal container not found');
        return Promise.reject('Container missing');
    }

    return fetch(modalPath)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.text();
        })
        .then(html => {
            modalContainer.innerHTML = html;
            console.log('✅ Modal loaded successfully');
            initializeModalElements();
        })
        .catch(error => {
            console.error('❌ Error loading modal:', error);
        });
}

function initializeModalElements() {
    const modal = document.getElementById('addEmployeeModal');
    const form = document.getElementById('addEmployeeForm');

    if (!modal) return;

    // Listen for input changes to update completion status in real-time
    if (form) {
        form.addEventListener('input', updateTabAvailability);
    }

    setupModalListeners();
    console.log('✅ Modal elements initialized');
}

function setupModalListeners() {
    const modal = document.getElementById('addEmployeeModal');
    if (!modal) return;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAddEmployeeModal();
    });
}

// ============================================
// MODAL OPEN/CLOSE FUNCTIONS
// ============================================

async function openAddEmployeeModal() {
    let modal = document.getElementById('addEmployeeModal');
    
    if (!modal) {
        console.log('📂 Modal not found. Fetching...');
        await loadAddEmployeeModal();
        modal = document.getElementById('addEmployeeModal');
    }

    if (modal) {
        // --- CLEAR FORM FIELDS ---
        const form = document.getElementById('addEmployeeForm');
        if (form) form.reset();

        // --- CLEAR PROFILE IMAGE ---
        const imagePreview = document.getElementById('imagePreview');
        const uploadPlaceholder = document.getElementById('uploadPlaceholder');
        if (imagePreview) {
            imagePreview.src = '';
            imagePreview.classList.add('hidden');
        }
        if (uploadPlaceholder) uploadPlaceholder.classList.remove('hidden');

        // --- CLEAR DOCUMENTS ---
        const documentsContainer = document.getElementById('documentsContainer');
        if (documentsContainer) documentsContainer.innerHTML = '';

        // --- SHOW MODAL ---
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // --- INIT OTHER STUFF ---
        await loadDepartments();
        setDOBLimit();
        setupDOBListener();
        setupContactValidation();
        setupEmergencyValidation();

        // Set IDs
        const empID = generateEmployeeID();
        const empIDInput = document.getElementById('employeeID');
        const qrIDInput = document.getElementById('qrEmployeeID');
        if (empIDInput) empIDInput.value = empID;
        if (qrIDInput) qrIDInput.value = empID;

        // Reset header and button for Add mode
        modal.querySelector('h2').textContent = "Add Employee";
        const submitBtn = document.getElementById('onboardBtn');
        submitBtn.innerHTML = `<i class="fas fa-user-plus"></i> Add Employee`;
        submitBtn.onclick = (e) => {
            e.preventDefault();
            submitAddEmployee(); // your existing add function
        };
    }
}

function closeAddEmployeeModal() {
    const modal = document.getElementById('addEmployeeModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        
        const form = document.getElementById('addEmployeeForm');
        if (form) form.reset();

        switchTab('profile');
        console.log('✅ Modal closed and reset');
    }
}




async function loadDepartments() {
    try {
        const response = await fetch('/api/departments');
        const departments = await response.json();

        const select = document.getElementById('department');

        if (!select) {
            console.warn('❌ Department select not found');
            return;
        }

        select.innerHTML = '<option value="">Select Department</option>';

        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.deptName;
            option.textContent = dept.deptName;
            select.appendChild(option);
        });

        console.log('✅ Departments loaded');

    } catch (error) {
        console.error('Error loading departments:', error);
    }
}
// ============================================
// TAB & VALIDATION MANAGEMENT
// ============================================

const requiredFields = {
    profile: ['firstName', 'lastName', 'gender', 'dob', 'phone', 'email', 'address', 'emergencyNo', 'emergencyName', 'emergencyRelation'],
    employment: ['department', 'position', 'grade', 'contractType', 'salary']
};

function updateTabAvailability() {
    const isProfileComplete = requiredFields.profile.every(id => {
        const el = document.getElementById(id);
        return el && el.value.trim() !== "";
    });

    const isEmploymentComplete = requiredFields.employment.every(id => {
        const el = document.getElementById(id);
        return el && el.value.trim() !== "";
    });

    const profileMsg = document.getElementById('profileCompleteMsg');
    const employMsg = document.getElementById('employmentCompleteMsg');

    if (profileMsg) profileMsg.style.display = isProfileComplete ? 'flex' : 'none';
    if (employMsg) employMsg.style.display = isEmploymentComplete ? 'flex' : 'none';
}

function switchTab(tabId) {
    // Update Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tabId;
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('bg-blue-50', isActive);
        btn.classList.toggle('text-[#003D7A]', isActive);
        btn.classList.toggle('border-[#003D7A]', isActive);
        btn.classList.toggle('text-gray-600', !isActive);
        btn.classList.toggle('border-transparent', !isActive);
    });

    // Update Content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    const targetTab = document.getElementById(`${tabId}-tab`);
    if (targetTab) targetTab.classList.remove('hidden');

    updateProgressBar(tabId);
}

function updateProgressBar(tabId) {
    const tabs = ['profile', 'employment', 'documents', 'qr'];
    const index = tabs.indexOf(tabId) + 1;
    const percentage = (index / tabs.length) * 100;
    
    const bar = document.getElementById('progressBar');
    const count = document.getElementById('tabCount');
    
    if (bar) bar.style.width = `${percentage}%`;
    if (count) count.innerText = index;
}

// ============================================
// DOCUMENT MANAGEMENT
// ============================================

/**
 * Adds a new document row to the Documents tab
 */
// ========== DOCUMENT MANAGEMENT ==========



async function loadAddEmployeeModal() {
    const res = await fetch('./pages/employee-add.html');
    const html = await res.text();
    document.body.insertAdjacentHTML('beforeend', html);

    // Initialize lightbox AFTER modal is added
    initLightbox();
}

// Make openLightbox global so preview images can call it
function openLightbox(type, url) {
    const content = document.getElementById('lightboxContent');
    if (!content) return;

    content.innerHTML = '';

    if (type === 'image') {
        const img = document.createElement('img');
        img.src = url;
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.transition = 'transform 0.2s';
        img.style.cursor = 'grab';
        let scale = 1;

        img.onwheel = (e) => {
            e.preventDefault();
            scale += e.deltaY < 0 ? 0.1 : -0.1;
            scale = Math.max(0.1, scale);
            img.style.transform = `scale(${scale})`;
        };

        content.appendChild(img);
    } else if (type === 'pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = '100%';
        iframe.style.height = '80vh';
        content.appendChild(iframe);
    }

    const lightbox = document.getElementById('fileLightbox');
    if (!lightbox) return;
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
}

function initLightbox() {
    const lightbox = document.getElementById('fileLightbox');
    const lightboxInner = document.getElementById('lightboxInner');
    const lightboxCloseBtn = document.getElementById('lightboxClose');

    console.log('Lightbox initialized:', { lightbox, lightboxInner, lightboxCloseBtn });

    if (!lightbox || !lightboxInner || !lightboxCloseBtn) return;

    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    // Drag
    lightboxInner.addEventListener('mousedown', (e) => {
        if (
            e.target.id === 'lightboxContent' ||
            e.target.tagName === 'IMG' ||
            e.target.tagName === 'IFRAME' ||
            e.target.id === 'lightboxClose'
        ) return;

        isDragging = true;
        dragOffsetX = e.clientX - lightboxInner.offsetLeft;
        dragOffsetY = e.clientY - lightboxInner.offsetTop;
        lightboxInner.style.cursor = 'grabbing';
        lightboxInner.style.position = 'absolute';
        console.log('Dragging started', { dragOffsetX, dragOffsetY });
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            lightboxInner.style.left = `${e.clientX - dragOffsetX}px`;
            lightboxInner.style.top = `${e.clientY - dragOffsetY}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) console.log('Dragging stopped');
        isDragging = false;
        lightboxInner.style.cursor = 'grab';
    });

    // Close button
    lightboxCloseBtn.addEventListener('click', (e) => {
        console.log('Close button clicked');
        e.stopPropagation();
        lightbox.classList.add('hidden');
        lightbox.classList.remove('flex');
        const content = document.getElementById('lightboxContent');
        if (content) content.innerHTML = '';
        console.log('Lightbox closed');
    });

    // Click outside to close
    lightbox.addEventListener('click', (e) => {
        console.log('Lightbox background clicked', e.target);
        if (e.target === lightbox) {
            lightbox.classList.add('hidden');
            lightbox.classList.remove('flex');
            const content = document.getElementById('lightboxContent');
            if (content) content.innerHTML = '';
            console.log('Lightbox closed by background click');
        }
    });
}


/* ---------------- Lightbox Open & Zoom ---------------- */
function openLightbox(type, url) {
    const content = document.getElementById('lightboxContent');
    if (!content) return;

    content.innerHTML = '';

    if (type === 'image') {
        const img = document.createElement('img');
        img.src = url;
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.transition = 'transform 0.2s';
        img.style.cursor = 'grab';
        let scale = 1;

        img.onwheel = (e) => {
            e.preventDefault();
            scale += e.deltaY < 0 ? 0.1 : -0.1;
            scale = Math.max(0.1, scale);
            img.style.transform = `scale(${scale})`;
        };

        content.appendChild(img);
    } else if (type === 'pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = '100%';
        iframe.style.height = '80vh';
        content.appendChild(iframe);
    }

    const lightbox = document.getElementById('fileLightbox');
    if (!lightbox) return;
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
}
/* ---------------- Document Row & Preview ---------------- */
function addDocument(doc = {}) {
    const container = document.getElementById('documentsContainer');
    const newRow = document.createElement('div');
    newRow.className = "document-row border border-gray-200 rounded-2xl p-3 bg-gray-50 mb-3";

    newRow.innerHTML = `
        <div class="grid grid-cols-4 gap-3">
            <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Document Type</label>
                <select name="docType" class="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm">
                    <option value="">Select Type</option>
                    <option value="Medical License" ${doc.docType === 'Medical License' ? 'selected' : ''}>Medical License</option>
                    <option value="Government ID" ${doc.docType === 'Government ID' ? 'selected' : ''}>Government ID</option>
                    <option value="Resume" ${doc.docType === 'Resume' ? 'selected' : ''}>Resume</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Upload</label>
                <div class="flex items-center gap-2">
                    <input type="file" name="docFile" class="hidden" onchange="updateFileName(this)">
                    <input type="text" class="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" placeholder="Select a file" readonly>
                    <button type="button" onclick="this.previousElementSibling.previousElementSibling.click()" class="px-3 py-2 bg-gray-100 rounded-xl text-sm">Browse</button>
                </div>
                <div class="mt-2 document-preview"></div>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Expiry Date</label>
                <input type="date" name="docExpiry" class="w-full px-3 py-2 border border-gray-300 rounded-xl" value="${doc.expiryDate ? new Date(doc.expiryDate).toISOString().slice(0,10) : ''}">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Action</label>
                <button type="button" onclick="this.closest('.document-row').remove()" class="w-full px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 transition text-sm font-medium">
                    Remove
                </button>
            </div>
        </div>
    `;

    container.appendChild(newRow);

    if (doc.docFile) {
        const fileInput = newRow.querySelector('input[type="file"]');
        const textInput = newRow.querySelector('input[type="text"]');
        textInput.value = doc.docFile.split('/').pop();
        previewDocumentFromUrl(newRow.querySelector('.document-preview'), doc.docFile);
    }
}

// Called when user selects a file
function updateFileName(fileInput) {
    const textInput = fileInput.nextElementSibling;
    const preview = fileInput.closest('.document-row').querySelector('.document-preview');

    if (fileInput.files.length > 0) {
        textInput.value = fileInput.files[0].name;
        previewDocument(fileInput); // existing preview function
    } else {
        textInput.value = '';
        preview.innerHTML = '';
    }
}
function previewDocument(input) {
    const file = input.files[0];
    const previewContainer = input.closest('.document-row').querySelector('.document-preview');
    previewContainer.innerHTML = '';
    if (!file) return;

    const fileType = file.type;
    const fileURL = URL.createObjectURL(file);

    if (fileType.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = fileURL;
        img.style.maxWidth = '100px';
        img.style.maxHeight = '100px';
        img.classList.add('rounded', 'cursor-pointer');
        img.onclick = () => openLightbox('image', fileURL);
        previewContainer.appendChild(img);
    } else if (fileType === 'application/pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = fileURL;
        iframe.style.width = '100px';
        iframe.style.height = '100px';
        iframe.classList.add('cursor-pointer');
        iframe.onclick = () => openLightbox('pdf', fileURL);
        previewContainer.appendChild(iframe);
    } else {
        const span = document.createElement('span');
        span.textContent = file.name;
        span.classList.add('text-sm', 'text-gray-600', 'cursor-pointer');
        span.onclick = () => window.open(fileURL, '_blank');
        previewContainer.appendChild(span);
    }
}

function previewDocumentFromUrl(container, fileURL) {
    const fileName = fileURL.split('/').pop();
    const fileExt = fileName.split('.').pop().toLowerCase();

    if (['png','jpg','jpeg','gif','webp'].includes(fileExt)) {
        const img = document.createElement('img');
        img.src = fileURL;
        img.style.maxWidth = '100px';
        img.style.maxHeight = '100px';
        img.classList.add('rounded', 'cursor-pointer');
        img.onclick = () => openLightbox('image', fileURL);
        container.appendChild(img);
    } else if (fileExt === 'pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = fileURL;
        iframe.style.width = '100px';
        iframe.style.height = '100px';
        iframe.classList.add('cursor-pointer');
        iframe.onclick = () => openLightbox('pdf', fileURL);
        container.appendChild(iframe);
    } else {
        const span = document.createElement('span');
        span.textContent = fileName;
        span.classList.add('text-sm', 'text-gray-600', 'cursor-pointer');
        span.onclick = () => window.open(fileURL, '_blank');
        container.appendChild(span);
    }
}





/**
 * Removes a document row
 * @param {HTMLElement} btn - The clicked button element
 */
function removeDocument(btn) {
    const container = document.getElementById('documentsContainer');
    // Check if it's the last row – prevents deleting everything if you want at least one
    if (container.querySelectorAll('.document-row').length > 1) {
        btn.closest('.document-row').remove();
    } else {
        // Optional: Just clear the inputs if it's the last row
        const row = btn.closest('.document-row');
        row.querySelectorAll('input, select').forEach(el => el.value = '');
    }
}

// ============================================
// UTILITIES & SUBMISSION
// ============================================

function generateEmployeeID() {
    const year = new Date().getFullYear();
    const random = Math.floor(100 + Math.random() * 900); // Guarantees 3 digits
    return `CLN-${year}-${random}`;
}

let addAnotherMode = false;



async function submitAddEmployee() {
    const form = document.getElementById('addEmployeeForm');
    const submitBtn = document.getElementById('onboardBtn');
    const formData = new FormData(form); 

    const documentInputs = document.querySelectorAll('.doc-file-input');
    documentInputs.forEach(input => {
        if (input.files[0]) {
            formData.append('docFile', input.files[0]); 
        }
    });

    const email = document.getElementById('email').value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        alert("Invalid email address.");
        return;
    }

    const phoneRaw = document.getElementById('phone').value;
    const digits = phoneRaw.replace(/\D/g, '');

    if (!/^639\d{9}$/.test(digits)) {
        alert("Phone must be a valid PH number (e.g. +63 912 345 6789)");
        return;
    }

    if (addAnotherMode) {
        form.reset();
        const placeholder = document.getElementById('id-placeholder');
        const badgeContainer = document.getElementById('id-badge-container');
        const idProfileImg = document.getElementById('id-profile-pic');
        const qrContainer = document.getElementById('id-qr-preview');
        const uploadPreview = document.getElementById('imagePreview');
        const uploadPlaceholder = document.getElementById('uploadPlaceholder');

        if (badgeContainer) badgeContainer.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
        if (idProfileImg) idProfileImg.src = '/images/default-avatar.png';
        if (qrContainer) qrContainer.innerHTML = "";
        
        if (uploadPreview) {
            uploadPreview.src = "";
            uploadPreview.classList.add('hidden');
        }
        if (uploadPlaceholder) uploadPlaceholder.classList.remove('hidden');

        if (submitBtn) {
            submitBtn.innerHTML = `<i class="fas fa-check"></i> Complete Onboarding`;
        }

        addAnotherMode = false;
        if (typeof switchTab === 'function') switchTab('profile');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('has-error'));

    if (!form.checkValidity()) {
        const allInvalidFields = form.querySelectorAll(':invalid');
        allInvalidFields.forEach(field => {
            const tabPane = field.closest('.tab-content');
            if (tabPane) {
                const tabId = tabPane.id.replace('-tab', '');
                const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
                if (tabBtn) tabBtn.classList.add('has-error');
            }
        });

        const firstInvalid = allInvalidFields[0];
        const firstTabPane = firstInvalid.closest('.tab-content');
        if (firstTabPane) {
            const firstTabId = firstTabPane.id.replace('-tab', '');
            if (typeof switchTab === 'function') switchTab(firstTabId);
        }
        form.reportValidity(); 
        return;
    }

    const dobValue = document.getElementById('dob').value;
    if (!dobValue) {
        alert("Please select Date of Birth.");
        return;
    }

    const dob = new Date(dobValue);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }

    if (age < 18) {
        alert("Employee must be at least 18 years old.");
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
    }

    try {
        if (!formData.get('employeeID')) formData.delete('employeeID'); 
        formData.delete('qrEmployeeID');

        const isUpdate = formData.has('employeeID');
        const backendUrl = window.location.origin;
        const endpoint = `${backendUrl}/api/employees/onboard`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData 
        });

        const result = await response.json();

        if (result.success) {
            // --- 1. REFRESH THE EMPLOYEE LIST DATA ---
            if (typeof loadEmployees === 'function') {
                await loadEmployees(); 
            }

            // --- 2. UI UPDATES ---
            const firstName = formData.get('firstName') || '';
            const lastName = formData.get('lastName') || '';
            const suffix = formData.get('suffix') || '';
            const fullName = `${firstName} ${lastName} ${suffix}`.replace(/\s+/g, ' ').trim();

            const nameEl = document.getElementById('id-full-name');
            const posEl = document.getElementById('id-position');
            const deptEl = document.getElementById('id-department');
            const numEl = document.getElementById('id-employee-num');

            if (nameEl) nameEl.innerText = fullName;
            if (posEl) posEl.innerText = formData.get('position') || 'Staff Personnel';
            if (deptEl) deptEl.innerText = formData.get('department') || 'General Department';
            if (numEl) numEl.innerText = result.employeeId || result.data.employeeId;
            
            const qrContainer = document.getElementById('id-qr-preview');
            if (qrContainer) {
                qrContainer.innerHTML = `<img src="${result.qrCode}" class="w-40 h-40 mx-auto" alt="Employee QR">`;
            }

            const hireDateInput = formData.get('hireDate');
            const expiryDisplay = document.getElementById('id-expiry-date');
            if (hireDateInput && expiryDisplay) {
                const hireDate = new Date(hireDateInput);
                const expiryDate = new Date(hireDate.setFullYear(hireDate.getFullYear() + 1));
                const options = { year: 'numeric', month: 'long', day: 'numeric' };
                expiryDisplay.innerText = expiryDate.toLocaleDateString('en-US', options);
            }

            const emergencyName = document.getElementById('id-emergency-name');
            const emergencyRel = document.getElementById('id-emergency-rel');
            const emergencyNo = document.getElementById('id-emergency-no');

            if (emergencyName) emergencyName.innerText = formData.get('emergencyName') || 'N/A';
            if (emergencyRel) emergencyRel.innerText = formData.get('emergencyRelation') || 'N/A';
            if (emergencyNo) emergencyNo.innerText = formData.get('emergencyNo') || 'N/A';

            const profileFile = formData.get('profilePic');
            const idProfileImg = document.getElementById('id-profile-pic');
            if (profileFile && profileFile.size > 0) {
                const reader = new FileReader();
                reader.onload = (e) => { if (idProfileImg) idProfileImg.src = e.target.result; };
                reader.readAsDataURL(profileFile);
            }

            const role = (formData.get('role') || 'staff').toLowerCase();
            const headerBg = document.getElementById('id-header-bg');
            if (headerBg) {
                if (role.includes('doctor')) headerBg.style.backgroundColor = '#991B1B'; 
                else if (role.includes('nurse')) headerBg.style.backgroundColor = '#065F46'; 
                else if (role.includes('admin')) headerBg.style.backgroundColor = '#1E3A8A'; 
                else headerBg.style.backgroundColor = '#003D7A'; 
            }

            const placeholder = document.getElementById('id-placeholder');
            const badgeContainer = document.getElementById('id-badge-container');
            if (placeholder) placeholder.classList.add('hidden');
            if (badgeContainer) badgeContainer.classList.remove('hidden');

            if (typeof switchTab === 'function') switchTab('qr');
            
            alert(isUpdate ? "Employee Updated Successfully!" : "Employee Onboarded Successfully!");

            const notifTitle = isUpdate ? "Employee Updated" : "New Employee Onboarded";
            const notifMsg = isUpdate 
                ? `Information for ${fullName} has been updated.` 
                : `${fullName} has been added to the system.`;

            await triggerNotification(
                notifTitle,
                notifMsg,
                'SYSTEM',
                `/admin/employees.html#employee-${result.employeeId}`
            );

            addAnotherMode = true;
            if (submitBtn) {
                submitBtn.innerHTML = `<i class="fas fa-user-plus"></i> Add Another Employee`;
                submitBtn.disabled = false;
            }
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
        } else {
            alert("Onboarding Failed: " + (result.error || "Unknown Error"));
        }
    } catch (error) {
        console.error('Submission failed:', error);
        alert("Network error: Could not connect to the server.");
    } finally {
        if (submitBtn && !addAnotherMode) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fas fa-check"></i> Complete Onboarding`;
        }
    }
}







function addEmployeeToTable(employee) {

    const tableBody = document.querySelector("#employeesTable tbody");

    if (!tableBody) {
        console.warn("Employee table not found.");
        return;
    }

    const row = document.createElement("tr");

    row.innerHTML = `
        <td class="px-4 py-3 flex items-center gap-2">
            <img src="${employee.profilePic}" 
                 class="w-8 h-8 rounded-full object-cover">

            <div>
                <div class="font-semibold">${employee.fullName}</div>
                <div class="text-xs text-gray-500">${employee.email}</div>
            </div>
        </td>

        <td class="px-4 py-3">${employee.position || 'Staff'}</td>
        <td class="px-4 py-3">${employee.department || 'General'}</td>
        <td class="px-4 py-3">${employee.phone || 'N/A'}</td>
        <td class="px-4 py-3">${employee.employeeId}</td>
    `;

    tableBody.prepend(row);
}






// ============================================
// Generate and Download ID Badge as PNG
// ============================================
function downloadIDBadge() {
    const front = document.getElementById('printable-id-card');
    const back = document.getElementById('printable-id-back');
    const empId = document.getElementById('id-employee-num').innerText || 'ID';
    const empName = document.getElementById('id-full-name').innerText || 'Badge';

    document.body.style.cursor = 'wait';

    // Create an off-screen container
    const captureWrapper = document.createElement('div');
    // Removed 'width' from wrapper to let it expand to children
    captureWrapper.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    z-index: -1; /* Place it behind the main UI instead of miles away */
    background: #ffffff;
    padding: 0;
    display: block;
`;
    const fClone = front.cloneNode(true);
    const bClone = back.cloneNode(true);

    // Hard-lock clone dimensions to prevent internal slicing
    [fClone, bClone].forEach(clone => {
        clone.style.width = "3.375in";
        clone.style.height = "5.125in";
        clone.style.margin = "0";
        clone.style.display = "flex"; // Ensure layout stays flex
        clone.style.boxShadow = "none";
    });
    
    captureWrapper.appendChild(fClone);
    captureWrapper.appendChild(bClone);
    document.body.appendChild(captureWrapper);

    // Give the browser 500ms to render the clones/images properly
    setTimeout(() => {
        html2canvas(captureWrapper, {
            scale: 4, 
            useCORS: true,
            backgroundColor: "#ffffff",
            // Explicitly set capture area to match the two cards
            width: fClone.offsetWidth,
            height: (fClone.offsetHeight + bClone.offsetHeight),
            logging: false
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `ID_FULL_${empId}_${empName.replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL("image/png", 1.0);
            link.click();
            
            document.body.removeChild(captureWrapper);
            document.body.style.cursor = 'default';
        }).catch(err => {
            console.error("Save Error:", err);
            document.body.style.cursor = 'default';
        });
    }, 500); 
}
function printIDBadge() {
    // Force the browser to focus on the main container only
    const container = document.getElementById('id-badge-container');
    if (!container) return;

    window.print();
}
// ============================================
// GLOBAL EVENTS
// ============================================

// ============================================
// PHOTO UPLOAD HANDLING
// ============================================
document.getElementById('profilePhoto')?.addEventListener('change', function(e) {
    const preview = document.getElementById('imagePreview');
    const placeholder = document.getElementById('uploadPlaceholder');
    const file = e.target.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            preview.src = event.target.result;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
});

document.addEventListener('click', function(e) {
    if (e.target.closest('#photoUploadArea')) {
        document.getElementById('profilePhoto').click();
    }
});

document.addEventListener('change', function(e) {
    if (e.target.id === 'profilePhoto') {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const preview = document.getElementById('imagePreview');
                const placeholder = document.getElementById('uploadPlaceholder');
                preview.src = event.target.result;
                preview.classList.remove('hidden');
                placeholder.classList.add('hidden');
            }
            reader.readAsDataURL(file);
        }
    }
});

window.addEventListener('load', () => {
    // Pre-load the modal content so it's ready when clicked
    loadAddEmployeeModal();
});


function initializePhotoUpload() {
    const photoArea = document.getElementById('photoUploadArea');
    const photoInput = document.getElementById('profilePhoto');
    const imagePreview = document.getElementById('imagePreview');
    const placeholder = document.getElementById('uploadPlaceholder');

    if (!photoArea || !photoInput) return;

    // Trigger file dialog when clicking the box
    photoArea.onclick = () => photoInput.click();

    photoInput.onchange = function(e) {
        const file = e.target.files[0];
        
        if (file) {
            // 1. Validate File Type
            if (!file.type.startsWith('image/')) {
                alert("Please upload an image file.");
                return;
            }

            // 2. Validate File Size (e.g., max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert("Image is too large. Max size is 2MB.");
                return;
            }

            // 3. Create Preview
            const reader = new FileReader();
            reader.onload = function(event) {
                imagePreview.src = event.target.result;
                imagePreview.classList.remove('hidden');
                placeholder.classList.add('hidden');
                
                // Add a "success" border to the area
                photoArea.classList.remove('border-gray-300');
                photoArea.classList.add('border-green-500', 'border-solid');
            };
            reader.readAsDataURL(file);
        }
    };
}

function calculateAge(dob) {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();

    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }

    return age;
}

function setupDOBListener() {
    const dobInput = document.getElementById('dob');
    const ageDisplay = document.getElementById('ageDisplay');

    if (!dobInput || !ageDisplay) return;

    dobInput.addEventListener('change', () => {
        if (!dobInput.value) {
            ageDisplay.textContent = "Age: —";
            return;
        }

        const dob = new Date(dobInput.value);
        const age = calculateAge(dob);

        ageDisplay.textContent = `Age: ${age}`;

        // Optional: color warning if under 18
        if (age < 18) {
            ageDisplay.classList.remove('text-gray-500');
            ageDisplay.classList.add('text-red-500');
        } else {
            ageDisplay.classList.remove('text-red-500');
            ageDisplay.classList.add('text-gray-500');
        }
    });
}

function setDOBLimit() {
    const dobInput = document.getElementById('dob');
    if (!dobInput) return;

    const today = new Date();

    // Calculate max date = today - 18 years
    const maxDate = new Date(
        today.getFullYear() - 18,
        today.getMonth(),
        today.getDate()
    );

    // Format to YYYY-MM-DD
    const formattedMax = maxDate.toISOString().split('T')[0];

    // Apply max attribute
    dobInput.setAttribute('max', formattedMax);
}


function setupContactValidation() {
    const phoneInput = document.getElementById('phone');
    const phoneError = document.getElementById('phoneError');
    const phoneValidIcon = document.getElementById('phoneValidIcon');

    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');

    if (!phoneInput && !emailInput) return;

    // ----- PHONE VALIDATION & FORMAT -----
    if (phoneInput) {
        phoneInput.addEventListener('input', () => {
            let raw = phoneInput.value;

            // Remove all non-digits
            let digits = raw.replace(/\D/g, '');

            // Handle starting zero (09XXXXXXXXX -> 9123456789)
            if (digits.startsWith('0')) digits = digits.slice(1);

            // Force starting with country code 63
            if (!digits.startsWith('63')) digits = '63' + digits;

            // Limit to 12 digits (639XXXXXXXXX)
            digits = digits.slice(0, 12);

            // Format to +63 912 345 6789
            let formatted = '+63';
            if (digits.length > 2) formatted += ' ' + digits.slice(2, 5);
            if (digits.length > 5) formatted += ' ' + digits.slice(5, 8);
            if (digits.length > 8) formatted += ' ' + digits.slice(8, 12);

            phoneInput.value = formatted;

            // Validation
            const phonePattern = /^\+639\d{9}$/;
            const cleanValue = '+' + digits;

            if (digits.length === 0) {
                showError(phoneInput, phoneError, "Contact number is required.");
                if (phoneValidIcon) phoneValidIcon.classList.add('hidden');
            } else if (!phonePattern.test(cleanValue)) {
                showError(phoneInput, phoneError, "Use format: +63 9XX XXX XXXX");
                if (phoneValidIcon) phoneValidIcon.classList.add('hidden');
            } else {
                clearError(phoneInput, phoneError);
                if (phoneValidIcon) phoneValidIcon.classList.remove('hidden');
            }
        });
    }

    // ----- EMAIL VALIDATION -----
    if (emailInput) {
        emailInput.addEventListener('input', () => {
            const email = emailInput.value.trim();
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (email.length === 0) {
                showError(emailInput, emailError, "Email is required.");
            } else if (!emailPattern.test(email)) {
                showError(emailInput, emailError, "Invalid email address.");
            } else {
                clearError(emailInput, emailError);
            }
        });
    }
}

// 🔴 Show error
function showError(input, errorEl, message) {
    if (input && input.classList) {
        input.classList.add('border-red-500');
    }
    if (errorEl) {
        errorEl.textContent = message || '';
        if (errorEl.classList) {
            errorEl.classList.remove('hidden');
        }
    }
}

// ✅ Clear error
function clearError(input, errorEl) {
    if (input && input.classList) {
        input.classList.remove('border-red-500');
    }
    if (errorEl) {
        errorEl.textContent = "";
        if (errorEl.classList) {
            errorEl.classList.add('hidden');
        }
    }
}

function setupEmergencyValidation() {
    const emergencyInput = document.getElementById('emergency');
    const emergencyError = document.getElementById('emergencyError');
    const emergencyValidIcon = document.getElementById('emergencyValidIcon');

    if (!emergencyInput) return;

    emergencyInput.addEventListener('input', () => {
        let raw = emergencyInput.value;
        let digits = raw.replace(/\D/g, '');

        if (digits.startsWith('0')) digits = digits.slice(1);
        if (!digits.startsWith('63')) digits = '63' + digits;
        digits = digits.slice(0, 12);

        let formatted = '+63';
        if (digits.length > 2) formatted += ' ' + digits.slice(2, 5);
        if (digits.length > 5) formatted += ' ' + digits.slice(5, 8);
        if (digits.length > 8) formatted += ' ' + digits.slice(8, 12);

        emergencyInput.value = formatted;

        const phonePattern = /^\+639\d{9}$/;
        const cleanValue = '+' + digits;

        if (digits.length === 0) {
            showError(emergencyInput, emergencyError, "Emergency number is required.");
            if (emergencyValidIcon) emergencyValidIcon.classList.add('hidden');
        } else if (!phonePattern.test(cleanValue)) {
            showError(emergencyInput, emergencyError, "Use format: +63 9XX XXX XXXX");
            if (emergencyValidIcon) emergencyValidIcon.classList.add('hidden');
        } else {
            clearError(emergencyInput, emergencyError);
            if (emergencyValidIcon) emergencyValidIcon.classList.remove('hidden');
        }
    });
}